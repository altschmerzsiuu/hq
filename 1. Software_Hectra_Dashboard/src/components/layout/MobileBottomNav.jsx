// src/components/layout/MobileBottomNav.jsx
// HERD Mobile Bottom Nav — Floating Style Update

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PawPrint, Scan, LineChart, User } from 'lucide-react';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import ScanModal from '@/components/scan/ScanModal';

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const [showRfidModal, setShowRfidModal] = useState(false);

  if (location.pathname === '/login') return null;

  const items = [
    { icon: Home, label: 'Beranda', path: '/dashboard' },
    { icon: PawPrint, label: 'Ternak', path: '/ternak' },
    { isScan: true },
    { icon: LineChart, label: 'Insight', path: '/sensor-data' }, // Or '/insight' if it exists, mapping to sensor-data for now
    { icon: User, label: 'Profil', path: '/settings' }, // Or '/profile'
  ];

  return (
    <>
      {/* Floating Bottom Nav Bar */}
      <nav style={{
        position: 'fixed', bottom: '16px', left: '16px', right: '16px',
        background: 'color-mix(in srgb, var(--bg-surface) 80%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '24px',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }} className="md:hidden">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px', padding: '0 16px' }}>
          {items.map((item, i) => {
            if (item.isScan) {
              return (
                <div key="scan" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '-36px', zIndex: 50 }}>
                  {/* Outer ring */}
                  <div style={{
                    background: 'var(--bg-surface)',
                    borderRadius: '50%',
                    padding: '6px',
                    boxShadow: '0 -4px 10px rgba(0,0,0,0.05)',
                  }}>
                    <button
                      onClick={() => setShowRfidModal(true)}
                      style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: 'var(--color-primary)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(13,99,27,0.3)',
                        transition: 'transform 0.15s',
                      }}
                    >
                      <Scan size={24} style={{ color: '#fff' }} />
                    </button>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)',
                    fontFamily: 'Inter, sans-serif',
                  }}>Scan</span>
                </div>
              );
            }

            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path || i}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isActive ? 'var(--color-primary)' : 'var(--text-3)',
                  padding: '8px 4px',
                  transition: 'color 0.15s',
                  minWidth: '56px',
                }}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span style={{
                  fontSize: '11px', fontWeight: isActive ? 700 : 500,
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Real Scan Modal Integration */}
      <ScanModal 
        isOpen={showRfidModal} 
        onClose={() => setShowRfidModal(false)} 
        onResult={(data) => {
          if (data?.needsRegistration && data?.uid) {
            navigate('/ternak', { state: { registerUid: data.uid } });
          } else if (data?.hewan?.id || data?.hewan?.cow_id) {
            navigate('/ternak', { state: { selectedCowId: data.hewan.id || data.hewan.cow_id } });
          }
        }}
      />
    </>
  );
}
