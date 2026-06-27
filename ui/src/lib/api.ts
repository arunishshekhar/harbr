import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
});

// Request interceptor — attach JWT if stored (no-op until auth is enabled)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('harbr_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — on 401, clear token (redirect handled when auth page added)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('harbr_token');
      // window.location.href = '/login'; // uncomment when auth is enabled
    }
    return Promise.reject(err);
  },
);

export default api;
