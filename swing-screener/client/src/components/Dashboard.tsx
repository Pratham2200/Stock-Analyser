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
  Divider
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
  const [alerts, setAlerts] = useState<any[]>([]);

  // Stock data is now fetched from API - no mock data needed

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [scanResults, performance, alertsData] = await Promise.all([
        api.get('/scan-results'),
        api.get('/performance'),
        api.get('/alerts')
      ]);

      setDashboardData({
        scanResults: scanResults.data,
        performance: performance.data
      });
      setAlerts(alertsData.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Show empty state instead of mock data
      setDashboardData({
        scanResults: {
          totalStocks: 0,
          qualifiedStocks: 0,
          successRate: 0,
          lastScanTime: '',
          scanDuration: 0
        },
        performance: {
          todayPnl: 0,
          todayPnlPercent: 0,
          weekPnl: 0,
          weekPnlPercent: 0
        }
      });
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  // Start scan function - REAL API CALL
  const startScan = async () => {
    try {
      setScanning(true);
      setScanProgress(10);
      setScanStatus('Connecting to scanner...');

      // Call the REAL backend API to start the scan
      const response = await api.post('/start-scan');

      setScanProgress(100);
      setScanStatus('Scan completed!');

      if (response.data.success) {
        const result = response.data.data;
        setSnack({
          open: true,
          msg: `Scan complete! ${result.qualifiedCount}/${result.totalCandidates} stocks qualified (${result.successRate?.toFixed(1) || 0}%)`,
          severity: 'success'
        });
      } else {
        setSnack({ open: true, msg: 'Scan completed with warnings', severity: 'warning' });
      }

      // Refresh data after scan
      await fetchDashboardData();
    } catch (error: any) {
      console.error('Error starting scan:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to start scan';
      setSnack({ open: true, msg: errorMsg, severity: 'error' });
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
    <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h3" component="h1" fontWeight="bold" color="primary">
            📊 Stock Analysis Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Real-time market analysis and stock screening
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{ borderRadius: 2 }}
          >
            {refreshing ? <CircularProgress size={20} /> : 'Refresh'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Assessment />}
            onClick={startScan}
            disabled={scanning}
            sx={{ borderRadius: 2 }}
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
      <Grid container spacing={3} mb={4}>
        {/* Today's Performance */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{
            background: dashboardData?.performance?.todayPnlPercent && dashboardData.performance.todayPnlPercent >= 0
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
              <Typography variant="h3" fontWeight="bold" mb={1}>
                ₹{dashboardData?.performance?.todayPnl?.toLocaleString() || '0'}
              </Typography>
              <Typography variant="h6">
                {(dashboardData?.performance?.todayPnlPercent ?? 0) >= 0 ? '+' : ''}{(dashboardData?.performance?.todayPnlPercent ?? 0).toFixed(2)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Scan Results */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{
            background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Assessment sx={{ mr: 1, fontSize: 28, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold" color="primary">Scan Results</Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="primary" mb={1}>
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
        </Grid>

        {/* Success Rate */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{
            background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Analytics sx={{ mr: 1, fontSize: 28, color: 'warning.main' }} />
                <Typography variant="h6" fontWeight="bold" color="warning.main">Success Rate</Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="warning.main" mb={1}>
                {dashboardData?.scanResults?.successRate || 0}%
              </Typography>
              <Typography variant="body1" color="text.secondary">
                qualification rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Weekly Performance */}
        <Grid size={{ xs: 12, md: 3 }}>
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
              <Typography variant="h4" fontWeight="bold">
                {dashboardData?.performance?.weekPnlPercent?.toFixed(2) || '0'}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Weekly Performance
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different views */}
      <Card sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab icon={<BarChart />} label="Analysis" />
            <Tab icon={<Timeline />} label="Performance" />
            <Tab icon={<Notifications />} label="Alerts" />
          </Tabs>
        </Box>

        {/* Analysis Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" mb={3}>Analysis Breakdown</Typography>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={3}>
                      <BarChart sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" fontWeight="bold">Failure Reasons</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      Why stocks were rejected in the last scan
                    </Typography>

                    {/* Failure Bars */}
                    {[
                      { label: 'Consolidation', value: dashboardData?.scanResults?.lastScanTime ? (dashboardData as any).scanResults.consolidation_failures || 0 : 0, color: '#FF6B6B' },
                      { label: 'Higher Lows', value: dashboardData?.scanResults?.lastScanTime ? (dashboardData as any).scanResults.higher_low_failures || 0 : 0, color: '#FFD93D' },
                      { label: 'Volume Pump', value: dashboardData?.scanResults?.lastScanTime ? (dashboardData as any).scanResults.volume_failures || 0 : 0, color: '#4D96FF' },
                      { label: 'Bear Squeeze', value: dashboardData?.scanResults?.lastScanTime ? (dashboardData as any).scanResults.bear_squeeze_failures || 0 : 0, color: '#6BCB77' }
                    ].map((item) => {
                      const totalFailures = ((dashboardData as any)?.scanResults?.rejected_count || 1);
                      const percent = Math.min(100, Math.round((item.value / totalFailures) * 100));

                      return (
                        <Box key={item.label} mb={2}>
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="body2">{item.label}</Typography>
                            <Typography variant="body2" fontWeight="bold">{item.value} ({percent}%)</Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={percent}
                            sx={{
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: '#f0f0f0',
                              '& .MuiLinearProgress-bar': { backgroundColor: item.color }
                            }}
                          />
                        </Box>
                      );
                    })}
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={3}>
                      <PieChart sx={{ mr: 1, color: 'secondary.main' }} />
                      <Typography variant="h6" fontWeight="bold">Scan Efficiency</Typography>
                    </Box>

                    <List>
                      <ListItem>
                        <ListItemText
                          primary="Avg Analysis Time"
                          secondary={`${Math.round((dashboardData as any)?.scanResults?.avg_duration || 0)} ms / stock`}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText
                          primary="Avg Strategy Score"
                          secondary={`${Number((dashboardData as any)?.scanResults?.avg_score || 0).toFixed(1)} / 10`}
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemText
                          primary="Rejected Stocks"
                          secondary={(dashboardData as any)?.scanResults?.rejected_count || 0}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Performance Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" mb={3}>Performance Metrics</Typography>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ p: 3, textAlign: 'center' }}>
                  <ShowChart sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    {dashboardData?.performance?.weekPnlPercent?.toFixed(2) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Weekly Performance
                  </Typography>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ p: 3, textAlign: 'center' }}>
                  <Timeline sx={{ fontSize: 40, color: 'success.main', mb: 2 }} />
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {dashboardData?.performance?.todayPnlPercent?.toFixed(2) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Today's Performance
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Alerts Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" mb={3}>Market Alerts</Typography>
            <List>
              {alerts.length > 0 ? (
                alerts.map((alert, index) => (
                  <React.Fragment key={alert.id || index}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{
                          backgroundColor:
                            alert.type === 'success' ? 'success.main' :
                              alert.type === 'error' ? 'error.main' :
                                alert.type === 'warning' ? 'warning.main' : 'info.main'
                        }}>
                          {alert.type === 'success' ? <TrendingUp /> :
                            alert.type === 'error' ? <TrendingDown /> :
                              alert.type === 'warning' ? <Notifications /> : <CheckCircle />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={alert.title}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="text.primary">
                              {alert.message}
                            </Typography>
                            <br />
                            <Typography component="span" variant="caption" color="text.secondary">
                              {new Date(alert.timestamp).toLocaleString()}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                    {index < alerts.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              ) : (
                <Box textAlign="center" py={4}>
                  <Notifications sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography color="text.secondary">No active alerts</Typography>
                </Box>
              )}
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