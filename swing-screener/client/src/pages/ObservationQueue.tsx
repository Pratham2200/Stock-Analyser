// src/pages/ObservationQueue.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Grid,
    Chip,
    TextField,
    Alert,
    CircularProgress,
    Paper,
    Stack,
    Divider,
    LinearProgress,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Pagination,
    Tooltip,
    Collapse,
    IconButton,
    Badge,
    Avatar,
} from '@mui/material';
import {
    CheckCircle as ApproveIcon,
    Cancel as RejectIcon,
    Psychology as AIIcon,
    TrendingUp as TrendIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    AccessTime as TimeIcon,
    Token as TokenIcon,
    PriorityHigh as PriorityIcon,
    FilterList as FilterIcon,
    CheckCircleOutline as PassIcon,
    CancelOutlined as FailIcon,
    RemoveCircleOutline as CloseIcon,
    Speed as ConfidenceIcon,
    Refresh as RefreshIcon,
    Circle as DotIcon,
} from '@mui/icons-material';
import { fetchObservationQueue, processObservation, fetchAIStats } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RuleResult {
    status: 'PASS' | 'FAIL' | 'CLOSE' | 'STRONG' | 'WEAK';
    reason: string;
}

interface KeyFactors {
    consolidation: RuleResult;
    higherLow: RuleResult;
    volumePump: RuleResult;
    bearSqueeze: RuleResult;
}

interface Observation {
    id: number;
    stock_id: number;
    scan_id: number;
    symbol: string;
    name: string;
    source: string;
    priority: number;
    status: string;
    user_decision: string;
    expires_at?: string;
    created_at: string;
    expiresAt?: string;
    createdAt?: string;
    // AI analysis fields
    layer_type: string;
    source_decision: string;
    ai_decision: string;
    confidence_score: string | number;
    reasoning: string;
    key_factors: KeyFactors;
    final_status: string;
    tokens_used: number;
    processing_time_ms: number;
}

interface RateLimitStatus {
    blocked: boolean;
    blockedUntil: string | null;
    requests: number;
    tokens: number;
}

interface AIStatsData {
    enabled: boolean;
    totalAnalyzed: number;
    passedCount: number;
    rejectedCount: number;
    avgConfidence: number;
    avgProcessingTime: number;
    totalTokensUsed: number;
    totalEstimatedCost: number;
    rateLimits?: { gemini: RateLimitStatus; groq: RateLimitStatus; openrouter: RateLimitStatus };
}

interface ObservationQueueProps {
    setSnack: (s: { open: boolean; msg: string; severity: 'success' | 'error' | 'warning' | 'info' }) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

const ruleColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
    const s = status?.toUpperCase();
    if (s === 'PASS' || s === 'STRONG') return 'success';
    if (s === 'FAIL' || s === 'WEAK') return 'error';
    if (s === 'CLOSE') return 'warning';
    return 'default';
};

const RuleIcon = ({ status }: { status: string }) => {
    const s = status?.toUpperCase();
    if (s === 'PASS' || s === 'STRONG') return <PassIcon fontSize="small" color="success" />;
    if (s === 'FAIL' || s === 'WEAK') return <FailIcon fontSize="small" color="error" />;
    if (s === 'CLOSE') return <CloseIcon fontSize="small" color="warning" />;
    return <DotIcon fontSize="small" color="disabled" />;
};

const confidenceColor = (score: number): string => {
    if (score >= 75) return '#2e7d32';
    if (score >= 50) return '#ed6c02';
    return '#d32f2f';
};

const priorityLabel = (p: number) => {
    if (p >= 8) return { label: 'High', color: '#d32f2f' as const };
    if (p >= 5) return { label: 'Med', color: '#ed6c02' as const };
    return { label: 'Low', color: '#0288d1' as const };
};

const formatAge = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const hrs = Math.floor(diffMs / 3_600_000);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const formatExpiry = (dateStr: string) => {
    const diffMs = new Date(dateStr).getTime() - Date.now();
    const days = Math.floor(diffMs / 86_400_000);
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires today';
    return `Expires in ${days}d`;
};

const layerLabel = (lt: string) =>
    lt === 'rejection_review' ? 'Layer 1 – Rejection Review' : 'Layer 2 – Selection Validation';

const sourceDecisionLabel = (sd: string) =>
    sd === 'code_rejected' ? 'Code Rejected' : 'Code Selected';

