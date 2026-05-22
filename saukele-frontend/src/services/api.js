import axios from 'axios';

const SKIP_AUTH_URLS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email'];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't intercept auth endpoints (login, register, password reset)
    const isAuthUrl = SKIP_AUTH_URLS.some(url => originalRequest?.url?.includes(url));

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthUrl) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;

        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  verifyEmail: (email, code) => api.post('/auth/verify-email', { email, code }),
};

// Wedding/Couple API
export const coupleAPI = {
  createProfile: (data) => api.post('/couples/profile', data),
  getProfile: (coupleId) => api.get(`/couples/${coupleId}`),
  updateProfile: (coupleId, data) => api.put(`/couples/${coupleId}`, data),
  getAllWeddings: (page = 1, limit = 10) =>
    api.get(`/couples/weddings?page=${page}&limit=${limit}`),
};

// Gift API
export const giftAPI = {
  create: (data) => api.post('/gifts', data),
  getAll: (page = 1, limit = 10) => api.get(`/gifts?page=${page}&limit=${limit}`),
  getByCouple: (coupleId, page = 1, limit = 10) =>
    api.get(`/gifts/couple/${coupleId}?page=${page}&limit=${limit}`),
  getById: (giftId) => api.get(`/gifts/${giftId}`),
  update: (giftId, data) => api.put(`/gifts/${giftId}`, data),
  delete: (giftId) => api.delete(`/gifts/${giftId}`),
};

// Contribution API
export const contributionAPI = {
  create: (data) => api.post('/contributions', data),
  getByGift: (giftId, page = 1, limit = 10) =>
    api.get(`/contributions/gift/${giftId}?page=${page}&limit=${limit}`),
};

// Family API
export const familyAPI = {
  addMember: (data) => api.post('/family/members', data),
  getMyKinship: () => api.get('/family/my-kinship'),
  getGiftsByKinship: (page = 1, limit = 10) =>
    api.get(`/family/gifts?page=${page}&limit=${limit}`),
  getTree: (coupleId) => api.get(`/family/tree/${coupleId}`),
  createRegistryEntry: (data) => api.post('/family/registry', data),
  getRegistry: (coupleId) => api.get(`/family/registry/${coupleId}`),
};

// Currency API
export const currencyAPI = {
  getSupportedCurrencies: () => api.get('/currencies'),
};
export const adminAPI = {
  getQueueStats: () => api.get('/admin/queues'),
};

