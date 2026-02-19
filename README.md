# Bandarmologger

Stock screener dashboard for IDX (Indonesia Stock Exchange) powered by Stockbit API. Focuses on **Valuation**, **Fundamental**, and **Bandarmology** (big money flow) screeners to surface today's best stock picks.

## Features

- **Best Picks** — Stocks appearing across multiple screener categories (Valuation + Fundamental + Bandarmology), ranked by cross-category score
- **6 Screener Categories** — Valuation, Fundamental, Technical, Bandarmology, Dividend, Popular — each with multiple guru templates
- **Screener Detail** — Full stock list per template with all calculated columns (Bandar Value, P/E, PBV, ROE, etc.)
- **Stock Detail** — Key statistics, price performance, foreign vs domestic flow, research indicators
- **Market Movers** — Top Gainer, Loser, Value, Volume
- **Auto-Refresh** — Every 15 minutes during IDX trading hours (Mon-Fri 09:00-15:15 WIB), daily on non-trading days
- **Token Management** — In-app UI to paste and save Stockbit Bearer token

## Quick Start

```bash
./start.sh
```

This installs dependencies and starts the server. Open [http://localhost:3456](http://localhost:3456).

## Setup

### Prerequisites

- Node.js 18+

### Installation

```bash
git clone <repo-url> && cd Bandarmologger
npm install
```

### Configuration

Copy or edit `.env`:

```
STOCKBIT_TOKEN=your_bearer_token_here
PORT=3456
```

### Getting a Stockbit Token

1. Open the Stockbit app (iOS/Android) or web
2. Use a proxy tool (ProxSeer, Charles, mitmproxy) to capture any API request to `exodus.stockbit.com`
3. Copy the `Authorization: Bearer eyJ...` value
4. Paste it in the `.env` file or use the in-app settings (gear icon)

Tokens expire after ~24 hours. When expired, the dashboard will show a token input banner automatically.

### Run

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

## Architecture

```
Bandarmologger/
├── start.sh              # 1-step install & run
├── .env                  # Token + port config
├── package.json
├── server/
│   ├── index.js          # Express server, API routes, token management
│   ├── api.js            # Stockbit API client (gzip/br decompression)
│   └── scheduler.js      # Cron-based data refresh scheduler
└── public/
    └── index.html        # Single-page dashboard
```

### Backend

- **Express** serves the static frontend and proxies API calls to `exodus.stockbit.com`
- **API client** handles gzip/deflate/brotli decompression using Node.js `https` + `zlib`
- **Scheduler** uses `node-cron` to refresh data:
  - Every 15 min during trading hours (Mon-Fri 09:00-15:15 WIB)
  - Daily at 07:00 WIB on trading days (pre-market)
  - Daily at 08:00 WIB on weekends

### Frontend

- Vanilla JS single-page app with dark theme
- No build step, no framework dependencies
- Auto-refreshes from cached backend data

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/dashboard` | All cached data (presets, screeners, best picks, market movers) |
| `GET /api/screener/presets` | Screener categories |
| `GET /api/screener/presets/:parentId` | Screener templates within a category |
| `GET /api/screener/templates/:id` | Stock results for a screener template |
| `GET /api/company/:symbol/info` | Company info |
| `GET /api/company/:symbol/keystats` | Key financial ratios (P/E, PBV, ROE, etc.) |
| `GET /api/company/:symbol/price-performance` | Price performance across timeframes |
| `GET /api/company/:symbol/foreign-flow` | Foreign vs domestic money flow |
| `GET /api/company/:symbol/running-trade` | Running trade chart (bandar flow) |
| `GET /api/company/:symbol/detectors` | Market detectors |
| `GET /api/company/:symbol/financials` | Financial statements |
| `GET /api/company/:symbol/indicator` | Research indicator signals |
| `GET /api/market-movers/:type` | Market movers (gainer, loser, value, volume) |
| `GET /api/trending` | Trending stocks |
| `GET /api/status` | Scheduler status |
| `POST /api/refresh` | Force data refresh |
| `GET /api/token` | Check token status |
| `POST /api/token` | Save new token and trigger refresh |

## Screener Categories

| ID | Name | Description |
|---|---|---|
| 28 | Valuation | PE Below Mean, PBV Undervalued, PS Undervalued, Low P/E, Forward PE, Low PBV, Cheap Big/Mid/Small Caps |
| 31 | Fundamental | Growth at Reasonable Price, High ROE, Revenue Growth, etc. |
| 32 | Bandarmology | Foreign Flow Uptrend, 1M Net Foreign Flow, Big Accumulation, Bandar Accumulation Uptrend, Frequency Spike, Insider Net Buy |
| 29 | Technical | Various technical analysis screeners |
| 30 | Dividend | Dividend-focused screeners |
| 27 | Popular | Community favorites |

## Best Picks Algorithm

Stocks are scored by how many screener templates they appear in across Valuation (28), Fundamental (31), and Bandarmology (32) categories. Sorted by:

1. Number of distinct categories (stocks in all 3 rank highest)
2. Total screener appearances

This surfaces stocks that are simultaneously cheap (valuation), fundamentally strong, and being accumulated by big money.
