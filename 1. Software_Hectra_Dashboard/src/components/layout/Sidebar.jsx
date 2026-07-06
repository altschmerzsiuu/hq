// src/components/layout/Sidebar.jsx
// HERD Sidebar — Neo Bio-Tech Intelligence UI

import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Database,
  BarChart3,
  PieChart,
  Clock,
  Lightbulb,
  Bell,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Beef,
  Settings,
  MoreVertical,
  Heart,
  Cpu,
  Eye,
  Wifi,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import { cn } from '@/lib/utils';
import herdLogo from '@/assets/logo/herd.jpeg'

export default function Sidebar({ isOpen, setIsOpen, isCollapsed, setIsCollapsed }) {
  const { user, logout } = useAuthStore();
  const { lang, theme } = useSettingsStore();
  const t = translations[lang];
  const location = useLocation();
  const navigate = useNavigate();

  const [logoFailed, setLogoFailed] = useState(false);
  const [textFailed, setTextFailed] = useState(false);

  const [dataMgmtOpen, setDataMgmtOpen] = useState(
    location.pathname.includes('/ternak') ||
    location.pathname.includes('/reproduction') ||
    location.pathname.includes('/sensor-data')
  );
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ FIX 2: Tutup sidebar otomatis saat route berubah di mobile
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navSections = [
    {
      label: null,
      items: [
        { name: t.nav_dashboard, path: '/dashboard', icon: Home },
      ]
    },
    {
      label: 'DATA',
      items: [
        {
          name: t.nav_data_mgmt,
          isDropdown: true,
          icon: Database,
          isOpen: dataMgmtOpen,
          toggle: () => setDataMgmtOpen(!dataMgmtOpen),
          subItems: [
            { name: t.nav_livestock, path: '/ternak', icon: Beef },
            { name: t.nav_repro_records, path: '/reproduction', icon: Heart },
            { name: t.nav_live_signals, path: '/sensor-data', icon: Cpu },
          ]
        }
      ]
    },
    {
      label: 'INTELLIGENCE',
      items: [
        { name: t.nav_estrus_intel, path: '/estrus-prediction', icon: Zap },
        { name: t.nav_herd_analytics, path: '/behavior-analytics', icon: PieChart },
        { name: t.nav_activity_timeline, path: '/activity-timeline', icon: Clock },
        { name: t.nav_recommendations, path: '/recommendations', icon: Lightbulb },
      ]
    }
  ];

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.slice(0, 2).toUpperCase() || 'OP');

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          background: 'var(--bg-surface)',
          borderRight: '0.5px solid var(--border)',
          // Di mobile selalu full width (210px), collapsed hanya berlaku di desktop
          width: isCollapsed ? '68px' : '210px',
        }}
        className={cn(
          'fixed inset-y-0 left-0 z-[60] transform transition-all duration-300 ease-in-out flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'lg:static lg:flex overflow-visible'
        )}
      >
        {/* ✅ FIX 2: Collapse Toggle Arrow — HANYA muncul di desktop (lg:flex).
            Sebelumnya sudah ada `hidden lg:flex` tapi posisi `absolute right: -10px`
            tetap membuat arrow terlihat melayang saat sidebar mobile terbuka.
            Sekarang dipastikan dengan double guard: className `hidden lg:flex` +
            pointer-events:none di mobile via Tailwind. */}
        {/* Collapse arrow — desktop ONLY. Inline style tidak boleh set display:flex
            karena akan override Tailwind `hidden`. Display dikontrol penuh oleh Tailwind. */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: 'absolute',
            right: '-10px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '20px',
            height: '44px',
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: '999px',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 60,
            transition: 'all 0.15s',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          }}
          className="hidden lg:flex hover:bg-[var(--bg-hover)]"
          aria-label="Toggle sidebar"
        >
          {isCollapsed
            ? <ChevronRight size={12} style={{ color: 'var(--text-2)' }} />
            : <ChevronLeft size={12} style={{ color: 'var(--text-2)' }} />
          }
        </button>

        {/* Brand */}
        <div
          style={{
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            padding: isCollapsed ? '0 14px' : '0 16px',
            borderBottom: '0.5px solid var(--border)',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          {/* Logo */}
          <img
            src={herdLogo}
            alt="HERD Logo"
            style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
          />

          {/* Text logo */}
          {!isCollapsed && (
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
              fontSize: '18px', color: 'var(--accent)',
              letterSpacing: '-0.02em', whiteSpace: 'nowrap',
            }}>HERD</span>
          )}

          {/* ✅ Close button mobile — ml-auto dorong ke kanan, hidden di desktop */}
          {!isCollapsed && (
            <button
              onClick={() => setIsOpen(false)}
              className="ml-auto flex lg:hidden p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-3)]"
              aria-label="Tutup menu"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
          style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          {navSections.map((section, si) => (
            <div key={si} style={{ marginBottom: '4px' }}>
              {/* Section Label */}
              {section.label && !isCollapsed && (
                <div style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.10em',
                  color: 'var(--text-3)',
                  padding: '8px 10px 4px',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {section.label}
                </div>
              )}
              {section.label && isCollapsed && (
                <div style={{ height: '1px', background: 'var(--border)', margin: '8px 6px 4px' }} />
              )}

              {section.items.map((item) => {
                const Icon = item.icon;

                /* Dropdown */
                if (item.isDropdown && !isCollapsed) {
                  return (
                    <div key={item.name}>
                      <button
                        onClick={item.toggle}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '7px 10px', borderRadius: '8px', border: 'none',
                          background: item.isOpen ? 'var(--accent-dim)' : 'transparent',
                          cursor: 'pointer', transition: 'background 0.15s',
                          color: item.isOpen ? 'var(--accent)' : 'var(--text-2)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <Icon size={16} />
                          <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                            {item.name}
                          </span>
                        </div>
                        <ChevronDown
                          size={13}
                          style={{
                            transition: 'transform 0.15s',
                            transform: item.isOpen ? 'rotate(180deg)' : 'rotate(0)',
                            color: 'var(--text-3)',
                          }}
                        />
                      </button>
                      {item.isOpen && (
                        <div style={{ paddingLeft: '16px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {item.subItems.map((sub) => (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              onClick={() => setIsOpen(false)}
                              style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '6px 10px', borderRadius: '7px', textDecoration: 'none',
                                fontSize: '12px', fontWeight: isActive ? 500 : 400,
                                fontFamily: 'Inter, sans-serif',
                                background: isActive ? 'var(--accent-dim)' : 'transparent',
                                color: isActive ? 'var(--accent)' : 'var(--text-2)',
                                transition: 'all 0.15s',
                                position: 'relative',
                              })}
                            >
                              {({ isActive }) => (
                                <>
                                  {isActive && <div className="nav-active-bar" />}
                                  <sub.icon size={14} />
                                  <span>{sub.name}</span>
                                </>
                              )}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                /* Regular Nav Item */
                return (
                  <NavLink
                    key={item.path || item.name}
                    to={item.isDropdown ? item.subItems[0].path : (item.path || '#')}
                    onClick={() => { setIsOpen(false); }}
                    style={({ isActive }) => {
                      const reallyActive = item.isDropdown
                        ? item.subItems.some(sub => location.pathname === sub.path)
                        : isActive;
                      return {
                        display: 'flex', alignItems: 'center', gap: isCollapsed ? 0 : '9px',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        padding: '7px 10px', borderRadius: '8px', textDecoration: 'none',
                        fontSize: '13px', fontWeight: reallyActive ? 500 : 400,
                        fontFamily: 'Inter, sans-serif',
                        background: reallyActive ? 'var(--accent-dim)' : 'transparent',
                        border: reallyActive ? '0.5px solid var(--accent-border)' : '0.5px solid transparent',
                        color: reallyActive ? 'var(--accent)' : 'var(--text-2)',
                        transition: 'all 0.15s',
                        position: 'relative',
                      };
                    }}
                    className="group"
                  >
                    {({ isActive }) => {
                      const reallyActive = item.isDropdown
                        ? item.subItems.some(sub => location.pathname === sub.path)
                        : isActive;
                      return (
                        <>
                          {reallyActive && <div className="nav-active-bar" />}
                          <Icon size={16} style={{ flexShrink: 0 }} />
                          {!isCollapsed && <span>{item.name}</span>}

                          {/* Tooltip when collapsed — desktop only */}
                          {isCollapsed && (
                            <div
                              style={{
                                position: 'absolute', left: '100%', marginLeft: '12px',
                                padding: '4px 10px', background: 'var(--bg-card)',
                                border: '0.5px solid var(--border)',
                                borderRadius: '6px', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                                color: 'var(--text-1)', whiteSpace: 'nowrap',
                                opacity: 0, pointerEvents: 'none', zIndex: 100,
                                transition: 'opacity 0.15s',
                                boxShadow: 'var(--shadow-dropdown)',
                              }}
                              className="group-hover:opacity-100"
                            >
                              {item.name}
                            </div>
                          )}
                        </>
                      );
                    }}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div
          ref={profileRef}
          style={{
            borderTop: '0.5px solid var(--border)',
            padding: '8px',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {/* Profile Dropdown */}
          {profileMenuOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', marginBottom: '8px',
              background: 'var(--bg-card)', border: '0.5px solid var(--border)',
              borderRadius: '12px', width: '220px', zIndex: 100,
              boxShadow: 'var(--shadow-dropdown)',
              left: isCollapsed ? '8px' : '8px',
              overflow: 'hidden',
              animation: 'page-fade-in 0.15s ease',
            }}>
              <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--border)' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', fontFamily: 'DM Sans, sans-serif' }}>
                  {user?.full_name || 'Operator'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', fontFamily: 'Inter, sans-serif' }}>
                  {user?.email || ''}
                </p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  marginTop: '6px', padding: '2px 8px', borderRadius: '999px',
                  background: 'var(--accent-dim)', border: '0.5px solid var(--accent-border)',
                  fontSize: '10px', fontWeight: 600, color: 'var(--accent)',
                  fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {user?.role || 'Admin'}
                </div>
              </div>
              <div style={{ padding: '6px' }}>
                {[
                  { icon: User, label: t.nav_settings, action: () => { navigate('/settings'); setProfileMenuOpen(false); } },
                ].map(({ icon: I, label, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '8px 10px', borderRadius: '8px', border: 'none',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      fontSize: '13px', color: 'var(--text-2)', fontFamily: 'Inter, sans-serif',
                      transition: 'background 0.15s',
                    }}
                    className="hover:bg-[var(--bg-hover)]"
                  >
                    <I size={14} style={{ color: 'var(--text-3)' }} />
                    {label}
                  </button>
                ))}
                <div style={{ height: '0.5px', background: 'var(--border)', margin: '4px 0' }} />
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '8px 10px', borderRadius: '8px', border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    fontSize: '13px', fontWeight: 600, color: 'var(--red)',
                    fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
                  }}
                  className="hover:bg-[var(--red-dim)]"
                >
                  <LogOut size={14} />
                  {t.btn_logout}
                </button>
              </div>
            </div>
          )}

          {/* Profile Button */}
          <button
            type="button"
            onClick={() => setProfileMenuOpen(prev => !prev)}
            style={{
              display: 'flex', alignItems: 'center', gap: isCollapsed ? 0 : '10px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              width: '100%', padding: '7px 10px', borderRadius: '8px', border: 'none',
              background: 'transparent', cursor: 'pointer', transition: 'background 0.15s',
            }}
            className="hover:bg-[var(--bg-hover)]"
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: 'var(--accent)',
              fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
            }}>
              {initials}
            </div>
            {!isCollapsed && (
              <>
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <p style={{
                    fontSize: '13px', fontWeight: 600, color: 'var(--text-1)',
                    fontFamily: 'DM Sans, sans-serif', lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user?.full_name || user?.name || 'Peternak'}
                  </p>
                  <p style={{
                    fontSize: '11px', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif',
                    lineHeight: 1.2, marginTop: '1px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user?.email || 'admin@farm.com'}
                  </p>
                </div>
                <MoreVertical size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}