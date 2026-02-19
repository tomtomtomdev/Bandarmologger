const http = require('https');
const zlib = require('zlib');

const BASE_URL = 'https://exodus.stockbit.com';

const HEADERS = {
  'accept': '*/*',
  'user-agent': 'Stockbit/3.19.0 (stockbit.com.stockbit; build:39096; iOS 26.2.0) Alamofire/5.9.0',
  'x-devicetype': 'iPad (9th generation)',
  'accept-language': 'ID',
  'x-platform': 'iOS',
  'x-appversion': '3.19.0',
  'accept-encoding': 'gzip, deflate, br',
};

function getAuth() {
  return { 'authorization': `Bearer ${process.env.STOCKBIT_TOKEN}` };
}

function apiFetch(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { ...HEADERS, ...getAuth() },
    };

    const req = http.request(opts, (res) => {
      let stream = res;
      const encoding = res.headers['content-encoding'];

      // Decompress based on content-encoding
      if (encoding === 'gzip' || encoding === 'x-gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', (err) => reject(new Error(`Decompress error on ${path}: ${err.message}`)));
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`API ${res.statusCode}: ${path} - ${body.slice(0, 200)}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`JSON parse error on ${path}: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Request error on ${path}: ${err.message}`)));
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout on ${path}`)); });
    req.end();
  });
}

// Screener
async function getScreenerPresets() {
  return apiFetch('/screener/preset?mobile=1');
}

async function getScreenerPresetChildren(parentId) {
  return apiFetch(`/screener/preset?mobile=1&parent_id=${parentId}`);
}

async function getScreenerTemplate(templateId, limit = 25) {
  return apiFetch(`/screener/templates/${templateId}?limit=${limit}&type=TEMPLATE_TYPE_GURU`);
}

async function getScreenerFavorites() {
  return apiFetch('/screener/favorites');
}

// Company
async function getCompanyInfo(symbol) {
  return apiFetch(`/emitten/${symbol}/info`);
}

async function getKeyStats(symbol) {
  return apiFetch(`/keystats/ratio/v1/${symbol}?year_limit=10`);
}

async function getPricePerformance(symbol) {
  return apiFetch(`/company-price-feed/price-performance/${symbol}`);
}

// Bandar / Money Flow
async function getForeignDomesticFlow(symbol, period = 'PERIOD_RANGE_1D') {
  return apiFetch(`/findata-view/foreign-domestic/v1/chart-data/${symbol}?market_type=MARKET_TYPE_REGULAR&period=${period}`);
}

async function getRunningTradeChart(symbol) {
  return apiFetch(`/order-trade/running-trade/chart/${symbol}?investor_type=INVESTOR_TYPE_ALL&market_board=BOARD_TYPE_REGULAR`);
}

async function getTradeBook(symbol) {
  return apiFetch(`/order-trade/trade-book/chart?symbol=${symbol}&time_interval=1m`);
}

// Market
async function getMarketMovers(type, limit = 10) {
  const moverType = `MOVER_TYPE_TOP_${type.toUpperCase()}`;
  const boards = [
    'FILTER_STOCKS_TYPE_MAIN_BOARD',
    'FILTER_STOCKS_TYPE_DEVELOPMENT_BOARD',
    'FILTER_STOCKS_TYPE_ACCELERATION_BOARD',
    'FILTER_STOCKS_TYPE_NEW_ECONOMY_BOARD',
  ].map(b => `filter_stocks=${b}`).join('&');
  return apiFetch(`/order-trade/market-mover?${boards}&limit=${limit}&mover_type=${moverType}`);
}

async function getMarketDetectors(symbol) {
  return apiFetch(`/marketdetectors/${symbol}?limit=25`);
}

// Financials
async function getFinancials(symbol, reportType = 1) {
  return apiFetch(`/findata-view/v2/financials/${symbol}?data_type=1&is_percentage=0&page=1&report_type=${reportType}&statement_type=2`);
}

async function getFundaChart(symbol, dataType = 1) {
  return apiFetch(`/fundachart/v2/${symbol}/financials?data_type=${dataType}&report=2`);
}

// Research
async function getResearchIndicator(symbol) {
  return apiFetch(`/research/indicator/new?symbol=${symbol}`);
}

// Trending
async function getTrending() {
  return apiFetch('/emitten/trending');
}

module.exports = {
  getScreenerPresets,
  getScreenerPresetChildren,
  getScreenerTemplate,
  getScreenerFavorites,
  getCompanyInfo,
  getKeyStats,
  getPricePerformance,
  getForeignDomesticFlow,
  getRunningTradeChart,
  getTradeBook,
  getMarketMovers,
  getMarketDetectors,
  getFinancials,
  getFundaChart,
  getResearchIndicator,
  getTrending,
};
