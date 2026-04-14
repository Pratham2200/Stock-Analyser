import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, CircularProgress, 
  Table, TableBody, TableCell, TableHead, TableRow, Chip,
  useTheme, Button, Stack, Divider, Avatar
} from '@mui/material';
import { 
  AccountBalanceWallet, EmojiEvents, AssignmentInd, 
  TrendingUp, TrendingDown, AutoAwesome
} from '@mui/icons-material';
import api from '../api';

interface Position {
  symbol: string;
  qty: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
}

interface Portfolio {
  userId: string;
  cash: number;
  invested: number;
  totalValue: number;
  positions: Position[];
}

interface LeaderboardUser {
  rank: number;
  userId: string;
  totalValue: number;
  pnlPercent: number;
}

interface JournalEntry {
  id: string;
  date: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  pnl: number;
  aiInsight: string;
}

interface WatchlistItem {
  symbol: string;
  addedAt: string;
  dailySummary: string;
  alertTriggered: boolean;
}

export default function TradeDesk({ setSnack }: { setSnack: any }) {
  const theme = useTheme();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTradeData = async () => {
      try {
        setLoading(true);
        // Phase 13: Paper Trading Portfolio
        const portRes = await api.get('/paper-trading/portfolio/test_user').catch(() => null);
        if (portRes?.data?.success) {
          setPortfolio(portRes.data.data);
        } else {
          // Mock data for UI presentation if backend is empty
          setPortfolio({
            userId: 'user_test', cash: 850000, invested: 185000, totalValue: 1035000,
            positions: [
              { symbol: 'RELIANCE', qty: 50, entryPrice: 2400, currentPrice: 2450, pnl: 2500 },
              { symbol: 'TCS', qty: 20, entryPrice: 3800, currentPrice: 3600, pnl: -4000 }
            ]
          });
        }

        // Phase 15: Leaderboard
        const leadRes = await api.get('/leaderboard').catch(() => null);
        if (leadRes?.data?.success && leadRes.data.data.length > 0) {
          setLeaderboard(leadRes.data.data);
        } else {
          setLeaderboard([
            { rank: 1, userId: 'quant_master', totalValue: 1450000, pnlPercent: 45.0 },
            { rank: 2, userId: 'theta_gang', totalValue: 1210000, pnlPercent: 21.0 },
            { rank: 3, userId: 'test_user', totalValue: 1035000, pnlPercent: 3.5 },
          ]);
        }

        // Phase 9: AI Trade Journal
        const jrnRes = await api.get('/journal/analysis/test_user').catch(() => null);
        if (jrnRes?.data?.success && jrnRes.data.data.journal.length > 0) {
          setJournal(jrnRes.data.data.journal);
        } else {
          setJournal([
            { id: '1', date: '2026-03-24', symbol: 'INFY', type: 'SELL', pnl: 4500, aiInsight: 'Excellent risk-reward capture. Letting AI cut losers early saved 12% drawdown.' },
            { id: '2', date: '2026-03-20', symbol: 'HDFCBANK', type: 'BUY', pnl: -1200, aiInsight: 'Patience recommended. You entered before the MACD crossed over. Wait for confirmation.' }
          ]);
        }

        // Phase 20: AI Watchlist Monitoring
        const watchRes = await api.get('/watchlist/test_user/summary').catch(() => null);
        if (watchRes?.data?.success && watchRes.data.data.length > 0) {
          setWatchlist(watchRes.data.data);
        } else {
          setWatchlist([
            { symbol: 'TATAMOTORS', addedAt: '2026-03-21', dailySummary: '3 of 12 internal indicators triggered bullish signals today. IV crush complete.', alertTriggered: true },
            { symbol: 'ITC', addedAt: '2026-03-10', dailySummary: 'Consolidating in a tight 2% channel. Wait for breakout above 415.', alertTriggered: false }
          ]);
        }

      } catch (err) {
        setSnack({ open: true, msg: 'Error loading Trade Desk data', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchTradeData();
  }, [setSnack]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceWallet fontSize="large" /> Trade Desk
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Live Paper Trading & AI Journal
          </Typography>
        </Box>
        <Button variant="contained" color="success" startIcon={<TrendingUp />}>
          New Trade
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Paper Trading Portfolio (Phase 13) */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ bgcolor: 'primary.dark', color: 'white' }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Total Portfolio Value</Typography>
                  <Typography variant="h4" fontWeight="bold">₹{portfolio?.totalValue.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ bgcolor: 'background.paper' }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Available Cash</Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">₹{portfolio?.cash.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ bgcolor: 'background.paper' }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Invested Capital</Typography>
                  <Typography variant="h4" fontWeight="bold" color="info.main">₹{portfolio?.invested.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Active Positions</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Avg Price</TableCell>
                      <TableCell align="right">LTP</TableCell>
                      <TableCell align="right">P&L</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {portfolio?.positions.map((pos) => (
                      <TableRow key={pos.symbol} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>{pos.symbol}</TableCell>
                        <TableCell align="right">{pos.qty}</TableCell>
                        <TableCell align="right">₹{pos.entryPrice.toLocaleString()}</TableCell>
                        <TableCell align="right">₹{pos.currentPrice.toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ color: pos.pnl >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                          {pos.pnl >= 0 ? '+' : ''}₹{pos.pnl.toLocaleString()}
                        </TableCell>
                        <TableCell align="center">
                          <Button size="small" variant="outlined" color="error">Exit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!portfolio?.positions || portfolio.positions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>No active positions</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>

          {/* AI Watchlist (Phase 20) */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesome color="primary" /> AI Watchlist Monitoring
                </Typography>
                <Button size="small" variant="outlined">+ Add Symbol</Button>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                     <TableCell>Symbol</TableCell>
                     <TableCell>Daily AI Summary</TableCell>
                     <TableCell align="right">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {watchlist.map(item => (
                    <TableRow key={item.symbol} hover>
                      <TableCell sx={{ fontWeight: 'bold' }}>{item.symbol}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{item.dailySummary}</TableCell>
                      <TableCell align="right">
                        {item.alertTriggered ? <Chip size="small" color="error" label="Alert Triggered" /> : <Chip size="small" color="default" label="Monitoring..." />}
                      </TableCell>
                    </TableRow>
                  ))}
                  {watchlist.length === 0 && (
                    <TableRow><TableCell colSpan={3} align="center">No symbols in watchlist.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* AI Trade Journal (Phase 9) */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentInd color="secondary" /> AI Trade Journal Insights
              </Typography>
              <Stack spacing={2}>
                {journal.map((entry) => (
                  <Box key={entry.id} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: `1px solid ${theme.palette.divider}` }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip size="small" label={entry.type} color={entry.type === 'BUY' ? 'success' : 'error'} />
                        <Typography fontWeight="bold">{entry.symbol}</Typography>
                        <Typography variant="caption" color="text.secondary">{entry.date}</Typography>
                      </Box>
                      <Typography fontWeight="bold" color={entry.pnl >= 0 ? 'success.main' : 'error.main'}>
                        {entry.pnl >= 0 ? '+' : ''}₹{entry.pnl.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, p: 1.5, bgcolor: 'rgba(139, 92, 246, 0.1)', borderRadius: 1 }}>
                      <AutoAwesome color="secondary" fontSize="small" />
                      <Typography variant="body2" color="text.secondary">
                        {entry.aiInsight}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Leaderboard (Phase 15) */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%', background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, rgba(245, 158, 11, 0.05) 100%)` }}>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
                <EmojiEvents /> Top Traders
              </Typography>
              
              <Stack spacing={2}>
                {leaderboard.map((user, index) => (
                  <Box 
                    key={user.userId} 
                    sx={{ 
                      display: 'flex', alignItems: 'center', gap: 2, p: 2, 
                      borderRadius: 2, 
                      bgcolor: user.userId === portfolio?.userId ? 'rgba(245, 158, 11, 0.1)' : 'background.default',
                      border: user.userId === portfolio?.userId ? `1px solid ${theme.palette.warning.main}` : `1px solid ${theme.palette.divider}`
                    }}
                  >
                    <Typography variant="h6" sx={{ width: 24, textAlign: 'center', color: index < 3 ? 'warning.main' : 'text.secondary' }}>
                      #{user.rank}
                    </Typography>
                    <Avatar sx={{ bgcolor: index === 0 ? 'warning.main' : index === 1 ? 'text.secondary' : index === 2 ? 'error.light' : 'primary.main', width: 32, height: 32 }}>
                      {user.userId.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight="bold">{user.userId}</Typography>
                      <Typography variant="caption" color="text.secondary">₹{user.totalValue.toLocaleString()}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold" color={user.pnlPercent >= 0 ? 'success.main' : 'error.main'}>
                      {user.pnlPercent >= 0 ? '+' : ''}{user.pnlPercent.toFixed(1)}%
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
