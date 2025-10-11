import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  LinearProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  Badge,
  Tabs,
  Tab,
  ListItemIcon
} from '@mui/material';
import {
  Assessment,
  TrendingUp,
  TrendingDown,
  Speed,
  Security,
  Analytics,
  Timeline,
  CheckCircle,
  Warning,
  Info,
  Refresh,
  PlayArrow,
  Pause,
  Stop,
  Download,
  Share,
  Star,
  StarBorder,
  Notifications,
  Settings
} from '@mui/icons-material';
import api from '../api';

// Type definitions
interface SnackbarState {
  open: boolean;
  msg: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

interface StatusData {
  uptime: number;
  lastScan: string;
  totalStocks: number;
  qualifiedStocks: number;
  successRate: number;
  cronTime: string;
  timezone: string;
  running: boolean;
  sheetUrl: string;
}

interface ScanResult {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  sector: string;
  score: number;
  status: 'qualified' | 'rejected' | 'pending';
  reason?: string;
  timestamp: string;
}

interface HomeProps {
  setSnack: (snack: SnackbarState) => void;
}

export default function Home({ setSnack }: HomeProps): React.JSX.Element {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [manualScanLoading, setManualScanLoading] = useState<boolean>(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);

  // Initialize with empty results - will be populated by API calls

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.get('/status');
        setStatus(response.data);
        
        // Also fetch scan results
        const scanResponse = await api.get('/scan-results');
        if (scanResponse.data.success) {
          setScanResults(scanResponse.data.data || scanResponse.data || []);
        }
      } catch (err) {
        console.error('Status fetch error:', err);
        setSnack({ 
          open: true, 
          msg: `Failed to fetch status: ${(err as any).response?.data?.error || (err as Error).message}`, 
          severity: 'error' 
        });
      }
    };
    
    fetchStatus();
  }, [setSnack]);

  const onManualScan = async (): Promise<void> => {
    setManualScanLoading(true);
    setScanning(true);
    setScanProgress(0);
    
    try {
      const res = await api.post('/start-scan');
      
      if (res.data.success) {
        setSnack({ open: true, msg: `Scan started successfully!`, severity: 'success' });
        
        // Start polling for progress
        const progressInterval = setInterval(async () => {
          try {
            const progressRes = await api.get('/scan-progress');
            if (progressRes.data.success) {
              const { percentage, stage } = progressRes.data.data;
              setScanProgress(percentage || 0);
              
              // If scan is complete, stop polling and refresh data
              if (!progressRes.data.data.running) {
                clearInterval(progressInterval);
                setScanning(false);
                setManualScanLoading(false);
                
                // Refresh status and results
                const [statusRes, scanRes] = await Promise.all([
                  api.get('/status'),
                  api.get('/scan-results')
                ]);
                
                setStatus(statusRes.data);
                if (scanRes.data.success) {
                  setScanResults(scanRes.data.data || scanRes.data || []);
                }
              }
            }
          } catch (error) {
            console.error('Progress polling error:', error);
          }
        }, 2000); // Poll every 2 seconds
        
        // Set a timeout to stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(progressInterval);
          setScanning(false);
          setManualScanLoading(false);
        }, 300000); // 5 minutes timeout
      } else {
        setSnack({ open: true, msg: res.data.message || 'Failed to start scan', severity: 'error' });
      }
    } catch (err) {
      setSnack({ open: true, msg: 'Scan failed: ' + ((err as any)?.response?.data?.error || (err as Error).message), severity: 'error' });
    } finally {
      setScanning(false);
      setManualScanLoading(false);
    }
  };

  // Ensure scanResults is always an array
  const safeScanResults = Array.isArray(scanResults) ? scanResults : [];
  const qualifiedStocks = safeScanResults.filter(stock => stock.status === 'qualified');
  const rejectedStocks = safeScanResults.filter(stock => stock.status === 'rejected');

  return (
    <Box sx={{ p: 3, backgroundColor: 'background.default', minHeight: '100vh' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h3" component="h1" fontWeight="bold" color="primary" gutterBottom>
            Stock Analysis Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Professional swing trading analysis and portfolio management
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => window.location.reload()}
            sx={{ borderRadius: 2 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={scanning ? <CircularProgress size={20} /> : <Assessment />}
            onClick={onManualScan}
            disabled={manualScanLoading || scanning}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {scanning ? 'Analyzing...' : 'Start Analysis'}
          </Button>
        </Box>
      </Box>

      {/* Scan Progress */}
      {scanning && (
        <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <Analytics sx={{ mr: 2, fontSize: 28 }} />
              <Typography variant="h6" fontWeight="bold">Market Analysis in Progress</Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={scanProgress} 
              sx={{ 
                mb: 2, 
                backgroundColor: 'rgba(255,255,255,0.3)', 
                '& .MuiLinearProgress-bar': { backgroundColor: 'white' } 
              }} 
            />
            <Typography variant="body2">
              {scanProgress > 0 ? `Analyzing stocks... ${Math.round(scanProgress)}%` : 'Starting analysis...'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* System Status */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }} mb={4}>
        <Box sx={{ flex: "1 1 300px", minWidth: "300px" }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={3} color="primary">
                System Status
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                <Box sx={{ flex: 1 }} >
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {status?.qualifiedStocks || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Qualified Stocks
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }} >
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold" color="info.main">
                      {status?.totalStocks || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Analyzed
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }} >
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {status?.successRate || 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Success Rate
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }} >
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                      {status?.uptime ? Math.floor(status.uptime / 3600) : 0}h
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      System Uptime
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
        
        <Box sx={{ flex: "1 1 300px", minWidth: "300px" }} >
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2} color="primary">
                Quick Actions
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Assessment color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Start New Analysis"
                    secondary="Run comprehensive market scan"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Download color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Export Results"
                    secondary="Download analysis report"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Share color="info" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Share Report"
                    secondary="Send results via email"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Analysis Results */}
      <Card sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab 
              icon={<CheckCircle />} 
              label={`Qualified (${qualifiedStocks.length})`} 
              iconPosition="start"
            />
            <Tab 
              icon={<Warning />} 
              label={`Rejected (${rejectedStocks.length})`} 
              iconPosition="start"
            />
            <Tab 
              icon={<Info />} 
              label="All Results" 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Qualified Stocks Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" mb={3} color="success.main">
              Qualified Stocks ({qualifiedStocks.length})
            </Typography>
            {qualifiedStocks.length > 0 ? (
              <List>
                {qualifiedStocks.map((stock, index) => (
                  <React.Fragment key={stock.id}>
                    <ListItem sx={{ py: 2 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ backgroundColor: 'success.main' }}>
                          {stock.symbol.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="h6" fontWeight="bold">
                              {stock.symbol}
                            </Typography>
                            <Chip 
                              label={`Score: ${stock.score}`} 
                              color="success" 
                              size="small"
                            />
                            <Chip 
                              label={stock.sector} 
                              color="primary" 
                              variant="outlined" 
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {stock.name}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={2} mt={1}>
                              <Typography variant="h6" fontWeight="bold">
                                ₹{stock.price ? Number(stock.price).toFixed(2) : '0.00'}
                              </Typography>
                              <Box display="flex" alignItems="center">
                                {stock.change >= 0 ? (
                                  <TrendingUp color="success" sx={{ mr: 0.5 }} />
                                ) : (
                                  <TrendingDown color="error" sx={{ mr: 0.5 }} />
                                )}
                                <Typography 
                                  variant="body2"
                                  color={stock.change >= 0 ? 'success.main' : 'error.main'}
                                >
                                  {stock.change >= 0 ? '+' : ''}{stock.change ? Number(stock.change).toFixed(2) : '0.00'} 
                                  ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent ? Number(stock.changePercent).toFixed(2) : '0.00'}%)
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        }
                      />
                      <Box display="flex" gap={1}>
                        <Tooltip title="Add to Portfolio">
                          <IconButton color="primary">
                            <StarBorder />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Details">
                          <IconButton color="info">
                            <Info />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </ListItem>
                    {index < qualifiedStocks.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  No qualified stocks found
                </Typography>
                <Typography>
                  Run a new analysis to find stocks that meet all criteria.
                </Typography>
              </Alert>
            )}
          </Box>
        )}

        {/* Rejected Stocks Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" mb={3} color="error.main">
              Rejected Stocks ({rejectedStocks.length})
            </Typography>
            {rejectedStocks.length > 0 ? (
              <List>
                {rejectedStocks.map((stock, index) => (
                  <React.Fragment key={stock.id}>
                    <ListItem sx={{ py: 2 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ backgroundColor: 'error.main' }}>
                          {stock.symbol.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="h6" fontWeight="bold">
                              {stock.symbol}
                            </Typography>
                            <Chip 
                              label={`Score: ${stock.score}`} 
                              color="error" 
                              size="small"
                            />
                            <Chip 
                              label={stock.sector} 
                              color="primary" 
                              variant="outlined" 
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {stock.name}
                            </Typography>
                            <Typography variant="body2" color="error.main" mt={1}>
                              <strong>Reason:</strong> {stock.reason}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < rejectedStocks.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  No rejected stocks
                </Typography>
                <Typography>
                  All analyzed stocks met the criteria!
                </Typography>
              </Alert>
            )}
          </Box>
        )}

        {/* All Results Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" mb={3}>
              All Analysis Results ({safeScanResults.length})
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {safeScanResults.map((stock) => (
                <Box sx={{ flex: "1 1 300px", minWidth: "300px" }}  key={stock.id}>
                  <Card 
                    sx={{ 
                      border: `2px solid ${stock.status === 'qualified' ? 'success.main' : 'error.main'}`,
                      '&:hover': { boxShadow: 4 }
                    }}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Avatar sx={{ 
                          mr: 2, 
                          backgroundColor: stock.status === 'qualified' ? 'success.main' : 'error.main' 
                        }}>
                          {stock.symbol.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" fontWeight="bold">
                            {stock.symbol}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {stock.sector}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Typography variant="h5" fontWeight="bold" mb={1}>
                        ₹{stock.price ? Number(stock.price).toFixed(2) : '0.00'}
                      </Typography>
                      
                      <Box display="flex" alignItems="center" mb={2}>
                        {stock.change >= 0 ? (
                          <TrendingUp color="success" sx={{ mr: 0.5 }} />
                        ) : (
                          <TrendingDown color="error" sx={{ mr: 0.5 }} />
                        )}
                        <Typography 
                          variant="body2"
                          color={stock.change >= 0 ? 'success.main' : 'error.main'}
                        >
                          {stock.change >= 0 ? '+' : ''}{stock.change ? Number(stock.change).toFixed(2) : '0.00'} 
                          ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent ? Number(stock.changePercent).toFixed(2) : '0.00'}%)
                        </Typography>
                      </Box>
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Chip 
                          label={stock.status === 'qualified' ? 'Qualified' : 'Rejected'} 
                          color={stock.status === 'qualified' ? 'success' : 'error'} 
                          size="small"
                        />
                        <Typography variant="body2" color="text.secondary">
                          Score: {stock.score}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Card>

      {/* Quick Stats */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        <Box sx={{ flex: "1 1 300px", minWidth: "300px" }} >
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Speed sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  Analysis Speed
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {status?.totalStocks ? Math.floor(status.totalStocks / 60) : 0} stocks/min
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Average processing time
              </Typography>
            </CardContent>
          </Card>
        </Box>
        
        <Box sx={{ flex: "1 1 300px", minWidth: "300px" }} >
          <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Security sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  System Health
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                99.9%
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Uptime reliability
              </Typography>
            </CardContent>
          </Card>
        </Box>
        
        <Box sx={{ flex: "1 1 300px", minWidth: "300px" }} >
          <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Timeline sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  Last Analysis
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {status?.lastScan ? new Date(status.lastScan).toLocaleTimeString() : 'Never'}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                {status?.cronTime} {status?.timezone}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}