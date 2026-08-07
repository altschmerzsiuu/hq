import { useNotificationStore } from '@/store/notificationStore';
import { X, CheckCheck, Bell, AlertTriangle, Info, BatteryWarning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ICON_MAP = {
  critical: AlertTriangle,
  warning:  BatteryWarning,
  info:     Info,
};
const COLOR_MAP = {
  critical: { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444' },
  warning:  { bg: 'rgba(247,119,27,0.1)', color: '#f7771b' },
  info:     { bg: 'rgba(77,166,255,0.1)', color: '#4da6ff' },
};

export default function NotifModalMobile({ isOpen, onClose }) {
  const { notifications: notifs, unreadCount: unread, markAllAsRead, markAsRead } = useNotificationStore();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          />

          {/* Draggable Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) {
                // Drag down to close
                onClose();
              }
            }}
            style={{
              position: 'relative', width: '100%',
              background: 'var(--bg-surface)',
              borderRadius: '28px 28px 0 0',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
              display: 'flex', flexDirection: 'column',
              // HACK: Extra padding bottom + negative margin bottom so pulling UP doesn't reveal the bottom edge
              paddingBottom: '50vh',
              marginBottom: '-50vh',
            }}
          >
            {/* Inner wrapper to contain actual height */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: '82vh' }}>
              
              {/* Drag Handle & Header */}
              <div style={{ touchAction: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '6px' }}>
                  <div style={{ width: '44px', height: '5px', background: 'var(--border-2)', borderRadius: '99px' }} />
                </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontWeight: 800, color: 'var(--text-1)', fontSize: '18px', margin: 0 }}>Notifikasi</h3>
            {unread > 0 && (
              <span style={{ padding: '2px 8px', borderRadius: '99px', background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 900 }}>{unread}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {unread > 0 && (
              <button onClick={markAllAsRead} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: '#2f7d31', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <CheckCheck size={14} /> Tandai semua
              </button>
            )}
            <button onClick={onClose} style={{ padding: '6px', borderRadius: '50%', background: 'var(--bg-hover)', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>
        </div>

        {/* Notification Cards */}
        <div style={{ overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {notifs.length === 0 ? (
            <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-3)' }}>
              <Bell size={32} style={{ opacity: 0.5 }} />
              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Tidak ada notifikasi</p>
            </div>
          ) : notifs.slice(0, 10).map(n => {
            const Icon = ICON_MAP[n.type] || Info;
            const colors = COLOR_MAP[n.type] || COLOR_MAP.info;
            return (
              <div
                key={n.id}
                onClick={() => { markAsRead(n.id); if (n.cow_id) { onClose(); navigate('/ternak', { state: { selectedCowId: n.cow_id } }); } }}
                style={{
                  display: 'flex', gap: '12px', padding: '12px 14px',
                  borderRadius: '16px',
                  background: n.read ? 'var(--bg-card)' : 'color-mix(in srgb, #2f7d31 7%, var(--bg-card))',
                  border: n.read ? '1px solid var(--border)' : '1px solid rgba(47,125,49,0.35)',
                  cursor: 'pointer', transition: 'opacity 0.15s',
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={colors.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    {n.cow_name && (
                      <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-hover)', color: 'var(--text-2)', padding: '2px 6px', borderRadius: '6px', flexShrink: 0 }}>{n.cow_name}</span>
                    )}
                    <p style={{ fontSize: '13px', fontWeight: n.read ? 600 : 800, color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.desc}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 700, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{n.timestamp || 'Baru saja'}</p>
                </div>
                {!n.read && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2f7d31', flexShrink: 0, marginTop: '4px' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer — safe-area-aware */}
        <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
