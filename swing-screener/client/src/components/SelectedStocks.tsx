// src/components/SelectedStocks.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
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
  Pagination
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
  const [stocks, setStocks] = useState<SelectedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<SelectedStock | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(12); // Grid layout 12/4 = 3 per row OR 12/6 = 2 per row
  const [totalStocks, setTotalStocks] = useState(0);

  useEffect(() => {
    fetchSelectedStocks();
  }, [page]);

  const fetchSelectedStocks = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchData(`/selected?page=${page}&limit=${limit}`);

      if (response.success) {
        setStocks(response.data);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotalStocks(response.pagination?.total || 0);
      } else {
        setError('Failed to fetch selected stocks');
      }
    } catch (err) {
      setError('Error fetching selected stocks');
      setSnack({ open: true, msg: 'Error fetching selected stocks', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || isNaN(price)) return '₹0.00';
    return `₹${Number(price).toFixed(2)}`;
  };

  const calculatePnL = (current: number, entry: number) => {
    return ((current - entry) / entry) * 100;
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? 'success' : 'error';
  };

  const handleViewDetails = (stock: SelectedStock) => {
    setSelectedStock(stock);
    setDetailsOpen(true);
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          ✅ Selected Stocks
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Stocks that passed the analysis and are ready for trading
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip
            label={`Total: ${totalStocks}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`Total Value: ₹${stocks.reduce((sum, stock) => sum + stock.position_value, 0).toLocaleString()}`}
            color="success"
            variant="outlined"
          />
          {totalPages > 1 && (
            <Box sx={{ ml: 'auto' }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                shape="rounded"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {stocks.map((stock) => {
          const pnl = calculatePnL(stock.current_price, stock.entry_price);
          return (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={stock.symbol}>
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

                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Stop Loss
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="error.main">
                        {formatPrice(stock.stop_loss)}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Current Price
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {formatPrice(stock.current_price)}
                      </Typography>
                    </Grid>
                  </Grid>

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
            </Grid>
          );
        })}
      </Grid>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
            size="large"
          />
        </Box>
      )}

      {stocks.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No selected stocks found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Run a scan to find qualified stocks
          </Typography>
        </Box>
      )}

      {/* Stock Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Stock Details - {selectedStock?.symbol}
        </DialogTitle>
        <DialogContent>
          {selectedStock && (
            <Box>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
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
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
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
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SelectedStocks;
