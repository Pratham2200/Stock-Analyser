import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  useTheme as useMuiTheme,
  useMediaQuery,
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Assessment,
  AccountBalance,
  Timeline,
  Settings,
  Notifications,
  Person,
  Logout,
  TrendingUp,
  TrendingDown,
  BarChart,
  PieChart,
  TableChart,
  FilterList,
  Search,
  Analytics,
  Speed,
  Security,
  DarkMode,
  LightMode
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from './ThemeToggle';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { darkMode, toggleDarkMode } = useTheme();
  const theme = useMuiTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Dashboard />, color: 'primary' },
    // Commented out scan page - scans can be run from dashboard
    // { id: 'scan', label: 'Run Scan', icon: <Search />, color: 'warning' },
    { id: 'scanned', label: 'All Scanner Stocks', icon: <TableChart />, color: 'secondary' },
    { id: 'selected', label: 'Selected Stocks', icon: <TrendingUp />, color: 'success' },
    { id: 'rejected', label: 'Rejected Stocks', icon: <TrendingDown />, color: 'error' }
  ];

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const drawer = (
    <Box sx={{ width: 300, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar 
            sx={{ 
              mr: 2, 
              backgroundColor: 'rgba(255,255,255,0.2)', 
              color: 'white',
              width: 48,
              height: 48,
              backdropFilter: 'blur(10px)',
            }}
          >
            <Analytics />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.1rem' }}>
              Stock Analysis Pro
            </Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.9)" sx={{ fontWeight: 500 }}>
              Professional Trading Dashboard
            </Typography>
          </Box>
        </Box>
      </Box>
      
      <List sx={{ p: 2, flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              selected={currentPage === item.id}
              onClick={() => {
                navigate(`/${item.id}`);
                setDrawerOpen(false);
              }}
              sx={{
                borderRadius: 3,
                py: 1.5,
                px: 2,
                transition: 'all 0.2s ease-in-out',
                '&.Mui-selected': {
                  backgroundColor: `${item.color}.main`,
                  color: 'white',
                  boxShadow: 3,
                  transform: 'translateX(4px)',
                  '&:hover': {
                    transform: 'translateX(6px)',
                    backgroundColor: `${item.color}.dark`,
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  transform: 'translateX(2px)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 44 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: currentPage === item.id ? 'bold' : 600,
                  fontSize: '0.95rem',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      <Divider sx={{ mx: 2 }} />
      
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="body2" color="rgba(255,255,255,0.8)" sx={{ fontWeight: 600 }}>
            Theme
          </Typography>
          <ThemeToggle size="small" />
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      <AppBar 
        position="sticky" 
        sx={{ 
          backgroundColor: 'background.paper',
          color: 'text.primary',
          boxShadow: 2,
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important' }}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setDrawerOpen(true)}
            sx={{ 
              mr: 2,
              '&:hover': {
                backgroundColor: 'action.hover',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box display="flex" alignItems="center" flexGrow={1}>
            <Avatar 
              sx={{ 
                mr: 2, 
                backgroundColor: 'primary.main',
                width: 40,
                height: 40,
                boxShadow: 2,
              }}
            >
              <Analytics />
            </Avatar>
            <Box>
              <Typography 
                variant="h6" 
                fontWeight="bold" 
                color="primary"
                sx={{ 
                  background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Stock Analysis Pro
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Professional Trading Dashboard
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <ThemeToggle />
            
            <Tooltip title="Notifications">
              <IconButton 
                color="inherit"
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transform: 'scale(1.05)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <Notifications />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Profile">
              <IconButton 
                color="inherit" 
                onClick={handleProfileMenuOpen}
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transform: 'scale(1.05)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32, 
                    backgroundColor: 'primary.main',
                    boxShadow: 2,
                  }}
                >
                  <Person />
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 300,
            boxSizing: 'border-box',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          },
        }}
      >
        {drawer}
      </Drawer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleProfileMenuClose}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleProfileMenuClose}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleProfileMenuClose}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default Navigation;
