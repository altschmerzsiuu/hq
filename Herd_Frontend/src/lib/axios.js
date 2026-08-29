import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'

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
// Proactive refresh removed to prevent infinite loops caused by server-client clock drift.
// Token rotation is now handled robustly via the 401 response interceptor below.

export function cancelProactiveRefresh() {
  // No-op
}

export function scheduleProactiveRefresh(token) {
  // No-op
}

// ─── Startup ────────────────────────
// No startup check needed; the first API call will trigger a 401 and refresh if expired.

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
      originalRequest.url.includes('/auth/logout') ||
      originalRequest.url.includes('/auth/pin')  // PIN endpoints must not trigger logout loop
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
      const tokenBeforeInterceptor = localStorage.getItem('access_token');

      try {
        const refreshResponse = await axios.post(
          `${getBaseUrl()}/auth/refresh`,
          {},
          { withCredentials: true }
        )

        // If the token changed during the request, ignore
        if (localStorage.getItem('access_token') !== tokenBeforeInterceptor) {
          console.warn("Interceptor refresh completed but token was updated mid-flight. Ignoring.");
          isRefreshing = false;
          return axiosInstance(originalRequest);
        }

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
        // If the token changed during the request, do NOT logout!
        if (localStorage.getItem('access_token') === tokenBeforeInterceptor) {
          localStorage.removeItem('access_token')
          useAuthStore.getState().logout()
          toast.error('Sesi Anda telah berakhir. Silakan masuk kembali.');
          setTimeout(() => { window.location.href = '/login' }, 800);
        }
        return Promise.reject(refreshError)

      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
