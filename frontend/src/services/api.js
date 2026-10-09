import axios from 'axios';

// withCredentials sends the session cookie with every request.
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true
});

export default API;
