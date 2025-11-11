// src/components/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  CircularProgress,
  LinearProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Tabs,
  Tab,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Refresh,
  Assessment,
  TrendingUp,
  TrendingDown,
  Timeline,
  CheckCircle,
  Cancel,
  Visibility,
  StarBorder,
  Sell,
  Add,
  Download,
  Share,
  Analytics,
  BarChart,
  PieChart,
  TableChart,
  FilterList,
  Search,
  Notifications,
  Settings,
  Dashboard as DashboardIcon,
  ShowChart
} from '@mui/icons-material';
import api from '../api';

interface DashboardData {
  scanResults: {
    totalStocks: number;
    qualifiedStocks: number;
    successRate: number;
    lastScanTime: string;
    scanDuration: number;
  };
  performance: {
    todayPnl: number;
    todayPnlPercent: number;
    weekPnl: number;
    weekPnlPercent: number;
  };
}

interface Stock {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  sector: string;
  qualified: boolean;
}

interface DashboardProps {
  setSnack: (snack: { open: boolean; msg: string; severity: 'success' | 'error' | 'warning' | 'info' }) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setSnack }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedStocks, setSelectedStocks] = useState<Stock[]>([]);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [speedDialOpen, setSpeedDialOpen] = useState<boolean>(false);

  // Initialize with empty data - will be populated by API calls

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statusResponse, scanResultsResponse, performanceResponse] = await Promise.all([
        api.get('/status'),
        api.get('/scan-results'),
        api.get('/performance')
      ]);

      // Handle response format - API returns { success: true, data: {...} }
      const status = statusResponse.data?.data || statusResponse.data;
      const scanResults = scanResultsResponse.data?.data || scanResultsResponse.data;
      const performance = performanceResponse.data?.data || performanceResponse.data;

      setDashboardData({
        scanResults: {
          totalStocks: status?.totalStocks || 0,
          qualifiedStocks: status?.qualifiedStocks || 0,
          successRate: status?.successRate || 0,
          lastScanTime: status?.lastScan || new Date().toISOString(),
          scanDuration: status?.scanDuration || 0
        },
        performance: {
          todayPnl: performance?.todayPnl || 0,
          todayPnlPercent: performance?.todayPnlPercent || 0,
          weekPnl: performance?.weekPnl || 0,
          weekPnlPercent: performance?.weekPnlPercent || 0
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setSnack({ open: true, msg: 'Failed to fetch dashboard data', severity: 'error' });
      // Use fallback data
      setDashboardData({
        scanResults: {
          totalStocks: 0,
          qualifiedStocks: 0,
          successRate: 0,
          lastScanTime: new Date().toISOString(),
          scanDuration: 0
        },
        performance: {
          todayPnl: 0,
          todayPnlPercent: 0,
          weekPnl: 0,
          weekPnlPercent: 0
        }
      });
    } finally {
      setLoading(false);
    }
  };

  // Start scan function
  const startScan = async () => {
    try {
      setScanning(true);
      setScanProgress(0);
      setScanStatus('Starting scan...');
      
      // Call the real API
      const response = await api.post('/start-scan');
      
      if (response.data.success) {
        setScanStatus('Scan started successfully!');
        setSnack({ open: true, msg: 'Stock scan started successfully!', severity: 'success' });
      
      // Refresh data after scan
      await fetchDashboardData();
      } else {
        setSnack({ open: true, msg: response.data.message || 'Failed to start scan', severity: 'error' });
      }
    } catch (error) {
      console.error('Error starting scan:', error);
      setSnack({ open: true, msg: 'Failed to start scan', severity: 'error' });
    } finally {
      setScanning(false);
      setScanProgress(0);
      setScanStatus('');
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const speedDialActions = [
    { icon: <Assessment />, name: 'Start Scan', action: startScan }
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 }, 
      backgroundColor: 'background.default', 
      minHeight: '100vh',
      width: '100%',
      overflowX: 'hidden'
    }}>
      {/* Header */}
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', sm: 'center' },
          mb: { xs: 3, sm: 4 },
          gap: { xs: 2, sm: 0 }
        }}
      >
        <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Typography 
            variant={isMobile ? 'h5' : 'h3'} 
            component="h1" 
            fontWeight="bold" 
            color="primary"
            sx={{ mb: { xs: 0.5, sm: 0 } }}
          >
            Stock Analysis Dashboard
          </Typography>
          <Typography 
            variant={isMobile ? 'body2' : 'subtitle1'} 
            color="text.secondary"
          >
            Real-time market analysis and stock screening
          </Typography>
        </Box>
        <Box 
          sx={{ 
            display: 'flex', 
            gap: 2,
            width: { xs: '100%', sm: 'auto' },
            flexDirection: { xs: 'column', sm: 'row' }
          }}
        >
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
            size={isMobile ? 'medium' : 'large'}
          >
            {refreshing ? <CircularProgress size={20} /> : 'Refresh'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Assessment />}
            onClick={startScan}
            disabled={scanning}
            sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
            size={isMobile ? 'medium' : 'large'}
          >
            {scanning ? 'Scanning...' : 'Start Scan'}
          </Button>
        </Box>
      </Box>

      {/* Scan Progress */}
      {scanning && (
        <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <Analytics sx={{ mr: 2 }} />
              <Typography variant="h6">Market Analysis in Progress</Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={scanProgress} 
              sx={{ mb: 1, backgroundColor: 'rgba(255,255,255,0.3)' }}
            />
            <Typography variant="body2">
              {scanStatus}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Main Stats Cards */}
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: { 
          xs: '1fr', 
          sm: 'repeat(2, 1fr)', 
          md: 'repeat(2, 1fr)',
          lg: 'repeat(4, 1fr)' 
        },
        gap: { xs: 2, sm: 3 },
        mb: { xs: 3, sm: 4 }
      }}>
        {/* Today's Performance */}
        <Box>
          <Card sx={{ 
            background: dashboardData?.performance?.todayPnlPercent !== undefined && dashboardData.performance.todayPnlPercent >= 0 
              ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' 
              : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            color: 'white',
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Timeline sx={{ mr: 1, fontSize: 28 }} />
                <Typography variant="h6" fontWeight="bold">Today's P&L</Typography>
              </Box>
              <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold" mb={1}>
                ₹{dashboardData?.performance?.todayPnl?.toLocaleString() || '0'}
              </Typography>
              <Typography variant={isMobile ? 'body1' : 'h6'}>
                {dashboardData?.performance?.todayPnlPercent !== undefined && dashboardData.performance.todayPnlPercent >= 0 ? '+' : ''}{dashboardData?.performance?.todayPnlPercent?.toFixed(2) || '0'}%
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Scan Results */}
        <Box>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Assessment sx={{ mr: 1, fontSize: 28, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold" color="primary">Scan Results</Typography>
              </Box>
              <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold" color="primary" mb={1}>
                {dashboardData?.scanResults?.qualifiedStocks || 0}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                qualified stocks
              </Typography>
              <Typography variant="body2" color="text.secondary">
                from {dashboardData?.scanResults?.totalStocks || 0} scanned
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Success Rate */}
        <Box>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Analytics sx={{ mr: 1, fontSize: 28, color: 'warning.main' }} />
                <Typography variant="h6" fontWeight="bold" color="warning.main">Success Rate</Typography>
              </Box>
              <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold" color="warning.main" mb={1}>
                {dashboardData?.scanResults?.successRate || 0}%
              </Typography>
              <Typography variant="body1" color="text.secondary">
                qualification rate
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Weekly Performance */}
        <Box>
          <Card sx={{ 
            background: dashboardData?.performance?.weekPnlPercent && dashboardData.performance.weekPnlPercent >= 0 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
              : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ShowChart sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" fontWeight="bold">
                  Weekly Performance
                </Typography>
              </Box>
              <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold">
                {dashboardData?.performance?.weekPnlPercent?.toFixed(2) || '0'}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Weekly Performance
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Tabs for different views */}
      <Card sx={{ mb: { xs: 3, sm: 4 }, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : false}
            sx={{ minHeight: { xs: 48, sm: 72 } }}
          >
            <Tab icon={<BarChart />} label={isMobile ? "" : "Analysis"} iconPosition={isMobile ? "start" : "top"} />
            <Tab icon={<Timeline />} label={isMobile ? "" : "Performance"} iconPosition={isMobile ? "start" : "top"} />
            <Tab icon={<Notifications />} label={isMobile ? "" : "Alerts"} iconPosition={isMobile ? "start" : "top"} />
          </Tabs>
        </Box>

        {/* Analysis Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" mb={3}>Stock Analysis</Typography>
            
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: { xs: 2, sm: 3 }
            }}>
              <Box>
                <Card sx={{ height: { xs: 250, sm: 300 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box textAlign="center">
                    <BarChart sx={{ fontSize: { xs: 48, sm: 60 }, color: 'primary.main', mb: 2 }} />
                    <Typography variant={isMobile ? 'body1' : 'h6'} fontWeight="bold" mb={1}>
                      Technical Analysis
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Advanced charting and indicators
                    </Typography>
                  </Box>
                </Card>
              </Box>
              <Box>
                <Card sx={{ height: { xs: 250, sm: 300 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box textAlign="center">
                    <PieChart sx={{ fontSize: { xs: 48, sm: 60 }, color: 'secondary.main', mb: 2 }} />
                    <Typography variant={isMobile ? 'body1' : 'h6'} fontWeight="bold" mb={1}>
                      Sector Analysis
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Portfolio diversification insights
                    </Typography>
                  </Box>
                </Card>
              </Box>
            </Box>
          </Box>
        )}

        {/* Performance Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" mb={3}>Performance Metrics</Typography>
            
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: { xs: 2, sm: 3 }
            }}>
              <Box>
                <Card sx={{ p: { xs: 2, sm: 3 }, textAlign: 'center' }}>
                  <ShowChart sx={{ fontSize: { xs: 32, sm: 40 }, color: 'primary.main', mb: 2 }} />
                  <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
                    {dashboardData?.performance?.weekPnlPercent?.toFixed(2) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Weekly Performance
                  </Typography>
                </Card>
              </Box>
              <Box>
                <Card sx={{ p: { xs: 2, sm: 3 }, textAlign: 'center' }}>
                  <Timeline sx={{ fontSize: { xs: 32, sm: 40 }, color: 'success.main', mb: 2 }} />
                  <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="success.main">
                    {dashboardData?.performance?.todayPnlPercent?.toFixed(2) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Today's Performance
                  </Typography>
                </Card>
              </Box>
            </Box>
          </Box>
        )}

        {/* Alerts Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" mb={3}>Market Alerts</Typography>
            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ backgroundColor: 'success.main' }}>
                    <CheckCircle />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="RELIANCE target achieved"
                  secondary="Target price of ₹2500 reached"
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ backgroundColor: 'warning.main' }}>
                    <TrendingDown />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="TCS showing weakness"
                  secondary="Price below 50-day moving average"
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ backgroundColor: 'info.main' }}>
                    <Analytics />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="New scan results available"
                  secondary="12 qualified stocks found"
                />
              </ListItem>
            </List>
          </Box>
        )}
      </Card>

      {/* Speed Dial */}
      <SpeedDial
        ariaLabel="SpeedDial"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.action}
          />
        ))}
      </SpeedDial>
    </Box>
  );
};

export default Dashboard;