// ─── Sub-components ───────────────────────────────────────────────────────────

const RuleBreakdown = ({ factors }: { factors: KeyFactors }) => {
    const rules = [
        { key: 'consolidation', label: 'Consolidation', rule: factors?.consolidation },
        { key: 'higherLow', label: 'Higher Low', rule: factors?.higherLow },
        { key: 'volumePump', label: 'Volume Pump', rule: factors?.volumePump },
        { key: 'bearSqueeze', label: 'Bear Squeeze', rule: factors?.bearSqueeze },
    ];

    return (
        <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
                Rule Analysis
            </Typography>
            <Stack spacing={0.75}>
                {rules.map(({ key, label, rule }) => (
                    <Box key={key} display="flex" alignItems="flex-start" gap={1}>
                        <Box mt={0.1} flexShrink={0}>
                            <RuleIcon status={rule?.status || 'FAIL'} />
                        </Box>
                        <Box flex={1}>
                            <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                                <Typography variant="caption" fontWeight={600}>
                                    {label}
                                </Typography>
                                <Chip
                                    label={rule?.status || 'N/A'}
                                    size="small"
                                    color={ruleColor(rule?.status || '')}
                                    sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } }}
                                />
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
                                {rule?.reason || 'No detail'}
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
};

const ConfidenceBar = ({ score }: { score: number }) => {
    const color = confidenceColor(score);
    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
                <Typography variant="caption" color="text.secondary">Confidence</Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color }}>
                    {score}%
                </Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={score}
                sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'rgba(0,0,0,0.08)',
                    '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 }
                }}
            />
        </Box>
    );
};

