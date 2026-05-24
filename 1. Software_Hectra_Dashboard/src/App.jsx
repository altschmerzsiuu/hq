import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import ToastContainer from './components/layout/ToastContainer';
import ConfirmDialog from './components/ui/ConfirmDialog';
import { useAuthStore } from './store/authStore';

function App() {
  const { isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSessionExpiry = () => {
      const expiry = localStorage.getItem('session_expiry') || sessionStorage.getItem('session_expiry');
      if (expiry) {
        const expiryTime = parseInt(expiry, 10);
        if (!isNaN(expiryTime) && Date.now() >= expiryTime) {
          logout();
          window.location.href = '/login';
        }
      }
    };

    // Check immediately on mount/focus
    checkSessionExpiry();

    // Check periodically every 15 seconds
    const interval = setInterval(checkSessionExpiry, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, logout]);

  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer />
      <ConfirmDialog />
    </>
  );
}

export default App;
