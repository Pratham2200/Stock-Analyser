import React from 'react';
import { IconButton, Tooltip, Box, Typography } from '@mui/material';
import { DarkMode, LightMode } from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  variant?: 'icon' | 'button';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  size = 'medium', 
  showLabel = false, 
  variant = 'icon' 
}) => {
  const { darkMode, toggleDarkMode } = useTheme();

  if (variant === 'button') {
    return (
      <Box 
        display="flex" 
        alignItems="center" 
        gap={1}
        onClick={toggleDarkMode}
        sx={{ 
          cursor: 'pointer',
          p: 1,
          borderRadius: 1,
          '&:hover': {
            backgroundColor: 'action.hover',
          },
          transition: 'background-color 0.2s ease-in-out',
        }}
      >
        <IconButton 
          size={size}
          sx={{ 
            transition: 'transform 0.2s ease-in-out',
            '&:hover': {
              transform: 'scale(1.1)',
            }
          }}
        >
          {darkMode ? <LightMode /> : <DarkMode />}
        </IconButton>
        {showLabel && (
          <Typography variant="body2" color="text.secondary">
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Tooltip title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
      <IconButton 
        onClick={toggleDarkMode}
        size={size}
        sx={{ 
          transition: 'all 0.3s ease-in-out',
          backgroundColor: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          '&:hover': {
            transform: 'scale(1.1) rotate(180deg)',
            backgroundColor: 'rgba(255,255,255,0.2)',
          },
          '&:active': {
            transform: 'scale(0.95)',
          }
        }}
      >
        {darkMode ? <LightMode /> : <DarkMode />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
