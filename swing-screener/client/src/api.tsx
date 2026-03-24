// src/api.tsx
import axios, { AxiosResponse, AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/api/',
  timeout: 300000, // 5 minute timeout for scans
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status && error.response.status >= 500) {
      // Handle server errors
      console.error('Server error:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      // Handle connection errors
      console.error('Cannot connect to server');
    }
    return Promise.reject(error);
  }
);

// Helper function for making API calls
export const fetchData = async (url: string) => {
  try {
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Observation Queue API
export const fetchObservationQueue = async (limit: number = 50) => {
  const response = await api.get(`/observations?limit=${limit}`);
  return response.data;
};

export const processObservation = async (
  id: number,
  decision: 'approved' | 'rejected',
  notes?: string
) => {
  const response = await api.post(`/observations/${id}/decision`, {
    decision,
    notes,
    reviewedBy: 'User'
  });
  return response.data;
};

export const fetchAIStats = async () => {
  const response = await api.get('/ai-stats');
  return response.data;
};

export default api;
