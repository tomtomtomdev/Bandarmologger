require('dotenv').config();
const express = require('express');
const path = require('path');
const api = require('./api');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// --- API Routes ---

// Screener presets (categories)
app.get('/api/screener/presets', async (req, res) => {
  try {
    const data = await api.getScreenerPresets();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Screener preset children by parent_id
app.get('/api/screener/presets/:parentId', async (req, res) => {
  try {
    const data = await api.getScreenerPresetChildren(req.params.parentId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Screener template results (stock list)
app.get('/api/screener/templates/:id', async (req, res) => {
  try {
    const limit = req.query.limit || 25;
    const data = await api.getScreenerTemplate(req.params.id, limit);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Company info
app.get('/api/company/:symbol/info', async (req, res) => {
  try {
    const data = await api.getCompanyInfo(req.params.symbol);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Key stats
app.get('/api/company/:symbol/keystats', async (req, res) => {
  try {
    const data = await api.getKeyStats(req.params.symbol);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Price performance
app.get('/api/company/:symbol/price-performance', async (req, res) => {
  try {
    const data = await api.getPricePerformance(req.params.symbol);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Foreign-domestic flow
app.get('/api/company/:symbol/foreign-flow', async (req, res) => {
  try {
    const period = req.query.period || 'PERIOD_RANGE_1D';
    const data = await api.getForeignDomesticFlow(req.params.symbol, period);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Running trade chart (bandar flow)
app.get('/api/company/:symbol/running-trade', async (req, res) => {
  try {
    const data = await api.getRunningTradeChart(req.params.symbol);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Market movers
app.get('/api/market-movers/:type', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const data = await api.getMarketMovers(req.params.type, limit);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Market detectors
app.get('/api/company/:symbol/detectors', async (req, res) => {
  try {
    const data = await api.getMarketDetectors(req.params.symbol);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Financials
app.get('/api/company/:symbol/financials', async (req, res) => {
  try {
    const reportType = req.query.report_type || 1;
    const data = await api.getFinancials(req.params.symbol, reportType);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Research indicator
app.get('/api/company/:symbol/indicator', async (req, res) => {
  try {
    const data = await api.getResearchIndicator(req.params.symbol);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Trending
app.get('/api/trending', async (req, res) => {
  try {
    const data = await api.getTrending();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cached dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const data = scheduler.getCachedData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Force refresh
app.post('/api/refresh', async (req, res) => {
  try {
    await scheduler.refresh();
    res.json({ ok: true, data: scheduler.getCachedData() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Scheduler status
app.get('/api/status', (req, res) => {
  res.json(scheduler.getStatus());
});

// Token management
app.get('/api/token', (req, res) => {
  const token = process.env.STOCKBIT_TOKEN || '';
  res.json({ hasToken: !!token, tokenPreview: token ? token.slice(-20) : '' });
});

app.post('/api/token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  process.env.STOCKBIT_TOKEN = token;
  // Also persist to .env
  const fs = require('fs');
  const envPath = require('path').join(__dirname, '..', '.env');
  const envContent = `STOCKBIT_TOKEN=${token}\nPORT=${process.env.PORT || 3456}\n`;
  fs.writeFileSync(envPath, envContent);
  // Trigger refresh with new token
  await scheduler.refresh();
  res.json({ ok: true, data: scheduler.getCachedData() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Bandarmologger running at http://localhost:${PORT}`);
  scheduler.start();
});
