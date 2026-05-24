// src/components/layout/MobileBottomNav.jsx
// Hectra Mobile Bottom Nav — MP-3 §13.5

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Wifi, Beef, Bell, Scan, X, Camera, Keyboard } from 'lucide-react';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import ScanModal from '@/components/scan/ScanModal';

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const [scanOpen, setScanOpen] = useState(false);
  const [showRfidModal, setShowRfidModal] = useState(false);

  if (location.pathname === '/login') return null;

  const items = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Wifi,  label: t.nav_live_signals || 'Sensor',  path: '/sensor-data' },
    { isScan: true },
    { icon: Beef, label: 'Ternak',    path: '/ternak' },
    { icon: Bell, label: t.nav_alerts || 'Notif', path: '/notifications' },
  ];

  return (
    <>
      {/* Bottom Nav Bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-surface)',
        borderTop: '0.5px solid var(--border)',
        zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }} className="md:hidden">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: '64px' }}>
          {items.map((item, i) => {
            if (item.isScan) {
              return (
                <div key="scan" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '-22px' }}>
                  {/* Outer ring */}
                  <div style={{
                    background: 'var(--bg-base)',
                    borderRadius: '50%',
                    padding: '5px',
                    border: '0.5px solid var(--border)',
                  }}>
                    <button
                      onClick={() => setShowRfidModal(true)}
                      style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: 'var(--accent)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0,212,126,0.3)',
                        transition: 'transform 0.15s',
                      }}
                    >
                      <Scan size={24} style={{ color: 'var(--bg-base)' }} />
                    </button>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, color: 'var(--accent)',
                    fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em',
                  }}>SCAN</span>
                </div>
              );
            }

            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isActive ? 'var(--accent)' : 'var(--text-3)',
                  padding: '8px 12px',
                  transition: 'color 0.15s',
                }}
              >
                <Icon size={22} />
                <span style={{
                  fontSize: '10px', fontWeight: isActive ? 600 : 400,
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
