import { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  AlertTriangle, 
  Info, 
  Thermometer, 
  BatteryWarning,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/notificationStore';

const ICON_MAP = {
  critical: AlertTriangle,
  warning: BatteryWarning,
  info: Info
};

export default function Notifications() {
  const { notifications, unreadCount, markAllAsRead, markAsRead, fetchNotifications } = useNotificationStore();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'critical') return n.type === 'critical';
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)] flex items-center gap-3">
            Pusat Notifikasi
            {unreadCount > 0 && (
              <span className="bg-[var(--color-danger)] text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Kelola pemberitahuan sistem dan peringatan sensor.</p>
        </div>
        
        <button 
          onClick={markAllAsRead}
          disabled={unreadCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-2)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 shadow-sm"
        >
          <Check className="w-4 h-4" /> Tandai Semua Dibaca
        </button>
      
      <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        
        {/* TABS */}
        <div className="flex items-center border-b border-[var(--color-sage-light)]/30 overflow-x-auto">
          <TabButton active={filter === 'all'} onClick={() => setFilter('all')}>Semua</TabButton>
          <TabButton active={filter === 'unread'} onClick={() => setFilter('unread')}>Belum Dibaca</TabButton>
          <TabButton active={filter === 'critical'} onClick={() => setFilter('critical')}>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-[var(--color-danger)]" /> Kritis</span>
          </TabButton>
        </div>

        {/* LIST */}
        <div className="divide-y divide-[var(--color-sage-light)]/20">
          {filteredNotifs.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-muted)]">
              <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>Tidak ada notifikasi di kategori ini.</p>
            </div>
          ) : (
            filteredNotifs.map((n) => {
              const Icon = n.icon || ICON_MAP[n.type] || Info;
              return (
                <div 
                  key={n.id} 
                  onClick={() => !n.read && markAsRead(n.id)}
                  className={cn(
                    "flex gap-4 p-5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer",
                    !n.read ? "bg-[var(--color-sage-light)]/5" : ""
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border shadow-sm",
                    n.type === 'critical' ? 'bg-[var(--red-dim)] border-[var(--red)] text-[var(--red)]' :
                    n.type === 'warning'  ? 'bg-[var(--amber-dim)] border-[var(--amber)] text-[var(--amber)]' :
                    'bg-[var(--blue-dim)] border-[var(--blue)] text-[var(--blue)]'
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={cn("text-sm font-semibold mb-0.5", !n.read ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]")}>
                      {n.title}
                    </h4>
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                      {n.desc}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      {n.time}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="shrink-0 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-[var(--color-forest)] block"></span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
        active 
          ? "border-[var(--color-forest)] text-[var(--color-forest)]" 
          : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-cream)]/30"
      )}
    >
      {children}
    </button>
  );
}
