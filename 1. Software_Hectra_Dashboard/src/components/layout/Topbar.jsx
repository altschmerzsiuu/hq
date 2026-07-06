// src/components/layout/Topbar.jsx
// HERD Topbar — Neo Bio-Tech Intelligence UI (MP-3 §10)

import { useState, useRef, useEffect } from 'react';
import { Bell, Globe, Menu, X, CheckCheck, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/ui/ThemeToggle';
import useSettingsStore from '@/store/settingsStore';
import { useNotificationStore } from '@/store/notificationStore';
import translations from '@/lib/i18n';

const TYPE_COLORS = {
  critical: { dot: 'var(--red)', bg: 'var(--red-dim)' },
  warning: { dot: 'var(--amber)', bg: 'var(--amber-dim)' },
  info: { dot: 'var(--blue)', bg: 'var(--blue-dim)' },
};

export default function Topbar({ onMenuClick }) {
  const { lang, setLang } = useSettingsStore();
  const t = translations[lang];
  const navigate = useNavigate();

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
      style={{
        height: '56px',
        background: 'var(--bg-surface)',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 30,
        paddingLeft: '16px',
        paddingRight: '22px',
      }}
    >
      {/* Left: Hamburger (mobile ONLY) + Date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>

        {/* ✅ FIX 1: Hamburger hanya muncul di mobile (< lg = < 1024px).
            Pakai `block lg:hidden` supaya di desktop dia benar-benar tidak dirender.
            Sebelumnya hanya `lg:hidden` yang kadang tidak ter-apply karena specificity
            inline style `display:flex` pada parent menang. */}
        <button
          onClick={onMenuClick}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-2)',
            borderRadius: '8px',
            transition: 'background 0.15s',
          }}
          className="flex lg:hidden hover:bg-[var(--bg-hover)]"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        {/* Date — hidden on small mobile, visible md+ */}
        <span
          className="hidden md:block"
          style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif' }}
        >
          {today}
        </span>
      </div>

      {/* Right: Lang + Theme + Bell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Language Dropdown (Enlarged with real flags & larger click area) */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Globe size={14} style={{ color: 'var(--text-2)', position: 'absolute', left: '10px', pointerEvents: 'none', zIndex: 1 }} />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            style={{
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--text-1)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              outline: 'none',
              padding: '6px 12px 6px 30px',
              appearance: 'none',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
            className="hover:border-[var(--accent)] hover:bg-[var(--bg-hover)]"
          >
            <option value="id" style={{ background: 'var(--bg-surface)', color: 'var(--text-1)' }}>🇮🇩 ID</option>
            <option value="en" style={{ background: 'var(--bg-surface)', color: 'var(--text-1)' }}>🇬🇧 EN</option>
          </select>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Separator */}
        <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />

        {/* Notification Bell + Popover */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setNotifOpen(prev => !prev)}
            style={{
              position: 'relative', background: 'none', border: 'none',
              cursor: 'pointer', padding: '6px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: notifOpen ? 'var(--accent)' : 'var(--text-2)',
              borderRadius: '8px',
              transition: 'color 0.15s, background 0.15s',
              background: notifOpen ? 'var(--accent-dim)' : 'transparent',
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

          {/* Notification Popover */}
          {notifOpen && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                width: '340px', maxHeight: '420px',
                background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
                borderRadius: '16px', boxShadow: 'var(--shadow-dropdown)',
                overflow: 'hidden', zIndex: 100,
                animation: 'page-fade-in 0.15s ease',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Popover Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '0.5px solid var(--border)',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', fontFamily: 'DM Sans, sans-serif' }}>
                  Notifikasi {unread > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      marginLeft: '6px', minWidth: '18px', height: '18px', borderRadius: '999px',
                      background: 'var(--red)', color: '#fff', fontSize: '10px', fontWeight: 700,
                    }}>{unread}</span>
                  )}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {unread > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                    >
                      <CheckCheck size={13} /> Tandai semua
                    </button>
                  )}
                  <button
                    onClick={() => setNotifOpen(false)}
                    style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifs.map(n => {
                  const colors = TYPE_COLORS[n.type] || TYPE_COLORS.info;
                  return (
                    <div
                      key={n.id}
                      style={{
                        display: 'flex', gap: '12px', padding: '12px 16px',
                        borderBottom: '0.5px solid var(--border)',
                        background: n.read ? 'transparent' : 'var(--accent-dim)',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      className="hover:bg-[var(--bg-hover)]"
                      onClick={() => markAsRead(n.id)}
                    >
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: n.read ? 'transparent' : colors.dot,
                        flexShrink: 0, marginTop: '5px',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: n.read ? 500 : 700, color: 'var(--text-1)', fontFamily: 'DM Sans, sans-serif', marginBottom: '2px' }}>
                          {n.title}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>
                          {n.desc}
                        </p>
                        <p style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', fontFamily: 'Inter, sans-serif' }}>
                          {n.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* See All Footer */}
              <button
                onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '12px', width: '100%', background: 'none', border: 'none',
                  borderTop: '0.5px solid var(--border)',
                  fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
                }}
                className="hover:bg-[var(--accent-dim)]"
              >
                Lihat Semua Notifikasi <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}