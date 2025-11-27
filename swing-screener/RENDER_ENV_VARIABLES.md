# Render Environment Variables

## Required Environment Variables for Render Deployment

**Only these three environment variables need to be set in Render:**

### 1. **NODE_ENV**
- **Value**: `production`
- **Purpose**: Sets the application to production mode
- **Usage**: 
  - Used in `src/config/index.ts` for environment detection
  - Used in `src/app.ts` for protocol selection (https vs http)

### 2. **DATABASE_URL**
- **Value**: `postgresql://postgres:Manju%40123@db.xxvyjbopomifkevlibfn.supabase.co:5432/postgres`
- **Purpose**: Supabase PostgreSQL connection string
- **Usage**: Used in `src/database/connection.ts` for production database connection
- **Note**: Password uses `%40` encoding for `@` symbol

### 3. **ALLOWED_ORIGINS**
- **Value**: `http://localhost:5173,http://localhost:3000`
- **Purpose**: Comma-separated list of allowed frontend URLs for CORS
- **Usage**: Used in `src/app.ts` for CORS configuration
- **Note**: Update with your Vercel frontend URL when deployed

## Additional Notes

**PORT** - Automatically set by Render (no need to configure)
- The code checks `process.env.PORT` but Render sets this automatically
- Falls back to port 4000 if not set (for local development)

## Example Environment Variables in Render

```
NODE_ENV = production
DATABASE_URL = postgresql://postgres:Manju%40123@db.xxvyjbopomifkevlibfn.supabase.co:5432/postgres
ALLOWED_ORIGINS = http://localhost:5173,http://localhost:3000
```

## All Other Configuration

All other settings are **hardcoded** in the application:
- Database connection settings (for local dev fallback)
- Email/SMTP configuration
- Scheduler settings
- Log level
- Dashboard port (fallback)
- Notification settings

These do not need to be set as environment variables.

## All Other Configuration

All other settings are **hardcoded** in the application:
- Database connection settings (for local dev)
- Email/SMTP configuration
- Scheduler settings
- Log level
- Dashboard port (fallback)
- Notification settings

These do not need to be set as environment variables.

