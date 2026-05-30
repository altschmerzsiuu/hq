import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import brandLogo from '@/assets/logo/hectra.webp';
import hectraDarkLogo from '@/assets/logo/Hectra_Dark.webp';

/* ─── Design Tokens ───────────────────────────────────────────────────── */
const T = {
  baseBg: '#0A0A0F',
  surfaceBg: '#111118',
  cardBg: '#16161F',
  hover: '#1C1C27',
  border: '#1D1D2B',
  accent: '#00D47E',
  accentHover: '#00B86B',
  danger: '#FF5B5B',
  t1: '#F2F2F7',
  t2: '#8E8EA0',
  t3: '#62627A', // Dipercerah agar label form lolos uji aksesibilitas kontras
};

const FONT_DISPLAY = "'Plus Jakarta Sans', system-ui, sans-serif";
const FONT_BODY = "'DM Sans', system-ui, sans-serif";

/* ─── Marquee ─────────────────────────────────────────────────────────── */
const MARQUEE_ITEMS = ['Hectra', 'Smart Farm', 'AI Powered', 'Livestock Intel', 'Realtime', 'Precision Farming'];

function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div style={{ overflow: 'hidden', width: '100%' }}>
      <div style={{
        display: 'flex', gap: '1.5rem',
        animation: 'hq-marquee 20s linear infinite',
        whiteSpace: 'nowrap',
      }}>
        {items.map((item, i) => (
          <span key={i} style={{
            fontSize: 10, letterSpacing: '0.14em', color: T.t3,
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
            textTransform: 'uppercase', fontFamily: FONT_BODY,
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: T.accent, display: 'inline-block', flexShrink: 0 }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Left Panel ──────────────────────────────────────────────────────── */
function LeftPanel() {
  return (
    <div style={{
      width: '100%',
      background: T.surfaceBg,
      borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      padding: '2.5rem 2rem',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* chaos shapes */}
      <div style={{ position: 'absolute', top: -20, right: -20, width: 72, height: 72, background: '#0d2b17', borderRadius: 14, transform: 'rotate(22deg)', opacity: 0.7 }} />
      <div style={{ position: 'absolute', bottom: 100, right: 18, width: 28, height: 28, background: '#0d2b17', borderRadius: '50%', opacity: 0.45 }} />
      <div style={{ position: 'absolute', top: 150, left: 14, width: 15, height: 15, background: '#0d2b17', borderRadius: 3, transform: 'rotate(9deg)', opacity: 0.55 }} />
      <div style={{ position: 'absolute', bottom: 180, left: 32, width: 42, height: 6, background: '#0d2b17', borderRadius: 3, transform: 'rotate(-6deg)', opacity: 0.4 }} />
      <div style={{ position: 'absolute', bottom: 240, right: 28, width: 18, height: 18, background: '#0d2b17', borderRadius: 4, transform: 'rotate(14deg)', opacity: 0.4 }} />

      {/* top marquee */}
      <Marquee />

      {/* logo + brand */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: 8 }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0
          }}>
            <img src={brandLogo} alt="Hectra Logo" style={{ width: '150%', height: '150%', objectFit: 'contain' }} />
          </div>

          <img src={hectraDarkLogo} alt="Hectra" style={{ height: 64, objectFit: 'contain', marginLeft: '-0.5rem' }} />
        </div>

        <p style={{
          fontSize: 11, color: T.t3, letterSpacing: '0.12em',
          fontWeight: 600, textTransform: 'uppercase', marginBottom: '1rem', // Dikurangi ke 1rem agar layout seimbang
          fontFamily: FONT_BODY, paddingLeft: 2,
        }}>
          Smart Farm Dashboard
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#0d2b17', border: `1px solid #1a3d1c`,
          borderRadius: 99, padding: '6px 16px',
          transform: 'rotate(-2.5deg)', width: 'fit-content',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: T.accent, display: 'inline-block',
            animation: 'hq-pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: '0.06em', fontFamily: FONT_BODY }}>
            Live monitoring
          </span>
        </div>
      </div>

      {/* Social Links (Custom React + Tailwind) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <ul style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 0, padding: 0, listStyle: 'none', gap: '1.75rem' }}>
          {/* Instagram */}
          <li className="group relative list-none">
            <a
              href="https://www.instagram.com/hectra.hq"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="relative overflow-hidden flex justify-center items-center w-12 h-12 rounded-full text-[#8E8EA0] bg-[#16161F] border border-[#1D1D2B] transition-all duration-300 ease-in-out hover:text-white hover:border-transparent hover:shadow-[0_4px_20px_rgba(225,48,108,0.4)]"
            >
              <div className="absolute inset-0 top-auto bottom-0 w-full h-0 bg-[#E1306C] transition-all duration-300 ease-in-out group-hover:h-full z-0" />
              <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            <div className="hq-tooltip" style={{ backgroundColor: '#E1306C' }}>
              Instagram
            </div>
          </li>

          {/* YouTube */}
          <li className="group relative list-none">
            <a
              href="https://youtube.com/@aditama7008?si=wG9YobftSXPL5_d4"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="relative overflow-hidden flex justify-center items-center w-12 h-12 rounded-full text-[#8E8EA0] bg-[#16161F] border border-[#1D1D2B] transition-all duration-300 ease-in-out hover:text-white hover:border-transparent hover:shadow-[0_4px_20px_rgba(255,0,0,0.4)]"
            >
              <div className="absolute inset-0 top-auto bottom-0 w-full h-0 bg-[#FF0000] transition-all duration-300 ease-in-out group-hover:h-full z-0" />
              <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"></path>
                <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon>
              </svg>
            </a>
            <div className="hq-tooltip" style={{ backgroundColor: '#FF0000' }}>
              YouTube
            </div>
          </li>

          {/* Website */}
          <li className="group relative list-none">
            <a
              href="https://terra-web-dun.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Website"
              className="relative overflow-hidden flex justify-center items-center w-12 h-12 rounded-full text-[#8E8EA0] bg-[#16161F] border border-[#1D1D2B] transition-all duration-300 ease-in-out hover:text-white hover:border-transparent hover:shadow-[0_4px_20px_rgba(0,212,126,0.4)]"
            >
              <div className="absolute inset-0 top-auto bottom-0 w-full h-0 bg-[#00D47E] transition-all duration-300 ease-in-out group-hover:h-full z-0" />
              <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </a>
            <div className="hq-tooltip" style={{ backgroundColor: '#00D47E' }}>
              Website
            </div>
          </li>

          {/* Telegram */}
          <li className="group relative list-none">
            <a
              href="https://t.me/PeternakanSapiBot"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="relative overflow-hidden flex justify-center items-center w-12 h-12 rounded-full text-[#8E8EA0] bg-[#16161F] border border-[#1D1D2B] transition-all duration-300 ease-in-out hover:text-white hover:border-transparent hover:shadow-[0_4px_20px_rgba(0,136,204,0.4)]"
            >
              <div className="absolute inset-0 top-auto bottom-0 w-full h-0 bg-[#0088cc] transition-all duration-300 ease-in-out group-hover:h-full z-0" />
              <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </a>
            <div className="hq-tooltip" style={{ backgroundColor: '#0088cc' }}>
              Telegram Bot
            </div>
          </li>
        </ul>
      </div>

      {/* bottom marquee */}
      <Marquee />
    </div>
  );
}

/* ─── Input Field (Full Width - Bulky Mode) ───────────────────────────── */
function Field({ label, icon: Icon, type = 'text', value, onChange, placeholder, rightEl }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 9, fontWeight: 700, color: T.t3,
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5,
        fontFamily: FONT_BODY,
      }}>
        <Icon size={10} strokeWidth={2.5} />
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: T.cardBg,
        border: `1px solid ${focused ? T.accent : T.border}`,
        borderRadius: 10, padding: '0 14px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: focused ? `0 0 0 3px ${T.accent}1A` : 'none',
      }}>
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: T.t1, fontSize: 13, padding: '12px 0', // padding vertical & font dinaikkan agar bulky
            caretColor: T.accent, fontFamily: FONT_BODY,
          }}
        />
        {rightEl}
      </div>
    </div>
  );
}

