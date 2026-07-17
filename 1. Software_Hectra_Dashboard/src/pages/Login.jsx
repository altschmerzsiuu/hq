import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, ChevronLeft, User, Delete } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { handleError, handlePinError } from '@/lib/errorHandler';
import { motion, AnimatePresence } from 'framer-motion';

import cowFeatureImg from '@/assets/onboarding/cow_featuree.png';
import farmerPinImg from '@/assets/onboarding/farmer_pin.png';

const PROVINCES = [
  "", "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Jambi", "Sumatera Selatan", "Bengkulu", "Lampung",
  "Kepulauan Bangka Belitung", "Kepulauan Riau", "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta",
  "Jawa Timur", "Banten", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Kalimantan Barat",
  "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara",
  "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo", "Sulawesi Barat",
  "Maluku", "Maluku Utara", "Papua Barat", "Papua"
];

const CITIES = [
  "", "Bandung", "Jakarta", "Surabaya", "Semarang", "Yogyakarta", "Medan", "Makassar", "Denpasar", "Malang", "Bogor", "Lainnya..."
];

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithPIN, isAuthenticated, setupPIN } = useAuthStore();

  // Steps: 'feature' | 'auth' | 'pin_login' | 'pin_setup'
  const [step, setStep] = useState('feature');
  // Initialize to true so desktop defaults to Login
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isCheckingUser, setIsCheckingUser] = useState(true);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [farmName, setFarmName] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // PIN State
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [setupPinDigits, setSetupPinDigits] = useState(['', '', '', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [shake, setShake] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);

  useEffect(() => {
    // Check if returning user
    const savedUserId = localStorage.getItem('herd_user_id');

    // If they are already authenticated without a PIN check required
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (savedUserId) {
      // Returning user, show PIN login
      setStep('pin_login');
      setIsCheckingUser(false);
    } else {
      // New user flow - Skip feature step if on desktop
      if (window.innerWidth >= 1024) {
        setStep('auth');
        setIsLoginMode(true);
      } else {
        setStep('feature');
      }
      setIsCheckingUser(false);
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Initialize Google Auth
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: '645755729462-jdjrqn0dutdiuc2c8orumv0ju7a775iu.apps.googleusercontent.com',
          callback: handleGoogleCredentialResponse,
        });
      }
    };

    return () => {
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  const handleGoogleCredentialResponse = async (response) => {
    try {
      toast.info('Memproses login Google...');
      const idToken = response.credential;
      const API_BASE = import.meta.env.DEV ? '/api' : `${import.meta.env.VITE_API_URL || ''}/api`;
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Google authentication failed');

      const { access_token, user } = data;
      localStorage.setItem('access_token', access_token);

      // Auto register device
      const { registerDevice, setToken } = useAuthStore.getState();
      setToken(access_token, user);
      await registerDevice();

      if (!user.has_pin) {
        setTempUserId(user.id);
        setStep('pin_setup');
      } else {
        localStorage.setItem('herd_user_id', user.id);
        localStorage.setItem('herd_user_name', user.full_name);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      handleError(err, 'Google login');
    }
  };

  const handleGoogleLogin = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      toast.error('Google Service SDK belum terpasang.');
    }
  };

  const handlePhoneChange = (e) => {
    // Only allow digits
    const val = e.target.value.replace(/\D/g, '');
    setPhone(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoginMode) {
      if (!email || !password) return;
      setIsLoading(true);
      const userObj = await login(email, password);
      setIsLoading(false);

      if (userObj) {
        const { registerDevice } = useAuthStore.getState();
        await registerDevice();

        if (!userObj.has_pin) {
          setTempUserId(userObj.id);
          setStep('pin_setup');
        } else {
          localStorage.setItem('herd_user_id', userObj.id);
          localStorage.setItem('herd_user_name', userObj.full_name);
          toast.success('Selamat datang kembali!');
          navigate('/dashboard', { replace: true });
        }
      }
    } else {
      if (!firstName || !email || !password || !confirmPassword) return;
      if (password !== confirmPassword) {
        toast.error('Konfirmasi password tidak cocok!');
        return;
      }
      setIsLoading(true);
      try {
        const API_BASE = import.meta.env.DEV ? '/api' : `${import.meta.env.VITE_API_URL || ''}/api`;
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            full_name: `${firstName} ${lastName}`.trim(),
            phone_number: phone,
            farm_name: farmName,
            province,
            city
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Pendaftaran gagal');

        toast.success('Pendaftaran berhasil! Mengalihkan...');

        const userObj = await login(email, password);
        if (userObj) {
          const { registerDevice } = useAuthStore.getState();
          await registerDevice();
          setTempUserId(userObj.id);
          setStep('pin_setup');
        }
      } catch (err) {
        const detail = err.response?.data?.detail;
        if (detail && typeof detail === 'string' && !detail.includes('Error') && !detail.includes('Exception')) {
          toast.error(detail);
        } else {
          handleError(err, 'registrasi akun');
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  // PIN Numpad Handlers
  const handleNumpadClick = (numStr, isSetup = false) => {
    if (isLoading) return;
    const currentDigits = isSetup ? setupPinDigits : pinDigits;
    const setDigits = isSetup ? setSetupPinDigits : setPinDigits;
    
    const emptyIndex = currentDigits.findIndex(d => d === '');
    if (emptyIndex !== -1) {
      const newDigits = [...currentDigits];
      newDigits[emptyIndex] = numStr;
      setDigits(newDigits);
      
      if (emptyIndex === 5) {
        const pinStr = newDigits.join('');
        if (isSetup) handleSetupPinSubmit(pinStr);
        else handlePinSubmit(pinStr);
      }
    }
  };

  const handleNumpadDelete = (isSetup = false) => {
    if (isLoading) return;
    const currentDigits = isSetup ? setupPinDigits : pinDigits;
    const setDigits = isSetup ? setSetupPinDigits : setPinDigits;
    
    for (let i = 5; i >= 0; i--) {
      if (currentDigits[i] !== '') {
        const newDigits = [...currentDigits];
        newDigits[i] = '';
        setDigits(newDigits);
        break;
      }
    }
  };

  // Long-press delete ref
  const deleteLongPressTimer = useRef(null);

  const handleDeletePressStart = (isSetup) => {
    deleteLongPressTimer.current = setTimeout(() => {
      // Long press: clear all
      if (isSetup) setSetupPinDigits(['', '', '', '', '', '']);
      else setPinDigits(['', '', '', '', '', '']);
    }, 600);
  };

  const handleDeletePressEnd = (isSetup) => {
    if (deleteLongPressTimer.current) {
      clearTimeout(deleteLongPressTimer.current);
      deleteLongPressTimer.current = null;
    }
  };

  const handlePinSubmit = async (pinStr) => {
    const userId = localStorage.getItem('herd_user_id');
    if (!userId) {
      setStep('auth');
      setIsLoginMode(true);
      return;
    }
    try {
      setPinError('');
      setIsLoading(true);
      const userObj = await loginWithPIN(userId, pinStr);
      if (userObj) {
        toast.success('Berhasil masuk!');
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPinDigits(['', '', '', '', '', '']);
      handlePinError(err);
      // Also show inline text under dots
      const status = err?.response?.status;
      if (status === 401) setPinError('PIN tidak sesuai.');
      else if (status === 423) setPinError('PIN dikunci. Hubungi admin.');
      else if (status === 403) setPinError('Perangkat tidak dikenal.');
      else setPinError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupPinSubmit = async (pinStr) => {
    try {
      setIsLoading(true);
      await setupPIN(pinStr);
      toast.success('PIN berhasil diatur!');

      const { user } = useAuthStore.getState();
      if (user) {
        localStorage.setItem('herd_user_id', user.id);
        localStorage.setItem('herd_user_name', user.full_name);
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      handleError(err, 'setup PIN');
      setSetupPinDigits(['', '', '', '', '', '']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipPinSetup = () => {
    const { user } = useAuthStore.getState();
    if (user) {
      localStorage.setItem('herd_user_id', user.id);
      localStorage.setItem('herd_user_name', user.full_name);
    }
    toast.success('Pendaftaran selesai! Selamat datang di HERD.');
    navigate('/dashboard', { replace: true });
  };


  if (isCheckingUser) return <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center" />;

  return (
    <div className="min-h-screen bg-[#F2F2F7] lg:bg-white flex justify-center items-center font-sans sm:p-4 lg:p-0">
      <div className="w-full max-w-[420px] lg:max-w-none h-[100dvh] sm:h-[850px] sm:max-h-[90vh] lg:h-screen lg:max-h-none bg-white lg:bg-[#FF7B1C] sm:rounded-[40px] lg:rounded-none sm:shadow-2xl lg:shadow-none sm:border border-gray-100 lg:border-none relative overflow-hidden flex flex-col lg:flex-row">
        
        <AnimatePresence mode="wait">
          
          {/* STEP 1: FEATURE PROPOSITION (Mobile Only) */}
          {step === 'feature' && (
            <motion.div 
              key="feature"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 bg-white flex flex-col overflow-hidden lg:hidden"
            >
              {/* Top Orange Header Section */}
              <div className="w-full flex-[1.1] bg-[#FF7B1C] rounded-b-[40px] flex flex-col items-center justify-center pt-8 pb-4 relative overflow-hidden">
                {/* Herd Logo top left */}
                <div className="absolute top-8 left-6 w-10 h-10 bg-white rounded-xl shadow-lg p-1 flex items-center justify-center z-20">
                  <img src="/herd.jpeg" alt="HERD Logo" className="w-full h-full object-contain rounded-lg" />
                </div>
                
                <h1 className="text-white text-[15px] font-extrabold tracking-widest absolute top-10 right-10 z-20">HERD</h1>

                <motion.img 
                  src={cowFeatureImg} 
                  alt="HERD Feature" 
                  className="w-[320px] h-[320px] object-contain mt-8 z-10 drop-shadow-none"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>

              {/* Bottom White Action Section */}
              <div className="flex-1 px-8 py-8 flex flex-col items-center justify-center text-center">
                <h2 className="text-[28px] font-extrabold text-[#111118] mb-4 leading-tight">
                  Kelola peternakan lebih cerdas.
                </h2>
                <p className="text-[#62627A] text-[15px] mb-8 px-2">
                  Pantau kesehatan, reproduksi, dan aktivitas ternak dalam satu aplikasi pintar.
                </p>

                <div className="w-full flex flex-col gap-3 mt-auto">
                  <button 
                    onClick={() => {
                      setIsLoginMode(false);
                      setStep('auth');
                    }}
                    className="w-full h-[54px] bg-[#FF7B1C] hover:bg-[#E66A12] text-white rounded-[16px] font-bold text-[16px] transition-all active:scale-[0.98] flex items-center justify-center"
                  >
                    Sign up
                  </button>
                  <button 
                    onClick={() => {
                      setIsLoginMode(true);
                      setStep('auth');
                    }}
                    className="w-full h-[54px] bg-gray-100 hover:bg-gray-200 text-[#111118] rounded-[16px] font-bold text-[16px] transition-all active:scale-[0.98] flex items-center justify-center border border-gray-200"
                  >
                    Log in to existing account
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: AUTH FORM (Mobile & Desktop) */}
          {step === 'auth' && (
            <motion.div 
              key="auth"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-0 flex flex-col lg:flex-row bg-[#F8F8F9] lg:bg-[#FF7B1C] overflow-hidden"
            >
              {/* DESKTOP LEFT PANEL (Hidden on Mobile, now Orange to blend with image) */}
              <div className="hidden lg:flex w-1/2 bg-[#FF7B1C] flex-col relative items-center justify-center p-12 overflow-hidden">
                {/* Decorative circles - softened for orange background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/20 pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full border border-white/20 pointer-events-none"></div>
                
                <h1 className="text-white text-5xl font-extrabold mb-8 text-center leading-[1.1] z-10 drop-shadow-md">
                  Manage your<br/>farm smarter
                </h1>
                
                <motion.img 
                  src={cowFeatureImg} 
                  alt="HERD Feature Desktop" 
                  className="w-[450px] h-[450px] object-contain z-10" 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>

              {/* RIGHT PANEL (Form) - Styled as a rounded modal card overlapping on Desktop */}
              <div className="w-full lg:w-1/2 flex flex-col h-full relative bg-[#F8F8F9] lg:bg-white lg:rounded-l-[40px] lg:shadow-[-20px_0_40px_rgba(0,0,0,0.15)] z-20 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                
                {/* Mobile back button */}
                <div className="p-4 flex items-center sticky top-0 bg-[#F8F8F9]/80 lg:hidden backdrop-blur-md z-30">
                  <button 
                    onClick={() => setStep('feature')}
                    className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#111118] hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <ChevronLeft size={20} />
                  </button>
                </div>

                {/* Desktop top Header (Logo + Toggle) */}
                <div className="hidden lg:flex justify-between items-center px-12 py-8 w-full absolute top-0 left-0 z-30">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white rounded-xl shadow-sm p-1 border border-gray-100 flex items-center justify-center">
                       <img src="/herd.jpeg" alt="HERD" className="w-full h-full object-contain rounded-lg" />
                     </div>
                     <span className="text-[#111118] font-extrabold text-xl tracking-wider">HERD</span>
                   </div>

                   <button 
                     onClick={() => setIsLoginMode(!isLoginMode)}
                     className="flex items-center gap-2 text-[#62627A] hover:text-[#111118] font-semibold transition-colors"
                   >
                     <User size={18} />
                     {isLoginMode ? 'Sign Up' : 'Log In'}
                   </button>
                </div>

                {/* Form Content - Made more compact */}
                <div className="px-6 lg:px-[12%] pb-10 flex flex-col flex-1 mt-2 lg:mt-28 lg:justify-center">
                  <h1 className="text-[28px] lg:text-[40px] lg:tracking-tight font-bold text-[#111118] mb-2">{isLoginMode ? 'Sign In' : 'Sign up'}</h1>
                  <p className="text-[13px] lg:text-[14px] text-[#62627A] mb-6 lg:mb-8">
                    By continuing, you agree to our <a href="#" className="font-bold text-[#FF7B1C]">Terms of Use</a>.
                  </p>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-3 flex-1">
                    {!isLoginMode && (
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[11px] font-bold text-[#8E8EA0] ml-1 mb-1 block">First Name</label>
                          <input 
                            type="text" required value={firstName} onChange={e => setFirstName(e.target.value)}
                            className="w-full h-[46px] bg-white rounded-[14px] px-4 text-[14px] outline-none border border-[#E5E5EA] focus:border-[#FF7B1C] transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#111118]"
                            placeholder="John"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[11px] font-bold text-[#8E8EA0] ml-1 mb-1 block">Last Name</label>
                          <input 
                            type="text" required value={lastName} onChange={e => setLastName(e.target.value)}
                            className="w-full h-[46px] bg-white rounded-[14px] px-4 text-[14px] outline-none border border-[#E5E5EA] focus:border-[#FF7B1C] transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#111118]"
                            placeholder="Doe"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] font-bold text-[#8E8EA0] ml-1 mb-1 block">Email</label>
                      <input 
                        type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full h-[46px] bg-white rounded-[14px] px-4 text-[14px] outline-none border border-[#E5E5EA] focus:border-[#FF7B1C] transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#111118]"
                        placeholder="your.email@example.com"
                      />
                    </div>

                    {!isLoginMode && (
                      <>
                        <div>
                          <label className="text-[11px] font-bold text-[#8E8EA0] ml-1 mb-1 block">Phone Number</label>
                          <input 
                            type="text" inputMode="numeric" pattern="[0-9]*" required value={phone} onChange={handlePhoneChange}
                            className="w-full h-[46px] bg-white rounded-[14px] px-4 text-[14px] outline-none border border-[#E5E5EA] focus:border-[#FF7B1C] transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#111118]"
                            placeholder="08..."
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-[#8E8EA0] ml-1 mb-1 block">Farm Name</label>
                          <input 
                            type="text" required value={farmName} onChange={e => setFarmName(e.target.value)}
                            className="w-full h-[46px] bg-white rounded-[14px] px-4 text-[14px] outline-none border border-[#E5E5EA] focus:border-[#FF7B1C] transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#111118]"
                            placeholder="Suka Maju Farm"
                          />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-[11px] font-bold text-[#8E8EA0] ml-1 mb-1 block">Province</label>
                            <select 
                              required value={province} onChange={e => setProvince(e.target.value)}
                              className="w-full h-[46px] bg-white rounded-[14px] px-4 text-[14px] outline-none border border-[#E5E5EA] focus:border-[#FF7B1C] transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#111118] appearance-none"
                              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%238E8EA0\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2em' }}
                            >
                              {PROVINCES.map(p => (
                                <option key={p} value={p} disabled={p === ""}>{p === "" ? "Select Province" : p}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="text-[11px] font-bold text-[#8E8EA0] ml-1 mb-1 block">City / Regency</label>
                            <select 
                              required value={city} onChange={e => setCity(e.target.value)}
                              className="w-full h-[46px] bg-white rounded-[14px] px-4 text-[14px] outline-none border border-[#E5E5EA] focus:border-[#FF7B1C] transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#111118] appearance-none"
                              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%238E8EA0\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2em' }}
                            >
                              {CITIES.map(c => (
                                <option key={c} value={c} disabled={c === ""}>{c === "" ? "Select City" : c}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="relative">
                      <label className="text-[11px] font-bold text-[#8E8EA0] ml-1 mb-1 block">Password</label>
                      <input 
                        type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full h-[46px] bg-white rounded-[14px] pl-4 pr-12 text-[14px] outline-none border border-[#E5E5EA] focus:border-[#FF7B1C] transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#111118]"
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-[32px] text-[#8E8EA0] hover:text-[#111118]">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {!isLoginMode && (
                      <div className="relative">
                        <label className="text-[11px] font-bold text-[#8E8EA0] ml-1 mb-1 block">Confirm Password</label>
                        <input 
                          type={showPassword ? "text" : "password"} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          className="w-full h-[46px] bg-white rounded-[14px] px-4 text-[14px] outline-none border border-[#E5E5EA] focus:border-[#FF7B1C] transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#111118]"
                          placeholder="••••••••"
                        />
                      </div>
                    )}

                    <p className="text-[11px] text-[#8E8EA0] mt-1 mb-1">
                      {isLoginMode ? 'We will send you an email with a login link if you forgot your password.' : 'Make sure to use a strong password.'}
                    </p>

                    <button 
                      type="submit" disabled={isLoading}
                      className="w-full h-[48px] mt-1 bg-[#FF7B1C] hover:bg-[#E66A12] text-white rounded-[14px] font-bold text-[15px] transition-colors active:scale-[0.98] disabled:opacity-70 flex items-center justify-center shadow-md shadow-[#FF7B1C]/20"
                    >
                      {isLoading ? <Loader2 className="animate-spin" /> : (isLoginMode ? 'Log In' : 'Sign Up')}
                    </button>

                    <div className="flex items-center gap-4 my-2">
                      <div className="h-[1px] flex-1 bg-gray-200"></div>
                      <span className="text-[12px] text-[#8E8EA0] font-medium">Or</span>
                      <div className="h-[1px] flex-1 bg-gray-200"></div>
                    </div>

                    <div className="flex flex-col gap-3 mb-4">
                      <button type="button" onClick={handleGoogleLogin} className="w-full h-[48px] bg-white border border-[#E5E5EA] hover:bg-gray-50 rounded-[14px] flex items-center justify-center gap-3 transition-colors active:scale-[0.98] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="font-bold text-[#111118] text-[14px]">Sign in with google</span>
                      </button>
                    </div>

                    <div className="mt-auto text-center lg:hidden">
                      <button 
                        type="button"
                        onClick={() => {
                          setIsLoginMode(!isLoginMode);
                          window.scrollTo(0, 0);
                        }}
                        className="text-[#FF7B1C] font-bold text-[14px] hover:underline"
                      >
                        {isLoginMode ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: PIN LOGIN (Returning user) */}
          {step === 'pin_login' && (
            <motion.div 
              key="pin_login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white px-6 py-6 flex flex-col items-center overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[320px]">
                <motion.img 
                  src={farmerPinImg} 
                  alt="Unlock HERD" 
                  className="w-[200px] h-[200px] object-contain mb-2"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                <h1 className="text-2xl font-bold text-[#111118] mb-1">Welcome Back!</h1>
                <p className="text-[#62627A] text-[14px] mb-8 text-center px-4">
                  Hi <span className="font-bold text-[#111118]">{localStorage.getItem('herd_user_name') || 'User'}</span>, enter your 6-digit PIN.
                </p>

                {/* PIN Indicator Dots */}
                <motion.div 
                  className="flex gap-4 mb-6"
                  animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  {pinDigits.map((digit, i) => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 rounded-full transition-all duration-300 ${digit !== '' ? 'bg-[#FF7B1C] scale-110 shadow-[0_2px_8px_rgba(255,123,28,0.4)]' : 'bg-[#E5E5EA]'}`}
                    ></div>
                  ))}
                </motion.div>

                {pinError && <p className="text-red-500 text-sm font-bold mb-4">{pinError}</p>}

                {/* Custom Numpad */}
                <div className="grid grid-cols-3 gap-y-2 gap-x-8 w-full mt-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => handleNumpadClick(num.toString(), false)}
                      className="w-[64px] h-[64px] mx-auto rounded-full flex items-center justify-center text-[28px] font-normal text-[#111118] bg-transparent hover:bg-[#F8F8F9] active:bg-[#FF7B1C] active:text-white active:scale-[0.85] transition-all duration-200"
                    >
                      {num}
                    </button>
                  ))}
                  <div />
                  <button
                    onClick={() => handleNumpadClick('0', false)}
                    className="w-[64px] h-[64px] mx-auto rounded-full flex items-center justify-center text-[28px] font-normal text-[#111118] bg-transparent hover:bg-[#F8F8F9] active:bg-[#FF7B1C] active:text-white active:scale-[0.85] transition-all duration-200"
                  >
                    0
                  </button>
                  <button
                    onClick={() => handleNumpadDelete(false)}
                    onMouseDown={() => handleDeletePressStart(false)}
                    onMouseUp={() => handleDeletePressEnd(false)}
                    onMouseLeave={() => handleDeletePressEnd(false)}
                    onTouchStart={() => handleDeletePressStart(false)}
                    onTouchEnd={() => handleDeletePressEnd(false)}
                    className="w-[64px] h-[64px] mx-auto rounded-full flex items-center justify-center text-[#62627A] bg-transparent hover:bg-[#F8F8F9] active:bg-[#FFF2E8] active:text-[#FF7B1C] active:scale-[0.85] transition-all duration-200"
                  >
                    <Delete size={26} />
                  </button>
                </div>
              </div>

              <div className="flex w-full justify-between mt-6 px-2 pb-4">
                <button type="button" className="text-[#FF7B1C] font-bold text-[14px] hover:underline">Forgot PIN?</button>
                <button type="button" onClick={() => {
                  localStorage.removeItem('herd_user_id');
                  localStorage.removeItem('herd_user_name');
                  setStep('auth');
                  setIsLoginMode(true);
                }} className="text-[#8E8EA0] font-bold text-[14px] hover:text-[#111118] transition-colors">Not you?</button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: PIN SETUP (After successful login/registration if no PIN) */}
          {step === 'pin_setup' && (
            <motion.div 
              key="pin_setup"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white px-6 py-6 flex flex-col items-center overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[320px]">
                <motion.img 
                  src={farmerPinImg} 
                  alt="Secure HERD" 
                  className="w-[200px] h-[200px] object-contain mb-2"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                />
                <h1 className="text-2xl font-bold text-[#111118] mb-1">Secure your account</h1>
                <p className="text-[#62627A] text-[14px] mb-8 text-center px-4">
                  Create a 6-digit PIN for faster and more secure login next time.
                </p>

                {/* PIN Indicator Dots */}
                <div className="flex gap-4 mb-8">
                  {setupPinDigits.map((digit, i) => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 rounded-full transition-all duration-300 ${digit !== '' ? 'bg-[#FF7B1C] scale-110 shadow-[0_2px_8px_rgba(255,123,28,0.4)]' : 'bg-[#E5E5EA]'}`}
                    ></div>
                  ))}
                </div>

                {/* Custom Numpad */}
                <div className="grid grid-cols-3 gap-y-2 gap-x-8 w-full mt-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => handleNumpadClick(num.toString(), true)}
                      className="w-[64px] h-[64px] mx-auto rounded-full flex items-center justify-center text-[28px] font-normal text-[#111118] bg-transparent hover:bg-[#F8F8F9] active:bg-[#FF7B1C] active:text-white active:scale-[0.85] transition-all duration-200"
                    >
                      {num}
                    </button>
                  ))}
                  <div />
                  <button
                    onClick={() => handleNumpadClick('0', true)}
                    className="w-[64px] h-[64px] mx-auto rounded-full flex items-center justify-center text-[28px] font-normal text-[#111118] bg-transparent hover:bg-[#F8F8F9] active:bg-[#FF7B1C] active:text-white active:scale-[0.85] transition-all duration-200"
                  >
                    0
                  </button>
                  <button
                    onClick={() => handleNumpadDelete(true)}
                    onMouseDown={() => handleDeletePressStart(true)}
                    onMouseUp={() => handleDeletePressEnd(true)}
                    onMouseLeave={() => handleDeletePressEnd(true)}
                    onTouchStart={() => handleDeletePressStart(true)}
                    onTouchEnd={() => handleDeletePressEnd(true)}
                    className="w-[64px] h-[64px] mx-auto rounded-full flex items-center justify-center text-[#62627A] bg-transparent hover:bg-[#F8F8F9] active:bg-[#FFF2E8] active:text-[#FF7B1C] active:scale-[0.85] transition-all duration-200"
                  >
                    <Delete size={26} />
                  </button>
                </div>
              </div>

              <div className="flex w-full justify-center mt-6 px-2 pb-4">
                <button 
                  onClick={handleSkipPinSetup}
                  className="w-full max-w-[280px] h-[52px] bg-[#F8F8F9] hover:bg-gray-100 text-[#62627A] hover:text-[#111118] rounded-[16px] font-bold text-[15px] transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}