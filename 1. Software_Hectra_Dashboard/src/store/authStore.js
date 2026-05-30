import { create } from 'zustand';
import axiosInstance, { scheduleProactiveRefresh } from '@/lib/axios';

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

// Initial state setup
let token = localStorage.getItem('access_token');
if (token === 'undefined' || token === 'null') {
  token = null;
}

// Midnight expiry removed — session now persists until refresh token expires or explicit logout

const initialUser = token ? parseJwt(token) : null;

export const useAuthStore = create((set) => ({
  user: initialUser,
  token: token,
  isAuthenticated: !!token,
  isLoading: false,
  error: null,

  setToken: (newToken) => {
    if (newToken) {
      localStorage.setItem('access_token', newToken);
    } else {
      localStorage.removeItem('access_token');
    }
    const decodedUser = newToken ? parseJwt(newToken) : null;
    set({ token: newToken, user: decodedUser, isAuthenticated: !!newToken });
  },

  login: async (email, password) => {
    localStorage.removeItem('access_token');
    set({ token: null, user: null, isAuthenticated: false, isLoading: true, error: null });
    try {
      const response = await axiosInstance.post('/auth/login', {
        email: email,
        password: password
      });

      const { access_token } = response.data;
      const decodedUser = parseJwt(access_token);
      
      localStorage.setItem('access_token', access_token);

      // Start proactive refresh timer so token never expires mid-session
      scheduleProactiveRefresh(access_token);

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
        const mockToken = "mock.eyJzdWIiOiIxIiwibmFtZSI6Ik9wZXJhdG9yIEhlY3RyYSIsImVtYWlsIjoiYWRtaW5AaGVjdHJhLmFpIiwicm9sZSI6ImFkbWluIiwiZnVsbF9uYW1lIjoiT3BlcmF0b3IgT3BlcmF0b3IgSGVjdHJhIiwiZXhwIjoyNjk1MzkxMTQ2fQ.mocksignature";
        const decodedUser = parseJwt(mockToken);
        
        localStorage.setItem('access_token', mockToken);

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

    // Call backend logout asynchronously to clear HttpOnly cookies
    axiosInstance.post('/auth/logout', {}).catch((err) => {
      console.warn('Backend logout failed or was offline', err);
    });

    set({ token: null, user: null, isAuthenticated: false });
  },

  clearError: () => set({ error: null })
}));
