import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import ConfirmDialog from './components/ui/ConfirmDialog';
import { useAuthStore } from './store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import splashScreenImg from './assets/onboarding/cow_featuree.png';
import { setupForegroundMessaging } from './firebase-config';

function App() {
  const { isAuthenticated, logout } = useAuthStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Setup foreground messaging
    setupForegroundMessaging(toast);
    // Clear any legacy session_expiry keys to avoid interference
    localStorage.removeItem('session_expiry');
    sessionStorage.removeItem('session_expiry');

    // Check if splash has been shown in this session
    const hasSeenSplash = sessionStorage.getItem('herd_splash_shown');
    
    if (hasSeenSplash) {
      setShowSplash(false);
      return;
    }

    // Simulate loading time for splash screen
    const timer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem('herd_splash_shown', 'true');
    }, 2500); // 2.5 seconds splash screen
    
    // Set initial splash screen theme color
    if (showSplash) {
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = 'theme-color';
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.content = '#FF7B1C';
    }

    return () => clearTimeout(timer);
  }, [showSplash]);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed top-0 left-0 right-0 bottom-0 min-h-[100dvh] w-[100dvw] z-[9999] bg-[#FF7B1C] flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="flex-1 flex items-center justify-center">
              <motion.img 
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                src={splashScreenImg} 
                alt="HERD Mascot" 
                className="w-[260px] h-[260px] object-contain"
              />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute bottom-10 left-0 right-0 flex flex-col items-center"
            >
              <style>{`
                @keyframes smoothBounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-8px); }
                }
              `}</style>
              <div className="flex gap-2 items-center mb-3">
                <div 
                  className="w-2.5 h-2.5 rounded-full bg-white/90"
                  style={{ animation: 'smoothBounce 0.8s infinite ease-in-out' }}
                />
                <div 
                  className="w-2.5 h-2.5 rounded-full bg-white/90"
                  style={{ animation: 'smoothBounce 0.8s infinite ease-in-out 0.15s' }}
                />
                <div 
                  className="w-2.5 h-2.5 rounded-full bg-white/90"
                  style={{ animation: 'smoothBounce 0.8s infinite ease-in-out 0.3s' }}
                />
              </div>
              <h1 className="text-white text-2xl font-extrabold tracking-wider">HERD</h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RouterProvider router={router} />
      <Toaster />
      <ConfirmDialog />
    </>
  );
}

export default App;
