import axios from 'axios';

const configuredBaseURL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const normalizedBaseURL = configuredBaseURL.replace(/\/+$/, '');

const api = axios.create({
  baseURL: normalizedBaseURL.endsWith('/api')
    ? normalizedBaseURL
    : `${normalizedBaseURL}/api`,
  timeout: 15000,
});

export default api;
