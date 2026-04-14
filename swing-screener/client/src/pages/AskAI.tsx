import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Typography, TextField, IconButton, Paper, 
  List, ListItem, ListItemButton, ListItemText, Divider,
  CircularProgress, Chip, Stack, useTheme
} from '@mui/material';
import { 
  Send as SendIcon, 
  SmartToy as RobotIcon, 
  Person as PersonIcon,
  Add as AddIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  extractedSymbols?: string[];
}

interface ChatSession {
  sessionId: string;
  title: string;
  updatedAt: string;
}

interface AskAIProps {
  setSnack: any;
  isWidget?: boolean;
  preloadPrompt?: string;
}

export default function AskAI({ setSnack, isWidget = false, preloadPrompt = '' }: AskAIProps) {
  const theme = useTheme();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (preloadPrompt && !input) {
      setInput(preloadPrompt);
    }
  }, [preloadPrompt]);

  // Handle new chat
  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your AI Trading Assistant. How can I help you analyze the markets today?',
      timestamp: new Date()
    }]);
  };

  useEffect(() => {
    handleNewChat();
    // In a real app, we'd fetch actual history sessions from the backend
    setSessions([
      { sessionId: 'mock-1', title: 'NIFTY Analysis', updatedAt: new Date().toISOString() },
      { sessionId: 'mock-2', title: 'RELIANCE Earnings', updatedAt: new Date().toISOString() }
    ]);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ask-ai', {
        prompt: userMsg.content,
        sessionId: currentSessionId
      });

      if (data.success) {
        if (!currentSessionId && data.data.sessionId) {
          setCurrentSessionId(data.data.sessionId);
          // Add to recent sessions here if desired
        }

        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.data.analysis || 'I apologize, I could not generate an analysis.',
          timestamp: new Date(),
          extractedSymbols: data.data.extractedSymbols
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || 'Failed to get AI response');
      }
    } catch (err: any) {
      setSnack({ open: true, msg: err.response?.data?.error || err.message, severity: 'error' });
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `**Error:** Failed to connect to AI engine. Please ensure backend services are running. (${err.message})`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ display: 'flex', height: isWidget ? '100%' : 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      {!isWidget && (
        <Box sx={{ 
          width: 280, 
          borderRight: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper'
        }}>
          <Box sx={{ p: 2 }}>
            <ListItemButton 
              onClick={handleNewChat}
              sx={{ 
                borderRadius: 2, 
                border: `1px solid ${theme.palette.primary.main}`,
                color: 'primary.main',
                justifyContent: 'center',
                py: 1
              }}
            >
              <AddIcon sx={{ mr: 1 }} />
              New Chat
            </ListItemButton>
          </Box>
          <Divider />
          <List sx={{ flexGrow: 1, overflow: 'auto' }}>
            {sessions.map((s) => (
              <ListItem key={s.sessionId} disablePadding>
                <ListItemButton 
                  selected={currentSessionId === s.sessionId}
                  onClick={() => {
                    setCurrentSessionId(s.sessionId);
                    // Mock loading history
                    setMessages([{
                      id: 'history-mock', role: 'assistant', content: `Loaded history for ${s.title}`, timestamp: new Date()
                    }]);
                  }}
                >
                  <ListItemText 
                    primary={s.title} 
                    secondary={new Date(s.updatedAt).toLocaleDateString()}
                    primaryTypographyProps={{ noWrap: true, variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Main Chat Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
        
        {/* Messages */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
          <Stack spacing={3} sx={{ maxWidth: 800, mx: 'auto' }}>
            {messages.map((msg) => (
              <Box 
                key={msg.id}
                sx={{
                  display: 'flex',
                  gap: 2,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <Box sx={{ 
                  width: 40, height: 40, borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: msg.role === 'user' ? 'primary.main' : 'secondary.main',
                  color: 'white', flexShrink: 0
                }}>
                  {msg.role === 'user' ? <PersonIcon /> : <RobotIcon />}
                </Box>
                
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2, 
                    borderRadius: 3,
                    maxWidth: '85%',
                    bgcolor: msg.role === 'user' ? 'primary.soft' : 'white',
                    border: `1px solid ${theme.palette.divider}`,
                    ...(msg.role === 'user' && {
                      bgcolor: theme.palette.primary.main,
                      color: 'primary.contrastText',
                      border: 'none',
                    })
                  }}
                >
                  <Box className="markdown-body" sx={{ 
                    '& p': { m: 0, '& + p': { mt: 1 } },
                    '& table': { borderCollapse: 'collapse', width: '100%', my: 2 },
                    '& th, & td': { border: `1px solid ${theme.palette.divider}`, p: 1 },
                    '& th': { bgcolor: 'action.hover', fontWeight: 'bold' }
                  }}>
                    {msg.role === 'user' ? (
                      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Typography>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </Box>
                  
                  {msg.extractedSymbols && msg.extractedSymbols.length > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: `1px dashed ${theme.palette.divider}` }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                        Detected Symbols:
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        {msg.extractedSymbols.map(sym => (
                          <Chip key={sym} label={sym} size="small" variant="outlined" color="primary" />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Paper>
              </Box>
            ))}
            
            {loading && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'secondary.main', color: 'white' }}>
                  <RobotIcon />
                </Box>
                <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'white', border: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">Analyzing market data and generating insights...</Typography>
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Stack>
        </Box>

        {/* Input Area */}
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.paper', borderTop: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ maxWidth: 800, mx: 'auto', position: 'relative' }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Ask me to analyze a stock, explain Options Pain, or find high correlation pairs..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={loading}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  pr: 6,
                  borderRadius: 4,
                  bgcolor: '#fafafa'
                }
              }}
            />
            <IconButton 
              color="primary" 
              onClick={handleSend}
              disabled={!input.trim() || loading}
              sx={{ 
                position: 'absolute', 
                bottom: 8, 
                right: 8,
                bgcolor: input.trim() ? 'primary.main' : 'transparent',
                color: input.trim() ? 'white' : 'action.disabled',
                '&:hover': {
                  bgcolor: 'primary.dark'
                }
              }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography variant="caption" align="center" display="block" color="text.secondary" sx={{ mt: 1 }}>
            AI can make mistakes. Verify important trading metrics independently.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
