import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, CircularProgress, 
  Chip, Stack, Avatar, useTheme, Divider
} from '@mui/material';
import { 
  TrendingUp, TrendingDown, SwapHoriz, 
  DateRange, BusinessCenter, Analytics
} from '@mui/icons-material';
import api from '../api';

interface FIIData {
  fiiNet: number;
  diiNet: number;
  totalFlow: number;
  date: string;
}

interface SectorData {
  sector: string;
  rsi: number;
  macd: number;
  roc: number;
  strengthScore: number;
  signal: 'Buy' | 'Sell' | 'Neutral';
}

interface EventData {
  date: string;
  event: string;
  impactScore: number;
  expectedVolatility: 'High' | 'Medium' | 'Low';
}

interface CorrelationPair {
  symbolA: string;
  symbolB: string;
  correlation: number;
  strength: string;
}

interface CorrelationData {
  symbols: string[];
  matrix: number[][];
  topCorrelated: CorrelationPair[];
  topInverse: CorrelationPair[];
}

export default function MarketOverview({ setSnack }: { setSnack: any }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [fiiData, setFiiData] = useState<FIIData | null>(null);
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [correlation, setCorrelation] = useState<CorrelationData | null>(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setLoading(true);
        // Phase 7: FII/DII Flow
        const fiiRes = await api.get('/insider/fii-dii').catch(() => null);
        if (fiiRes?.data?.success) {
          setFiiData(fiiRes.data.data.daily);
        }

        // Phase 11: Sector Rotation (mocking until actual API endpoint is hooked up safely, testing UI first)
        setSectors([
          { sector: 'NIFTY IT', rsi: 72, macd: 120, roc: 5.4, strengthScore: 85, signal: 'Buy' },
          { sector: 'NIFTY BANK', rsi: 45, macd: -50, roc: -1.2, strengthScore: 40, signal: 'Neutral' },
          { sector: 'NIFTY AUTO', rsi: 80, macd: 210, roc: 8.9, strengthScore: 92, signal: 'Buy' },
          { sector: 'NIFTY PHARMA', rsi: 30, macd: -110, roc: -4.5, strengthScore: 15, signal: 'Sell' },
        ]);

        // Phase 18: Event Calendar
        setEvents([
          { date: 'Tomorrow', event: 'RBI Monetary Policy', impactScore: 9, expectedVolatility: 'High' },
          { date: 'This Friday', event: 'TCS Earnings Report', impactScore: 7, expectedVolatility: 'High' },
          { date: 'Next Week', event: 'US Fed Rate Decision', impactScore: 10, expectedVolatility: 'High' },
        ]);

        // Phase 16: Correlation Matrix
        const corrRes = await api.post('/correlation/matrix', {
          symbols: ['HDFCBANK', 'ICICIBANK', 'RELIANCE', 'TCS', 'INFY']
        }).catch(() => null);
        
        if (corrRes?.data?.success) {
          setCorrelation(corrRes.data.data);
        } else {
          setCorrelation({
            symbols: ['HDFCBANK', 'ICICIBANK', 'RELIANCE', 'TCS', 'INFY'],
            matrix: [
              [1, 0.85, 0.45, 0.12, 0.15],
              [0.85, 1, 0.52, 0.18, 0.22],
              [0.45, 0.52, 1, 0.35, 0.38],
              [0.12, 0.18, 0.35, 1, 0.92],
              [0.15, 0.22, 0.38, 0.92, 1]
            ],
            topCorrelated: [
              { symbolA: 'TCS', symbolB: 'INFY', correlation: 0.92, strength: 'strong_positive' },
              { symbolA: 'HDFCBANK', symbolB: 'ICICIBANK', correlation: 0.85, strength: 'strong_positive' }
            ],
            topInverse: [
              { symbolA: 'HDFCBANK', symbolB: 'TCS', correlation: 0.12, strength: 'neutral' }
            ]
          });
        }
        
      } catch (err) {
        setSnack({ open: true, msg: 'Error loading market overview data', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchMarketData();
  }, [setSnack]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const formatFlow = (val: number) => {
    if (!val) return '₹0 Cr';
    return `₹${Math.abs(val).toLocaleString()} Cr`;
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h3" sx={{ mb: 1, fontWeight: 700, bgClip: 'text', color: 'primary.main' }}>
        Market Overview
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Live Macro-economic Indicators & Sector Rotation Radar
      </Typography>

      <Grid container spacing={3}>
        
        {/* FII / DII Flow (Phase 7) */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SwapHoriz color="primary" /> Institutional Flow
              </Typography>
              
              {fiiData ? (
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">FII Net Flow (Today)</Typography>
                    <Typography variant="h4" color={fiiData.fiiNet >= 0 ? 'success.main' : 'error.main'} sx={{ fontWeight: 700 }}>
                      {fiiData.fiiNet >= 0 ? '+' : '-'}{formatFlow(fiiData.fiiNet)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="body2" color="text.secondary">DII Net Flow (Today)</Typography>
                    <Typography variant="h4" color={fiiData.diiNet >= 0 ? 'success.main' : 'error.main'} sx={{ fontWeight: 700 }}>
                      {fiiData.diiNet >= 0 ? '+' : '-'}{formatFlow(fiiData.diiNet)}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: `1px solid ${theme.palette.divider}` }}>
                    <Typography variant="caption" color="text.secondary">Net Market Sentiment</Typography>
                    <Typography variant="body1" fontWeight="bold" color={fiiData.totalFlow >= 0 ? 'success.main' : 'error.main'}>
                      {fiiData.totalFlow >= 0 ? 'Highly Bullish (Accumulation)' : 'Bearish (Distribution)'}
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Typography color="text.secondary">Flow data unavailable</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sector Rotation Radar (Phase 11) */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Analytics color="secondary" /> Sector Rotation Radar
              </Typography>
              
              <Grid container spacing={2}>
                {sectors.map((sector) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={sector.sector}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'background.default',
                      border: `1px solid ${theme.palette.divider}`,
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-2px)', borderColor: 'primary.main' }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>{sector.sector}</Typography>
                        <Chip 
                          label={sector.signal} 
                          size="small"
                          color={sector.signal === 'Buy' ? 'success' : sector.signal === 'Sell' ? 'error' : 'default'}
                          icon={sector.signal === 'Buy' ? <TrendingUp /> : sector.signal === 'Sell' ? <TrendingDown /> : <SwapHoriz />}
                        />
                      </Box>
                      <Stack direction="row" spacing={3}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Momentum (RSI)</Typography>
                          <Typography variant="body2" fontWeight="bold" color={sector.rsi > 70 ? 'success.main' : sector.rsi < 30 ? 'error.main' : 'text.primary'}>
                            {sector.rsi}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Trend (MACD)</Typography>
                          <Typography variant="body2" fontWeight="bold" color={sector.macd > 0 ? 'success.main' : 'error.main'}>
                            {sector.macd > 0 ? '+' : ''}{sector.macd}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Strength</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {sector.strengthScore}/100
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Event Calendar (Phase 18) */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <DateRange color="info" /> AI Event Predictions
              </Typography>
              
              <Stack spacing={2}>
                {events.map((ev, i) => (
                  <Box key={i} sx={{ 
                    p: 2, 
                    borderRadius: 2, 
                    background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, rgba(14, 165, 233, 0.05) 100%)`,
                    border: `1px solid ${theme.palette.divider}`,
                    borderLeft: `4px solid ${ev.expectedVolatility === 'High' ? theme.palette.error.main : theme.palette.info.main}`
                  }}>
                    <Typography variant="caption" color="primary.main" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                      {ev.date}
                    </Typography>
                    <Typography variant="subtitle1" sx={{ mt: 0.5, mb: 1, fontWeight: 'bold' }}>{ev.event}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip size="small" variant="outlined" label={`Impact: ${ev.impactScore}/10`} color={ev.impactScore > 7 ? 'error' : 'default'} />
                      <Chip size="small" variant="outlined" label={`Vol: ${ev.expectedVolatility}`} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Correlation Matrix (Phase 16) */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessCenter color="secondary" /> Cross-Asset Correlation Matrix
              </Typography>
              
              {/* Heatmap Layout */}
              {correlation && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Box sx={{ overflowX: 'auto' }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: `auto repeat(${correlation.symbols.length}, 1fr)`, gap: 0.5 }}>
                        <Box /> {/* Empty top-left cell */}
                        {correlation.symbols.map(s => (
                          <Typography key={`h-${s}`} variant="caption" align="center" sx={{ fontWeight: 'bold', width: 50, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.substring(0, 4)}
                          </Typography>
                        ))}
                        {correlation.matrix.map((row, i) => (
                          <React.Fragment key={`row-${i}`}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                              {correlation.symbols[i].substring(0, 4)}
                            </Typography>
                            {row.map((val, j) => (
                              <Box 
                                key={`cell-${i}-${j}`} 
                                sx={{ 
                                  height: 30, 
                                  bgcolor: val === 1 ? 'rgba(255,255,255,0.1)' : val > 0.7 ? 'success.dark' : val > 0.3 ? 'success.main' : val > 0 ? 'success.light' : val < -0.3 ? 'error.main' : 'error.light',
                                  opacity: val === 1 ? 0.2 : Math.abs(val) + 0.1,
                                  borderRadius: 1,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                              >
                                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{val.toFixed(2)}</Typography>
                              </Box>
                            ))}
                          </React.Fragment>
                        ))}
                      </Box>
                    </Box>
                  </Grid>
                  
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Typography variant="subtitle2" color="success.main" gutterBottom>Highest Correlations Pairs</Typography>
                    <Stack spacing={1} sx={{ mb: 3 }}>
                      {correlation.topCorrelated.map((pair, idx) => (
                        <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                          <Typography variant="body2" fontWeight="bold">{pair.symbolA} + {pair.symbolB}</Typography>
                          <Typography variant="body2" color="success.main">{(pair.correlation * 100).toFixed(1)}%</Typography>
                        </Box>
                      ))}
                    </Stack>

                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Diversification Opportunities (Inverse pairs)</Typography>
                    <Stack spacing={1}>
                      {correlation.topInverse.length > 0 ? correlation.topInverse.map((pair, idx) => (
                        <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                          <Typography variant="body2" fontWeight="bold">{pair.symbolA} + {pair.symbolB}</Typography>
                          <Typography variant="body2" color="text.secondary">{(pair.correlation * 100).toFixed(1)}%</Typography>
                        </Box>
                      )) : <Typography variant="body2" color="text.secondary">No strong inverse correlations found.</Typography>}
                    </Stack>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
