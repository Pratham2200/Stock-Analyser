// src/components/RejectedStocks.tsx
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  ExpandMore,
  Warning,
  Error
} from '@mui/icons-material';
import { fetchData } from '../api';

interface RejectedStock {
  id: string;
  symbol: string;
  name: string;
  qualified: boolean;
  fail_step: number;
  fail_reason: string;
  current_price: number;
  ema10: number;
  ema20: number;
  scan_date: string;
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

interface RejectedStocksProps {
  setSnack: (snack: { open: boolean; msg: string; severity: 'success' | 'error' | 'warning' | 'info' }) => void;
}

const RejectedStocks: React.FC<RejectedStocksProps> = ({ setSnack }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [stocks, setStocks] = useState<RejectedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<RejectedStock | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStocks, setTotalStocks] = useState(0);

  useEffect(() => {
    fetchRejectedStocks();
  }, [page]);

  const fetchRejectedStocks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchData(`/rejected?page=${page}&limit=10`);
      
      if (response.success) {
        setStocks(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotalStocks(response.pagination?.total || 0);
      } else {
        setError('Failed to fetch rejected stocks');
        setSnack({ open: true, msg: 'Failed to fetch rejected stocks', severity: 'error' });
      }
    } catch (err) {
      console.error('Error fetching rejected stocks:', err);
      setError('Error fetching rejected stocks');
      setSnack({ open: true, msg: 'Error fetching rejected stocks', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || isNaN(price)) return '₹0.00';
    return `₹${Number(price).toFixed(2)}`;
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

  const getFailStepName = (step: number) => {
    const steps = ['Analysis', 'Higher Low', 'Volume Pump', 'Bear Squeeze', 'Consolidation'];
    return steps[step] || 'Unknown';
  };

  const handleViewDetails = (stock: RejectedStock) => {
    setSelectedStock(stock);
    setDetailsOpen(true);
  };

  // Group stocks by scan date
  const groupStocksByDate = (stocks: RejectedStock[]) => {
    const grouped: Record<string, RejectedStock[]> = {};
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
    const dateA = stocks.find(s => s.scan_date && new Date(s.scan_date).toLocaleDateString() === a)?.scan_date;
    const dateB = stocks.find(s => s.scan_date && new Date(s.scan_date).toLocaleDateString() === b)?.scan_date;
    if (!dateA || !dateB) return 0;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

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
          Rejected Stocks
        </Typography>
        <Typography variant={isMobile ? 'body2' : 'body1'} color="text.secondary" sx={{ mb: 2 }}>
          Stocks that failed the analysis criteria
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: { xs: 1, sm: 2 }, 
          mb: 2 
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
        </Box>
      </Box>

      {sortedDates.length === 0 && stocks.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No rejected stocks found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All stocks passed the analysis
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
              {groupedStocks[dateKey].length} stock{groupedStocks[dateKey].length !== 1 ? 's' : ''} rejected
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
            {groupedStocks[dateKey].map((stock) => (
              <Box key={`${dateKey}-${stock.id}`}>
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
                        label={stock.strategy_details.overall.grade}
                        color={getGradeColor(stock.strategy_details.overall.grade) as any}
                        size="small"
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Current Price
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {formatPrice(stock.current_price)}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Failed At
                      </Typography>
                      <Chip
                        label={getFailStepName(stock.fail_step)}
                        color="error"
                        size="small"
                        icon={<Error />}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Analysis Results
                      </Typography>
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
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          EMA10: {formatPrice(stock.ema10)}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          EMA20: {formatPrice(stock.ema20)}
                        </Typography>
                      </Box>
                      <Tooltip title="View Analysis Details">
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
            ))}
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

      {/* Stock Analysis Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Analysis Details - {selectedStock?.symbol}
        </DialogTitle>
        <DialogContent>
          {selectedStock && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Overall Analysis
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mb: 3 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">Grade</Typography>
                  <Chip
                    label={selectedStock.strategy_details.overall.grade}
                    color={getGradeColor(selectedStock.strategy_details.overall.grade) as any}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">Score</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {selectedStock.strategy_details.overall.score}/100
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">Risk Level</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {selectedStock.strategy_details.overall.riskLevel}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">Confidence</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {selectedStock.strategy_details.overall.confidence ? (Number(selectedStock.strategy_details.overall.confidence) * 100).toFixed(1) : '0.0'}%
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Detailed Analysis
              </Typography>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">Higher Low Analysis</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Status: {selectedStock.strategy_details.higherLow.status}</Typography>
                    <Typography variant="body2" color="text.secondary">Trend: {selectedStock.strategy_details.higherLow.trend}</Typography>
                    <Typography variant="body2" color="text.secondary">Strength: {selectedStock.strategy_details.higherLow.strength ? (Number(selectedStock.strategy_details.higherLow.strength) * 100).toFixed(1) : '0.0'}%</Typography>
                    <Typography variant="body2" color="text.secondary">Reason: {selectedStock.strategy_details.higherLow.reason}</Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">Volume Pump Analysis</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Status: {selectedStock.strategy_details.volumePump.status}</Typography>
                    <Typography variant="body2" color="text.secondary">Volume Ratio: {selectedStock.strategy_details.volumePump.volumeRatio}</Typography>
                    <Typography variant="body2" color="text.secondary">Reason: {selectedStock.strategy_details.volumePump.reason}</Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">Bear Squeeze Analysis</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Status: {selectedStock.strategy_details.bearSqueeze.status}</Typography>
                    <Typography variant="body2" color="text.secondary">Squeeze Count: {selectedStock.strategy_details.bearSqueeze.squeezeCount}</Typography>
                    <Typography variant="body2" color="text.secondary">Reason: {selectedStock.strategy_details.bearSqueeze.reason}</Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">Consolidation Analysis</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Status: {selectedStock.strategy_details.consolidation.status}</Typography>
                    <Typography variant="body2" color="text.secondary">Range: {selectedStock.strategy_details.consolidation.range.low} - {selectedStock.strategy_details.consolidation.range.high}</Typography>
                    <Typography variant="body2" color="text.secondary">Range %: {selectedStock.strategy_details.consolidation.range.rangePercent}%</Typography>
                    <Typography variant="body2" color="text.secondary">Reason: {selectedStock.strategy_details.consolidation.reason}</Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>
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

export default RejectedStocks;
