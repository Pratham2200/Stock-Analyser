// src/components/Summary.tsx - Performance summary page
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
    TextField
} from '@mui/material';
import {
    TrendingUp,
    TrendingDown,
    CheckCircle,
    Cancel,
    PlayArrow,
    Refresh
} from '@mui/icons-material';
import api from '../api';

interface PerformanceData {
    symbol: string;
    name: string;
    entryPrice: number;
    currentPrice: number;
    changePercent: number;
    highestPrice: number;
    lowestPrice: number;
    t1Reached: boolean;
    t2Reached: boolean;
    t3Reached: boolean;
    stoplossHit: boolean;
    stoplossLevel: number;
    status: 'active' | 'target_hit' | 'stoploss_hit';
    recommendation: string;
    entry_price?: number;
    stop_loss?: number;
    target_1?: number;
    target_2?: number;
    target_3?: number;
}

interface SummaryProps {
    setSnack: (snack: { open: boolean; msg: string; severity: 'success' | 'error' | 'warning' | 'info' }) => void;
}

const Summary: React.FC<SummaryProps> = ({ setSnack }) => {
    const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fromDate, setFromDate] = useState<string>(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );

    const runSelectedScan = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.post('/run-selected-scan', { fromDate });

            if (response.data.success) {
                setPerformanceData(response.data.data);
                setSnack({ open: true, msg: 'Performance scan completed', severity: 'success' });
            } else {
                setError('Failed to run performance scan');
            }
        } catch (err) {
            setError('Error running performance scan');
            setSnack({ open: true, msg: 'Error running performance scan', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price: number | null | undefined) => {
        if (price === null || price === undefined || isNaN(price)) return '₹0.00';
        return `₹${Number(price).toFixed(2)}`;
    };

    const formatPercent = (percent: number | null | undefined) => {
        if (percent === null || percent === undefined || isNaN(percent)) return '0.00%';
        const sign = percent >= 0 ? '+' : '';
        return `${sign}${Number(percent).toFixed(2)}%`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'target_hit': return 'success';
            case 'stoploss_hit': return 'error';
            default: return 'primary';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'target_hit': return 'Target Hit';
            case 'stoploss_hit': return 'Stoploss Hit';
            default: return 'Active';
        }
    };

    // Calculate summary statistics
    const totalStocks = performanceData.length;
    const profitableStocks = performanceData.filter(s => s.changePercent > 0).length;
    const t1HitCount = performanceData.filter(s => s.t1Reached).length;
    const slHitCount = performanceData.filter(s => s.stoplossHit).length;

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    📊 Performance Summary
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Track performance of selected stocks with target and stoploss analysis
                </Typography>
            </Box>

            {/* Controls */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                            label="From Date"
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            size="small"
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
                            onClick={runSelectedScan}
                            disabled={loading}
                        >
                            {loading ? 'Running...' : 'Run Selected Scan'}
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={runSelectedScan}
                            disabled={loading}
                        >
                            Refresh
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
            )}

            {/* Summary Stats */}
            {performanceData.length > 0 && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="primary">{totalStocks}</Typography>
                                <Typography variant="body2" color="text.secondary">Total Stocks</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="success.main">{profitableStocks}</Typography>
                                <Typography variant="body2" color="text.secondary">Profitable</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="info.main">{t1HitCount}</Typography>
                                <Typography variant="body2" color="text.secondary">T1 Reached</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="error.main">{slHitCount}</Typography>
                                <Typography variant="body2" color="text.secondary">SL Hit</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Performance Table */}
            {performanceData.length > 0 ? (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell><strong>Symbol</strong></TableCell>
                                <TableCell align="right"><strong>Buy Price</strong></TableCell>
                                <TableCell align="right"><strong>Current</strong></TableCell>
                                <TableCell align="right"><strong>Change %</strong></TableCell>
                                <TableCell align="right"><strong>High</strong></TableCell>
                                <TableCell align="right"><strong>Low</strong></TableCell>
                                <TableCell align="center"><strong>T1</strong></TableCell>
                                <TableCell align="center"><strong>T2</strong></TableCell>
                                <TableCell align="center"><strong>T3</strong></TableCell>
                                <TableCell align="center"><strong>SL</strong></TableCell>
                                <TableCell><strong>Status</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {performanceData.map((stock) => (
                                <TableRow key={stock.symbol}>
                                    <TableCell>
                                        <Box>
                                            <Typography variant="body2" fontWeight="bold">{stock.symbol}</Typography>
                                            <Typography variant="caption" color="text.secondary">{stock.name}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">{formatPrice(stock.entryPrice || stock.entry_price)}</TableCell>
                                    <TableCell align="right">
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                            {stock.changePercent >= 0 ? <TrendingUp color="success" fontSize="small" /> : <TrendingDown color="error" fontSize="small" />}
                                            {formatPrice(stock.currentPrice)}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            label={formatPercent(stock.changePercent)}
                                            color={stock.changePercent >= 0 ? 'success' : 'error'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="right">{formatPrice(stock.highestPrice)}</TableCell>
                                    <TableCell align="right">{formatPrice(stock.lowestPrice)}</TableCell>
                                    <TableCell align="center">
                                        {stock.t1Reached ? <CheckCircle color="success" /> : <Cancel color="disabled" />}
                                    </TableCell>
                                    <TableCell align="center">
                                        {stock.t2Reached ? <CheckCircle color="success" /> : <Cancel color="disabled" />}
                                    </TableCell>
                                    <TableCell align="center">
                                        {stock.t3Reached ? <CheckCircle color="success" /> : <Cancel color="disabled" />}
                                    </TableCell>
                                    <TableCell align="center">
                                        {stock.stoplossHit ? <Cancel color="error" /> : <CheckCircle color="success" />}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={getStatusLabel(stock.status)}
                                            color={getStatusColor(stock.status) as any}
                                            size="small"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                !loading && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="h6" color="text.secondary">
                            No performance data yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Click "Run Selected Scan" to analyze selected stocks
                        </Typography>
                    </Box>
                )
            )}
        </Box>
    );
};

export default Summary;
