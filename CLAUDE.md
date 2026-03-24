# Stock-Analyser — Swing Trading Screener

## Stack

### Backend (`swing-screener/`)
- **Runtime**: Node.js with TypeScript (`ts-node` for dev, `tsc` for build)
- **Framework**: Express 4 with `helmet`, `cors`, `compression`, `express-rate-limit`
- **Language**: TypeScript (strict mode, ES2020 target, CommonJS modules)
- **Database**: PostgreSQL via `pg` (connection pool), hosted on Neon
- **Scheduler**: `node-cron` (9 AM IST weekdays, Asia/Kolkata timezone)
- **Notifications**: `nodemailer` (SMTP/Gmail), Telegram flag in config
- **Technical Analysis**: `technicalindicators` (EMA calculations)

### Frontend (`swing-screener/client/`)
- **Framework**: React 19 + Vite 7
- **UI Library**: Material UI v7 (`@mui/material`, `@mui/icons-material`, `@mui/x-data-grid`)
- **Charts**: Chart.js + `react-chartjs-2`
- **Routing**: React Router DOM v7
- **HTTP Client**: Axios (baseURL `/api/`, 5-minute timeout for scans)
- **Proxy**: Vite proxies `/api/*` → `http://localhost:4000`

### External APIs & Data Sources
- **Yahoo Finance**: `yahoo-finance2` library + raw fetch (Puppeteer-obtained cookies/crumb for bypassing blocks)
- **NSE India**: `stock-nse-india` package
- **Chartink**: Puppeteer scraping for stock candidate lists
- **AI Providers** (with automatic fallback chain):
  - **Google Gemini** (`@google/generative-ai`, model: `gemini-2.0-flash-exp`)
  - **Groq** (`groq-sdk`, model: `llama-3.3-70b-versatile`)
  - **OpenRouter** (raw fetch, model: `meta-llama/llama-3.3-70b-instruct:free`)

---

## Key Commands

All commands run from `swing-screener/` unless noted.

```bash
# Backend
npm run dev           # nodemon + ts-node main.ts (port 4000)
npm run start         # ts-node main.ts (no hot reload)
npm run build         # tsc → dist/

# Frontend (from swing-screener/)
npm run dev:client    # cd client && vite (port 5173)

# Both together
npm run dev:full      # concurrently: backend + frontend
./start.sh            # cleans ports 4000/5173 then runs dev:full

# Database
npm run db:setup      # psql -d stock_analysis -f database/schema.sql
npm run db:migrate    # same as db:setup

# Scripts
ts-node scripts/run-migration.ts    # run DB migration
ts-node scripts/test-ai-layers.ts   # test AI layer pipeline
```

### Ports
| Service  | Port |
|----------|------|
| Backend API | 4000 |
| Frontend (Vite) | 5173 |

---

## Project Structure

