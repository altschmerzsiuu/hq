// src/components/layout/Topbar.jsx
// HERD Topbar — Neo Bio-Tech Intelligence UI (MP-3 §10)

import { useState, useRef, useEffect } from 'react';
import { Bell, Globe, Menu, X, CheckCheck, ArrowRight } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import ThemeToggle from '@/components/ui/ThemeToggle';
import useSettingsStore from '@/store/settingsStore';
import { useNotificationStore } from '@/store/notificationStore';
import translations from '@/lib/i18n';

const TYPE_COLORS = {
  critical: { dot: 'var(--red)', bg: 'var(--red-dim)' },
  warning: { dot: 'var(--amber)', bg: 'var(--amber-dim)' },
  info: { dot: 'var(--blue)', bg: 'var(--blue-dim)' },
};

export default function Topbar({ onMenuClick, isScrolled }) {
  const { lang, setLang } = useSettingsStore();
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const isMergedHeader = location.pathname === '/dashboard' || location.pathname === '/ternak' || location.pathname === '/sensor-data';

  const { notifications: notifs, unreadCount: unread, markAllAsRead, markAsRead, fetchNotifications } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

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
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      id="main-topbar"
      style={{
        height: '56px',
        background: isMergedHeader ? (isScrolled ? 'var(--bg-surface)' : 'transparent') : 'var(--bg-surface)',
        borderBottom: isMergedHeader ? (isScrolled ? '0.5px solid var(--border)' : 'none') : '0.5px solid var(--border)',
        boxShadow: (isMergedHeader && isScrolled) ? '0 4px 20px rgba(0,0,0,0.03)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        paddingLeft: '16px',
        paddingRight: '22px',
        transition: 'background-color 0.3s ease, border-bottom 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {/* Left: Hamburger (mobile ONLY) + Date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Logo (mobile ONLY) */}
        <Link to="/dashboard" className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg overflow-hidden shrink-0">
          <img src="/herd.jpeg" alt="HERD Logo" className="w-full h-full object-cover" />
        </Link>

        {/* Date — hidden on small mobile, visible md+ */}
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

      {/* Right: Lang + Theme + Bell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Notification Bell + Popover */}
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

          {/* Notification Popover (Top-Centered) */}
          {notifOpen && location.pathname !== '/notifications' && (
            <div className="fixed inset-0 z-[100] bg-transparent" onClick={() => setNotifOpen(false)}>
              <div
                className="absolute top-[52px] left-1/2 -translate-x-1/2 w-[90vw] max-w-[340px] max-h-[55vh] bg-white border border-gray-200/60 rounded-[28px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
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
                {notifs.map(n => {
                  return (
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
                  );
                })}
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
            </div>
          )}
        </div>
      </div>
    </header>
  );
}