const ProviderDot = ({ name, state }: { name: string; state: RateLimitStatus }) => (
    <Box display="flex" alignItems="center" gap={0.5}>
        <Box
            sx={{
                width: 8, height: 8, borderRadius: '50%',
                bgcolor: state.blocked ? '#d32f2f' : '#2e7d32'
            }}
        />
        <Typography variant="caption" color="white" fontWeight={500}>
            {name}
        </Typography>
        {state.blocked && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem' }}>
                (blocked)
            </Typography>
        )}
    </Box>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ObservationQueue({ setSnack }: ObservationQueueProps): React.JSX.Element {
    const [observations, setObservations] = useState<Observation[]>([]);
    const [aiStats, setAIStats] = useState<AIStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<number | null>(null);
    const [notes, setNotes] = useState<{ [key: number]: string }>({});
    const [expanded, setExpanded] = useState<{ [key: number]: boolean }>({});

    // Filters & pagination
    const [filterCode, setFilterCode] = useState<string>('all');
    const [filterAI, setFilterAI] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('priority');
    const [page, setPage] = useState(1);

    const loadData = async () => {
        try {
            setLoading(true);
            const [obsData, statsData] = await Promise.all([
                fetchObservationQueue(100),
                fetchAIStats()
            ]);
            setObservations(obsData.data || []);
            setAIStats(statsData.data || null);
        } catch {
            setSnack({ open: true, msg: 'Failed to load observation queue', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleDecision = async (id: number, decision: 'approved' | 'rejected') => {
        try {
            setProcessing(id);
            await processObservation(id, decision, notes[id]);
            setSnack({
                open: true,
                msg: `Stock ${decision === 'approved' ? 'approved ✅' : 'rejected ❌'} successfully`,
                severity: 'success'
            });
            setObservations(prev => prev.filter(o => o.id !== id));
        } catch {
            setSnack({ open: true, msg: 'Failed to process decision', severity: 'error' });
        } finally {
            setProcessing(null);
        }
    };

    // Filtered + sorted list
    const filtered = useMemo(() => {
        let list = [...observations];

        if (filterCode !== 'all')
            list = list.filter(o => o.source_decision === filterCode);
        if (filterAI !== 'all')
            list = list.filter(o => o.ai_decision === filterAI);

        if (sortBy === 'priority')
            list.sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));
        else if (sortBy === 'confidence')
            list.sort((a, b) => Number(b.confidence_score) - Number(a.confidence_score));
        else
            list.sort((a, b) => new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime());

        return list;
    }, [observations, filterCode, filterAI, sortBy]);

    const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleFilterChange = (setter: (v: string) => void, val: string) => {
        setter(val);
        setPage(1);
    };

    if (loading) {
        return (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh" gap={2}>
                <CircularProgress size={48} />
                <Typography color="text.secondary">Loading AI Observation Queue…</Typography>
            </Box>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>

            {/* ── Header ─────────────────────────────────────────────── */}
            <Box mb={3} display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
                <Box>
                    <Typography variant="h4" fontWeight={700} display="flex" alignItems="center" gap={1}>
                        <AIIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                        AI Observation Queue
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Stocks flagged by AI for manual verification. Review and take action.
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadData}
                    size="small"
                >
                    Refresh
                </Button>
            </Box>

            {/* ── Stats Banner ────────────────────────────────────────── */}
            {aiStats && (
                <Paper
                    elevation={3}
                    sx={{
                        mb: 3,
                        background: 'linear-gradient(135deg, #1a237e 0%, #283593 40%, #3949ab 100%)',
                        borderRadius: 3,
                        overflow: 'hidden',
                    }}
                >
                    {/* Top stats row */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, p: 2.5 }}>
                        {[
                            { label: 'Total Analyzed', value: aiStats.totalAnalyzed ?? 0 },
                            { label: 'AI Passed', value: aiStats.passedCount ?? 0 },
                            { label: 'AI Rejected', value: aiStats.rejectedCount ?? 0 },
                            {
                                label: 'Avg Confidence',
                                value: aiStats.avgConfidence ? `${Number(aiStats.avgConfidence).toFixed(1)}%` : 'N/A'
                            },
                            {
                                label: 'Total Tokens',
                                value: aiStats.totalTokensUsed
                                    ? (aiStats.totalTokensUsed / 1000).toFixed(1) + 'K'
                                    : '0'
                            },
                            {
                                label: 'Est. API Cost',
                                value: `$${Number(aiStats.totalEstimatedCost ?? 0).toFixed(4)}`
                            },
                        ].map(({ label, value }) => (
                            <Box key={label} sx={{ flex: '1 1 120px', textAlign: 'center' }}>
                                <Typography variant="h5" fontWeight={700} color="white">
                                    {value}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                    {label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    {/* Rate limit status bar */}
                    {aiStats.rateLimits && (
                        <Box
                            sx={{
                                px: 2.5, py: 1,
                                bgcolor: 'rgba(0,0,0,0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                flexWrap: 'wrap',
                            }}
                        >
                            <Typography variant="caption" color="rgba(255,255,255,0.6)" fontWeight={600}>
                                PROVIDER STATUS
                            </Typography>
                            {Object.entries(aiStats.rateLimits).map(([name, state]) => (
                                <ProviderDot key={name} name={name.charAt(0).toUpperCase() + name.slice(1)} state={state as RateLimitStatus} />
                            ))}
                        </Box>
                    )}
                </Paper>
            )}

            {/* ── Filter Bar ──────────────────────────────────────────── */}
            <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                    <FilterIcon color="action" />
                    <Typography variant="body2" fontWeight={600} color="text.secondary">
                        Filters:
                    </Typography>

                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Code Decision</InputLabel>
                        <Select
                            value={filterCode}
                            label="Code Decision"
                            onChange={e => handleFilterChange(setFilterCode, e.target.value)}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="code_rejected">Code Rejected</MenuItem>
                            <MenuItem value="code_selected">Code Selected</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>AI Decision</InputLabel>
                        <Select
                            value={filterAI}
                            label="AI Decision"
                            onChange={e => handleFilterChange(setFilterAI, e.target.value)}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="passed">AI Passed</MenuItem>
                            <MenuItem value="rejected">AI Rejected</MenuItem>
                            <MenuItem value="uncertain">Uncertain</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Sort By</InputLabel>
                        <Select
                            value={sortBy}
                            label="Sort By"
                            onChange={e => handleFilterChange(setSortBy, e.target.value)}
                        >
                            <MenuItem value="priority">Priority</MenuItem>
                            <MenuItem value="confidence">Confidence</MenuItem>
                            <MenuItem value="newest">Newest First</MenuItem>
                        </Select>
                    </FormControl>

                    <Box ml="auto">
                        <Typography variant="body2" color="text.secondary">
                            <strong>{filtered.length}</strong> result{filtered.length !== 1 ? 's' : ''}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* ── Empty State ─────────────────────────────────────────── */}
            {filtered.length === 0 ? (
                <Alert
                    severity="info"
                    icon={<AIIcon />}
                    sx={{ borderRadius: 2 }}
                >
                    {observations.length === 0
                        ? 'No observations pending. All stocks have been processed!'
                        : 'No stocks match your current filter. Try adjusting the filters above.'}
                </Alert>
            ) : (
                <>
                    {/* ── Cards ─────────────────────────────────────────── */}
                    <Stack spacing={2} mb={3}>
                        {paginated.map((obs) => {
                            const confidence = Number(obs.confidence_score) || 0;
                            const pri = priorityLabel(obs.priority ?? 5);
                            const isExpanded = !!expanded[obs.id];
                            const codeIsRejected = obs.source_decision === 'code_rejected';
                            const aiPassed = obs.ai_decision === 'passed';

                            return (
                                <Card
                                    key={obs.id}
                                    elevation={2}
                                    sx={{
                                        borderRadius: 2.5,
                                        overflow: 'hidden',
                                        transition: 'box-shadow 0.2s',
                                        '&:hover': { boxShadow: '0 6px 24px rgba(0,0,0,0.15)' },
                                        borderLeft: `5px solid ${codeIsRejected ? '#d32f2f' : '#2e7d32'}`,
                                    }}
                                >
                                    <CardContent sx={{ pb: 1 }}>
                                        {/* ═ Row 1: Stock identity + chips ═ */}
                                        <Box display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1} mb={1.5}>
                                            <Box>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Avatar
                                                        sx={{
                                                            bgcolor: codeIsRejected ? '#ffebee' : '#e8f5e9',
                                                            color: codeIsRejected ? '#d32f2f' : '#2e7d32',
                                                            width: 40, height: 40,
                                                            fontWeight: 700, fontSize: '0.75rem'
                                                        }}
                                                    >
                                                        {obs.symbol?.slice(0, 3)}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                                                            {obs.symbol}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {obs.name}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>

                                            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                                {/* Priority badge */}
                                                <Tooltip title={`Priority: ${obs.priority ?? 5}/10`}>
                                                    <Box
                                                        sx={{
                                                            px: 1, py: 0.25, borderRadius: 1,
                                                            bgcolor: `${pri.color}18`,
                                                            border: `1px solid ${pri.color}40`,
                                                            display: 'flex', alignItems: 'center', gap: 0.5
                                                        }}
                                                    >
                                                        <PriorityIcon sx={{ fontSize: 12, color: pri.color }} />
                                                        <Typography variant="caption" fontWeight={700} sx={{ color: pri.color }}>
                                                            {pri.label} ({obs.priority ?? 5})
                                                        </Typography>
                                                    </Box>
                                                </Tooltip>

                                                {/* Code decision */}
                                                <Chip
                                                    label={sourceDecisionLabel(obs.source_decision)}
                                                    color={codeIsRejected ? 'error' : 'success'}
                                                    size="small"
                                                    variant="outlined"
                                                />

                                                {/* AI decision */}
                                                <Chip
                                                    label={`AI: ${obs.ai_decision || 'N/A'}`}
                                                    color={aiPassed ? 'success' : obs.ai_decision === 'uncertain' ? 'warning' : 'error'}
                                                    size="small"
                                                />

                                                {/* Layer */}
                                                <Chip
                                                    label={obs.layer_type === 'rejection_review' ? 'L1' : 'L2'}
                                                    size="small"
                                                    variant="outlined"
                                                    color={obs.layer_type === 'rejection_review' ? 'warning' : 'primary'}
                                                    sx={{ fontWeight: 700 }}
                                                />
                                            </Box>
                                        </Box>

                                        {/* ═ Row 2: Confidence bar ═ */}
                                        <Box mb={1.5}>
                                            <ConfidenceBar score={confidence} />
                                        </Box>

                                        {/* ═ Row 3: AI Reasoning ═ */}
                                        <Box
                                            sx={{
                                                p: 1.25,
                                                bgcolor: 'rgba(25,118,210,0.05)',
                                                borderLeft: '3px solid #1976d2',
                                                borderRadius: '0 8px 8px 0',
                                                mb: 1.5,
                                            }}
                                        >
                                            <Typography variant="caption" color="primary.main" fontWeight={600} display="block" mb={0.5}>
                                                AI Reasoning
                                            </Typography>
                                            <Typography variant="body2" color="text.primary" sx={{ fontStyle: 'italic', lineHeight: 1.5 }}>
                                                {obs.reasoning || 'No reasoning provided'}
                                            </Typography>
                                        </Box>

                                        {/* ═ Row 4: Expandable rule breakdown ═ */}
                                        <Box>
                                            <Button
                                                size="small"
                                                startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                onClick={() => setExpanded(prev => ({ ...prev, [obs.id]: !prev[obs.id] }))}
                                                sx={{ textTransform: 'none', px: 0, color: 'text.secondary', '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}
                                            >
                                                {isExpanded ? 'Hide' : 'Show'} Rule Breakdown
                                            </Button>

                                            <Collapse in={isExpanded}>
                                                {obs.key_factors ? (
                                                    <RuleBreakdown factors={obs.key_factors} />
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary">No rule data available</Typography>
                                                )}
                                            </Collapse>
                                        </Box>

                                        <Divider sx={{ my: 1.5 }} />

                                        {/* ═ Row 5: Meta footer ═ */}
                                        <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
                                            <Tooltip title="Layer type">
                                                <Typography variant="caption" color="text.secondary">
                                                    🏷 {layerLabel(obs.layer_type)}
                                                </Typography>
                                            </Tooltip>
                                            <Tooltip title="Source (how it got here)">
                                                <Typography variant="caption" color="text.secondary">
                                                    📌 {obs.source?.replace(/_/g, ' ')}
                                                </Typography>
                                            </Tooltip>
                                            <Tooltip title="Tokens used by AI">
                                                <Typography variant="caption" color="text.secondary">
                                                    🔢 {obs.tokens_used ?? 0} tokens
                                                </Typography>
                                            </Tooltip>
                                            <Tooltip title="AI processing time">
                                                <Typography variant="caption" color="text.secondary">
                                                    ⚡ {obs.processing_time_ms ?? 0}ms
                                                </Typography>
                                            </Tooltip>
                                            <Typography variant="caption" color="text.secondary">
                                                🕐 {formatAge(obs.createdAt || obs.created_at)}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color={(obs.expiresAt || obs.expires_at) && new Date(obs.expiresAt || obs.expires_at || '') < new Date() ? 'error.main' : 'text.secondary'}
                                                fontWeight={(obs.expiresAt || obs.expires_at) && new Date(obs.expiresAt || obs.expires_at || '') < new Date() ? 700 : 400}
                                            >
                                                ⏳ {(obs.expiresAt || obs.expires_at) ? formatExpiry(obs.expiresAt || obs.expires_at || '') : 'No expiry'}
                                            </Typography>
                                        </Box>

                                        {/* ═ Notes field ═ */}
                                        <Box mt={1.5}>
                                            <TextField
                                                label="Notes (Optional)"
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                                multiline
                                                rows={2}
                                                value={notes[obs.id] || ''}
                                                onChange={e => setNotes(prev => ({ ...prev, [obs.id]: e.target.value }))}
                                                placeholder="Add notes about your decision..."
                                            />
                                        </Box>
                                    </CardContent>

                                    {/* ═ Actions ═ */}
                                    <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>
                                        <Button
                                            variant="contained"
                                            color="success"
                                            startIcon={processing === obs.id ? <CircularProgress size={16} color="inherit" /> : <ApproveIcon />}
                                            onClick={() => handleDecision(obs.id, 'approved')}
                                            disabled={processing === obs.id}
                                            sx={{ flex: 1 }}
                                        >
                                            {processing === obs.id ? 'Processing…' : 'Approve'}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            startIcon={processing === obs.id ? <CircularProgress size={16} color="inherit" /> : <RejectIcon />}
                                            onClick={() => handleDecision(obs.id, 'rejected')}
                                            disabled={processing === obs.id}
                                            sx={{ flex: 1 }}
                                        >
                                            {processing === obs.id ? 'Processing…' : 'Reject'}
                                        </Button>
                                    </CardActions>
                                </Card>
                            );
                        })}
                    </Stack>

                    {/* ── Pagination ─────────────────────────────────────── */}
                    {pageCount > 1 && (
                        <Box display="flex" justifyContent="center" mt={2}>
                            <Pagination
                                count={pageCount}
                                page={page}
                                onChange={(_, p) => setPage(p)}
                                color="primary"
                                shape="rounded"
                                showFirstButton
                                showLastButton
                            />
                        </Box>
                    )}
                </>
            )}
        </Container>
    );
}
