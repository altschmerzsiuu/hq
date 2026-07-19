import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { Toaster } from './components/ui/sonner';
import ConfirmDialog from './components/ui/ConfirmDialog';
import { useAuthStore } from './store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import splashScreenImg from './assets/onboarding/cow_featuree.png';

function App() {
  const { isAuthenticated, logout } = useAuthStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
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
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] bg-[#FF7B1C] flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="flex-1 flex items-center justify-center">
              <motion.img 
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
                src={splashScreenImg} 
                alt="HERD Mascot" 
                className="w-[260px] h-[260px] object-contain"
              />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="absolute bottom-10 left-0 right-0 flex flex-col items-center"
            >
              <div className="flex gap-2 items-center mb-3">
                <motion.div 
                  className="w-2.5 h-2.5 rounded-full bg-white/90"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                />
                <motion.div 
                  className="w-2.5 h-2.5 rounded-full bg-white/90"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                />
                <motion.div 
                  className="w-2.5 h-2.5 rounded-full bg-white/90"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
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
