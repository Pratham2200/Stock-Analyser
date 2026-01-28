// src/components/SelectedStocks.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Pagination,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle,
  Cancel,
  Visibility,
  Add,
  Edit,
  Delete,
  Assessment,
  Summarize
} from '@mui/icons-material';
import { fetchData } from '../api';

interface SelectedStock {
  symbol: string;
  name: string;
  entry_price: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  target_3: number;
  position_size: number;
  position_value: number;
  current_price: number;
  ema10: number;
  ema20: number;
  scan_date: string;
  buyInitiated?: boolean;
  highestPriceAfterSelection?: number | null;
  lowestPriceAfterSelection?: number | null;
  priceAnalysisPeriod?: number;
  buy_initiated?: boolean; // Database field name
  highest_price_after_selection?: number | null; // Database field name
  lowest_price_after_selection?: number | null; // Database field name
  price_analysis_period?: number; // Database field name
}

interface SelectedStocksProps {
  setSnack: (snack: { open: boolean; msg: string; severity: 'success' | 'error' | 'warning' | 'info' }) => void;
}

const SelectedStocks: React.FC<SelectedStocksProps> = ({ setSnack }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [stocks, setStocks] = useState<SelectedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<SelectedStock | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStocks, setTotalStocks] = useState(0);
  const [trackingPrices, setTrackingPrices] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any>(null);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    fetchSelectedStocks();
    fetchSummary();
  }, [page]);

  useEffect(() => {
    // Refresh summary when price tracking completes
    if (!trackingPrices && summaryOpen) {
      fetchSummary();
    }
  }, [trackingPrices, summaryOpen]);

  const fetchSelectedStocks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchData(`/selected?page=${page}&limit=10`);
      
      if (response.success) {
        setStocks(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotalStocks(response.pagination?.total || 0);
      } else {
        setError('Failed to fetch selected stocks');
        setSnack({ open: true, msg: 'Failed to fetch selected stocks', severity: 'error' });
      }
    } catch (err) {
      console.error('Error fetching selected stocks:', err);
      setError('Error fetching selected stocks');
      setSnack({ open: true, msg: 'Error fetching selected stocks', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Group stocks by scan date
  const groupStocksByDate = (stocks: SelectedStock[]) => {
    const grouped: Record<string, SelectedStock[]> = {};
    stocks.forEach(stock => {
      const dateKey = stock.scan_date ? new Date(stock.scan_date).toLocaleDateString() : 'Unknown Date';
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(stock);
    });
    return grouped;
  };

  const groupedStocks = groupStocksByDate(stocks);
  const sortedDates = Object.keys(groupedStocks).sort((a, b) => {
    const dateA = stocks.find(s => new Date(s.scan_date).toLocaleDateString() === a)?.scan_date;
    const dateB = stocks.find(s => new Date(s.scan_date).toLocaleDateString() === b)?.scan_date;
    if (!dateA || !dateB) return 0;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || isNaN(price)) return '₹0.00';
    return `₹${Number(price).toFixed(2)}`;
  };

  const safeToFixed = (value: any, decimals: number = 2): string => {
    const num = Number(value);
    if (isNaN(num) || num === null || num === undefined) return '0.00';
    return num.toFixed(decimals);
  };

  const safeNumber = (value: any): number => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  const calculatePnL = (current: number, entry: number) => {
    if (!entry || entry === 0) return 0;
    return ((current - entry) / entry) * 100;
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? 'success' : 'error';
  };

  const handleViewDetails = async (stock: SelectedStock) => {
    setSelectedStock(stock);
    setDetailsOpen(true);
    
    // Fetch price history when opening details
    setPriceHistoryLoading(true);
    try {
      const response = await fetchData(`/selected/${stock.symbol}/prices`);
      if (response.success) {
        setPriceHistory(response.data);
      } else {
        setPriceHistory(null);
      }
    } catch (err) {
      console.error('Error fetching price history:', err);
      setPriceHistory(null);
    } finally {
      setPriceHistoryLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const response = await fetchData('/selected/summary');
      
      if (response.success) {
        setSummary(response.data);
      } else {
        setSummary(null);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleTrackPrices = async () => {
    try {
      setTrackingPrices(true);
      const response = await fetchData('/selected/track-prices', {
        method: 'POST'
      });
      
      if (response.success) {
        setSnack({ 
          open: true, 
          msg: `Price tracking started for ${response.data?.length || 0} stocks`, 
          severity: 'success' 
        });
        // Refresh stocks and summary after a delay
        setTimeout(() => {
          fetchSelectedStocks();
          if (summaryOpen) {
            fetchSummary();
          }
        }, 2000);
      } else {
        setSnack({ 
          open: true, 
          msg: 'Failed to start price tracking', 
          severity: 'error' 
        });
      }
    } catch (err) {
      console.error('Error tracking prices:', err);
      setSnack({ 
        open: true, 
        msg: 'Error starting price tracking', 
        severity: 'error' 
      });
    } finally {
      setTrackingPrices(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%', overflowX: 'hidden' }}>
      <Box sx={{ mb: { xs: 2, sm: 3 } }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} component="h1" gutterBottom>
          Selected Stocks
        </Typography>
        <Typography variant={isMobile ? 'body2' : 'body1'} color="text.secondary" sx={{ mb: 2 }}>
          Stocks that passed the analysis and are ready for trading
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: { xs: 1, sm: 2 }, 
          mb: 2,
          alignItems: 'center'
        }}>
          <Chip 
            label={`Total: ${totalStocks}`} 
            color="primary" 
            variant="outlined"
            size={isMobile ? 'small' : 'medium'}
          />
          <Chip 
            label={`Page: ${page} of ${totalPages}`} 
            color="secondary" 
            variant="outlined"
            size={isMobile ? 'small' : 'medium'}
          />
          <Button
            variant="contained"
            color="primary"
            startIcon={trackingPrices ? <CircularProgress size={16} /> : <TrendingUp />}
            onClick={handleTrackPrices}
            disabled={trackingPrices || totalStocks === 0}
            size={isMobile ? 'small' : 'medium'}
          >
            {trackingPrices ? 'Tracking Prices...' : 'Run Selected Scan'}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<Assessment />}
            onClick={() => {
              setSummaryOpen(true);
              // Only fetch summary if we don't already have it
              if (!summary && !summaryLoading) {
                fetchSummary();
              }
            }}
            size={isMobile ? 'small' : 'medium'}
          >
            View Summary
          </Button>
        </Box>
      </Box>

      {sortedDates.length === 0 && stocks.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No selected stocks found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Run a scan to find qualified stocks
          </Typography>
        </Box>
      )}

      {sortedDates.map((dateKey) => (
        <Box key={dateKey} sx={{ mb: { xs: 3, sm: 4 } }}>
          <Box sx={{ mb: { xs: 1.5, sm: 2 }, pb: 1, borderBottom: '2px solid', borderColor: 'divider' }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" gutterBottom>
              {dateKey}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {groupedStocks[dateKey].length} stock{groupedStocks[dateKey].length !== 1 ? 's' : ''} selected
            </Typography>
          </Box>
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: { 
              xs: '1fr', 
              sm: 'repeat(2, 1fr)', 
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)' 
            },
            gap: { xs: 2, sm: 3 }
          }}>
            {groupedStocks[dateKey].map((stock) => {
              const pnl = calculatePnL(stock.current_price, stock.entry_price);
              return (
                <Box key={`${dateKey}-${stock.symbol}`}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                          <Typography variant="h6" fontWeight="bold">
                            {stock.symbol}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {stock.name}
                          </Typography>
                        </Box>
                        <Chip
                          label={pnl >= 0 ? `+${Number(pnl).toFixed(2)}%` : `${Number(pnl).toFixed(2)}%`}
                          color={getPnLColor(pnl)}
                          size="small"
                        />
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Entry Price
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          {formatPrice(stock.entry_price)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Stop Loss
                          </Typography>
                          <Typography variant="body2" fontWeight="bold" color="error.main">
                            {formatPrice(stock.stop_loss)}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Current Price
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {formatPrice(stock.current_price)}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Targets
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip label={`T1: ${formatPrice(stock.target_1)}`} size="small" color="success" variant="outlined" />
                          <Chip label={`T2: ${formatPrice(stock.target_2)}`} size="small" color="info" variant="outlined" />
                          <Chip label={`T3: ${formatPrice(stock.target_3)}`} size="small" color="warning" variant="outlined" />
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Position Size
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {stock.position_size} shares
                          </Typography>
                        </Box>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => handleViewDetails(stock)}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
            size="large"
          />
        </Box>
      )}

      {/* Stock Details Dialog */}
      <Dialog 
        open={detailsOpen} 
        onClose={() => {
          setDetailsOpen(false);
          setPriceHistory(null);
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          Stock Details - {selectedStock?.symbol}
        </DialogTitle>
        <DialogContent>
          {selectedStock && (
            <Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
                  <Typography variant="h6" gutterBottom>
                    Basic Information
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Company Name</Typography>
                    <Typography variant="body1" fontWeight="bold">{selectedStock.name}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Symbol</Typography>
                    <Typography variant="body1" fontWeight="bold">{selectedStock.symbol}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Scan Date</Typography>
                    <Typography variant="body1">{new Date(selectedStock.scan_date).toLocaleDateString()}</Typography>
                  </Box>
                </Box>
                
                <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
                  <Typography variant="h6" gutterBottom>
                    Trading Parameters
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Entry Price</Typography>
                    <Typography variant="body1" fontWeight="bold">{formatPrice(selectedStock.entry_price)}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Stop Loss</Typography>
                    <Typography variant="body1" fontWeight="bold" color="error.main">{formatPrice(selectedStock.stop_loss)}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Position Size</Typography>
                    <Typography variant="body1" fontWeight="bold">{selectedStock.position_size} shares</Typography>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Price Movement Summary */}
              {priceHistory && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Price Performance
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      label={`Current Price: ${formatPrice(priceHistory.currentPrice)}`}
                      color={priceHistory.priceMovement >= 0 ? 'success' : 'error'}
                      variant="outlined"
                    />
                    <Chip
                      label={`Movement: ${safeNumber(priceHistory.priceMovement) >= 0 ? '+' : ''}${safeToFixed(priceHistory.priceMovement)}%`}
                      color={safeNumber(priceHistory.priceMovement) >= 0 ? 'success' : 'error'}
                      variant="filled"
                    />
                  </Box>

                  {/* Targets Hit Status */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Targets Reached:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {priceHistory.targetsHit && priceHistory.targetsHit.length > 0 ? (
                        priceHistory.targetsHit.map((target: any) => (
                          <Chip
                            key={target.type}
                            label={`${target.type.toUpperCase()}: ${formatPrice(target.price)} on ${new Date(target.date).toLocaleDateString()}`}
                            color="success"
                            size="small"
                            icon={<CheckCircle />}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No targets reached yet
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Stop Loss Status */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Stop Loss Status:
                    </Typography>
                    {priceHistory.stoplossHit ? (
                      <Chip
                        label={`Hit on ${new Date(priceHistory.stoplossHit.date).toLocaleDateString()} at ${formatPrice(priceHistory.stoplossHit.price)}`}
                        color="error"
                        icon={<Cancel />}
                      />
                    ) : (
                      <Chip
                        label="Not Hit"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              )}

              <Divider sx={{ my: 3 }} />

              {/* Price History Table */}
              <Typography variant="h6" gutterBottom>
                Daily Price History
              </Typography>
              {priceHistoryLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : priceHistory && priceHistory.prices && priceHistory.prices.length > 0 ? (
                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Date</strong></TableCell>
                        <TableCell align="right"><strong>Open</strong></TableCell>
                        <TableCell align="right"><strong>High</strong></TableCell>
                        <TableCell align="right"><strong>Low</strong></TableCell>
                        <TableCell align="right"><strong>Close</strong></TableCell>
                        <TableCell align="right"><strong>Volume</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {priceHistory.prices.map((price: any, index: number) => {
                        const isTargetHit = priceHistory.targetsHit?.some((t: any) => t.date === price.date);
                        const isStoplossHit = priceHistory.stoplossHit?.date === price.date;
                        
                        return (
                          <TableRow 
                            key={index}
                            sx={{
                              backgroundColor: isStoplossHit ? 'error.light' : isTargetHit ? 'success.light' : 'inherit',
                              '&:hover': { backgroundColor: 'action.hover' }
                            }}
                          >
                            <TableCell>{new Date(price.date).toLocaleDateString()}</TableCell>
                            <TableCell align="right">{formatPrice(price.open)}</TableCell>
                            <TableCell align="right">{formatPrice(price.high)}</TableCell>
                            <TableCell align="right">{formatPrice(price.low)}</TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                {formatPrice(price.close)}
                                {isTargetHit && <CheckCircle fontSize="small" color="success" />}
                                {isStoplossHit && <Cancel fontSize="small" color="error" />}
                              </Box>
                            </TableCell>
                            <TableCell align="right">{price.volume.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">
                  No price history available. Click "Run Selected Scan" to start tracking prices.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetailsOpen(false);
            setPriceHistory(null);
          }}>Close          </Button>
        </DialogActions>
      </Dialog>

      {/* Summary Dialog */}
      <Dialog 
        open={summaryOpen} 
        onClose={() => setSummaryOpen(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Summarize />
            <Typography variant="h6">Selected Stocks Summary</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {summaryLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : summary && summary.totalStocks > 0 ? (
            <Box>
              {/* Overall Statistics */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Overall Statistics
                </Typography>
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                  gap: 2 
                }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Total Stocks</Typography>
                      <Typography variant="h5" fontWeight="bold">{summary.totalStocks}</Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Total Portfolio Value</Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary">
                        ₹{safeNumber(summary.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Total P&L</Typography>
                      <Typography 
                        variant="h5" 
                        fontWeight="bold" 
                        color={safeNumber(summary.totalPnL) >= 0 ? 'success.main' : 'error.main'}
                      >
                        {safeNumber(summary.totalPnL) >= 0 ? '+' : ''}₹{safeNumber(summary.totalPnL).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Average P&L</Typography>
                      <Typography 
                        variant="h5" 
                        fontWeight="bold"
                        color={safeNumber(summary.averagePnL) >= 0 ? 'success.main' : 'error.main'}
                      >
                        {safeNumber(summary.averagePnL) >= 0 ? '+' : ''}₹{safeNumber(summary.averagePnL).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>

              {/* Performance Breakdown */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Performance Breakdown
                </Typography>
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 2 
                }}>
                  <Card variant="outlined" sx={{ borderColor: 'success.main' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TrendingUp color="success" />
                        <Typography variant="subtitle1" fontWeight="bold">In Profit</Typography>
                      </Box>
                      <Typography variant="h4" color="success.main">{summary.stocksInProfit}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {summary.totalStocks > 0 ? ((summary.stocksInProfit / summary.totalStocks) * 100).toFixed(1) : 0}% of portfolio
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined" sx={{ borderColor: 'error.main' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TrendingDown color="error" />
                        <Typography variant="subtitle1" fontWeight="bold">In Loss</Typography>
                      </Box>
                      <Typography variant="h4" color="error.main">{summary.stocksInLoss}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {summary.totalStocks > 0 ? ((summary.stocksInLoss / summary.totalStocks) * 100).toFixed(1) : 0}% of portfolio
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Cancel color="warning" />
                        <Typography variant="subtitle1" fontWeight="bold">Stop Loss Hit</Typography>
                      </Box>
                      <Typography variant="h4" color="warning.main">{summary.stocksAtStopLoss}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {summary.totalStocks > 0 ? ((summary.stocksAtStopLoss / summary.totalStocks) * 100).toFixed(1) : 0}% of portfolio
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>

              {/* Targets Hit */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Targets Hit
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`Target 1: ${summary.targetsHit.target1} stocks`} 
                    color="success" 
                    variant="outlined"
                    icon={<CheckCircle />}
                  />
                  <Chip 
                    label={`Target 2: ${summary.targetsHit.target2} stocks`} 
                    color="info" 
                    variant="outlined"
                    icon={<CheckCircle />}
                  />
                  <Chip 
                    label={`Target 3: ${summary.targetsHit.target3} stocks`} 
                    color="warning" 
                    variant="outlined"
                    icon={<CheckCircle />}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Individual Stock Details */}
              <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
                Individual Stock Details
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Buy initiation is determined by checking if the stock price reached above the entry price
                (day's high when selected) at any point after the selection date.
                When buy is not initiated, highest and lowest prices since selection are shown.
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Symbol</strong></TableCell>
                      <TableCell><strong>Name</strong></TableCell>
                      <TableCell align="right"><strong>Entry Price</strong></TableCell>
                      <TableCell align="right"><strong>Current Price</strong></TableCell>
                      <TableCell align="right"><strong>% Move</strong></TableCell>
                      <TableCell align="right"><strong>Status</strong></TableCell>
                      <TableCell align="right"><strong>Highest (After Selection)</strong></TableCell>
                      <TableCell align="right"><strong>Lowest (After Selection)</strong></TableCell>
                      <TableCell><strong>Details</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.stocks.map((stock: any, index: number) => {
                      // Use server-calculated buy initiation status based on price history after selection date
                      // Handle backward compatibility for when these fields don't exist yet
                      // Check both camelCase (processed) and snake_case (raw from DB) field names
                      const buyInitiated = (stock.buyInitiated !== undefined ? stock.buyInitiated :
                                           stock.buy_initiated !== undefined ? stock.buy_initiated : false);

                      // Use server-calculated highest/lowest prices after selection date
                      const highestAfterEntry = (stock.highestPriceAfterSelection !== undefined && stock.highestPriceAfterSelection !== null ? stock.highestPriceAfterSelection :
                                                 stock.highest_price_after_selection !== undefined && stock.highest_price_after_selection !== null ? stock.highest_price_after_selection : 0);
                      const lowestAfterEntry = (stock.lowestPriceAfterSelection !== undefined && stock.lowestPriceAfterSelection !== null ? stock.lowestPriceAfterSelection :
                                                stock.lowest_price_after_selection !== undefined && stock.lowest_price_after_selection !== null ? stock.lowest_price_after_selection : 0);

                      return (
                        <TableRow
                          key={index}
                          sx={{
                            '&:hover': { backgroundColor: 'action.hover' }
                          }}
                        >
                          <TableCell><strong>{stock.symbol}</strong></TableCell>
                          <TableCell>{stock.name}</TableCell>
                          <TableCell align="right">₹{safeToFixed(stock.entryPrice)}</TableCell>
                          <TableCell align="right">₹{safeToFixed(stock.currentPrice)}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${safeNumber(stock.priceMovement) >= 0 ? '+' : ''}${safeToFixed(stock.priceMovement)}%`}
                              color={safeNumber(stock.priceMovement) >= 0 ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {buyInitiated ? (
                              <Chip
                                label="Buy Initiated"
                                color="success"
                                size="small"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                label="Buy Not Initiated"
                                color="warning"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {highestAfterEntry > 0 ? `₹${safeToFixed(highestAfterEntry)}` : 'N/A'}
                          </TableCell>
                          <TableCell align="right">
                            {lowestAfterEntry > 0 ? `₹${safeToFixed(lowestAfterEntry)}` : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {buyInitiated ? (
                              <Box>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                                  <Chip
                                    label={`Buy Initiated (${(stock.priceAnalysisPeriod || stock.price_analysis_period || 0)} days)`}
                                    color="success"
                                    size="small"
                                    variant="outlined"
                                  />
                                  {stock.targetsHit && Array.isArray(stock.targetsHit) && stock.targetsHit.map((target: string) => (
                                    <Chip
                                      key={target}
                                      label={target.toUpperCase()}
                                      color="success"
                                      size="small"
                                      icon={<CheckCircle />}
                                    />
                                  ))}
                                  {stock.stoplossHit && (
                                    <Chip
                                      label="SL"
                                      color="error"
                                      size="small"
                                      icon={<Cancel />}
                                    />
                                  )}
                                  {!stock.stoplossHit && (!stock.targetsHit || !Array.isArray(stock.targetsHit) || stock.targetsHit.length === 0) && (
                                    <Chip label="Active" color="default" size="small" variant="outlined" />
                                  )}
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Highest: ₹{safeToFixed(highestAfterEntry)} | Lowest: ₹{safeToFixed(lowestAfterEntry)}
                                </Typography>
                              </Box>
                            ) : (
                              <Box>
                                <Chip
                                  label={`Buy Not Initiated (${(stock.priceAnalysisPeriod || stock.price_analysis_period || 0)} days)`}
                                  color="warning"
                                  size="small"
                                  variant="outlined"
                                />
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Highest: ₹{safeToFixed(highestAfterEntry)} | Lowest: ₹{safeToFixed(lowestAfterEntry)}
                                </Typography>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Alert severity="info">
              No selected stocks found. Run a scan to find qualified stocks.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Close</Button>
          <Button 
            onClick={() => {
              fetchSummary();
            }}
            variant="outlined"
            disabled={summaryLoading}
          >
            Refresh
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SelectedStocks;