```
Stock-Analyser/
├── CLAUDE.md
├── package.json                    # root: only @anthropic-ai/claude-code devDep
└── swing-screener/                 # main project
    ├── main.ts                     # entry point — creates App, calls initialize() + start()
    ├── start.sh                    # kills port conflicts, runs dev:full
    ├── tsconfig.json               # strict TS, path alias @/* → ./src/*
    ├── .env / .env.example         # environment config (see Env Vars section)
    ├── tradingview/
    │   └── 4_rule_swing_strategy.pine   # Pine Script for TradingView
    ├── database/
    │   ├── schema.sql              # full DB schema (all tables)
    │   └── ai_layers_migration.sql # AI layer tables migration
    ├── scripts/
    │   ├── run-migration.ts        # applies migration
    │   └── test-ai-layers.ts       # integration test for AI pipeline
    ├── src/
    │   ├── app.ts                  # App class — wires DI, middleware, routes
    │   ├── config/index.ts         # createConfig() — reads all env vars
    │   ├── database/
    │   │   └── connection.ts       # createDatabaseConnection(config) → Pool
    │   ├── types/
    │   │   ├── index.ts            # OHLCVBar, ScanResult, AppConfig, AppError, etc.
    │   │   ├── analysis.ts         # 4-rule types: DailyBar, AnalysisOutput, ConsolidationResult, etc.
    │   │   ├── ai.ts               # AILayerType, AIAnalysisInput/Output, ObservationQueueEntry, etc.
    │   │   ├── api.ts              # ApiResponse, PaginatedResponse, ErrorResponse, etc.
    │   │   └── database.ts         # DatabaseQueryResult, QueryOptions
    │   ├── utils/
    │   │   └── logger-enhanced.ts  # Logger class (context-aware, LOG_LEVEL env)
    │   ├── repositories/
    │   │   ├── BaseRepository.ts   # extends BaseService; query(), transaction(), buildInsertQuery(), etc.
    │   │   ├── StockRepository.ts  # all stock/scan DB operations
    │   │   ├── PortfolioRepository.ts
    │   │   └── AIRepository.ts     # AI results, observation queue, rate limit state
    │   ├── services/
    │   │   ├── BaseService.ts      # handleError(), executeWithRetry(), validateRequired(), sanitizeInput()
    │   │   ├── ScanService.ts      # orchestrates full scan pipeline; main scan entry point
    │   │   ├── StockAnalysisService.ts  # 4-rule strategy engine (see Strategy section)
    │   │   ├── ScraperService.ts   # Chartink + NSE scraping via Puppeteer
    │   │   ├── MarketDataService.ts     # Yahoo Finance data fetching
    │   │   ├── YahooBrowserService.ts   # Puppeteer-based Yahoo session management
    │   │   ├── YahooSessionService.ts   # cookie/crumb extraction for Yahoo API
    │   │   ├── TargetStoplossService.ts # computes target prices and stop losses
    │   │   ├── NotificationService.ts   # email via nodemailer
    │   │   ├── AILayerOrchestrator.ts   # AI pipeline: Gemini → Groq → OpenRouter fallback
    │   │   ├── AIAnalysisService.ts     # Gemini integration
    │   │   ├── GroqAnalysisService.ts   # Groq integration
    │   │   ├── OpenRouterAnalysisService.ts  # OpenRouter integration
    │   │   └── AIRateLimitService.ts    # DB-backed per-provider rate limit tracking
    │   ├── controllers/
    │   │   ├── BaseController.ts   # success(), error(), handleAsync(), getPaginationParams()
    │   │   ├── ScanController.ts   # scan endpoints
    │   │   ├── PortfolioController.ts
    │   │   └── HealthController.ts
    │   └── routes/index.ts         # createRoutes() — mounts all routes under /api
    └── client/
        ├── vite.config.js          # React plugin + /api proxy to :4000
        ├── src/
        │   ├── main.tsx            # React entry
        │   ├── App.tsx             # BrowserRouter + all routes
        │   ├── api.tsx             # axios instance + fetchData, fetchObservationQueue, processObservation
        │   ├── theme.ts            # MUI theme customization
        │   ├── index.css           # global styles
        │   ├── pages/
        │   │   ├── Home.tsx            # manual scan trigger UI
        │   │   └── ObservationQueue.tsx # AI observation queue review UI
        │   └── components/
        │       ├── Dashboard.tsx       # metrics overview
        │       ├── Navigation.tsx      # sidebar/navbar
        │       ├── ScannedStocks.tsx
        │       ├── SelectedStocks.tsx
        │       ├── RejectedStocks.tsx
        │       └── Summary.tsx
```

---

## Application Architecture

### Layered Architecture (Backend)

```
HTTP Request
    ↓
routes/index.ts        (createRoutes — mounts controllers)
    ↓
controllers/           (extends BaseController → BaseService)
    ↓
services/              (extends BaseService; business logic)
    ↓
repositories/          (extends BaseRepository → BaseService; all DB access)
    ↓
PostgreSQL Pool (pg)
```

