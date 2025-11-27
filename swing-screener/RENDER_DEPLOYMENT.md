# Render Deployment Configuration

## Render Web Service Configuration

### Scenario 1: If your Git repository root is `Stock-Analyser` (parent directory)

**Root Directory (Optional):**
```
swing-screener
```

**Build Command:**
```
npm install && npm run build
```

**Start Command:**
```
npm start
```

### Scenario 2: If your Git repository root is `swing-screener` (this directory)

**Root Directory (Optional):**
```
(leave empty)
```

**Build Command:**
```
npm install && npm run build
```

**Start Command:**
```
npm start
```

## Environment Variables

Set these in your Render dashboard under "Environment":

### Required for Production:
- `DATABASE_URL` - Your Supabase PostgreSQL connection string
- `NODE_ENV` - Set to `production`
- `PORT` - Automatically set by Render (optional override)

### Optional but Recommended:
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
  - Example: `https://your-app.onrender.com,https://your-frontend.com`
  - If not set, defaults to localhost ports (3000, 5173)

### Other Environment Variables (for fallback):
- `DB_HOST` - Database host (fallback if DATABASE_URL not set)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_SSL` - Set to `true` for SSL connections

## Build & Deploy Process

1. Render will run: `npm install && npm run build`
2. This compiles TypeScript from `src/` to `dist/`
3. Render then runs: `npm start`
4. This executes: `node dist/main.js`
5. Server starts on `0.0.0.0:PORT` (PORT from Render)

## Notes

- The application automatically detects `DATABASE_URL` and uses SSL for Supabase
- Trust proxy is enabled for Render's load balancer
- CORS is configured to allow your frontend domain
- Rate limiting is enabled (100 requests per 15 minutes per IP)

