import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import GendhisWidget from '../gendhis/GendhisWidget';
import GendhistPullUpSheet from '../gendhis/GendhistPullUpSheet';
import MobileBottomNav from './MobileBottomNav';
import ToastContainer from './ToastContainer';
import { useNotificationStore } from '@/store/notificationStore';
import { toast } from '@/store/toastStore';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const addNotification = useNotificationStore(state => state.addNotification);
  useEffect(() => {
    let wsUrl = '';
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl && !import.meta.env.DEV) {
      wsUrl = apiUrl.replace(/^http/, 'ws') + '/api/ws';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/api/ws`;
    }

    let ws = new WebSocket(wsUrl);
    let reconnectTimeout = null;

    const connect = () => {
      ws.onopen = () => {
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'ESTRUS_ALERT') {
            addNotification({
              title: 'Indikasi Estrus',
              desc: data.message,
              type: 'critical'
            });
            toast.error(data.message);
          } else if (data.type === 'ANOMALY_ALERT') {
            addNotification({
              title: 'Anomali Suhu/Kesehatan',
              desc: data.message,
              type: 'warning'
            });
            toast.warning(data.message);
          }
        } catch (err) {
          console.error('Failed to process WS message:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(() => {
          ws = new WebSocket(wsUrl);
          connect();
        }, 5000);
      };

      ws.onerror = (err) => {
        console.error('WS Error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws.onclose = null;
      ws.close();
    };
  }, [addNotification]);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: 'var(--bg-base)',
      overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      {/* Main Column */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Topbar — hamburger is now inside Topbar */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Scrollable Content */}
        <main
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
          className="px-4 py-4 md:px-[22px] md:py-5"
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Outlet />
          </div>

          {/* Mobile bottom spacer */}
          <div className="md:hidden" style={{ height: '140px' }} />
        </main>

        {/* Mobile Gendhis + Nav */}
        <GendhistPullUpSheet />
        <MobileBottomNav />
      </div>

      {/* Desktop Gendhis Floating Widget */}
      <div className="hidden md:block">
        <GendhisWidget />
      </div>

      {/* Dynamic Toast System */}
      <ToastContainer />
    </div>
  );
}
