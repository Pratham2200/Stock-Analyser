import React from 'react';
import { Card, CardContent, Typography, Button, Stack, CircularProgress, Box } from '@mui/material';
import { CheckCircle, TrendingDown } from '@mui/icons-material';

// Type definitions
interface StatusData {
  cronTime: string;
  timezone: string;
  running: boolean;
  lastScan: {
    start: string;
    count: number;
  };
  sheetUrl: string;
}

interface HomeCardProps {
  status: StatusData | null;
  onManualScan: () => Promise<void>;
  manualScanLoading: boolean;
}

const HomeCard: React.FC<HomeCardProps> = ({ status, onManualScan, manualScanLoading }) => {
  console.log('HomeCard rendering with status:', status);
  if (!status) return <CircularProgress sx={{ m: 2 }} />;
  
  return (
    <Card sx={{ maxWidth: 600, margin: '24px auto' }}>
      <CardContent>
        <Typography variant="h5" mb={1}>System Status</Typography>
        <Stack spacing={1}>
          <Typography>
            <strong>Cron Schedule:</strong> {status.cronTime} (<em>{status.timezone}</em>)
          </Typography>
          <Typography>
            <strong>Job Running:</strong> {status.running ? <span style={{color:'green'}}>Yes</span> : <span style={{color: 'gray'}}>No</span>}
          </Typography>
          <Typography>
            <strong>Last Scan:</strong>
            {status.lastScan?.start ? (" " + new Date(status.lastScan.start).toLocaleString()) : " —"}
          </Typography>
          <Typography>
            <strong>Stocks Shortlisted Today:</strong> {status.lastScan?.count ?? "0"}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button
            href={status.sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            color="info"
          >
            Google Sheet
          </Button>
          <Button
            onClick={onManualScan}
            variant="contained"
            color="primary"
            disabled={manualScanLoading || status.running}
          >
            {manualScanLoading ? <CircularProgress size={22} /> : "Run Manual Scan"}
          </Button>
        </Stack>
        
        {/* Navigation Buttons */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            📊 Stock Analysis Results
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              href="/stocks"
              variant="outlined"
              color="primary"
              startIcon={<CheckCircle />}
            >
              View All Stocks
            </Button>
            <Button
              href="/selected"
              variant="outlined"
              color="success"
              startIcon={<CheckCircle />}
            >
              Selected Stocks
            </Button>
            <Button
              href="/rejected"
              variant="outlined"
              color="error"
              startIcon={<TrendingDown />}
            >
              Rejected Stocks
            </Button>
            <Button
              href="/rejections"
              variant="outlined"
              color="warning"
            >
              Rejection Analysis
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HomeCard;
