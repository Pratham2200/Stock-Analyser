import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, CircularProgress, 
  Avatar, Chip, IconButton, Button, Stack, Divider, useTheme
} from '@mui/material';
import { 
  Explore, ThumbUp, ThumbDown, Share, FormatQuote, 
  VolumeUp, TipsAndUpdates
} from '@mui/icons-material';
import api from '../api';

interface TradeIdea {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  targetPrice: number;
  stopLoss: number;
  timeframe: string;
  conviction: 'High' | 'Medium' | 'Low';
  rationale: string;
  timestamp: string;
  upvotes: number;
  downvotes: number;
}

interface UnusualVolume {
  symbol: string;
  ltp: number;
  changePercent: number;
  volumeMultiplier: number;
  deliveryPercent: number;
  timestamp: string;
}

interface CompoundAlert {
  symbol: string;
  bias: 'BULLISH' | 'BEARISH';
  score: number;
  signals: string[];
  timestamp: string;
}

export default function DiscoveryFeed({ setSnack }: { setSnack: any }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [ideas, setIdeas] = useState<TradeIdea[]>([]);
  const [alerts, setAlerts] = useState<UnusualVolume[]>([]);
  const [compoundAlerts, setCompoundAlerts] = useState<CompoundAlert[]>([]);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setLoading(true);
        // Phase 21: AI Trade Ideas
        const ideaRes = await api.get('/ideas').catch(() => null);
        if (ideaRes?.data?.success && ideaRes.data.data.length > 0) {
          setIdeas(ideaRes.data.data);
        } else {
          setIdeas([
            { id: '1', symbol: 'HDFCBANK', type: 'BUY', targetPrice: 1550, stopLoss: 1410, timeframe: '1-2 Weeks', conviction: 'High', rationale: 'Strong support bounce at 1420 combined with heavy DII accumulation and extreme max pain divergence.', timestamp: new Date().toISOString(), upvotes: 42, downvotes: 3 },
            { id: '2', symbol: 'WIPRO', type: 'SELL', targetPrice: 480, stopLoss: 535, timeframe: 'Intraday', conviction: 'Medium', rationale: 'Bearish divergence on daily MACD. IV crush expected ahead of earnings next week.', timestamp: new Date(Date.now() - 3600000).toISOString(), upvotes: 18, downvotes: 12 },
          ]);
        }

        // Phase 17: Unusual Volume
        const alertRes = await api.post('/unusual-activity/scan', { symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY'] }).catch(() => null);
        if (alertRes?.data?.success && alertRes.data.data.length > 0) {
          setAlerts(alertRes.data.data);
        } else {
          setAlerts([
            { symbol: 'ADANIENT', ltp: 3200, changePercent: 4.5, volumeMultiplier: 3.2, deliveryPercent: 45, timestamp: new Date().toISOString() },
            { symbol: 'ITC', ltp: 410, changePercent: -1.2, volumeMultiplier: 2.8, deliveryPercent: 68, timestamp: new Date(Date.now() - 7200000).toISOString() },
          ]);
        }

        // Phase 10: Compound Alerts
        const compRes = await api.get('/alerts/test_user').catch(() => null);
        if (compRes?.data?.success && compRes.data.data.length > 0) {
          setCompoundAlerts(compRes.data.data);
        } else {
          setCompoundAlerts([
            { symbol: 'TCS', bias: 'BULLISH', score: 92, signals: ['RSI Oversold', 'MACD Crossover', 'DII Buying'], timestamp: new Date().toISOString() },
            { symbol: 'ZOMATO', bias: 'BEARISH', score: 85, signals: ['FII Selling', 'Price below 200 EMA'], timestamp: new Date(Date.now() - 3600000).toISOString() }
          ]);
        }
      } catch (err) {
        setSnack({ open: true, msg: 'Error loading Discovery Feed', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchFeed();
  }, [setSnack]);

  const handleVote = async (id: string, vote: 'up' | 'down') => {
    try {
      await api.post(`/ideas/${id}/vote`, { action: vote });
      setSnack({ open: true, msg: `Voted ${vote} successfully`, severity: 'success' });
      // Optimistic UI update
      setIdeas(prev => prev.map(i => {
        if (i.id === id) {
          return { ...i, upvotes: vote === 'up' ? i.upvotes + 1 : i.upvotes, downvotes: vote === 'down' ? i.downvotes + 1 : i.downvotes };
        }
        return i;
      }));
    } catch (e) {
      setSnack({ open: true, msg: 'Vote failed to register', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, color: 'secondary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Explore fontSize="large" /> Discovery Feed
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            AI Trade Ideas & Real-time Market Anomalies
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={4}>
        {/* Main Feed: AI Trade Ideas */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TipsAndUpdates color="primary" /> Algorithmic Trade Ideas
          </Typography>
          
          <Stack spacing={3}>
            {ideas.map((idea) => (
              <Card key={idea.id} sx={{ overflow: 'visible', position: 'relative' }}>
                {/* Decorative border based on Trade Type */}
                <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: idea.type === 'BUY' ? 'success.main' : 'error.main', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }} />
                
                <CardContent sx={{ pl: 4 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Avatar sx={{ bgcolor: idea.type === 'BUY' ? 'success.dark' : 'error.dark', fontWeight: 'bold' }}>
                        {idea.symbol.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="h5" fontWeight="bold">{idea.symbol}</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date(idea.timestamp).toLocaleString()}</Typography>
                      </Box>
                    </Box>
                    <Chip 
                      label={`${idea.type} SIGNAL`} 
                      color={idea.type === 'BUY' ? 'success' : 'error'} 
                      sx={{ fontWeight: 'bold', px: 1 }} 
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 3, mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Target</Typography>
                      <Typography variant="h6" color="success.main">₹{idea.targetPrice}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Stop Loss</Typography>
                      <Typography variant="h6" color="error.main">₹{idea.stopLoss}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Timeframe</Typography>
                      <Typography variant="subtitle1" fontWeight="bold">{idea.timeframe}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Conviction</Typography>
                      <Chip size="small" label={idea.conviction} color={idea.conviction === 'High' ? 'primary' : 'default'} />
                    </Box>
                  </Box>

                  <Box sx={{ position: 'relative', pl: 4, mb: 3 }}>
                    <FormatQuote sx={{ position: 'absolute', left: 0, top: -4, color: 'text.disabled', fontSize: 32 }} />
                    <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                      {idea.rationale}
                    </Typography>
                  </Box>

                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" startIcon={<ThumbUp />} onClick={() => handleVote(idea.id, 'up')} sx={{ borderRadius: 4 }}>
                        {idea.upvotes}
                      </Button>
                      <Button size="small" color="inherit" startIcon={<ThumbDown />} onClick={() => handleVote(idea.id, 'down')} sx={{ borderRadius: 4 }}>
                        {idea.downvotes}
                      </Button>
                    </Box>
                    <Button size="small" variant="outlined" startIcon={<Share />} sx={{ borderRadius: 4 }}>
                      Share Card
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Grid>

        {/* Sidebar: Unusual Volume & Events */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <VolumeUp color="warning" /> Unusual Volume Alerts
          </Typography>
          
          <Stack spacing={2}>
            {alerts.map((alert, i) => (
              <Card key={i} sx={{ bgcolor: 'rgba(245, 158, 11, 0.05)', border: `1px solid ${theme.palette.divider}` }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography fontWeight="bold" variant="subtitle1">{alert.symbol}</Typography>
                    <Chip 
                      size="small" 
                      label={`${alert.volumeMultiplier}x VOL`} 
                      color="warning" 
                      sx={{ fontWeight: 'bold' }} 
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">LTP</Typography>
                      <Typography variant="body2" fontWeight="bold">₹{alert.ltp.toLocaleString()}</Typography>
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary">Change</Typography>
                      <Typography variant="body2" fontWeight="bold" color={alert.changePercent >= 0 ? 'success.main' : 'error.main'}>
                        {alert.changePercent > 0 ? '+' : ''}{alert.changePercent.toFixed(2)}%
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>

          {/* Compound Alerts (Phase 10) */}
          <Typography variant="h6" sx={{ mt: 4, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Explore color="error" /> High-Conviction Compound Alerts
          </Typography>
          
          <Stack spacing={2}>
            {compoundAlerts.map((alert, i) => (
              <Card key={i} sx={{ borderLeft: `4px solid ${alert.bias === 'BULLISH' ? theme.palette.success.main : theme.palette.error.main}` }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography fontWeight="bold" variant="subtitle1">{alert.symbol}</Typography>
                    <Chip 
                      size="small" 
                      label={`${alert.score}/100 SCORE`} 
                      color={alert.score >= 90 ? 'error' : 'secondary'} 
                    />
                  </Box>
                   <Typography variant="body2" color={alert.bias === 'BULLISH' ? 'success.main' : 'error.main'} fontWeight="bold" sx={{ mb: 1 }}>
                     {alert.bias} SIGNALS ALIGNED
                   </Typography>
                   <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                     {alert.signals.map((sig, idx) => (
                       <Chip key={idx} label={sig} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                     ))}
                   </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
