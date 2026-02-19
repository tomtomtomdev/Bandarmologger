const cron = require('node-cron');
const api = require('./api');

// IDX trading hours: Mon-Fri, 09:00-15:00 WIB (UTC+7 = 02:00-08:00 UTC)
// Quarter-hourly = every 15 min during trading hours
// Daily = once at 07:00 WIB (00:00 UTC) on non-trading days

let cache = {
  presets: null,
  screeners: {},       // { parentId: { children, templates: { id: data } } }
  bestPicks: [],
  trending: null,
  lastRefresh: null,
  refreshing: false,
  tokenExpired: false,
  errors: [],
};

function isTradingDay() {
  const now = new Date();
  // Convert to WIB (UTC+7)
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay();
  return day >= 1 && day <= 5; // Mon-Fri
}

function isTradingHours() {
  if (!isTradingDay()) return false;
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const hour = wib.getUTCHours();
  const min = wib.getUTCMinutes();
  const timeMin = hour * 60 + min;
  return timeMin >= 8 * 60 + 45 && timeMin <= 15 * 60 + 15; // 08:45 - 15:15 WIB (buffer)
}

// Screener categories from API:
// 26=Guru, 27=Popular, 28=Valuation, 29=Technical, 30=Dividend, 31=Fundamental, 32=Bandarmology, 33=Overview
const SCREENER_CATEGORIES = [
  { id: 28, name: 'Valuation' },
  { id: 31, name: 'Fundamental' },
  { id: 29, name: 'Technical' },
  { id: 32, name: 'Bandarmology' },
  { id: 30, name: 'Dividend' },
  { id: 27, name: 'Popular' },
];

async function fetchSafe(fn, label) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[Scheduler] Error fetching ${label}:`, e.message);
    if (e.message.includes('401')) {
      cache.tokenExpired = true;
    }
    cache.errors.push({ label, message: e.message, time: new Date().toISOString() });
    return null;
  }
}

async function refresh() {
  if (cache.refreshing) return;
  cache.refreshing = true;
  cache.tokenExpired = false;
  cache.errors = [];
  console.log(`[Scheduler] Refreshing data at ${new Date().toISOString()}`);

  try {
    // 1. Fetch screener presets
    const presets = await fetchSafe(() => api.getScreenerPresets(), 'presets');
    if (presets) cache.presets = presets;

    // 2. Fetch each category's children and their template results
    for (const cat of SCREENER_CATEGORIES) {
      const children = await fetchSafe(() => api.getScreenerPresetChildren(cat.id), `preset-${cat.id}`);
      if (!children) continue;

      const templates = {};
      const childList = children?.data?.children || children?.data || [];
      const items = Array.isArray(childList) ? childList : [];

      for (const child of items.slice(0, 10)) {
        const tid = child.id || child.template_id;
        if (!tid) continue;
        const tpl = await fetchSafe(() => api.getScreenerTemplate(tid, 25), `template-${tid}`);
        if (tpl) templates[tid] = tpl;
      }

      cache.screeners[cat.id] = { category: cat, children, templates };
    }

    // 3. Trending
    const trending = await fetchSafe(() => api.getTrending(), 'trending');
    if (trending) cache.trending = trending;

    // 4. Compute best picks from screener results
    computeBestPicks();

    cache.lastRefresh = new Date().toISOString();
    console.log(`[Scheduler] Refresh complete at ${cache.lastRefresh}`);
  } catch (e) {
    console.error('[Scheduler] Refresh failed:', e.message);
  } finally {
    cache.refreshing = false;
  }
}

function extractStocksFromTemplate(tpl) {
  // API returns data.calcs[] with company.symbol structure
  const calcs = tpl?.data?.calcs || tpl?.data?.stocks || [];
  if (Array.isArray(calcs)) {
    return calcs.map(c => {
      if (c.company) {
        // calcs format: { company: { symbol, name, ... }, results: [...] }
        return {
          symbol: c.company.symbol,
          name: c.company.name,
          icon_url: c.company.icon_url,
          results: c.results || [],
        };
      }
      // flat format
      return {
        symbol: c.symbol || c.company_symbol || c.code,
        name: c.name || c.company_name || '',
        results: [],
      };
    }).filter(s => s.symbol);
  }
  return [];
}

function computeBestPicks() {
  // Aggregate stocks appearing across all screener categories
  const stockScores = {};

  for (const catId of SCREENER_CATEGORIES.map(c => c.id)) {
    const cat = cache.screeners[catId];
    if (!cat) continue;

    for (const [, tpl] of Object.entries(cat.templates)) {
      const stocks = extractStocksFromTemplate(tpl);
      for (const stock of stocks) {
        if (!stockScores[stock.symbol]) {
          stockScores[stock.symbol] = { symbol: stock.symbol, name: stock.name, score: 0, categories: [], screeners: [], icon_url: stock.icon_url, data: stock };
        }
        stockScores[stock.symbol].score += 1;
        const catName = SCREENER_CATEGORIES.find(c => c.id === catId)?.name || '';
        if (!stockScores[stock.symbol].categories.includes(catName)) {
          stockScores[stock.symbol].categories.push(catName);
        }
        const screenName = tpl?.data?.screen_name || '';
        if (screenName && !stockScores[stock.symbol].screeners.includes(screenName)) {
          stockScores[stock.symbol].screeners.push(screenName);
        }
      }
    }
  }

  // Prioritize stocks appearing in multiple categories, then by score
  cache.bestPicks = Object.values(stockScores)
    .sort((a, b) => {
      if (b.categories.length !== a.categories.length) return b.categories.length - a.categories.length;
      return b.score - a.score;
    })
    .slice(0, 30);
}

function getCachedData() {
  return {
    presets: cache.presets,
    screeners: cache.screeners,
    bestPicks: cache.bestPicks,
    trending: cache.trending,
    lastRefresh: cache.lastRefresh,
    isTradingDay: isTradingDay(),
    isTradingHours: isTradingHours(),
    categories: SCREENER_CATEGORIES,
    tokenExpired: cache.tokenExpired,
    errors: cache.errors.slice(-5),
  };
}

function getStatus() {
  return {
    lastRefresh: cache.lastRefresh,
    refreshing: cache.refreshing,
    isTradingDay: isTradingDay(),
    isTradingHours: isTradingHours(),
    cachedCategories: Object.keys(cache.screeners).length,
    bestPicksCount: cache.bestPicks.length,
    tokenExpired: cache.tokenExpired,
  };
}

function start() {
  // Initial fetch
  console.log('[Scheduler] Starting initial data fetch...');
  refresh();

  // Quarter-hourly during trading hours (Mon-Fri, every 15 min)
  cron.schedule('*/15 9-15 * * 1-5', () => {
    // WIB trading hours check
    if (isTradingHours()) {
      console.log('[Scheduler] Trading hours refresh');
      refresh();
    }
  }, { timezone: 'Asia/Jakarta' });

  // Daily refresh at 07:00 WIB for non-trading or pre-market
  cron.schedule('0 7 * * *', () => {
    console.log('[Scheduler] Daily refresh');
    refresh();
  }, { timezone: 'Asia/Jakarta' });

  // Weekend/holiday: daily at 08:00 WIB
  cron.schedule('0 8 * * 0,6', () => {
    console.log('[Scheduler] Weekend refresh');
    refresh();
  }, { timezone: 'Asia/Jakarta' });

  console.log('[Scheduler] Cron jobs registered (15-min trading, daily non-trading)');
}

module.exports = { start, refresh, getCachedData, getStatus };
