import { create } from 'zustand';
import axiosInstance, { scheduleProactiveRefresh, cancelProactiveRefresh } from '@/lib/axios';

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

// Helper to get or create device UUID
export function getOrCreateDeviceUUID() {
  let uuid = localStorage.getItem('hectra_device_uuid');
  if (!uuid) {
    // Basic fallback UUID generator if crypto.randomUUID is not available (e.g. non-HTTPS local)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      uuid = crypto.randomUUID();
    } else {
      uuid = 'f' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
    }
    localStorage.setItem('hectra_device_uuid', uuid);
  }
  return uuid;
}

// Simple browser/OS label generator from UserAgent
function getDeviceLabel() {
  const ua = navigator.userAgent;
  let os = "Unknown OS";
  if (ua.indexOf("Win") !== -1) os = "Windows";
  else if (ua.indexOf("Mac") !== -1) os = "macOS";
  else if (ua.indexOf("X11") !== -1) os = "UNIX";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";
  else if (ua.indexOf("Android") !== -1) os = "Android";
  else if (ua.indexOf("like Mac") !== -1) os = "iOS";

  let browser = "Unknown Browser";
  if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
  else if (ua.indexOf("Safari") !== -1) browser = "Safari";
  else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
  else if (ua.indexOf("MSIE") !== -1 || !!document.documentMode === true) browser = "IE";

  return `${browser} on ${os}`;
}

export const useAuthStore = create((set) => ({
  user: initialUser,
  token: token,
  isAuthenticated: !!token,
  isLoading: false,
  error: null,
  deviceNotTrusted: false,
  pinSetupComplete: false,

  setToken: (newToken, userObj = null) => {
    if (newToken) {
      localStorage.setItem('access_token', newToken);
    } else {
      localStorage.removeItem('access_token');
    }
    const decodedUser = newToken ? parseJwt(newToken) : null;
    const finalUser = (decodedUser && userObj) ? { ...decodedUser, ...userObj } : decodedUser;
    set({ token: newToken, user: finalUser, isAuthenticated: !!newToken });
  },

  login: async (email, password) => {
    // Cancel any stale proactive refresh timer — prevents old session's timer from
    // calling logout() and clearing the new token during a fresh login
    cancelProactiveRefresh();
    localStorage.removeItem('access_token');
    localStorage.removeItem('session_expiry');
    sessionStorage.removeItem('session_expiry');
    set({ token: null, user: null, isAuthenticated: false, isLoading: true, error: null });
    try {
      const response = await axiosInstance.post('/auth/login', {
        email: email,
        password: password
      });

      const { access_token, user } = response.data;
      const decodedUser = parseJwt(access_token);
      const mergedUser = user ? { ...decodedUser, ...user } : decodedUser;
      
      localStorage.setItem('access_token', access_token);

      // Start proactive refresh timer so token never expires mid-session
      scheduleProactiveRefresh(access_token);

      set({ 
        token: access_token, 
        user: mergedUser, 
        isAuthenticated: true, 
        isLoading: false 
      });
      return mergedUser;
    } catch (err) {
      console.warn("Backend server connection failed. Running in mock offline mode...", err);
      // Fallback: If network is offline/error, run in premium offline demo mode!
      if (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK' || !err.response) {
        // Fallback mockup login (e.g. admin@hectra.ai / password)
        const mockToken = "mock.eyJzdWIiOiIxIiwibmFtZSI6Ik9wZXJhdG9yIEhlY3RyYSIsImVtYWlsIjoiYWRtaW5AaGVjdHJhLmFpIiwicm9sZSI6ImFkbWluIiwiZnVsbF9uYW1lIjoiT3BlcmF0b3IgT3BlcmF0b3IgSGVjdHJhIiwiZXhwIjoyNjk1MzkxMTQ2fQ.mocksignature";
        const decodedUser = parseJwt(mockToken);
        const mockUser = { ...decodedUser, has_pin: false };
        
        localStorage.setItem('access_token', mockToken);

        set({ 
          token: mockToken, 
          user: mockUser, 
          isAuthenticated: true, 
          isLoading: false 
        });
        return mockUser;
      }
      set({ 
        error: err.response?.data?.detail || 'Gagal login. Periksa email dan password Anda.', 
        isLoading: false 
      });
      return false;
    }
  },

  loginWithPIN: async (user_id, pin) => {
    set({ isLoading: true, error: null, deviceNotTrusted: false });
    const device_uuid = getOrCreateDeviceUUID();
    try {
      const response = await axiosInstance.post('/auth/pin/login', {
        user_id: String(user_id),
        device_uuid,
        pin
      });

      const { access_token, user } = response.data;
      const decodedUser = parseJwt(access_token);
      const mergedUser = user ? { ...decodedUser, ...user } : decodedUser;
      
      localStorage.setItem('access_token', access_token);
      scheduleProactiveRefresh(access_token);

      set({ 
        token: access_token, 
        user: mergedUser, 
        isAuthenticated: true, 
        isLoading: false,
        deviceNotTrusted: false
      });
      return mergedUser;
    } catch (err) {
      set({ isLoading: false });
      if (err.response?.status === 403) {
        set({ deviceNotTrusted: true });
        throw err;
      }
      if (err.response?.status === 423) {
        throw new Error(err.response.data?.detail || "PIN dikunci.");
      }
      set({ error: err.response?.data?.detail || "PIN salah atau terjadi kesalahan." });
      throw err;
    }
  },

  setupPIN: async (pin) => {
    set({ isLoading: true, error: null, pinSetupComplete: false });
    try {
      await axiosInstance.post('/auth/pin/set', { pin });
      set({ pinSetupComplete: true, isLoading: false });
      return true;
    } catch (err) {
      set({ isLoading: false, error: err.response?.data?.detail || "Gagal mengatur PIN" });
      throw err;
    }
  },

  registerDevice: async () => {
    const device_uuid = getOrCreateDeviceUUID();
    const device_label = getDeviceLabel();
    try {
      await axiosInstance.post('/auth/pin/register-device', {
        device_uuid,
        device_label
      });
      return true;
    } catch (err) {
      console.warn("Failed to register device", err);
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