/* ─── Input Field Half (Side by Side - Bulky Mode) ────────────────────── */
function FieldHalf({ label, icon: Icon, type = 'text', value, onChange, placeholder, rightEl }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 9, fontWeight: 700, color: T.t3,
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5,
        fontFamily: FONT_BODY,
      }}>
        <Icon size={9} strokeWidth={2.5} />
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: T.cardBg,
        border: `1px solid ${focused ? T.accent : T.border}`,
        borderRadius: 10, padding: '0 14px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: focused ? `0 0 0 3px ${T.accent}1A` : 'none',
      }}>
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: T.t1, fontSize: 13, padding: '12px 0', // Disamakan agar seimbang
            caretColor: T.accent, fontFamily: FONT_BODY,
            minWidth: 0,
          }}
        />
        {rightEl}
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────── */
export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const navigate = useNavigate();

  // PIN & Device states
  const [isPinLogin, setIsPinLogin] = useState(false);
  const [pinDigits, setPinDigits] = useState(Array(6).fill(''));
  const [pinError, setPinError] = useState('');
  const [shake, setShake] = useState(false);
  const [lockedTimeRemaining, setLockedTimeRemaining] = useState(0);

  // PIN Setup Modal states
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [setupPinDigits, setSetupPinDigits] = useState(Array(6).fill(''));
  const [confirmPinDigits, setConfirmPinDigits] = useState(Array(6).fill(''));
  const [setupError, setSetupError] = useState('');
  const [tempUserId, setTempUserId] = useState(null);
  const [tempUserName, setTempUserName] = useState(null);

  // Focus tracking states
  const [focusedPinIdx, setFocusedPinIdx] = useState(-1);
  const [focusedSetupIdx, setFocusedSetupIdx] = useState(-1);
  const [focusedConfirmIdx, setFocusedConfirmIdx] = useState(-1);

  // Input references
  const pinRefs = useRef([]);
  const setupPinRefs = useRef([]);
  const confirmPinRefs = useRef([]);

  const { login, isLoading, error, isAuthenticated, clearError } = useAuthStore();

  // Startup: Detect existing UUID and previous user session to activate PIN login
  useEffect(() => {
    const devUuid = localStorage.getItem('hectra_device_uuid');
    const userId = localStorage.getItem('hectra_user_id');
    if (devUuid && userId) {
      setIsPinLogin(true);
      setTimeout(() => {
        pinRefs.current[0]?.focus();
      }, 150);
    }
  }, []);

  // Automatically submit PIN login once all 6 digits are keyed in
  useEffect(() => {
    const pinStr = pinDigits.join('');
    if (pinStr.length === 6 && isPinLogin) {
      handlePinSubmit(pinStr);
    }
  }, [pinDigits, isPinLogin]);

  // Locked countdown handler
  useEffect(() => {
    if (lockedTimeRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockedTimeRemaining(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedTimeRemaining]);

  useEffect(() => {
    // Prevent redirect to dashboard if setup modal is open
    if (isAuthenticated && !showPinSetup) {
      navigate('/dashboard', { replace: true });
    }
    clearError();
  }, [isAuthenticated, navigate, clearError, isLogin, showPinSetup]);

  // Prefill email
  useEffect(() => {
    const savedEmail = localStorage.getItem('remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  // Load Google Identity Services SDK dynamically
  useEffect(() => {
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: idToken }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Google authentication failed');
      }
      
      // Auto register device
      const { registerDevice } = useAuthStore.getState();
      await registerDevice();

      const userObj = data.user;
      
      if (!userObj.has_pin) {
        setTempUserId(userObj.id);
        setTempUserName(userObj.full_name);
        setShowPinSetup(true);
        useAuthStore.getState().setToken(data.access_token, data.user);
      } else {
        localStorage.setItem('hectra_user_id', userObj.id);
        localStorage.setItem('hectra_user_name', userObj.full_name);
        useAuthStore.getState().setToken(data.access_token, data.user);
        toast.success('Berhasil masuk dengan Google!');
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      toast.error(err.message || 'Gagal login dengan Google');
    }
  };

  const handleGoogleLogin = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      toast.error('Google Service SDK belum terpasang.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      if (!email || !password) return;
      const userObj = await login(email, password);
      if (userObj) {
        localStorage.setItem('remember_email', email);
        
        // Auto register device
        const { registerDevice } = useAuthStore.getState();
        await registerDevice();

        if (!userObj.has_pin) {
          setTempUserId(userObj.id);
          setTempUserName(userObj.full_name);
          setShowPinSetup(true);
        } else {
          localStorage.setItem('hectra_user_id', userObj.id);
          localStorage.setItem('hectra_user_name', userObj.full_name);
          toast.success('Selamat datang kembali!');
          navigate('/dashboard', { replace: true });
        }
      }
    } else {
      if (!fullName || !email || !password || !confirmPassword) return;
      if (password !== confirmPassword) {
        toast.error('Konfirmasi password tidak cocok!');
        return;
      }
      try {
        const API_BASE = import.meta.env.DEV ? '/api' : `${import.meta.env.VITE_API_URL || ''}/api`;
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Pendaftaran gagal');
        
        toast.success('Pendaftaran berhasil! Mengalihkan ke dashboard...');
        
        // Auto-login after successful registration
        const userObj = await login(email, password);
        if (userObj) {
          localStorage.setItem('remember_email', email);
          
          // Auto register device
          const { registerDevice } = useAuthStore.getState();
          await registerDevice();

          if (!userObj.has_pin) {
            setTempUserId(userObj.id);
            setTempUserName(userObj.full_name);
            setShowPinSetup(true);
          } else {
            localStorage.setItem('hectra_user_id', userObj.id);
            localStorage.setItem('hectra_user_name', userObj.full_name);
            navigate('/dashboard', { replace: true });
          }
        } else {
          setIsLogin(true);
        }
      } catch (err) {
        toast.error(err.message || 'Pendaftaran gagal');
      }
    }
  };

  // PIN Login Form Handlers
  const extractMinutes = (msg) => {
    const match = msg.match(/(\d+)\s*menit/);
    return match ? parseInt(match[1], 10) : 10;
  };

  const formatTimeRemaining = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePinDigitChange = (index, value, digitsArray, setDigitsArray, refs) => {
    if (value && !/^\d$/.test(value)) return;
    const newDigits = [...digitsArray];
    newDigits[index] = value;
    setDigitsArray(newDigits);

    // Auto-focus next input
    if (value !== '' && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index, e, digitsArray, setDigitsArray, refs) => {
    if (e.key === 'Backspace') {
      if (digitsArray[index] === '' && index > 0) {
        const newDigits = [...digitsArray];
        newDigits[index - 1] = '';
        setDigitsArray(newDigits);
        refs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digitsArray];
        newDigits[index] = '';
        setDigitsArray(newDigits);
      }
    }
  };

  const handlePinPaste = (e, setDigitsArray, refs) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    if (!/^\d{6}$/.test(pastedData)) return;

    const newDigits = pastedData.split('');
    setDigitsArray(newDigits);
    refs.current[5]?.focus();
  };

  const handlePinSubmit = async (pinStr) => {
    const userId = localStorage.getItem('hectra_user_id');
    if (!userId) return;
    try {
      setPinError('');
      const { loginWithPIN } = useAuthStore.getState();
      const userObj = await loginWithPIN(userId, pinStr);
      if (userObj) {
        toast.success('Berhasil masuk!');
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setShake(true);
      setTimeout(() => setShake(false), 500);

      const errMsg = err.response?.data?.detail || err.message || "PIN salah";

      if (err.response?.status === 423 || errMsg.includes('dikunci')) {
        const minutes = extractMinutes(errMsg);
        setLockedTimeRemaining(minutes * 60);
        setPinError(errMsg);
      } else if (err.response?.status === 403) {
        toast.error('Perangkat ini belum terdaftar. Silakan masuk menggunakan Email / Google terlebih dahulu.');
        handleNotYou();
      } else {
        setPinError(errMsg);
      }
      setPinDigits(Array(6).fill(''));
      pinRefs.current[0]?.focus();
    }
  };

  // PIN Setup Handlers
  const handleSetupPinSubmit = async () => {
    const pinStr = setupPinDigits.join('');
    const confirmPinStr = confirmPinDigits.join('');
    
    if (pinStr.length !== 6 || confirmPinStr.length !== 6) {
      setSetupError('PIN harus berupa 6 digit angka.');
      return;
    }
    
    if (pinStr !== confirmPinStr) {
      setSetupError('Konfirmasi PIN tidak cocok.');
      setSetupPinDigits(Array(6).fill(''));
      setConfirmPinDigits(Array(6).fill(''));
      setupPinRefs.current[0]?.focus();
      return;
    }
    
    try {
      setSetupError('');
      const { setupPIN } = useAuthStore.getState();
      await setupPIN(pinStr);
      
      if (tempUserId) {
        localStorage.setItem('hectra_user_id', tempUserId);
      }
      if (tempUserName) {
        localStorage.setItem('hectra_user_name', tempUserName);
      }
      
      toast.success('PIN berhasil diatur!');
      setShowPinSetup(false);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setSetupError(err.message || 'Gagal mengatur PIN');
    }
  };

  const handleSkipPinSetup = () => {
    setShowPinSetup(false);
    toast.info('PIN Setup dilewati.');
    navigate('/dashboard', { replace: true });
  };

  const handleNotYou = () => {
    localStorage.removeItem('hectra_user_id');
    localStorage.removeItem('hectra_user_name');
    setIsPinLogin(false);
    setPinDigits(Array(6).fill(''));
    setPinError('');
  };

  const handleForgotPin = () => {
    localStorage.removeItem('hectra_user_id');
    localStorage.removeItem('hectra_user_name');
    setIsPinLogin(false);
    setPinDigits(Array(6).fill(''));
    setPinError('');
    toast.success('Silakan login ulang untuk atur PIN baru');
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    clearError();
  };

  const eyeBtn = (
    <button type="button" onClick={() => setShowPassword(!showPassword)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 0 }}>
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        @keyframes hq-marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes hq-pulse   { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes hq-fadeup  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes hq-shake   { 0%,100%{transform:translateX(0)} 10%,30%,50%,70%,90%{transform:translateX(-6px)} 20%,40%,60%,80%{transform:translateX(6px)} }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        
        /* Custom Tooltip Classes for Social Icons */
        .hq-tooltip {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          color: #ffffff;
          padding: 8px 16px !important;
          border-radius: 9999px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          white-space: nowrap;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          z-index: 50;
          top: -30px;
        }
        .group:hover .hq-tooltip {
          opacity: 1 !important;
          visibility: visible !important;
          top: -46px !important;
        }

        input::placeholder { color: ${T.t2}; opacity: 0.5; font-family: 'DM Sans', system-ui, sans-serif; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px ${T.cardBg} inset !important;
          -webkit-text-fill-color: ${T.t1} !important;
        }
        
        input[type="password"] {
          font-family: monospace !important;
          letter-spacing: 0.35em !important;
        }
        input[type="password"]::placeholder {
          font-family: monospace !important;
          letter-spacing: 0.35em !important;
        }
        
        @media (max-width: 768px) {
          .hq-left-panel { display: none !important; }
          
          .hq-right-panel {
            padding: 1.25rem 1.25rem !important; 
            align-items: center !important;
            overflow: hidden !important;
            height: 100dvh !important; 
          }
          
          .hq-form-inner { 
            max-width: 100% !important; 
            padding-top: 0 !important; 
          }
          
          .hq-mobile-header { 
            display: flex !important; 
            margin-bottom: 1.25rem !important;
            padding-bottom: 1rem !important; 
          }
          
          .hq-field-row { 
            flex-direction: row !important; 
            gap: 8px !important; 
          }
        }

        .hq-right-panel::-webkit-scrollbar { display: none; }
        .hq-right-panel { -ms-overflow-style: none; scrollbar-width: none; }

        @media (min-width: 769px) {
          .hq-mobile-header { display: none !important; }
        }
      `}</style>

      <div style={{
        width: '100vw', height: '100vh',
        background: T.baseBg,
        display: 'flex',
        fontFamily: FONT_BODY,
        overflow: 'hidden',
      }}>

        {/* LEFT PANEL */}
        <div className="hq-left-panel" style={{ display: 'flex', width: '40%' }}>
          <LeftPanel />
        </div>

        {/* RIGHT PANEL */}
        <div className="hq-right-panel" style={{
          flex: 1,
          background: T.surfaceBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          padding: '1.5rem',
        }}>
          <div className="hq-form-inner" style={{
            width: '100%', maxWidth: 450, // Melebar ke 450 agar form bernapas lega
            animation: 'hq-fadeup 0.45s ease both',
          }}>

            {/* Mobile-only header */}
            <div className="hq-mobile-header" style={{
              display: 'none',
              alignItems: 'center', gap: 12,
              marginBottom: '1.5rem',
              paddingBottom: '1.25rem',
              borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                overflow: 'hidden', flexShrink: 0,
              }}>
                <img src={brandLogo} alt="Hectra Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.t1, fontFamily: FONT_DISPLAY, letterSpacing: '-0.5px' }}>
                  Hectra
                </div>
                <div style={{ fontSize: 9, color: T.t3, letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase' }}>
                  Smart Farm Dashboard
                </div>
              </div>
            </div>

            {isPinLogin ? (
              <>
                {/* ─── PIN LOGIN SCREEN ─── */}
                <h2 style={{
                  fontSize: 22, fontWeight: 800, color: T.t1,
                  letterSpacing: '-0.5px', marginBottom: 4,
                  fontFamily: FONT_DISPLAY,
                }}>
                  Selamat datang kembali.
                </h2>
                <p style={{ fontSize: 12, color: T.t2, marginBottom: '1.25rem', lineHeight: 1.55 }}>
                  Halo <strong>{localStorage.getItem('hectra_user_name') || 'Operator Hectra'}</strong>, masukkan 6 digit PIN Anda untuk masuk.
                </p>

                {/* error banner */}
                {pinError && (
                  <div style={{
                    background: '#2b0d0d', border: `1px solid ${T.danger}40`,
                    color: T.danger, padding: '8px 12px', borderRadius: 8,
                    fontSize: 12, marginBottom: 12, fontWeight: 600,
                  }}>{pinError}</div>
                )}

                {/* 6 Digit PIN inputs */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  margin: '24px 0',
                  animation: shake ? 'hq-shake 0.5s ease' : 'none'
                }}>
                  {pinDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => pinRefs.current[idx] = el}
                      type="password"
                      pattern="\d*"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      disabled={lockedTimeRemaining > 0}
                      onFocus={() => setFocusedPinIdx(idx)}
                      onBlur={() => setFocusedPinIdx(-1)}
                      onChange={e => handlePinDigitChange(idx, e.target.value, pinDigits, setPinDigits, pinRefs)}
                      onKeyDown={e => handlePinKeyDown(idx, e, pinDigits, setPinDigits, pinRefs)}
                      onPaste={e => handlePinPaste(e, setPinDigits, pinRefs)}
                      style={{
                        width: '100%',
                        maxWidth: '52px',
                        height: '52px',
                        borderRadius: '12px',
                        border: `1px solid ${focusedPinIdx === idx ? T.accent : T.border}`,
                        background: T.cardBg,
                        color: T.t1,
                        fontSize: '20px',
                        fontWeight: '800',
                        textAlign: 'center',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        boxShadow: focusedPinIdx === idx ? `0 0 0 3px ${T.accent}1A` : 'none',
                      }}
                    />
                  ))}
                </div>

                {lockedTimeRemaining > 0 && (
                  <p style={{ fontSize: 11, color: T.danger, textAlign: 'center', fontWeight: 600, marginBottom: 14 }}>
                    PIN dikunci. Coba lagi dalam {formatTimeRemaining(lockedTimeRemaining)}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 24 }}>
                  <button type="button"
                    onClick={handleForgotPin}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T.accent, fontWeight: 700, fontFamily: FONT_BODY }}>
                    Lupa PIN?
                  </button>
                  <button type="button"
                    onClick={handleNotYou}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T.t2, fontWeight: 600, fontFamily: FONT_BODY }}>
                    Bukan kamu?
                  </button>
                </div>

                <p style={{ textAlign: 'center', fontSize: 9, color: T.t3, marginTop: 14, letterSpacing: '0.04em' }}>
                  © 2026 Hectra. All rights reserved.
                </p>
              </>
            ) : (
              <>
                {/* ─── STANDARD EMAIL / GOOGLE LOGIN ─── */}
                <h2 style={{
                  fontSize: 22, fontWeight: 800, color: T.t1,
                  letterSpacing: '-0.5px', marginBottom: 4,
                  fontFamily: FONT_DISPLAY,
                }}>
                  {isLogin ? "Hey, you're back." : 'First time here?'}
                </h2>
                <p style={{ fontSize: 12, color: T.t2, marginBottom: '1.25rem', lineHeight: 1.55 }}>
                  {isLogin
                    ? "Your farm's been waiting. Let's check in."
                    : 'Set up takes less than 2 minutes, promise.'}
                </p>

                {/* error banner */}
                {error && (
                  <div style={{
                    background: '#2b0d0d', border: `1px solid ${T.danger}40`,
                    color: T.danger, padding: '8px 12px', borderRadius: 8,
                    fontSize: 12, marginBottom: 12, fontWeight: 600,
                  }}>{error}</div>
                )}

                {/* form */}
                <form onSubmit={handleSubmit}>
                  {!isLogin ? (
                    <>
                      {/* Baris 1: Full Name (Full Width) */}
                      <Field label="Full Name" icon={User}
                        value={fullName} onChange={e => setFullName(e.target.value)}
                        placeholder="Your name" />

                      {/* Baris 2: Email (Full Width) */}
                      <Field label="Email Address" icon={Mail} type="email"
                        value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="admin@farm.com" />

                      {/* Baris 3: Password + Confirm Password (Side by Side) */}
                      <div className="hq-field-row" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <FieldHalf label="Password" icon={Lock}
                          type={showPassword ? 'text' : 'password'}
                          value={password} onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••"
                          rightEl={
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 0, flexShrink: 0 }}>
                              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          } />
                        <FieldHalf label="Confirm Password" icon={Lock}
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          rightEl={
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 0, flexShrink: 0 }}>
                              {showConfirmPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          } />
                      </div>
                    </>
                  ) : (
                    <>
                      <Field label="Email Address" icon={Mail} type="email"
                        value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="admin@farm.com" />
                      <Field label="Password" icon={Lock}
                        type={showPassword ? 'text' : 'password'}
                        value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" rightEl={eyeBtn} />
                    </>
                  )}

                  {isLogin && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 14 }}>
                      <button type="button"
                        onClick={() => setShowForgotModal(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T.accent, fontWeight: 700, fontFamily: FONT_BODY }}>
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {/* Bulky Submit Button */}
                  <button type="submit" disabled={isLoading}
                    style={{
                      width: '100%', background: T.accent, border: 'none', borderRadius: 10,
                      padding: '14px 0', fontSize: 13, fontWeight: 800, color: '#0A0A0F',
                      cursor: isLoading ? 'not-allowed' : 'pointer', letterSpacing: '0.04em',
                      opacity: isLoading ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      transition: 'background 0.2s', marginBottom: 12,
                      fontFamily: FONT_BODY,
                    }}
                    onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = T.accentHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.accent; }}
                  >
                    {isLoading
                      ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
                      : <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={14} /></>}
                  </button>
                </form>

                {/* OR divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <span style={{ fontSize: 9, color: T.t3, fontWeight: 700, letterSpacing: '0.1em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>

                {/* Bulky Google Button */}
                <button type="button" onClick={handleGoogleLogin}
                  style={{
                    width: '100%', background: T.cardBg,
                    border: `1px solid ${T.border}`, borderRadius: 10,
                    padding: '13px 0', fontSize: 12, fontWeight: 700,
                    color: T.t2, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s', fontFamily: FONT_BODY,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.hover; e.currentTarget.style.borderColor = T.t3; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.cardBg; e.currentTarget.style.borderColor = T.border; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {isLogin ? 'Continue with Google' : 'Sign up with Google'}
                </button>

                {/* toggle */}
                <p style={{ textAlign: 'center', fontSize: 11, color: T.t2, marginTop: 14 }}>
                  {isLogin ? 'New to Hectra? ' : 'Already have an account? '}
                  <button onClick={handleToggleMode} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.accent, fontWeight: 700, fontSize: 11, fontFamily: FONT_BODY,
                  }}>
                    {isLogin ? 'Create an account' : 'Sign in'}
                  </button>
                </p>

                <p style={{ textAlign: 'center', fontSize: 9, color: T.t3, marginTop: 14, letterSpacing: '0.04em' }}>
                  © 2026 Hectra. All rights reserved.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: '2rem',
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            animation: 'hq-fadeup 0.3s ease both'
          }}>
            <h3 style={{ fontSize: 18, color: T.t1, fontFamily: FONT_DISPLAY, marginBottom: 12 }}>Reset Password</h3>
            <p style={{ fontSize: 12, color: T.t2, lineHeight: 1.6, marginBottom: 20 }}>
              Untuk alasan keamanan, proses reset password memerlukan verifikasi kepemilikan kandang. Silakan hubungi tim administrator HectraHQ melalui email atau WhatsApp Support di bawah ini:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              <div style={{ background: T.surfaceBg, border: `1px solid ${T.border}`, padding: '10px 14px', borderRadius: 8, fontSize: 11, color: T.t1 }}>
                <strong style={{ color: T.accent }}>Email:</strong> admin@hectra.my.id
              </div>
              <div style={{ background: T.surfaceBg, border: `1px solid ${T.border}`, padding: '10px 14px', borderRadius: 8, fontSize: 11, color: T.t1 }}>
                <strong style={{ color: T.accent }}>WhatsApp:</strong> +62 812-3456-7890
              </div>
            </div>
            <button 
              onClick={() => setShowForgotModal(false)} 
              style={{
                width: '100%',
                background: T.accent,
                border: 'none',
                borderRadius: 10,
                padding: '12px 0',
                fontSize: 12,
                fontWeight: 700,
                color: '#0A0A0F',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.accentHover}
              onMouseLeave={e => e.currentTarget.style.background = T.accent}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ─── PIN SETUP MODAL ─── */}
      {showPinSetup && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: '2rem',
            maxWidth: 420,
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            animation: 'hq-fadeup 0.3s ease both'
          }}>
            <h3 style={{ fontSize: 18, color: T.t1, fontFamily: FONT_DISPLAY, marginBottom: 8, fontWeight: 800 }}>
              Buat PIN untuk login lebih cepat
            </h3>
            <p style={{ fontSize: 12, color: T.t2, lineHeight: 1.6, marginBottom: 20 }}>
              Atur PIN 6 digit untuk memudahkan login di perangkat ini tanpa memasukkan email dan password lagi.
            </p>

            {setupError && (
              <div style={{
                background: '#2b0d0d', border: `1px solid ${T.danger}40`,
                color: T.danger, padding: '8px 12px', borderRadius: 8,
                fontSize: 12, marginBottom: 16, fontWeight: 600,
              }}>{setupError}</div>
            )}

            {/* PIN inputs */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                PIN Baru
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                {setupPinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => setupPinRefs.current[idx] = el}
                    type="password"
                    pattern="\d*"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onFocus={() => setFocusedSetupIdx(idx)}
                    onBlur={() => setFocusedSetupIdx(-1)}
                    onChange={e => handlePinDigitChange(idx, e.target.value, setupPinDigits, setSetupPinDigits, setupPinRefs)}
                    onKeyDown={e => handlePinKeyDown(idx, e, setupPinDigits, setSetupPinDigits, setupPinRefs)}
                    style={{
                      width: '100%',
                      maxWidth: '48px',
                      height: '48px',
                      borderRadius: '10px',
                      border: `1px solid ${focusedSetupIdx === idx ? T.accent : T.border}`,
                      background: T.surfaceBg,
                      color: T.t1,
                      fontSize: '18px',
                      fontWeight: '800',
                      textAlign: 'center',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Confirm PIN inputs */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Konfirmasi PIN Baru
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                {confirmPinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => confirmPinRefs.current[idx] = el}
                    type="password"
                    pattern="\d*"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onFocus={() => setFocusedConfirmIdx(idx)}
                    onBlur={() => setFocusedConfirmIdx(-1)}
                    onChange={e => handlePinDigitChange(idx, e.target.value, confirmPinDigits, setConfirmPinDigits, confirmPinRefs)}
                    onKeyDown={e => handlePinKeyDown(idx, e, confirmPinDigits, setConfirmPinDigits, confirmPinRefs)}
                    style={{
                      width: '100%',
                      maxWidth: '48px',
                      height: '48px',
                      borderRadius: '10px',
                      border: `1px solid ${focusedConfirmIdx === idx ? T.accent : T.border}`,
                      background: T.surfaceBg,
                      color: T.t1,
                      fontSize: '18px',
                      fontWeight: '800',
                      textAlign: 'center',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button 
                onClick={handleSetupPinSubmit} 
                style={{
                  width: '100%',
                  background: T.accent,
                  border: 'none',
                  borderRadius: 10,
                  padding: '13px 0',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#0A0A0F',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.accentHover}
                onMouseLeave={e => e.currentTarget.style.background = T.accent}
              >
                Simpan PIN
              </button>
              <button 
                onClick={handleSkipPinSetup} 
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: '12px 0',
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.t2,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.hover; e.currentTarget.style.color = T.t1; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.t2; }}
              >
                Lewati untuk sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}