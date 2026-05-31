import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import ToastContainer from './components/layout/ToastContainer';
import ConfirmDialog from './components/ui/ConfirmDialog';
import { useAuthStore } from './store/authStore';

function App() {
  const { isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    // Clear any legacy session_expiry keys to avoid interference
    localStorage.removeItem('session_expiry');
    sessionStorage.removeItem('session_expiry');
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer />
      <ConfirmDialog />
    </>
  );
}

export default App;
