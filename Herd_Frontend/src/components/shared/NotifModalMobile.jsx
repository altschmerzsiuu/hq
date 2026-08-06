import { useNotificationStore } from '@/store/notificationStore';
import { X, CheckCheck, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotifModalMobile({ isOpen, onClose }) {
  const { notifications: notifs, unreadCount: unread, markAllAsRead, markAsRead } = useNotificationStore();
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full sm:w-[400px] max-h-[80vh] bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
        
        {/* Drag Handle (Mobile) */}
        <div className="sm:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-1" />
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-[17px]">Notifikasi</h3>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 text-[12px] font-bold text-[#2f7d31] hover:text-[#2f7d31]/80 transition-colors bg-transparent border-none cursor-pointer"
              >
                <CheckCheck size={14} /> Tandai semua
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer border-none"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto p-2 flex flex-col gap-1 flex-1">
          {notifs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400">
              <Bell size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-medium">Tidak ada notifikasi</p>
            </div>
          ) : (
            notifs.slice(0, 10).map(n => (
              <div
                key={n.id}
                className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-colors relative ${n.read ? 'bg-transparent hover:bg-gray-50' : 'bg-[#2f7d31]/5 hover:bg-[#2f7d31]/10'}`}
                onClick={() => {
                  markAsRead(n.id);
                  if (n.cow_id) {
                    onClose();
                    navigate('/ternak', { state: { selectedCowId: n.cow_id } });
                  }
                }}
              >
                {!n.read && (
                  <div className="absolute left-2 top-5 w-2 h-2 rounded-full bg-[#2f7d31] shadow-sm animate-pulse" />
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
                  <p className="text-[12px] text-gray-500 font-medium leading-snug line-clamp-2">
                    {n.desc}
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1.5 uppercase tracking-wider">
                    {n.timestamp || 'Baru saja'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer Link */}
        {notifs.length > 0 && (
          <div className="p-3 border-t border-gray-100 flex justify-center">
            <button 
              onClick={() => {
                onClose();
                navigate('/notifications');
              }}
              className="text-[#2f7d31] text-[13px] font-bold bg-transparent border-none cursor-pointer hover:underline"
            >
              Lihat Semua Notifikasi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
