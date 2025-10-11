# 📊 Stock Analysis Pro - Production Setup Guide

A professional-grade stock analysis application with PostgreSQL database, enhanced UI, and portfolio management features.

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 16+ 
- PostgreSQL 12+
- Git

### 2. Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd swing-screener

# Install dependencies
npm install

# Install PostgreSQL (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql
```

### 3. Database Setup
```bash
# Create database
createdb stock_analysis

# Run database schema
psql -d stock_analysis -f database/schema.sql

# Or use the setup script
chmod +x setup-database.sh
./setup-database.sh
```

### 4. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit your configuration
nano .env
```

### 5. Start Application
```bash
# Development mode
npm run dev

# Production mode
npm run start:prod

# Or use the production script
node start-production.js
```

## 📊 Features

### 🎯 Core Features
- **Automated Stock Screening**: Daily scans using Chartink screener
- **Advanced Strategy Analysis**: 6-step swing trading strategy
- **PostgreSQL Database**: Full data persistence and analytics
- **Portfolio Management**: Track positions and performance
- **Real-time Monitoring**: Live price updates and alerts

### 🎨 Enhanced UI
- **Dashboard**: Overview of scans, portfolio, and performance
- **Portfolio Management**: Track active positions and P&L
- **Stock Analysis**: Detailed view of analysis results
- **Performance Analytics**: Historical performance tracking
- **Responsive Design**: Works on desktop and mobile

### 💾 Database Features
- **Scan History**: Track all daily scans and results
- **Stock Analysis**: Detailed analysis results for each stock
- **Portfolio Tracking**: Active positions and performance
- **Performance Metrics**: Daily portfolio performance
- **Audit Trail**: Complete history of all operations

## 🗄️ Database Schema

### Core Tables
- `scans` - Daily scan records
- `stocks` - Scraped stocks from screener
- `stock_analysis` - Analysis results for each stock
- `selected_stocks` - Stocks that passed all criteria
- `portfolio_positions` - Active trading positions
- `portfolio_performance` - Daily performance metrics
- `app_settings` - Application configuration
- `notifications_log` - Notification history

## 🔧 Configuration

### Environment Variables
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_analysis
DB_USER=postgres
DB_PASSWORD=your_password

# Google Sheets API
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_KEY\\n-----END PRIVATE KEY-----\\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# Application Settings
DASHBOARD_PORT=4000
LOG_LEVEL=info
SCAN_CRON=0 18 * * *
TIMEZONE=Asia/Kolkata
```

## 📊 API Endpoints

### Core Endpoints
- `GET /api/status` - Application status
- `GET /api/scan-results` - Latest scan results
- `GET /api/stocks` - Stocks from latest scan
- `GET /api/portfolio` - Portfolio positions
- `GET /api/performance` - Portfolio performance
- `POST /api/start-scan` - Trigger manual scan

### Portfolio Endpoints
- `GET /api/portfolio` - Get active positions
- `PUT /api/portfolio/:id` - Update position
- `POST /api/portfolio/:id/close` - Close position

## 🎯 Strategy Details

The application uses a 6-step swing trading strategy:

1. **Higher-Low Structure**: At least 3 swing lows above 10 EMA
2. **60-Day Consolidation**: After 30%+ move, 60+ days consolidation
3. **Volume Pump**: Today's volume 1.8x average
4. **EMA Shakeout**: Close below both 10 & 20 EMA in last 5 days
5. **Bear Squeeze Candle**: Specific candlestick patterns
6. **Volume Risk Filter**: No recent selling pressure

## 📈 Portfolio Management

### Position Tracking
- Entry price and stop loss
- Multiple profit targets
- Real-time P&L calculation
- Performance metrics
- Risk management

### Performance Analytics
- Total portfolio value
- Daily returns
- Maximum drawdown
- Success rate tracking
- Historical performance

## 🔒 Security Features

- **Input Validation**: All inputs are validated
- **SQL Injection Protection**: Parameterized queries
- **Error Handling**: Comprehensive error management
- **Logging**: Detailed audit trail
- **Rate Limiting**: API rate limiting

## 📊 Monitoring & Logging

### Log Levels
- `ERROR`: Critical errors
- `WARN`: Warnings and issues
- `INFO`: General information
- `DEBUG`: Detailed debugging

### Log Files
- `logs/app.log` - General application logs
- `logs/error.log` - Error-specific logs
- Automatic log rotation (10MB max, 5 files)

## 🚀 Production Deployment

### 1. System Requirements
- Ubuntu 20.04+ or CentOS 8+
- 2GB RAM minimum
- 10GB disk space
- PostgreSQL 12+

### 2. Process Management
```bash
# Using PM2
npm install -g pm2
pm2 start start-production.js --name "stock-analysis-pro"
pm2 save
pm2 startup
```

### 3. Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. SSL Certificate
```bash
# Using Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 🔧 Maintenance

### Database Maintenance
```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('stock_analysis'));

-- Clean old logs
DELETE FROM notifications_log WHERE sent_at < NOW() - INTERVAL '30 days';

-- Update statistics
ANALYZE;
```

### Log Rotation
```bash
# Set up logrotate
sudo nano /etc/logrotate.d/stock-analysis-pro

# Add configuration
/path/to/swing-screener/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 node node
    postrotate
        pm2 reload stock-analysis-pro
    endscript
}
```

## 📊 Performance Optimization

### Database Optimization
- Indexes on frequently queried columns
- Connection pooling
- Query optimization
- Regular VACUUM and ANALYZE

### Application Optimization
- Memory management
- Efficient data structures
- Caching strategies
- Rate limiting

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Check connection
   psql -h localhost -U postgres -d stock_analysis
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :4000
   
   # Kill process
   kill -9 <PID>
   ```

3. **Email Not Working**
   - Check SMTP credentials
   - Verify app password for Gmail
   - Check firewall settings

4. **Google Sheets Error**
   - Verify service account credentials
   - Check spreadsheet permissions
   - Ensure spreadsheet ID is correct

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run start:prod
```

## 📞 Support

For issues and support:
1. Check the logs in `logs/` directory
2. Verify configuration in `.env` file
3. Test database connection
4. Check all external services (Yahoo Finance, Google Sheets, Email)

## 🎯 Success Metrics

The application tracks:
- **Scan Success Rate**: Percentage of stocks that pass criteria
- **Portfolio Performance**: Total returns and drawdown
- **System Uptime**: Application availability
- **Data Quality**: Accuracy of analysis results

## 🔄 Updates

To update the application:
1. Backup database
2. Pull latest changes
3. Run database migrations
4. Restart application
5. Verify functionality

---

**Stock Analysis Pro** - Professional-grade stock analysis for serious traders 🚀
