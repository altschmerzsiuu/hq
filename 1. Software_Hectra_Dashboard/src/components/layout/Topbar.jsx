// src/components/layout/Topbar.jsx
// HERD Topbar — Neo Bio-Tech Intelligence UI (MP-3 §10)

import { useState, useRef, useEffect } from 'react';
import { Bell, Globe, Menu, X, CheckCheck, ArrowRight, Search, ChevronDown, User, Settings, LogOut, Command } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '@/components/ui/ThemeToggle';
import useSettingsStore from '@/store/settingsStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import translations from '@/lib/i18n';
import { cn } from '@/lib/utils';

const TYPE_COLORS = {
  critical: { dot: 'var(--red)', bg: 'var(--red-dim)' },
  warning: { dot: 'var(--amber)', bg: 'var(--amber-dim)' },
  info: { dot: 'var(--blue)', bg: 'var(--blue-dim)' },
};

export default function Topbar({ onMenuClick, isScrolled }) {
  const { lang, setLang } = useSettingsStore();
  const { user, logout } = useAuthStore();
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const isMergedHeader = location.pathname === '/dashboard' || location.pathname === '/ternak' || location.pathname === '/sensor-data';

  const { notifications: notifs, unreadCount: unread, markAllAsRead, markAsRead, fetchNotifications } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const today = new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NotifPopover = () => (
    <div
      className="absolute top-[52px] lg:top-[60px] left-1/2 lg:left-auto lg:right-0 lg:-translate-x-0 -translate-x-1/2 w-[90vw] lg:w-[360px] max-w-[360px] max-h-[55vh] lg:max-h-[60vh] bg-white border border-gray-200/60 rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      onClick={e => e.stopPropagation()}
    >
      {/* Popover Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 20px 16px 20px',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
      }}>
        <span className="text-[15px] font-bold text-gray-900 flex items-center">
          Notifikasi {unread > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
              {unread}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {unread > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-[12px] font-bold text-[#2f7d31] hover:text-[#2f7d31]/80 transition-colors bg-transparent border-none cursor-pointer"
            >
              <CheckCheck size={14} /> Tandai semua
            </button>
          )}
          <button
            onClick={() => setNotifOpen(false)}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors bg-transparent border-none cursor-pointer flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }} className="flex flex-col gap-1">
        {notifs.map(n => (
          <div
            key={n.id}
            className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-colors relative ${n.read ? 'bg-transparent hover:bg-gray-50' : 'bg-[#2f7d31]/5 hover:bg-[#2f7d31]/10'}`}
            onClick={() => {
              markAsRead(n.id);
              if (n.cow_id) {
                setNotifOpen(false);
                navigate('/ternak', { state: { selectedCowId: n.cow_id, from: location.pathname } });
              }
            }}
          >
            {!n.read && (
              <div className="absolute left-2.5 top-5 w-2 h-2 rounded-full bg-[#2f7d31] shadow-sm animate-pulse" />
            )}
            <div className={`flex-1 min-w-0 ${!n.read ? 'pl-4' : 'pl-1'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                {n.cow_name && (
                  <span className="text-[9px] font-black uppercase tracking-wider bg-gray-200/50 text-gray-700 px-1.5 py-0.5 rounded-md shrink-0">
                    {n.cow_name}
                  </span>
                )}
                <p className={`text-[13px] truncate ${n.read ? 'font-semibold text-gray-700' : 'font-bold text-gray-900'}`}>
                  {n.title}
                </p>
              </div>
              <p className="text-[12px] text-gray-500 leading-snug line-clamp-2 pr-2">
                {n.desc}
              </p>
              <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                {n.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* See All Footer */}
      <div className="p-2 border-t border-gray-100/80">
        <button
          onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
          className="flex items-center justify-center gap-1.5 p-3 w-full rounded-xl bg-transparent hover:bg-gray-50 text-[13px] font-bold text-[#2f7d31] transition-colors border-none cursor-pointer"
        >
          Lihat Semua Notifikasi <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* =========================================================================
          MOBILE TOPBAR (UNTOUCHED, EXACTLY AS BEFORE)
          ========================================================================= */}
      <header
        className="flex lg:hidden items-center justify-between shrink-0 absolute top-0 left-0 right-0 z-30 px-4 transition-all duration-300"
        style={{
          height: '56px',
          background: isMergedHeader ? (isScrolled ? 'var(--bg-surface)' : 'transparent') : 'var(--bg-surface)',
          borderBottom: isMergedHeader ? (isScrolled ? '0.5px solid var(--border)' : 'none') : '0.5px solid var(--border)',
          boxShadow: (isMergedHeader && isScrolled) ? '0 4px 20px rgba(0,0,0,0.03)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link to="/dashboard" className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg overflow-hidden shrink-0">
            <img src="/herd.jpeg" alt="HERD Logo" className="w-full h-full object-cover" />
          </Link>
          <span
            className="hidden md:block"
            style={{ 
              fontSize: '12px', 
              color: (isMergedHeader && !isScrolled) ? 'rgba(255,255,255,0.9)' : 'var(--text-3)', 
              fontFamily: 'Inter, sans-serif',
              transition: 'color 0.3s ease'
            }}
          >
            {today}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div ref={notifRef} style={{ position: 'relative' }}>
            {location.pathname === '/notifications' ? (
              <button
                onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/dashboard')}
                style={{
                  position: 'relative', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '6px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: (isMergedHeader && !isScrolled) ? '#fff' : 'var(--text-2)',
                  borderRadius: '8px',
                  transition: 'color 0.3s ease, background 0.15s',
                }}
                aria-label="Kembali"
              >
                <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
            ) : (
              <button
                onClick={() => setNotifOpen(prev => !prev)}
                style={{
                  position: 'relative', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '6px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: (isMergedHeader && !isScrolled) ? '#fff' : (notifOpen ? 'var(--accent)' : 'var(--text-2)'),
                  borderRadius: '8px',
                  transition: 'color 0.3s ease, background 0.15s',
                  background: notifOpen ? ((isMergedHeader && !isScrolled) ? 'rgba(255,255,255,0.2)' : 'var(--accent-dim)') : 'transparent',
                }}
                aria-label="Notifikasi"
              >
                <Bell size={18} />
                {unread > 0 && (
                  <div style={{
                    position: 'absolute', top: '3px', right: '3px',
                    minWidth: '16px', height: '16px', borderRadius: '999px',
                    background: 'var(--red)', border: '1.5px solid var(--bg-surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', fontWeight: 700, color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {unread}
                  </div>
                )}
              </button>
            )}

            {/* Notification Popover (Mobile uses fixed inset + top-centered) */}
            {notifOpen && location.pathname !== '/notifications' && (
              <div className="fixed inset-0 z-[100] bg-transparent" onClick={() => setNotifOpen(false)}>
                <NotifPopover />
              </div>
            )}
          </div>
        </div>
      </header>


      {/* =========================================================================
          DESKTOP FLOATING TOPBAR (DONEZO STYLE)
          ========================================================================= */}
      <header className="hidden lg:flex items-center justify-between shrink-0 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E5E7EB] rounded-[24px] mx-4 mt-4 mb-2 px-5 py-3 relative z-30">
        
        {/* Left: Search Bar */}
        <div className="flex-1">
          <div className="flex items-center bg-[#F8F9FA] border border-transparent hover:border-gray-200 rounded-[16px] px-4 py-3 w-[420px] transition-all focus-within:w-[480px] focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500/30 group">
            <Search size={18} className="text-gray-400 mr-3 group-focus-within:text-emerald-500 transition-colors shrink-0" />
            <input 
              type="text" 
              placeholder="Search task..." 
              className="bg-transparent border-none outline-none flex-1 text-[14px] font-medium text-gray-700 placeholder-gray-400"
            />
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm shrink-0">
              <Command size={12} className="text-gray-400" />
              <span className="text-[11px] font-bold text-gray-400">F</span>
            </div>
          </div>
        </div>

        {/* Right: Notifications & Profile */}
        <div className="flex items-center gap-4">
          
          {/* Circular Notification Bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className={cn(
                "w-12 h-12 flex items-center justify-center rounded-full transition-all border",
                notifOpen ? "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900"
              )}
            >
              <Bell size={20} />
              {unread > 0 && (
                <div className="absolute top-2 right-2.5 min-w-[18px] h-[18px] bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                  {unread}
                </div>
              )}
            </button>

            {/* Notification Popover */}
            <AnimatePresence>
              {notifOpen && location.pathname !== '/notifications' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-[100]"
                >
                  <div className="fixed inset-0 z-0 bg-transparent" onClick={() => setNotifOpen(false)} />
                  <div className="relative z-10 -right-4">
                    <NotifPopover />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-10 w-[1.5px] bg-gray-100 rounded-full mx-1" />

          {/* Profile Dropdown */}
          <div className="relative" ref={profileMenuRef}>
             <button 
               onClick={() => setProfileMenuOpen(!profileMenuOpen)}
               className={cn(
                 "flex items-center gap-3 p-1.5 pr-4 rounded-full border transition-all",
                 profileMenuOpen ? "bg-gray-50 border-gray-200 shadow-inner" : "bg-white border-transparent hover:bg-gray-50/80 hover:border-gray-200"
               )}
             >
               <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-gray-200 shadow-sm">
                 <img src={user?.profile_picture || "/photoprofile_default.jpeg"} alt="Profile" className="w-full h-full object-cover" />
               </div>
               <div className="flex flex-col items-start text-left max-w-[120px] xl:max-w-[160px]">
                 <span className="text-[14px] font-bold text-gray-900 leading-tight truncate w-full">{user?.full_name || user?.name || 'Peternak'}</span>
                 <span className="text-[12px] font-medium text-gray-500 leading-tight truncate w-full">{user?.email || 'peternak@herd.com'}</span>
               </div>
             </button>

             {/* Dropdown Menu */}
             <AnimatePresence>
               {profileMenuOpen && (
                 <motion.div
                   initial={{ opacity: 0, y: 10, scale: 0.95 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   exit={{ opacity: 0, y: 10, scale: 0.95 }}
                   transition={{ duration: 0.15 }}
                   className="absolute right-0 top-full mt-3 w-64 bg-white border border-gray-100 shadow-2xl rounded-2xl p-2 z-[60]"
                 >
                    {/* Header / Back Button */}
                    <div className="flex items-center justify-between px-3 pt-2 pb-2 mb-1 border-b border-gray-50">
                      <span className="text-gray-400 font-['Inter'] text-[11px] font-bold uppercase tracking-widest">
                        Opsi Akun
                      </span>
                    </div>

                    {/* Menu Links */}
                    <div className="flex flex-col gap-1 pt-1">
                      <button
                          onClick={() => { navigate('/settings'); setProfileMenuOpen(false); }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-[14px] font-['Inter'] font-medium text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <Settings size={18} className="text-gray-400" />
                        Pengaturan
                      </button>
                      <button
                          onClick={() => { navigate('/settings?tab=profile'); setProfileMenuOpen(false); }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-[14px] font-['Inter'] font-medium text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <User size={18} className="text-gray-400" />
                        Akun
                      </button>
                      <div className="h-px bg-gray-100 my-1 mx-2" />
                      <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-[14px] font-['Inter'] font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <LogOut size={18} className="text-red-400" />
                        {t.btn_logout || 'Logout'}
                      </button>
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>

        </div>
      </header>
    </>
  );
}