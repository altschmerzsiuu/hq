import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import GendhisWidget from '../gendhis/GendhisWidget';
import GendhistPullUpSheet from '../gendhis/GendhistPullUpSheet';
import MobileBottomNav from './MobileBottomNav';
import { useNotificationStore } from '@/store/notificationStore';
import { useTernakStore } from '@/store/useTernakStore';
import { toast } from '@/store/toastStore';
import ScrollToTop from './ScrollToTop';
import { cn } from '@/lib/utils';

export default function MainLayout() {
  const location = useLocation();
  const isResearchLab = location.pathname.includes('/research-lab');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Hover-to-expand defaults to true
  const [isScrolled, setIsScrolled] = useState(false);
  const addNotification = useNotificationStore(state => state.addNotification);
  const updateSapiSensor = useTernakStore(state => state.updateSapiSensor);
  
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
          } else if (data.type === 'SENSOR_UPDATE') {
            updateSapiSensor(data.collar_id, {
              suhu: data.temperature,
              rms_z: data.rms_z,
              estrus_probability: data.ml_estrus_prob
            });
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

  // Dynamic Theme Color for Android Status Bar
  useEffect(() => {
    let themeColor = '#F8F9FA';
    if (location.pathname === '/dashboard') {
      themeColor = '#2f7d31';
    } else if (location.pathname === '/sensor-data') {
      themeColor = '#115e59';
    } else if (location.pathname === '/ternak') {
      themeColor = '#FF7B1C';
    } else if (location.pathname.startsWith('/ternak/')) {
      themeColor = '#F3F4F6';
    }

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = themeColor;
  }, [location.pathname]);

  const handleScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    // Only turn solid white when scrolled past most of the green card
    setIsScrolled(scrollTop > 180);
  };

  return (
    <div style={{
      display: 'flex',
      height: '100%',
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
        {/* Topbar */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} isScrolled={isScrolled} />

        {/* Scrollable Content */}
        <main
          id="main-scroll-container"
          onScroll={handleScroll}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            overflowX: 'hidden',
            maxWidth: '100%',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            overscrollBehavior: 'contain', // prevent iOS rubber-band from bleeding
          }}
          className={cn(
            "pb-4 md:px-4",
            (location.pathname === '/dashboard' || location.pathname === '/sensor-data') 
              ? "pt-0 px-0" 
              : ((location.pathname === '/ternak') ? "pt-0 px-4" : "pt-4 px-4")
          )}
        >
          <div 
            className={location.pathname.startsWith('/ternak/') && location.pathname !== '/ternak' 
              ? "w-full" 
              : "md:bg-white md:border md:border-[#E5E7EB] md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:rounded-[24px] md:p-5 lg:p-6 lg:min-h-[calc(100dvh-100px)]"} 
            style={{ 
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              margin: '0 auto'
            }}
          >
            <ScrollToTop />
            <Outlet />
          </div>

          {/* Mobile bottom spacer — matches navbar height 64px + safe-area */}
          {!isResearchLab && <div className="md:hidden flex-shrink-0" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} />}
        </main>

        {/* Mobile Nav */}
        {!isResearchLab && (
          <div className="md:hidden">
            <MobileBottomNav />
          </div>
        )}
      </div>

      {/* Gendhis Floating Widget (Mobile & Desktop) */}
      {!isResearchLab && (
        <GendhisWidget />
      )}
    </div>
  );
}
