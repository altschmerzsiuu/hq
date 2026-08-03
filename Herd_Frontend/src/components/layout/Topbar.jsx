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
import { useTernakStore } from '@/store/useTernakStore';
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

  const { sapiList, fetchSapiList } = useTernakStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const today = new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  useEffect(() => {
    fetchNotifications();
    fetchSapiList();
  }, [fetchNotifications, fetchSapiList]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const staticPages = [
    { title: 'Dashboard', path: '/dashboard', icon: <Command size={16}/> },
    { title: 'Data Sapi (Ternak)', path: '/ternak', icon: <Command size={16}/> },
    { title: 'Riwayat Laporan', path: '/reports', icon: <Command size={16}/> },
    { title: 'Data Sensor', path: '/sensor-data', icon: <Command size={16}/> },
    { title: 'Pengaturan', path: '/settings', icon: <Settings size={16}/> },
    { title: 'Bantuan', path: '/settings?tab=help', icon: <Settings size={16}/> },
  ];

  const searchResults = (() => {
    if (!searchQuery.trim()) return { pages: [], cows: [] };
    const q = searchQuery.toLowerCase();
    return {
      pages: staticPages.filter(p => p.title.toLowerCase().includes(q)),
      cows: sapiList.filter(c => 
        (c.nama || '').toLowerCase().includes(q) || 
        (c.id || '').toLowerCase().includes(q)
      ).slice(0, 5) // limit to 5 cows
    };
  })();

  const NotifPopover = ({ className = "" }) => (
    <div
      className={cn("w-[90vw] lg:w-[360px] max-w-[360px] max-h-[55vh] lg:max-h-[60vh] bg-white border border-gray-200/60 rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200", className)}
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
                <NotifPopover className="absolute top-[60px] left-1/2 -translate-x-1/2" />
              </div>
            )}
          </div>
        </div>

        {/* Mobile Portal Target for Selection Header */}
        <div id="topbar-portal-mobile" className="absolute inset-0 z-50 pointer-events-none rounded-b-xl overflow-hidden" />
      </header>


      {/* =========================================================================
          DESKTOP FLOATING TOPBAR (DONEZO STYLE)
          ========================================================================= */}
      <header className="hidden lg:flex items-center justify-between shrink-0 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E5E7EB] rounded-[24px] mx-4 mt-4 mb-2 px-5 py-3 relative z-30">
        
        {/* Desktop Portal Target for Selection Header */}
        <div id="topbar-portal-desktop" className="absolute inset-0 z-50 pointer-events-none rounded-[24px] overflow-hidden" />

        {/* Left: Greeting */}
        <div className="w-[220px] shrink-0">
          <div className="flex flex-col">
            <span className="text-[12px] font-normal text-gray-400">
              {(() => {
                const h = new Date().getHours();
                if (h < 11) return lang === 'id' ? 'Selamat Pagi,' : 'Good Morning,';
                if (h < 15) return lang === 'id' ? 'Selamat Siang,' : 'Good Afternoon,';
                if (h < 18) return lang === 'id' ? 'Selamat Sore,' : 'Good Evening,';
                return lang === 'id' ? 'Selamat Malam,' : 'Good Night,';
              })()}
            </span>
            <span className="text-[16px] font-bold text-gray-800 leading-tight truncate">
              {user?.full_name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Peternak'}
            </span>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 flex justify-center">
          <div ref={searchRef} className="relative z-50">
            <div className="flex items-center bg-[#F8F9FA] border border-transparent hover:border-gray-200 rounded-[16px] px-4 py-2.5 w-[380px] transition-all focus-within:w-[440px] focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500/30 group">
              <Search size={16} className="text-gray-400 mr-3 group-focus-within:text-emerald-500 transition-colors shrink-0" />
              <input
                type="text"
                placeholder={lang === 'id' ? 'Cari halaman atau sapi...' : 'Search pages or cattle...'}
                className="bg-transparent border-none outline-none flex-1 text-[14px] font-medium text-gray-700 placeholder-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchOpen(true)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="ml-2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown Results */}
            <AnimatePresence>
              {isSearchOpen && searchQuery.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 shadow-2xl rounded-[20px] overflow-hidden flex flex-col z-[100]"
                >
                  <div className="max-h-[60vh] overflow-y-auto p-2">
                    {/* Pages Results */}
                    {searchResults.pages.length > 0 && (
                      <div className="mb-2">
                        <div className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Halaman</div>
                        {searchResults.pages.map((p, i) => (
                          <button
                            key={`p-${i}`}
                            onClick={() => {
                              navigate(p.path);
                              setIsSearchOpen(false);
                              setSearchQuery('');
                            }}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-gray-700 group"
                          >
                            <div className="p-1.5 bg-gray-50 rounded-md group-hover:bg-emerald-100 text-gray-400 group-hover:text-emerald-600">
                              {p.icon}
                            </div>
                            <span className="font-medium text-sm">{p.title}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Cows Results */}
                    {searchResults.cows.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Data Sapi</div>
                        {searchResults.cows.map((c) => (
                          <button
                            key={`c-${c.id}`}
                            onClick={() => {
                              navigate('/ternak', { state: { selectedCowId: c.id } });
                              setIsSearchOpen(false);
                              setSearchQuery('');
                            }}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0 border border-gray-200 group-hover:border-emerald-200">
                              <img src={c.foto || "/photoprofile_default.jpeg"} alt={c.nama} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-gray-900 group-hover:text-emerald-700">{c.nama || 'Tanpa Nama'}</span>
                              <span className="text-xs text-gray-500 group-hover:text-emerald-600/70">{c.id} • {c.status_kesehatan}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.pages.length === 0 && searchResults.cows.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        <Search size={24} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-medium">Tidak ada hasil untuk "{searchQuery}"</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                  className="absolute top-full right-0 mt-2 z-[100] origin-top-right"
                >
                  <div className="fixed inset-0 z-0 bg-transparent" onClick={() => setNotifOpen(false)} />
                  <div className="relative z-10">
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
                        {lang === 'id' ? 'OPSI AKUN' : 'ACCOUNT OPTIONS'}
                      </span>
                    </div>

                    {/* Menu Links */}
                    <div className="flex flex-col gap-1 pt-1">
                      <button
                          onClick={() => { navigate('/settings'); setProfileMenuOpen(false); }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-[14px] font-['Inter'] font-medium text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <Settings size={18} className="text-gray-400" />{lang === 'id' ? 'Pengaturan' : 'Settings'}</button>
                      <button
                          onClick={() => { navigate('/settings?tab=profile'); setProfileMenuOpen(false); }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-[14px] font-['Inter'] font-medium text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <User size={18} className="text-gray-400" />{lang === 'id' ? 'Akun' : 'Account'}</button>
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