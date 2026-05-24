import { create } from 'zustand';
import axiosInstance from '../lib/axios';
import useSettingsStore from './settingsStore';

// Helper to format relative time
function formatRelativeTime(isoString, lang) {
  if (!isoString) return lang === 'id' ? 'Baru saja' : 'Just now';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return lang === 'id' ? 'Baru saja' : 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return lang === 'id' ? `${minutes} mnt lalu` : `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return lang === 'id' ? `${hours} jam lalu` : `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return lang === 'id' ? `${days} hari lalu` : `${days} days ago`;
  } catch (e) {
    return lang === 'id' ? 'Baru saja' : 'Just now';
  }
}

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      // Fetch notifications log from backend
      const res = await axiosInstance.get('/notifications?limit=50');
      const logs = res.data.logs || [];
      
      const lang = useSettingsStore.getState().lang || 'id';

      // Load read IDs from localStorage
      const readIdsRaw = localStorage.getItem('read_notification_ids');
      const readIds = readIdsRaw ? JSON.parse(readIdsRaw) : [];

      const mapped = logs.map(n => {
        // Determine type/severity
        let type = 'info';
        if (n.severity?.toLowerCase() === 'critical' || n.type?.toLowerCase() === 'critical' || n.type?.toLowerCase() === 'estrus') {
          type = 'critical';
        } else if (n.severity?.toLowerCase() === 'warning' || n.type?.toLowerCase() === 'warning') {
          type = 'warning';
        }

        // Determine title
        const prefix = n.cow_name ? `${n.cow_name} — ` : '';
        let title = 'Notifikasi';
        switch (n.type?.toLowerCase()) {
          case 'estrus':
            title = prefix + (lang === 'id' ? 'Indikasi Estrus' : 'Estrus Detected');
            type = 'critical';
            break;
          case 'insemination':
            title = prefix + (lang === 'id' ? 'Inseminasi Buatan (IB)' : 'Artificial Insemination');
            break;
          case 'pregnancy':
            title = prefix + (lang === 'id' ? 'Status Reproduksi' : 'Reproduction Status');
            break;
          case 'anomaly':
          case 'anomal':
            title = prefix + (lang === 'id' ? 'Anomali Sensor' : 'Sensor Anomaly');
            type = 'warning';
            break;
          case 'battery':
            title = prefix + (lang === 'id' ? 'Baterai Lemah' : 'Battery Low');
            type = 'warning';
            break;
          default:
            title = prefix + (n.type ? n.type.charAt(0).toUpperCase() + n.type.slice(1) : (lang === 'id' ? 'Sistem' : 'System'));
        }

        return {
          id: n.id,
          type,
          read: readIds.includes(n.id),
          title,
          desc: n.message,
          timestamp: n.timestamp,
          time: formatRelativeTime(n.timestamp, lang),
        };
      });

      set({
        notifications: mapped,
        unreadCount: mapped.filter(n => !n.read).length,
        loading: false
      });
    } catch (err) {
      console.error('[NotificationStore] error fetching:', err);
      set({ loading: false });
    }
  },

  markAsRead: (id) => {
    // Save to localStorage
    const readIdsRaw = localStorage.getItem('read_notification_ids');
    const readIds = readIdsRaw ? JSON.parse(readIdsRaw) : [];
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem('read_notification_ids', JSON.stringify(readIds));
    }

    // Update local state
    set((state) => {
      const updated = state.notifications.map(n => n.id === id ? { ...n, read: true } : n);
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.read).length
      };
    });
  },

  markAllAsRead: () => {
    const { notifications } = get();
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('read_notification_ids', JSON.stringify(allIds));

    set((state) => {
      const updated = state.notifications.map(n => ({ ...n, read: true }));
      return {
        notifications: updated,
        unreadCount: 0
      };
    });
  },

  addNotification: (notif) => {
    // For live events received over WebSocket
    const lang = useSettingsStore.getState().lang || 'id';
    const newNotif = {
      id: `N-${Date.now()}`,
      read: false,
      time: lang === 'id' ? 'Baru saja' : 'Just now',
      title: notif.title || (lang === 'id' ? 'Notifikasi Baru' : 'New Notification'),
      desc: notif.desc || notif.message,
      type: notif.type || 'info',
    };
    set((state) => {
      const newNotifs = [newNotif, ...state.notifications];
      return {
        notifications: newNotifs,
        unreadCount: newNotifs.filter(n => !n.read).length
      };
    });
  },
}));
