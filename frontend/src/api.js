import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// One axios instance for the whole app: every request goes to <backend>/api/...
const api = axios.create({ baseURL: `${API_URL}/api` });

// Before every request: attach the JWT token if we have one
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// After every response: if the server says "not logged in" (token expired
// or invalid), clear the saved login and send the user to the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginCall = error.config?.url === '/auth/login';
    if (error.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Turns any axios error into a message we can show on screen
export function getErrorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.request) return 'Cannot reach the server. Is the backend running?';
  return 'Something went wrong. Please try again.';
}

export default api;