- **All classes** inherit from `BaseService` or `BaseRepository` (which extends `BaseService`)
- Services are instantiated in `App.setupServices()` and stored in `app.locals.services`
- Repositories are stored in `app.locals.repositories`
- Controllers receive services via constructor injection

### Startup Sequence (`main.ts`)
```
new App()
  → setupDatabase()    // test pool connection
  → setupMiddleware()  // helmet, cors, rate limiting, compression, body parsing
  → setupServices()    // instantiate repos, services, ScanService
  → setupRoutes()      // mount /api routes, serve client/dist
  → setupErrorHandling()
  → start()            // app.listen(4000)
```

---

## 4-Rule Swing Trading Strategy (`StockAnalysisService.ts`)

The core strategy runs in `analyzeStock(input)`. All four rules execute sequentially; failure at any rule short-circuits the rest.

### Rules

| # | Rule | Pass Condition |
|---|------|----------------|
| 1 | **Consolidation Phase** | Zones (consecutive closes < 10 EMA) exist AND current price is < 30% above base (min zone low) |
| 2 | **Higher Low Structure** | Latest zone low ≥ previous zone low; fail if price < EMA AND price < latest zone low |
| 3 | **Volume Pump** | Within last 20 bars, at least one bar has volume ≥ 1.8× its own preceding 20-bar average |
| 4 | **Bear Squeeze Candle** | Today's candle: lower wick / total range ≥ 40% |

### Strategy Constants
```typescript
CONSOLIDATION_WINDOW   = 60   // bars lookback
CONSOLIDATION_THRESHOLD= 30   // max % gain above base
EMA_PERIOD             = 10
VOLUME_WINDOW          = 20
VOLUME_MULTIPLIER      = 1.8
BEAR_SQUEEZE_THRESHOLD = 40   // wick % threshold
```

### Rule Filter Return Shape
Each rule check returns:
```typescript
{ pass: boolean, status: string, reason: string, ...ruleSpecificFields }
```

### Score & Grade
- Score = number of rules passed (0–4)
- Grade: A (4), B (3), C (2), D (1), F (0)
- Recommendation: `'buy'` | `'watch'` | `'avoid'`

---

## AI Layer Pipeline (`AILayerOrchestrator.ts`)

After the 4-rule code analysis, stocks flow through a two-layer AI review:

```
Code Result
    │
    ├─ rejected → Layer 1 (rejection_review)
    │                AI PASSES → Observation Queue
    │                AI REJECTS → Final rejected
    │
    └─ selected → Layer 2 (selection_validation)
                     AI PASSES → Final selected
                     AI FAILS  → Observation Queue
```

### Provider Fallback Chain
```
Gemini → Groq → OpenRouter → failure (code-only result kept)
```
- Rate limit state is **DB-backed** (`ai_rate_limits` table) — persists across restarts
- On 429, the provider is blocked for the retry-after window and the next provider is tried
- Rate limiting is tracked in `AIRateLimitService` / `AIRepository`

### AI Decision Types
```typescript
type AILayerType  = 'rejection_review' | 'selection_validation'
type AIDecision   = 'passed' | 'rejected' | 'uncertain'
type FinalStatus  = 'selected' | 'observation' | 'rejected'
```

---

## Database Schema

Database name: `stock_analysis`. All queries go through `BaseRepository.query()` — **never raw SQL outside `src/repositories/`**.

### Tables

| Table | Purpose |
|-------|---------|
| `stocks` | Core stock record per scan (symbol, name, qualified, score, analysis details) |
| `scans` | Scan run metadata (start/end time, counts) |
| `stock_metadata` | Additional stock info (sector, market cap, etc.) |
| `stock_daily_bars` | OHLCV daily bar storage |
| `stock_zones` | Detected consolidation zones per stock |
| `stock_analysis` | Detailed rule-by-rule analysis results |
| `stock_performance` | Post-scan performance tracking |
| `selected_stocks` | Stocks that passed all rules + AI validation |
| `portfolio_positions` | Active/closed portfolio positions |
| `ai_analysis_config` | AI provider config and prompt templates |
| `ai_analysis_results` | Per-stock AI analysis results |
| `ai_analysis_history` | Historical AI decisions |
| `ai_rate_limits` | DB-backed rate limit state per provider |
| `ai_api_logs` | Full request/response logs for every AI API call |
| `observation_queue` | Stocks flagged for manual human review |

