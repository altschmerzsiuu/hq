// src/components/layout/Sidebar.jsx
// HERD Sidebar — Neo Bio-Tech Intelligence UI

import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
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
  HelpCircle,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    location.pathname.includes('/sensor-data')
  );
  
  // Mobile Profile Ref
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
      label: 'MANAJEMEN',
      items: [
        { name: t.nav_livestock, path: '/ternak', icon: Beef },
        { name: t.iot_title || 'Perangkat IoT', path: '/sensor-data', icon: Cpu },
      ]
    },
    {
      label: 'INTELLIGENCE',
      items: [
        { name: t.nav_estrus_intel, path: '/estrus-prediction', icon: Zap },
        { name: t.nav_activity_timeline, path: '/activity-timeline', icon: Clock },
        { name: t.nav_recommendations, path: '/recommendations', icon: Lightbulb },
      ]
    },
    {
      label: 'SISTEM',
      items: [
        { name: t.notif_page_title || 'Notifikasi', path: '/notifications', icon: Bell },
        { name: t.nav_settings || 'Pengaturan', path: '/settings', icon: Settings },
      ]
    }
  ];

  // Custom desktop structure (from Donezo style image)
  const desktopMenu = [
    { name: t.nav_dashboard || 'Dashboard', path: '/dashboard', icon: Home },
    { name: t.nav_livestock || 'Ternak', path: '/ternak', icon: Beef },
    { name: t.nav_activity_timeline || 'Aktivitas', path: '/activity-timeline', icon: Clock },
    { name: t.nav_estrus_intel || 'Prediksi', path: '/estrus-prediction', icon: Zap },
    { name: t.nav_recommendations || 'Rekomendasi', path: '/recommendations', icon: Lightbulb },
    { name: t.iot_title || 'Perangkat IoT', path: '/sensor-data', icon: Cpu },
  ];

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.slice(0, 2).toUpperCase() || 'OP');

  return (
    <>
      {/* =========================================================================
          MOBILE VIEW SECTION - PRESERVED 100% UNTOUCHED
          ========================================================================= */}
      <div className="lg:hidden">
        {/* Mobile Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          style={{
            background: 'var(--bg-surface)',
            borderRight: '0.5px solid var(--border)',
            width: '210px',
          }}
          className={cn(
            'fixed inset-y-0 left-0 z-[60] transform transition-all duration-300 ease-in-out flex flex-col',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Brand */}
          <div
            style={{
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              borderBottom: '0.5px solid var(--border)',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            {/* Logo */}
            <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <img
                src={herdLogo}
                alt="HERD Logo"
                style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
              />

              {/* Text logo */}
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
                fontSize: '18px', color: 'var(--accent)',
                letterSpacing: '-0.02em', whiteSpace: 'nowrap',
              }}>HERD</span>
            </Link>

            {/* Close button mobile */}
            <button
              onClick={() => setIsOpen(false)}
              className="ml-auto flex p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-3)]"
              aria-label="Tutup menu"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          <nav
            className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
            style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}
          >
            {navSections.map((section, si) => (
              <div key={si} style={{ marginBottom: '4px' }}>
                {/* Section Label */}
                {section.label && (
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

                {section.items.map((item) => {
                  const Icon = item.icon;

                  /* Dropdown */
                  if (item.isDropdown) {
                    return (
                      <div key={item.name}>
                        <button
                          onClick={item.toggle}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '7px 10px', borderRadius: '8px', border: 'none',
                            background: item.isOpen ? 'var(--accent-dim)' : 'transparent',
                            cursor: 'pointer', transition: 'background 0.15s',
                            color: item.isOpen ? 'var(--accent)' : 'var(--text-1)',
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
                                  color: isActive ? 'var(--accent)' : 'var(--text-1)',
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
                          display: 'flex', alignItems: 'center', gap: '9px',
                          justifyContent: 'flex-start',
                          padding: '7px 10px', borderRadius: '8px', textDecoration: 'none',
                          fontSize: '13px', fontWeight: reallyActive ? 500 : 400,
                          fontFamily: 'Inter, sans-serif',
                          background: reallyActive ? 'var(--accent-dim)' : 'transparent',
                          border: reallyActive ? '0.5px solid var(--accent-border)' : '0.5px solid transparent',
                          color: reallyActive ? 'var(--accent)' : 'var(--text-1)',
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
                            <span>{item.name}</span>
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
                left: '8px',
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
                display: 'flex', alignItems: 'center', gap: '10px',
                justifyContent: 'flex-start',
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
            </button>
          </div>
        </aside>
      </div>

      {/* =========================================================================
          DESKTOP VIEW SECTION - BRAND NEW BULKY DONEZO STYLE (HOVER TO EXPAND)
          ========================================================================= */}
      <div 
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
        className={cn(
        "hidden lg:flex flex-shrink-0 bg-white border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex-col relative transition-all duration-300 ml-4 my-4 rounded-[24px] overflow-hidden",
        isCollapsed ? "w-[88px]" : "w-[240px] xl:w-[260px]"
      )}>
        
        {/* Top Branding (Logo) */}
        <div className={cn(
          "flex items-center pt-8 pb-6 transition-all",
          isCollapsed ? "flex-col gap-5 px-4" : "justify-between px-6 xl:px-8"
        )}>
          <Link to="/dashboard" className={cn("flex items-center gap-3 w-full", isCollapsed ? "justify-center" : "")}>
            <img
              src={herdLogo}
              alt="HERD Logo"
              className={cn("object-cover rounded-xl shadow-sm transition-all duration-300", isCollapsed ? "w-11 h-11" : "w-9 h-9")}
            />
            {!isCollapsed && (
              <span className="font-['DM_Sans'] font-bold text-2xl text-[#0F172A] tracking-tight whitespace-nowrap transition-opacity duration-300">
                HERD
              </span>
            )}
          </Link>
        </div>

        {/* Scrollable Navigation */}
        <div className={cn("flex-1 overflow-y-auto pb-6 flex flex-col gap-6 no-scrollbar z-40", isCollapsed ? "px-4 mt-2" : "px-6")}>
          
          {/* MENU Section */}
          <div className="flex flex-col gap-1.5">
            {!isCollapsed && (
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-1 font-['Inter'] transition-opacity duration-300">
                MENU
              </span>
            )}
            {desktopMenu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) => cn(
                  "relative flex items-center rounded-xl transition-all duration-300 ease-in-out group font-['Inter']",
                  isActive
                    ? "text-[#0F172A] font-semibold bg-gray-50"
                    : "text-gray-500 font-medium hover:text-gray-800 hover:bg-gray-50",
                  isCollapsed ? "justify-center p-3" : "gap-3.5 px-4 py-3"
                )}
              >
                {({ isActive }) => (
                  <>
                    {/* The Green Pill Indicator */}
                    {isActive && (
                      <div className={cn(
                        "absolute bg-[#16A34A] transition-all duration-300",
                        isCollapsed ? "-left-4 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-r-full" : "-left-6 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-r-full"
                      )} />
                    )}
                    <item.icon
                      size={isCollapsed ? 24 : 20}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={cn(
                        "transition-colors duration-300 shrink-0",
                        isActive ? "text-[#16A34A]" : "text-gray-400 group-hover:text-gray-600"
                      )}
                    />
                    {!isCollapsed && (
                      <span className="text-[14px] leading-snug whitespace-normal break-words pr-2 transition-all duration-300">{item.name}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>



      </div>

    </>
  );
}