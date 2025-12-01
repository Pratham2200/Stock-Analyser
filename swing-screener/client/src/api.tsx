// src/api.tsx
import axios, { AxiosResponse, AxiosError } from 'axios';

// Define the Base URL from environment variable (Vite uses import.meta.env)
// For production on Netlify, set VITE_API_URL to your Render backend URL
// Example: https://stock-analyser-sm8q.onrender.com
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/`,
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
export const fetchData = async (url: string, options?: { method?: string; headers?: any; body?: any }) => {
  try {
    let response;
    if (options?.method === 'POST') {
      // If body is a string, parse it; otherwise use as-is
      const bodyData = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      response = await api.post(url, bodyData, { 
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
    } else {
      response = await api.get(url);
    }
    return response.data;
  } catch (error: any) {
    // Enhanced error logging
    if (error.response) {
      // Server responded with error status
      console.error('API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: url
      });
    } else if (error.request) {
      // Request was made but no response received
      console.error('API Error - No response:', {
        url: url,
        message: error.message
      });
    } else {
      // Error setting up request
      console.error('API Error - Request setup:', error.message);
    }
    throw error;
  }
};

export default api;
