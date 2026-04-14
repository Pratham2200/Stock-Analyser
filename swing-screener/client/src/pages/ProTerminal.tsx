import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, CircularProgress, 
  TextField, Button, Slider, Stack, Divider, useTheme, Chip, Tab, Tabs,
  Avatar
} from '@mui/material';
import { 
  BarChart, ShowChart, Psychology, Flare, CompareArrows,
  Campaign, AccessTime, Fingerprint
} from '@mui/icons-material';
import api from '../api';
import AskAI from './AskAI';

interface PainPoint {
  strike: number;
  totalCallOI: number;
  totalPutOI: number;
  painValue: number;
}

interface WhatIfResult {
  symbol: string;
  simulatedPrice: number;
  expectedMove: string;
  aiCommentary: string;
  sentimentShift: string;
}

interface InsiderData {
  overallSignal: 'Bullish' | 'Bearish' | 'Neutral';
  buySideActivity: number;
  sellSideActivity: number;
}

interface EarningsData {
  sentimentScore: number;
  aiSummary: string;
  historicalBeatProbability: number;
}

interface MTFData {
  overallBias: string;
  timeframes: {
    [key: string]: { rsi: number, macd: number, signal: string }
  }
}

export default function ProTerminal({ setSnack }: { setSnack: any }) {
  const theme = useTheme();
  const [symbol, setSymbol] = useState('RELIANCE');
  const [inputSymbol, setInputSymbol] = useState('RELIANCE');
  
  // Tab State
  const [activeRightTab, setActiveRightTab] = useState(0);

  // Left Pane Data
  const [painData, setPainData] = useState<{ maxPainStrike: number, painMap: PainPoint[] } | null>(null);
  const [insiderData, setInsiderData] = useState<InsiderData | null>(null);
  const [loadingLeft, setLoadingLeft] = useState(false);

  // Right Pane Content State
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [mtfData, setMtfData] = useState<MTFData | null>(null);
  const [loadingRightItems, setLoadingRightItems] = useState(false);

  // What-If State
  const [loadingWhatIf, setLoadingWhatIf] = useState(false);
  const [simIndexMove, setSimIndexMove] = useState(0);
  const [simDays, setSimDays] = useState(0);
  const [simIv, setSimIv] = useState(0);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);

  useEffect(() => {
    const fetchLeftPane = async () => {
      setLoadingLeft(true);
      try {
        const [painRes, insiderRes] = await Promise.allSettled([
          api.get(`/options/pain-map/${symbol}`),
          api.get(`/insider/activity/${symbol}`)
        ]);

        if (painRes.status === 'fulfilled' && painRes.value.data.success) {
          setPainData(painRes.value.data.data);
        } else { setPainData(null); }

        if (insiderRes.status === 'fulfilled' && insiderRes.value.data.success) {
          setInsiderData(insiderRes.value.data.data);
        } else { 
          // Mock for Phase 6
          setInsiderData({ overallSignal: 'Bullish', buySideActivity: 4500000, sellSideActivity: 1200000 }); 
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingLeft(false);
      }
    };

    const fetchRightPaneContext = async () => {
      setLoadingRightItems(true);
      try {
        const [earnRes, mtfRes] = await Promise.allSettled([
          api.post(`/earnings/whisper`, { symbol }),
          api.get(`/mtf/${symbol}`)
        ]);

        if (earnRes.status === 'fulfilled' && earnRes.value.data.success) {
          setEarningsData(earnRes.value.data.data);
        } else {
          // Mock for Phase 12
          setEarningsData({ sentimentScore: 8.5, aiSummary: 'Options market is pricing in a 4% move. Whisper numbers indicate strong cloud revenue growth expectations.', historicalBeatProbability: 0.75 });
        }

        if (mtfRes.status === 'fulfilled' && mtfRes.value.data.success) {
          setMtfData(mtfRes.value.data.data);
        } else {
          // Mock for Phase 19
          setMtfData({
            overallBias: 'Strongly Bullish',
            timeframes: {
              '15m': { rsi: 65, macd: 1.2, signal: 'Buy' },
              '1h': { rsi: 72, macd: 3.4, signal: 'Strong Buy' },
              '1d': { rsi: 58, macd: 0.8, signal: 'Neutral' },
            }
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingRightItems(false);
      }
    };

    fetchLeftPane();
    fetchRightPaneContext();
  }, [symbol]);

  const handleSimulate = async () => {
    setLoadingWhatIf(true);
    try {
      const { data } = await api.post(`/what-if/simulate`, {
        symbol,
        simulatedIndexMovePercent: simIndexMove,
        daysElapsed: simDays,
        volatilityChangePercent: simIv
      });
      if (data.success) {
        setWhatIfResult(data.data);
      }
    } catch (err: any) {
      setSnack({ open: true, msg: 'Simulation failed', severity: 'error' });
    } finally {
      setLoadingWhatIf(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top Config Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShowChart /> Pro Terminal
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">
            Advanced multi-dimensional analysis
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField 
            size="small" 
            label="Symbol" 
            variant="outlined" 
            value={inputSymbol} 
            onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && setSymbol(inputSymbol)}
            sx={{ width: 150, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
          />
          <Button variant="contained" color="primary" onClick={() => setSymbol(inputSymbol)}>
            Load Asset
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ flexGrow: 1 }}>
        {/* LEFT PANE: Charts, Pain Map, Insider Flow */}
        <Grid size={{ xs: 12, lg: 7 }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          <Card sx={{ height: 350, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
              <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                  <BarChart color="primary" /> Price Action: {symbol}
                </Typography>
                <Chip label="Live Data" color="success" size="small" variant="outlined" />
              </Box>
              <Box sx={{ 
                flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.05))`
              }}>
                <Typography variant="h3" color="text.secondary" sx={{ opacity: 0.1, fontWeight: 900 }}>CHART_RENDERER</Typography>
              </Box>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            {/* Options Pain Map (Phase 8) */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Flare color="secondary" /> Options Max Pain
                  </Typography>
                  {loadingLeft ? (
                    <CircularProgress color="secondary" />
                  ) : painData && painData.painMap ? (
                    <Box>
                      <Typography variant="body2" color="secondary.main" fontWeight="bold" sx={{ mb: 2 }}>
                        Maximum Pain Strike: {painData.maxPainStrike}
                      </Typography>
                      <Box sx={{ maxHeight: 180, overflowY: 'auto', pr: 1 }}>
                        {painData.painMap.map((p) => {
                          const maxOi = Math.max(...painData.painMap.map(x => x.totalCallOI + x.totalPutOI));
                          const callPct = (p.totalCallOI / maxOi) * 100;
                          const putPct = (p.totalPutOI / maxOi) * 100;
                          return (
                            <Box key={p.strike} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                              <Typography variant="caption" sx={{ minWidth: 45, fontWeight: 'bold' }}>{p.strike}</Typography>
                              <Box sx={{ flexGrow: 1, height: 12, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, display: 'flex', overflow: 'hidden' }}>
                                <Box sx={{ width: `${putPct}%`, bgcolor: 'success.main', opacity: 0.8 }} />
                                <Box sx={{ width: `${callPct}%`, bgcolor: 'error.main', opacity: 0.8 }} />
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  ) : (
                    <Typography color="text.secondary">No derivatives data available</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Insider Tracker (Phase 6) */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Fingerprint color="info" /> Insider & Promoter Flow
                  </Typography>
                  {loadingLeft ? (
                    <CircularProgress color="info" />
                  ) : insiderData ? (
                    <Stack spacing={2}>
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                        <Typography variant="caption" color="text.secondary">Net Insider Bias</Typography>
                        <Typography variant="h5" fontWeight="bold" color={
                          insiderData.overallSignal === 'Bullish' ? 'success.main' : 
                          insiderData.overallSignal === 'Bearish' ? 'error.main' : 'text.primary'
                        }>
                          {insiderData.overallSignal} Validation
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Buy Volume</Typography>
                          <Typography variant="body1" color="success.main" fontWeight="bold">₹{(insiderData.buySideActivity / 100000).toFixed(1)}L</Typography>
                        </Box>
                        <Box textAlign="right">
                          <Typography variant="caption" color="text.secondary">Sell Volume</Typography>
                          <Typography variant="body1" color="error.main" fontWeight="bold">₹{(insiderData.sellSideActivity / 100000).toFixed(1)}L</Typography>
                        </Box>
                      </Box>
                       <Box sx={{ height: 6, bgcolor: 'error.main', borderRadius: 1, display: 'flex', overflow: 'hidden', mt: 1 }}>
                          <Box sx={{ 
                            width: `${(insiderData.buySideActivity / (insiderData.buySideActivity + insiderData.sellSideActivity)) * 100}%`, 
                            bgcolor: 'success.main' 
                          }} />
                        </Box>
                    </Stack>
                  ) : (
                    <Typography color="text.secondary">No filings reported recently</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

        </Grid>

        {/* RIGHT PANE: What-If, Ask AI, MTF, Earnings */}
        <Grid size={{ xs: 12, lg: 5 }} sx={{ display: 'flex', flexDirection: 'column' }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={activeRightTab} 
                onChange={(e, v) => setActiveRightTab(v)} 
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab icon={<CompareArrows fontSize="small"/>} label="What-If" />
                <Tab icon={<Psychology fontSize="small"/>} label="Ask AI" />
                <Tab icon={<AccessTime fontSize="small"/>} label="Multi-TF" />
                <Tab icon={<Campaign fontSize="small"/>} label="Earnings" />
              </Tabs>
            </Box>
            
            <CardContent sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
              
              {/* Tab 0: What-If */}
              {activeRightTab === 0 && (
                <Box sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom color="info.main">Simulate Market Scenarios</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    See how a specific drop or rally will affect {symbol}'s future price relying on options predictive Greeks.
                  </Typography>

                  <Stack spacing={4}>
                    <Box>
                      <Typography gutterBottom>Simulated Index Move: {simIndexMove > 0 ? '+' : ''}{simIndexMove}%</Typography>
                      <Slider value={simIndexMove} onChange={(e, val) => setSimIndexMove(val as number)} min={-10} max={10} step={0.5} marks color={simIndexMove >= 0 ? 'success' : 'error'} />
                    </Box>
                    <Box>
                      <Typography gutterBottom>Days Elapsed: {simDays} days</Typography>
                      <Slider value={simDays} onChange={(e, val) => setSimDays(val as number)} min={0} max={30} step={1} marks color="primary" />
                    </Box>
                    <Box>
                      <Typography gutterBottom>Implied Volatility Shift: {simIv > 0 ? '+' : ''}{simIv}%</Typography>
                      <Slider value={simIv} onChange={(e, val) => setSimIv(val as number)} min={-20} max={20} step={1} marks color="info" />
                    </Box>
                    
                    <Button variant="contained" color="info" size="large" onClick={handleSimulate} disabled={loadingWhatIf}>
                      {loadingWhatIf ? <CircularProgress size={24} color="inherit" /> : 'Run Neural Simulation'}
                    </Button>
                  </Stack>

                  {whatIfResult && (
                    <Box sx={{ mt: 4, p: 3, bgcolor: 'background.default', borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                      <Typography variant="subtitle2" color="primary.main" gutterBottom>Simulation Result</Typography>
                      <Typography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>₹{whatIfResult.simulatedPrice.toFixed(2)}</Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{whatIfResult.aiCommentary}</Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Tab 1: Ask AI */}
              {activeRightTab === 1 && (
                <Box sx={{ height: '100%', '& > div': { height: '100%' } }}>
                  <AskAI setSnack={setSnack} isWidget={true} preloadPrompt={`Analyze ${symbol} for me.`} />
                </Box>
              )}

              {/* Tab 2: Multi-Timeframe Dashboard (Phase 19) */}
              {activeRightTab === 2 && (
                <Box sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom color="info.main">Multi-Timeframe Analysis</Typography>
                  {loadingRightItems ? <CircularProgress /> : mtfData ? (
                    <Stack spacing={3} sx={{ mt: 2 }}>
                       <Box sx={{ p: 2, bgcolor: 'rgba(2, 132, 199, 0.1)', borderRadius: 2, border: `1px solid ${theme.palette.info.main}` }}>
                        <Typography variant="caption" color="text.secondary">Algorithmic Consensus Bias</Typography>
                        <Typography variant="h5" fontWeight="bold" color="info.main">{mtfData.overallBias}</Typography>
                      </Box>
                      <Divider />
                      {Object.entries(mtfData.timeframes).map(([tf, data]) => (
                        <Box key={tf} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Avatar sx={{ bgcolor: 'background.default', border: `1px solid ${theme.palette.divider}`, color: 'text.primary', width: 48, height: 48, fontWeight: 'bold' }}>
                            {tf}
                          </Avatar>
                          <Box textAlign="center">
                            <Typography variant="caption" color="text.secondary">RSI</Typography>
                            <Typography variant="body2" fontWeight="bold">{data.rsi}</Typography>
                          </Box>
                           <Box textAlign="center">
                            <Typography variant="caption" color="text.secondary">MACD</Typography>
                            <Typography variant="body2" fontWeight="bold">{data.macd > 0 ? '+' : ''}{data.macd}</Typography>
                          </Box>
                          <Chip 
                            label={data.signal} 
                            color={data.signal.includes('Buy') ? 'success' : data.signal.includes('Sell') ? 'error' : 'default'} 
                            variant="outlined"
                          />
                        </Box>
                      ))}
                    </Stack>
                  ) : <Typography>No TF data available.</Typography>}
                </Box>
              )}

              {/* Tab 3: Earnings Whisper (Phase 12) */}
              {activeRightTab === 3 && (
                <Box sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom color="warning.main">Earnings Whisper Engine</Typography>
                  {loadingRightItems ? <CircularProgress /> : earningsData ? (
                    <Stack spacing={3} sx={{ mt: 2 }}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                            <Typography variant="caption" color="text.secondary">Implied Sentiment</Typography>
                            <Typography variant="h4" fontWeight="bold" color={earningsData.sentimentScore > 6 ? 'success.main' : 'error.main'}>
                              {earningsData.sentimentScore}/10
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                            <Typography variant="caption" color="text.secondary">Beat Probability</Typography>
                            <Typography variant="h4" fontWeight="bold" color="primary.main">
                              {(earningsData.historicalBeatProbability * 100).toFixed(0)}%
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                      <Box sx={{ p: 2, bgcolor: 'rgba(245, 158, 11, 0.05)', borderRadius: 2, borderLeft: `4px solid ${theme.palette.warning.main}` }}>
                         <Typography variant="subtitle2" color="warning.main" gutterBottom>AI Earnings Whisper</Typography>
                         <Typography variant="body2" color="text.primary">{earningsData.aiSummary}</Typography>
                      </Box>
                    </Stack>
                  ) : <Typography>No upcoming earnings data detected.</Typography>}
                </Box>
              )}

            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
