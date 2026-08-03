import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, AlertTriangle, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import translations from '@/lib/i18n';
import useSettingsStore from '@/store/settingsStore';
import { cn } from '@/lib/utils';

export default function StatsDrawer({ isOpen, onClose, type, data }) {
  useBodyScrollLock(isOpen);
  const navigate = useNavigate();
  const { lang } = useSettingsStore();
  const t = translations[lang];

  const title = type === 'pantau' 
    ? (lang === 'id' ? 'Ternak Dipantau' : 'Cows Monitored')
    : (lang === 'id' ? 'Perlu Tindakan' : 'Action Needed');

  const icon = type === 'pantau' ? <Activity size={20} className="text-[var(--accent)]" /> : <AlertTriangle size={20} className="text-[var(--red)]" />;

  const handleRowClick = (cowId) => {
    onClose();
    navigate('/ternak', { state: { selectedCowId: cowId } });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 99998
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: '100%', maxWidth: '400px',
              background: 'var(--bg-base)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
              zIndex: 99999,
              display: 'flex', flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: type === 'pantau' ? 'var(--accent-dim)' : 'var(--red-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {icon}
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>{title}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0 }}>
                    {data.length} {lang === 'id' ? 'ekor sapi' : 'cows'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-2)', cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleRowClick(item.cow_id || item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: '12px', cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  className="hover:border-[var(--accent)] hover:shadow-sm"
                >
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 4px 0' }}>
                      {item.nama || item.cow_name || (item.cow_id ? `Cow #${item.cow_id.slice(0,6)}` : 'Unknown Cow')}
                    </h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      type === 'pantau' ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "bg-[var(--red-dim)] text-[var(--red)]"
                    )}>
                      {type === 'pantau' ? 'Aktif' : (item.urgency === 'critical' ? 'Kritis' : 'Perhatian')}
                    </span>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />
                </div>
              ))}
              {data.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: '13px' }}>
                  {lang === 'id' ? 'Tidak ada data untuk ditampilkan.' : 'No data to display.'}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
