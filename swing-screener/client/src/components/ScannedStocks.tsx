// src/components/ScannedStocks.tsx
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
  Pagination,
  Chip as MuiChip,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle,
  Cancel,
  Visibility
} from '@mui/icons-material';
import { fetchData } from '../api';

interface ScannedStock {
  id: string;
  symbol: string;
  name: string;
  qualified: boolean;
  fail_step: number;
  fail_reason: string;
  current_price: number;
  ema10: number;
  ema20: number;
  strategy_details: {
    overall: {
      grade: string;
      score: number;
      riskLevel: string;
      confidence: number;
      recommendation: string;
    };
    higherLow: {
      pass: boolean;
      trend: string;
      reason: string;
      status: string;
      strength: number;
    };
    volumePump: {
      pass: boolean;
      reason: string;
      status: string;
      volumeRatio: number;
    };
    bearSqueeze: {
      pass: boolean;
      reason: string;
      status: string;
      squeezeCount: number;
    };
    consolidation: {
      pass: boolean;
      reason: string;
      status: string;
      range: {
        low: number;
        high: number;
        range: number;
        rangePercent: number;
      };
    };
  };
  analysis_duration_ms: number;
  data_points_daily: number;
  data_points_intraday: number;
}

interface ScannedStocksProps {
  setSnack: (snack: { open: boolean; msg: string; severity: 'success' | 'error' | 'warning' | 'info' }) => void;
}

const ScannedStocks: React.FC<ScannedStocksProps> = ({ setSnack }) => {
  const [stocks, setStocks] = useState<ScannedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStocks, setTotalStocks] = useState(0);

  useEffect(() => {
    fetchScannedStocks();
  }, [page]);

  const fetchScannedStocks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchData(`/stocks?page=${page}&limit=10`);
      
      if (response.success) {
        setStocks(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotalStocks(response.pagination?.total || 0);
      } else {
        setError('Failed to fetch scanned stocks');
        setSnack({ open: true, msg: 'Failed to fetch scanned stocks', severity: 'error' });
      }
    } catch (err) {
      console.error('Error fetching scanned stocks:', err);
      setError('Error fetching scanned stocks');
      setSnack({ open: true, msg: 'Error fetching scanned stocks', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (qualified: boolean) => {
    return qualified ? 'success' : 'error';
  };

  const getStatusIcon = (qualified: boolean) => {
    return qualified ? <CheckCircle /> : <Cancel />;
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'success';
      case 'B': return 'info';
      case 'C': return 'warning';
      case 'D': return 'error';
      default: return 'default';
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || isNaN(price)) return '₹0.00';
    return `₹${Number(price).toFixed(2)}`;
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '0.0%';
    return `${(Number(value) * 100).toFixed(1)}%`;
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
          📊 Scanned Stocks
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          All stocks fetched from the scanner with detailed analysis
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Chip 
            label={`Total: ${totalStocks}`} 
            color="primary" 
            variant="outlined" 
          />
          <Chip 
            label={`Qualified: ${stocks.filter(s => s.qualified).length}`} 
            color="success" 
            variant="outlined" 
          />
          <Chip 
            label={`Rejected: ${stocks.filter(s => !s.qualified).length}`} 
            color="error" 
            variant="outlined" 
          />
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Stock</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell>EMA</TableCell>
              <TableCell>Analysis</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stocks.map((stock) => (
              <TableRow key={stock.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {stock.symbol}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stock.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    {formatPrice(stock.current_price)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={getStatusIcon(stock.qualified)}
                    label={stock.qualified ? 'Qualified' : 'Rejected'}
                    color={getStatusColor(stock.qualified)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={stock.strategy_details.overall.grade}
                    color={getGradeColor(stock.strategy_details.overall.grade) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="caption" display="block">
                      EMA10: {formatPrice(stock.ema10)}
                    </Typography>
                    <Typography variant="caption" display="block">
                      EMA20: {formatPrice(stock.ema20)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Tooltip title={`Higher Low: ${stock.strategy_details.higherLow.status}`}>
                      <Chip
                        label="HL"
                        size="small"
                        color={stock.strategy_details.higherLow.pass ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </Tooltip>
                    <Tooltip title={`Volume Pump: ${stock.strategy_details.volumePump.status}`}>
                      <Chip
                        label="VP"
                        size="small"
                        color={stock.strategy_details.volumePump.pass ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </Tooltip>
                    <Tooltip title={`Bear Squeeze: ${stock.strategy_details.bearSqueeze.status}`}>
                      <Chip
                        label="BS"
                        size="small"
                        color={stock.strategy_details.bearSqueeze.pass ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </Tooltip>
                    <Tooltip title={`Consolidation: ${stock.strategy_details.consolidation.status}`}>
                      <Chip
                        label="C"
                        size="small"
                        color={stock.strategy_details.consolidation.pass ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>
                  <Tooltip title="View Details">
                    <IconButton size="small" color="primary">
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
    </Box>
  );
};

export default ScannedStocks;