---

## API Routes (all under `/api`)

| Method | Endpoint | Controller | Description |
|--------|----------|------------|-------------|
| GET | `/health` | HealthController | Health check |
| GET | `/status` | ScanController | Scan running status |
| POST | `/start-scan` | ScanController | Trigger manual scan |
| GET | `/scan-results` | ScanController | Latest scan results |
| GET | `/stocks` | ScanController | Stocks from latest scan |
| GET | `/selected` | ScanController | Selected stocks (paginated) |
| GET | `/rejected` | ScanController | Rejected stocks (paginated) |
| GET | `/scan-history` | ScanController | Historical scan list |
| GET | `/statistics` | ScanController | Analysis statistics |
| POST | `/analyze-stock` | ScanController | Analyze a single stock |
| GET | `/quote/:symbol` | ScanController | Live quote for symbol |
| GET | `/logs` | ScanController | Recent log lines |
| POST | `/run-selected-scan` | ScanController | Performance backtest scan |
| GET | `/observations` | ScanController | AI observation queue |
| POST | `/observations/:id/decision` | ScanController | Approve/reject observation |
| GET | `/ai-stats` | ScanController | AI provider statistics |
| GET | `/portfolio` | PortfolioController | Portfolio positions |
| GET | `/performance` | PortfolioController | Performance metrics |

### API Response Envelope
```typescript
// Success
{ success: true, data: T, message?: string, timestamp: string }

// Error
{ success: false, error: string, code?: string, timestamp: string }

// Paginated
{ success: true, data: T[], timestamp: string, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
```

---

## Frontend Routes

| URL Path | Component | Purpose |
|----------|-----------|---------|
| `/` → redirect | — | Redirects to `/dashboard` |
| `/dashboard` | `Dashboard.tsx` | Key metrics overview |
| `/scan` | `Home.tsx` | Trigger and monitor scans |
| `/observations` | `ObservationQueue.tsx` | Review AI-flagged stocks |
| `/scanned` | `ScannedStocks.tsx` | All scanned stocks |
| `/selected` | `SelectedStocks.tsx` | Stocks passing all rules |
| `/rejected` | `RejectedStocks.tsx` | Rejected stocks with reasons |
| `/summary` | `Summary.tsx` | Scan summary stats |

---

## Environment Variables (`.env`)

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_analysis
DB_USER=postgres
DB_PASSWORD=
DB_SSL=false
DB_MAX_CONNECTIONS=10
# Or: DATABASE_URL=postgresql://user:pass@host:5432/database

# App
NODE_ENV=production
LOG_LEVEL=info          # ERROR | WARN | INFO | DEBUG
DASHBOARD_PORT=4000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Scheduler
SCHEDULER_ENABLED=false
SCHEDULER_TIMEZONE=Asia/Kolkata
SCHEDULER_CRON=0 9 * * 1-5   # 9 AM weekdays IST

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=             # Gmail App Password
SEND_EMAIL=false
SEND_TELEGRAM=false

# AI Layer
ENABLE_AI_LAYER=true
GEMINI_API_KEY=        # https://aistudio.google.com/
AI_MODEL=gemini-2.0-flash-exp
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=1000
AI_RATE_LIMIT_MS=4500  # 13 req/min under Gemini 15 RPM free tier
AI_CONFIDENCE_THRESHOLD=70
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
OPENROUTER_API_KEY=
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

---

## Conventions & Patterns

### TypeScript
- **Always use `async/await`** — no raw Promise chains
- **Strict mode** is on — no implicit `any`, always type return values
- **Path alias**: `@/*` maps to `src/*`
- All files start with a comment: `// src/path/to/file.ts - description`

