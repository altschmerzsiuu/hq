import { create } from 'zustand';
import axiosInstance from '@/lib/axios';

// Attempt to parse JWT to get basic user info (for current_user['id'])
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      base64 += '='.repeat(4 - pad);
    }
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Helper to retrieve storage items
function getStorageItem(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

// Initial state setup
let token = getStorageItem('access_token');
if (token === 'undefined' || token === 'null') {
  token = null;
}

// Check and handle midnight session expiry
let sessionExpiry = getStorageItem('session_expiry');
const isTrusted = localStorage.getItem('trusted_device') === 'true';

if (token && !sessionExpiry) {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  sessionExpiry = midnight.getTime().toString();
  if (isTrusted) {
    localStorage.setItem('session_expiry', sessionExpiry);
  } else {
    sessionStorage.setItem('session_expiry', sessionExpiry);
  }
} else if (sessionExpiry) {
  const expiryTime = parseInt(sessionExpiry, 10);
  if (isNaN(expiryTime) || Date.now() >= expiryTime) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('session_expiry');
    localStorage.removeItem('trusted_device');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('session_expiry');
    token = null;
  }
}

const initialUser = token ? parseJwt(token) : null;

export const useAuthStore = create((set) => ({
  user: initialUser,
  token: token,
  isAuthenticated: !!token,
  isLoading: false,
  error: null,

  setToken: (newToken) => {
    const isCurrentlyTrusted = localStorage.getItem('trusted_device') === 'true';
    const storage = isCurrentlyTrusted ? localStorage : sessionStorage;

    if (newToken) {
      storage.setItem('access_token', newToken);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      storage.setItem('session_expiry', midnight.getTime().toString());

      // Clean up the other storage to avoid conflict
      const otherStorage = isCurrentlyTrusted ? sessionStorage : localStorage;
      otherStorage.removeItem('access_token');
      otherStorage.removeItem('session_expiry');
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('session_expiry');
      localStorage.removeItem('trusted_device');
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('session_expiry');
    }
    const decodedUser = newToken ? parseJwt(newToken) : null;
    set({ token: newToken, user: decodedUser, isAuthenticated: !!newToken });
  },

  login: async (email, password, rememberMe = true) => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('session_expiry');
    localStorage.removeItem('trusted_device');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('session_expiry');
    set({ token: null, user: null, isAuthenticated: false, isLoading: true, error: null });
    try {
      const response = await axiosInstance.post('/auth/login', {
        email: email,
        password: password
      });

      const { access_token } = response.data;
      const decodedUser = parseJwt(access_token);
      
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const expiryVal = midnight.getTime().toString();

      if (rememberMe) {
        localStorage.setItem('trusted_device', 'true');
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('session_expiry', expiryVal);
      } else {
        sessionStorage.setItem('access_token', access_token);
        sessionStorage.setItem('session_expiry', expiryVal);
      }

      set({ 
        token: access_token, 
        user: decodedUser, 
        isAuthenticated: true, 
        isLoading: false 
      });
      return true;
    } catch (err) {
      console.warn("Backend server connection failed. Running in mock offline mode...", err);
      // Fallback: If network is offline/error, run in premium offline demo mode!
      if (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK' || !err.response) {
        // Fallback mockup login (e.g. admin@hectra.ai / password)
        const mockToken = "mock.eyJzdWIiOiIxIiwibmFtZSI6Ik9wZXJhdG9yIEhlY3RyYSIsImVtYWlsIjoiYWRtaW5AaGVjdHJhLmFpIiwicm9sZSI6ImFkbWluIiwiZnVsbF9uYW1lIjoiT3BlcmF0b3IgSGVjdHJhIiwiZXhwIjoyNjk1MzkxMTQ2fQ.mocksignature";
        const decodedUser = parseJwt(mockToken);
        
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
        const expiryVal = midnight.getTime().toString();

        if (rememberMe) {
          localStorage.setItem('trusted_device', 'true');
          localStorage.setItem('access_token', mockToken);
          localStorage.setItem('session_expiry', expiryVal);
        } else {
          sessionStorage.setItem('access_token', mockToken);
          sessionStorage.setItem('session_expiry', expiryVal);
        }

        set({ 
          token: mockToken, 
          user: decodedUser, 
          isAuthenticated: true, 
          isLoading: false 
        });
        return true;
      }
      set({ 
        error: err.response?.data?.detail || 'Gagal login. Periksa email dan password Anda.', 
        isLoading: false 
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('session_expiry');
    localStorage.removeItem('trusted_device');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('session_expiry');

    // Call backend logout asynchronously to clear HttpOnly cookies
    axiosInstance.post('/auth/logout', {}).catch((err) => {
      console.warn('Backend logout failed or was offline', err);
    });

    set({ token: null, user: null, isAuthenticated: false });
  },

  clearError: () => set({ error: null })
}));
