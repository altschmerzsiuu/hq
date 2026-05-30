import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const getBaseUrl = () => {
  if (import.meta.env.DEV) {
    return '/api';
  }
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  return '/api';
};

// ─── Token Expiry Helpers ───────────────────────────────────────────
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  if (!token || token.startsWith('mock.')) return false; // mock tokens never expire
  const exp = getTokenExpiry(token);
  return exp ? Date.now() >= exp : false;
}

// ─── Axios Instance ─────────────────────────────────────────────────
const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  withCredentials: true,
})

// ─── Proactive Refresh Scheduler ────────────────────────────────────
let proactiveRefreshTimer = null;

export function scheduleProactiveRefresh(token) {
  if (!token || token.startsWith('mock.')) return;

  const expMs = getTokenExpiry(token);
  if (!expMs) return;

  const msUntilExpiry = expMs - Date.now();
  // Refresh 90 seconds before expiry — gives plenty of buffer
  const refreshIn = msUntilExpiry - 90_000;

  if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer);

  if (refreshIn <= 0) {
    // Token already expired or about to — refresh immediately
    doSilentRefresh();
    return;
  }

  proactiveRefreshTimer = setTimeout(() => {
    doSilentRefresh();
  }, refreshIn);
}

async function doSilentRefresh() {
  try {
    const resp = await axios.post(
      `${getBaseUrl()}/auth/refresh`,
      {},
      { withCredentials: true }
    );
    const newToken = resp.data.access_token;
    useAuthStore.getState().setToken(newToken);
    // Reschedule for the new token's expiry
    scheduleProactiveRefresh(newToken);
  } catch {
    // Refresh cookie also expired — graceful logout
    useAuthStore.getState().logout();
    // Show brief message then redirect
    setTimeout(() => { window.location.href = '/login'; }, 100);
  }
}

// ─── Startup: check stored token immediately ────────────────────────
const storedToken = localStorage.getItem('access_token');
if (storedToken && storedToken !== 'undefined' && storedToken !== 'null') {
  if (isTokenExpired(storedToken)) {
    // Access token expired on load — try silent refresh immediately
    doSilentRefresh();
  } else {
    // Token valid — schedule proactive refresh
    scheduleProactiveRefresh(storedToken);
  }
}

// ─── Request Interceptor ───────────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response Interceptor — Fallback 401 handler ───────────────────
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    const isAuthRequest = originalRequest.url && (
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/register') ||
      originalRequest.url.includes('/auth/google') ||
      originalRequest.url.includes('/auth/refresh') ||
      originalRequest.url.includes('/auth/logout')
    );

    // If 401 and not an auth endpoint and haven't retried yet
    if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {

      // Queue additional requests while refreshing
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return axiosInstance(originalRequest)
          })
          .catch(err => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshResponse = await axios.post(
          `${getBaseUrl()}/auth/refresh`,
          {},
          { withCredentials: true }
        )

        const newToken = refreshResponse.data.access_token
        useAuthStore.getState().setToken(newToken)
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${newToken}`
        originalRequest.headers.Authorization = `Bearer ${newToken}`

        // Reschedule proactive refresh for the new token
        scheduleProactiveRefresh(newToken);

        processQueue(null, newToken)
        return axiosInstance(originalRequest)

      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('access_token')
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)

      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
