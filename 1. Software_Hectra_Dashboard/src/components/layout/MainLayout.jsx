import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import GendhisWidget from '../gendhis/GendhisWidget';
import GendhistPullUpSheet from '../gendhis/GendhistPullUpSheet';
import MobileBottomNav from './MobileBottomNav';
import { useNotificationStore } from '@/store/notificationStore';
import { toast } from '@/store/toastStore';
import ScrollToTop from './ScrollToTop';

export default function MainLayout() {
  const location = useLocation();
  const isResearchLab = location.pathname.includes('/research-lab');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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

  const handleScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    // Only turn solid white when scrolled past most of the green card
    setIsScrolled(scrollTop > 180);
  };

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
        <Topbar onMenuClick={() => setSidebarOpen(true)} isScrolled={isScrolled} />

        {/* Scrollable Content */}
        <main
          id="main-scroll-container"
          onScroll={handleScroll}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            overflowX: 'hidden',
            paddingTop: (location.pathname === '/dashboard' || location.pathname === '/ternak' || location.pathname === '/sensor-data' || location.pathname === '/settings') ? '0px' : 'calc(56px + 16px)'
          }}
          className="px-4 pb-4 md:px-[22px] md:pb-5"
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <ScrollToTop />
            <Outlet />
          </div>

          {/* Mobile bottom spacer */}
          {!isResearchLab && <div className="md:hidden" style={{ height: '140px' }} />}
        </main>

        {/* Mobile Nav */}
        {!isResearchLab && <MobileBottomNav />}
      </div>

      {/* Gendhis Floating Widget (Mobile & Desktop) */}
      {!isResearchLab && (
        <GendhisWidget />
      )}
    </div>
  );
}
