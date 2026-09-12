import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isOffline, initializeAuth } = useAuthStore();

  if (isOffline && !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[#F1F5F9] text-center">
        <WifiOff className="w-16 h-16 text-slate-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Koneksi Terputus</h2>
        <p className="text-slate-600 mb-6 max-w-sm">
          Sesi Anda masih tersimpan, tetapi HERD gagal terhubung ke server. Periksa koneksi internet Anda.
        </p>
        <Button 
          onClick={() => {
            useAuthStore.setState({ isOffline: false, isInitializing: true });
            initializeAuth();
          }}
          className="bg-[#FF7B1C] hover:bg-[#E66A15] text-white flex gap-2 items-center"
        >
          <RefreshCw className="w-4 h-4" />
          Coba Lagi
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
