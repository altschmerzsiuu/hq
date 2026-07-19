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
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/notificationStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import { toast } from '@/store/toastStore';

const ICON_MAP = {
  critical: AlertTriangle,
  warning: BatteryWarning,
  info: Info
};

export default function Notifications() {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllAsRead, markAsRead, fetchNotifications } = useNotificationStore();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications, lang]);

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'important') return n.type === 'critical' || n.type === 'warning';
    return true;
  });

  const handleMarkAllAsRead = () => {
    markAllAsRead();
    toast.success(t.notif_toast_read_all);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto pb-20">
      
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-gray-900 font-display">
          {t.notif_page_title}
        </h1>
        <button 
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100/80 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-bold transition-colors disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" /> {t.notif_mark_all_read}
        </button>
      </div>
      
      <div className="flex flex-col gap-6">
        
        {/* TABS (Underline) */}
        <div className="flex border-b border-gray-200/60 w-full mb-2">
          <TabButton active={filter === 'all'} onClick={() => setFilter('all')}>{t.notif_tab_all}</TabButton>
          <TabButton active={filter === 'unread'} onClick={() => setFilter('unread')}>{t.notif_tab_unread}</TabButton>
          <TabButton active={filter === 'important'} onClick={() => setFilter('important')}>Penting</TabButton>
        </div>

        {/* LIST */}
        <div className="flex flex-col gap-4 bg-transparent">
          {filteredNotifs.length === 0 ? (
            <div className="py-12 text-center rounded-3xl">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-200" />
              <p className="text-gray-400 font-medium">{t.notif_empty}</p>
            </div>
          ) : (
            filteredNotifs.map((n) => {
              const isCrit = n.type === 'critical';
              const isWarn = n.type === 'warning';
              
              return (
                <div 
                  key={n.id} 
                  onClick={() => {
                    if (!n.read) markAsRead(n.id);
                    if (n.cow_id) navigate('/ternak', { state: { selectedCowId: n.cow_id, from: '/notifications' } });
                  }}
                  className="flex flex-col p-4 bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100/80 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon Bubble */}
                    <div className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center shrink-0",
                      !n.read ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-400"
                    )}>
                      <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[15px] font-bold text-gray-900 truncate">
                          {n.cow_name ? `${n.cow_name} | CE${n.cow_id?.slice(-4) || '532A'}` : n.title}
                        </h4>
                        
                        {/* Status Badge */}
                        <span className={cn(
                          "text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 uppercase tracking-widest",
                          isCrit ? "bg-red-50 text-red-600" :
                          isWarn ? "bg-amber-50 text-amber-600" :
                          "bg-blue-50 text-blue-600"
                        )}>
                          {isCrit ? 'TINGGI' : isWarn ? 'SEDANG' : 'NORMAL'}
                        </span>
                      </div>
                      
                      <p className="text-[13px] text-gray-700 leading-[1.4] pr-2">
                        {n.title} • {n.desc}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 ml-14">
                    <span className="text-[12px] font-semibold text-[#2f7d31] flex items-center gap-1.5">
                      Ketuk untuk detail <span className="text-[9px] mt-[1px]">❯</span>
                    </span>
                  </div>
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
        "flex-1 pb-3 text-[14px] font-bold transition-all duration-200 relative",
        active ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
      )}
    >
      {children}
      {active && (
        <span className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-gray-800 rounded-t-full" />
      )}
    </button>
  );
}
