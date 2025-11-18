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
  Delete
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

  useEffect(() => {
    fetchSelectedStocks();
  }, [page]);

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
        // Refresh stocks after a delay
        setTimeout(() => {
          fetchSelectedStocks();
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
                      label={`Movement: ${priceHistory.priceMovement >= 0 ? '+' : ''}${priceHistory.priceMovement.toFixed(2)}%`}
                      color={priceHistory.priceMovement >= 0 ? 'success' : 'error'}
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
          }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SelectedStocks;
