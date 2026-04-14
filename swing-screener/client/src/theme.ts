import { createTheme } from '@mui/material/styles';

const darkFintechTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0A0E17', // Very deep navy/black
      paper: '#131A2A', // Slightly lighter for cards
    },
    primary: {
      main: '#3B82F6', // Vibrant blue
      light: '#60A5FA',
      dark: '#2563EB',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#8B5CF6', // Purple/AI accent
      light: '#A78BFA',
      dark: '#7C3AED',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#10B981', // Clean profit green
      light: '#34D399',
      dark: '#059669',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#F59E0B', 
      light: '#FBBF24',
      dark: '#D97706',
      contrastText: '#0A0E17',
    },
    error: {
      main: '#EF4444', // Sharp loss red
      light: '#F87171',
      dark: '#DC2626',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#0EA5E9',
      light: '#38BDF8',
      dark: '#0284C7',
      contrastText: '#FFFFFF',
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: '2.5rem' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em', fontSize: '2rem' },
    h3: { fontWeight: 600, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1rem', letterSpacing: '0.01em' },
    subtitle1: { fontWeight: 500, fontSize: '1rem' },
    subtitle2: { fontWeight: 500, fontSize: '0.875rem', color: '#94A3B8' },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.02em' },
  },
  shape: {
    borderRadius: 12, // Modern rounded corners
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0A0E17',
          backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.1) 0%, rgba(10, 14, 23, 1) 50%)',
          backgroundAttachment: 'fixed',
          scrollbarColor: '#334155 #0F172A',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: '#334155',
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: '#0F172A',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(19, 26, 42, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(19, 26, 42, 0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.25)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        },
        head: {
          fontWeight: 600,
          color: '#94A3B8',
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
        outlined: {
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(10, 14, 23, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0F172A',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});

export default darkFintechTheme;