### Class Hierarchy
- All classes extend `BaseService` (directly or via `BaseRepository`)
- `BaseService` provides: `handleError()`, `executeWithRetry()`, `validateRequired()`, `sanitizeInput()`, `delay()`
- `BaseRepository` adds: `query()`, `transaction()`, `buildInsertQuery()`, `buildUpdateQuery()`, `buildSelectQuery()`
- `BaseController` adds: `success()`, `error()`, `handleAsync()`, `getPaginationParams()`, `createPaginatedResponse()`

### Logger
- **Never use `console.log`** — always use the custom `Logger` class
- Import: `import { Logger } from './utils/logger-enhanced'`
- Instantiate per class: `private logger = new Logger('ClassName')`
- Methods: `logger.info()`, `logger.warn()`, `logger.error()`, `logger.debug()`, `logger.success()`
- Level controlled by `LOG_LEVEL` env var (default: `INFO`)

### Database / Repositories
- **Never write SQL outside `src/repositories/`**
- Repositories extend `BaseRepository` and use `this.query()` for all DB access
- Use `this.transaction()` for multi-step operations
- Use `buildInsertQuery()` / `buildUpdateQuery()` / `buildSelectQuery()` helpers to avoid string interpolation
- Always use parameterized queries (`$1`, `$2`, …) — never string-concatenate user input

### Services
- All services extend `BaseService`
- Use `this.executeWithRetry(fn, maxRetries, delayMs)` for external API calls
- Wrap errors with `this.handleError(error, 'context string')` — never throw raw errors
- Validate inputs with `this.validateRequired(data, ['field1', 'field2'])`

### Controllers
- Wrap async handlers in `this.handleAsync(async (req, res) => { ... })` to auto-catch errors
- Always call `this.success(res, data)` or `this.error(res, message, statusCode)` — never `res.json()` directly
- Use `this.getPaginationParams(req)` for paginated endpoints
- Use `this.createPaginatedResponse(data, total, page, limit)` for paginated responses

### Strategy Rule Filters
Return shape (enforced convention):
```typescript
{ pass: boolean, status: string, reason: string, ...additionalFields }
```

### Frontend
- Use MUI components only — no plain HTML `<button>`, `<input>`, etc.
- All API calls go through `client/src/api.tsx` (the axios instance)
- Theme customization goes in `client/src/theme.ts`
- Global styles in `client/src/index.css`
- `setSnack` prop is passed to all pages/components for toast notifications

---

## Yahoo Finance Authentication

Yahoo Finance blocks direct API calls. The project uses a Puppeteer-based session workaround:
1. `YahooBrowserService` launches a headless Chrome to obtain session cookies and `crumb`
2. `YahooSessionService` stores and refreshes the crumb
3. `MarketDataService` calls Yahoo's API endpoints directly via `fetch()` with these credentials
- **Do NOT use `yahoo-finance2.setGlobalConfig()`** for custom headers — it silently ignores them; use raw `fetch()` instead

---

## Known Gotchas

- **Port conflicts**: Run `./start.sh` instead of `npm run dev:full` directly — it clears ports 4000, 5173, 3000, 5174, 5175 first
- **Scheduler disabled by default**: `SCHEDULER_ENABLED=false` — set to `true` + configure `SCHEDULER_CRON` to enable auto-scans
- **AI rate limits are DB-backed**: If a provider gets blocked, it stays blocked until the retry-after window expires (or you run `AILayerOrchestrator.unblockProvider()`)
- **`ENABLE_AI_LAYER=false`** bypasses AI entirely — code-only analysis results are used as final decisions
- **Build output**: `tsc` outputs to `swing-screener/dist/`; client build goes to `swing-screener/client/dist/` (served as static files by Express in production)
- **MCP tool** (`stock-analysis-db`) is configured in `.claude/mcp.json` — use it for direct DB queries during development

