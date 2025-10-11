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

export default api;
