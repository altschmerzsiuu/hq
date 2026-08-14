import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Filter, 
  Activity, 
  Thermometer, 
  Battery, 
  Wifi,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Download,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ShieldAlert,
  HeartPulse,
  Settings2,
  X,
  TriangleAlert,
  ClipboardList
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';
import axiosInstance from '@/lib/axios';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { toast } from '@/store/toastStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

function formatLastSync(lastSyncStr, t) {
  if (!lastSyncStr) return t.sensor_sync_never;
  const lastSync = new Date(lastSyncStr);
  const diffMs = new Date() - lastSync;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  
  if (diffMin < 1) return t.sensor_sync_just_now;
  if (diffMin < 60) return `${diffMin} ${t.sensor_sync_min_ago}`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ${t.sensor_sync_hr_ago}`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ${t.sensor_sync_days_ago}`;
}

function getSignalStrength(lastSyncStr, t) {
  if (!lastSyncStr) return t.sensor_signal_weak;
  const lastSync = new Date(lastSyncStr);
  const diffMs = new Date() - lastSync;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  
  if (diffMin < 5) return t.sensor_signal_strong;
  if (diffMin < 30) return t.sensor_signal_medium;
  return t.sensor_signal_weak;
}

function formatActivity(state, t) {
  if (!state) return t.sensor_act_normal;
  const map = {
    RESTING: t.sensor_act_resting,
    EATING: t.sensor_act_eating,
    RUMINATING: t.sensor_act_ruminating,
    ESTRUS: t.sensor_act_estrus,
    SICK: t.sensor_act_sick,
    UNKNOWN: t.sensor_act_normal
  };
  return map[state.toUpperCase()] || state;
}

export default function SensorData() {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [allCowsData, setAllCowsData] = useState([]);
  const [downloadModalData, setDownloadModalData] = useState(null);
  const [deviceModalData, setDeviceModalData] = useState(null);
  const [disconnectModalData, setDisconnectModalData] = useState(null);
  
  const [liveSignal, setLiveSignal] = useState('Bagus');
  const [liveBattery, setLiveBattery] = useState(0);

  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(today.getMonth() - 1);
  const defaultEndDate = today.toISOString().split('T')[0];
  const defaultStartDate = lastMonth.toISOString().split('T')[0];

  useEffect(() => {
    if (deviceModalData) {
      setLiveBattery(deviceModalData.battery);
      setLiveSignal(deviceModalData.signal || 'Bagus');
    }
  }, [deviceModalData]);

  const [timeFilter, setTimeFilter] = useState('1wk');
  const [showMoreReports, setShowMoreReports] = useState(false);
  const [populationStats, setPopulationStats] = useState({ total: 0, pregnant: 0 });
  const [healthStats, setHealthStats] = useState({ sangatSehat: 0, observasi: 0, perluPenanganan: 0 });
  const [collarStats, setCollarStats] = useState([]);
  const [popHistory, setPopHistory] = useState([]);
  const [pregHistory, setPregHistory] = useState([]);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  useBodyScrollLock(showWidgetModal);
  
  const [selectedWidgets, setSelectedWidgets] = useState(() => {
    const saved = localStorage.getItem('herd_sensor_widgets');
    return saved ? JSON.parse(saved) : ['collar_aktif', 'rata_suhu', 'sapi_bunting'];
  });

  useEffect(() => {
    localStorage.setItem('herd_sensor_widgets', JSON.stringify(selectedWidgets));
  }, [selectedWidgets]);

  const fetchAllData = async (showMainLoader = false) => {
    if (showMainLoader) setLoading(true);
    setSyncing(true);
    try {
      const [cattleRes, telemetryRes] = await Promise.all([
        axiosInstance.get('/hewan'),
        axiosInstance.get('/sensor-data?limit=100')
      ]);
      const allCows = cattleRes.data || [];
      setAllCowsData(allCows);

      // Process Stats
      const totalPop = allCows.length;
      const pregnantCount = allCows.filter(c => c.status_kebuntingan === 'Bunting' || c.is_pregnant || c.status?.toLowerCase().includes('bunting')).length;
      setPopulationStats({ total: totalPop, pregnant: pregnantCount });

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
      const current = new Date();
      const pHistory = [];
      const prHistory = [];
      for (let i = 5; i >= 0; i--) {
        let m = current.getMonth() - i;
        let y = current.getFullYear();
        if (m < 0) {
          m += 12;
          y -= 1;
        }
        
        let popAtThisMonth = 0;
        let pregAtThisMonth = 0;
        
        allCows.forEach(c => {
          // Parse date properly (handle DD/MM/YYYY and YYYY-MM-DD)
          let d = null;
          if (c.bulan_tahun_lahir) {
            const btl = c.bulan_tahun_lahir;
            if (btl.includes('/')) {
              const parts = btl.split('/');
              if (parts.length >= 2) {
                let yStr = parts.length > 2 ? parts[2] : new Date().getFullYear().toString();
                if (yStr.length === 2) yStr = "20" + yStr;
                d = new Date(parseInt(yStr), parseInt(parts[1]) - 1, parseInt(parts[0]) || 1);
              }
            } else if (btl.includes('-')) {
              const parts = btl.split('-');
              if (parts[0].length === 4) { // YYYY-MM-DD
                d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) || 1);
              } else if (parts.length > 2 && parts[2].length === 4) { // DD-MM-YYYY
                d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]) || 1);
              }
            }
          }
          // Fallback to first_activity_date if birth date parsing fails
          if ((!d || isNaN(d.getTime())) && c.first_activity_date) {
            d = new Date(c.first_activity_date);
          }
          // Fallback to created_at
          if ((!d || isNaN(d.getTime())) && c.created_at) {
            d = new Date(c.created_at);
          }
          // Absolute fallback
          if (!d || isNaN(d.getTime())) {
            d = new Date();
          }

          if (d.getFullYear() < y || (d.getFullYear() === y && d.getMonth() <= m)) {
            popAtThisMonth++;
            if (c.status_kebuntingan === 'Bunting' || c.is_pregnant || c.status?.toLowerCase().includes('bunting')) {
              pregAtThisMonth++;
            }
          }
        });
        pHistory.push({ name: monthNames[m], val: popAtThisMonth });
        prHistory.push({ name: monthNames[m], val: pregAtThisMonth });
      }
      setPopHistory(pHistory);
      setPregHistory(prHistory);

      let sehat = 0, observasi = 0, penanganan = 0;
      let collarNormal = 0, collarLow = 0, collarLost = 0;

      allCows.forEach(cow => {
        // Health
        if (cow.status === 'Sakit' || cow.status === 'Butuh Perawatan') {
          penanganan++;
        } else if (cow.temp && cow.temp > 39.0) {
          observasi++;
        } else {
          sehat++;
        }
        
        // Collar
        if (cow.collar_id) {
          const lastSyncDate = new Date(cow.last_sync || 0);
          const hrsSinceSync = (new Date() - lastSyncDate) / (1000 * 60 * 60);
          
          if (hrsSinceSync > 24 || !cow.last_sync) {
            collarLost++;
          } else if (cow.battery !== null && cow.battery <= 20) {
            collarLow++;
          } else {
            collarNormal++;
          }
        }
      });

      const totalHealth = sehat + observasi + penanganan || 1;
      setHealthStats({
        sangatSehat: Math.round((sehat / totalHealth) * 100),
        observasi: Math.round((observasi / totalHealth) * 100),
        perluPenanganan: Math.round((penanganan / totalHealth) * 100)
      });
      
      setCollarStats([
        { name: lang === 'id' ? 'Normal' : 'Normal', value: collarNormal, color: '#2f7d31' },
        { name: lang === 'id' ? 'Baterai Lemah' : 'Low Battery', value: collarLow, color: '#F59E0B' },
        { name: lang === 'id' ? 'Sinyal Hilang' : 'Signal Lost', value: collarLost, color: '#EF4444' }
      ]);

      // Process table data: only show cows that have a collar_id
      let liveCows = allCows
        .filter(cow => cow.collar_id !== null && cow.collar_id !== undefined && cow.collar_id !== '')
        .map(cow => {
          let status = 'good';
          if (cow.battery !== null && cow.battery <= 20) {
            status = 'critical';
          } else if (cow.temp !== null && cow.temp >= 39.0) {
            status = 'warning';
          }

          return {
            id: cow.collar_id,
            cow_id: cow.id,
            rfid: cow.rfid || cow.cow_id,
            cowName: cow.nama || 'Sapi',
            temp: cow.temp,
            activityState: cow.activity_state,
            battery: cow.battery,
            lastSyncRaw: cow.last_sync,
            status: status
          };
        });

      setTableData(liveCows);

      // Process telemetry data for chart (chronological order)
      const telemetryPayload = Array.isArray(telemetryRes?.data) ? telemetryRes.data : (telemetryRes?.data?.data || []);
      const sortedTelemetry = [...telemetryPayload].reverse();
      const formattedChart = sortedTelemetry.map(d => {
        const timeStr = d.batch_ts ? new Date(d.batch_ts).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
        return {
          time: timeStr,
          rawTime: d.batch_ts ? new Date(d.batch_ts) : null,
          temp: d.temperature !== null ? parseFloat(d.temperature.toFixed(1)) : null,
          activity: d.max_z !== null ? Math.round(d.max_z * 30) : 0
        };
      });

      setChartData(formattedChart);

      if (!showMainLoader) {
        toast.success(t.sensor_sync_success);
      }
    } catch (err) {
      console.error('Gagal memuat data sensor:', err);
      toast.error(t.sensor_sync_failed);


    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAllData(true);
  }, []);

  const filteredTableData = tableData.filter(row => {
    const matchSearch = !search || 
      (row.cowName || '').toLowerCase().includes(search.toLowerCase()) || 
      (row.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (row.rfid || '').toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const avgTemp = tableData.length ? (tableData.reduce((acc, curr) => acc + (curr.temp || 0), 0) / tableData.length).toFixed(1) : '--';
  const avgBattery = tableData.length ? Math.round(tableData.reduce((acc, curr) => acc + (curr.battery || 0), 0) / tableData.length) : '--';
  const activeCollars = tableData.filter(d => d.lastSyncRaw).length;
  const pregnantCount = populationStats.pregnant;
  const sickCount = tableData.filter(d => d.status === 'critical' || d.status === 'warning').length;
  
  const widgetOptions = {
    collar_aktif: { id: 'collar_aktif', label: 'Collar Aktif', icon: Activity, value: activeCollars, subValue: `/ ${tableData.length || 0}`, unit: '' },
    rata_suhu: { id: 'rata_suhu', label: 'Rata Suhu', icon: Thermometer, value: avgTemp, unit: '°C' },
    sapi_bunting: { id: 'sapi_bunting', label: 'Bunting', icon: HeartPulse, value: pregnantCount, unit: (lang === 'id' ? 'Ekor' : 'Cows') },
    perlu_cek: { id: 'perlu_cek', label: 'Perlu Cek', icon: ShieldAlert, value: sickCount, unit: (lang === 'id' ? 'Ekor' : 'Cows') },
  };

  const renderLoadingOverlay = () => {
    if (!loading) return null;
    return (
      <div className="absolute top-4 right-4 z-50">
        <div className="w-6 h-6 border-2 border-[#81C784] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  };

  return (
    <div className="page-enter overflow-x-hidden relative" style={{ paddingBottom: '100px' }}>
      {renderLoadingOverlay()}
      
      {/* ── 0. HEADER ── */}
      <div 
        className="rounded-t-none rounded-b-[40px] lg:rounded-none px-6 pb-[56px] lg:pb-2 relative overflow-hidden mb-0 text-white lg:text-gray-900 flex flex-col justify-between -mx-4 lg:mx-0 bg-gradient-to-b from-[#115e59] to-[#022c22] lg:bg-none lg:bg-transparent" 
        style={{ 
          paddingTop: 'calc(env(safe-area-inset-top) + 56px)'
        }}
      >
        {/* Subtle Cyber/Pulse Accent (Hidden on desktop) */}
        <Activity 
          size={320} 
          strokeWidth={0.8} 
          className="absolute -right-12 text-[#34d399] opacity-[0.08] pointer-events-none lg:hidden" 
          style={{ top: 'calc(env(safe-area-inset-top) - 2rem)' }}
        />

        {/* Title area */}
        <div className="flex justify-between items-start relative z-10 mb-6 lg:mb-8">
          <div>
            <p className="text-[10px] lg:text-xs font-black opacity-90 lg:opacity-60 mb-1 uppercase tracking-widest text-teal-200 lg:text-gray-500">
              {t.sensor_sub || 'PANTAU SUHU, AKTIVITAS, DAN STATUS BATERAI IOT COLLAR.'}
            </p>
            <h1 className="text-[32px] font-black tracking-tight leading-none lg:text-gray-900">
              {t.sensor_title || 'Data Sensor'}
            </h1>
          </div>
          <button 
            onClick={() => setShowWidgetModal(true)}
            className="w-9 h-9 rounded-full bg-white/10 lg:bg-white lg:border lg:border-gray-200 lg:shadow-sm lg:text-gray-600 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 lg:hover:bg-gray-50 transition-colors flex-shrink-0 ml-3 mt-1"
          >
            <Settings2 size={16} />
          </button>
        </div>

        {/* Quick Stats (Customizable Grid) */}
        <div className={`grid gap-3 lg:gap-4 w-full relative z-10 ${selectedWidgets.length === 1 ? 'grid-cols-1' : selectedWidgets.length === 2 ? 'grid-cols-2' : 'grid-cols-3 lg:grid-cols-3'}`}>
          {selectedWidgets.map(widgetId => {
            const w = widgetOptions[widgetId];
            if (!w) return null;
            const Icon = w.icon;
            return (
              <div key={widgetId} className="bg-white/20 lg:bg-white backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] lg:shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center border border-white/30 lg:border-gray-100">
                <Icon size={24} className="text-white lg:text-[var(--color-sage)] mb-2 lg:mb-3 opacity-90 lg:opacity-100" strokeWidth={1.5} />
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="text-xl lg:text-2xl font-black leading-none text-white lg:text-gray-900">{w.value}</span>
                  {w.subValue && <span className="text-[10px] lg:text-xs font-medium text-white/80 lg:text-gray-500">{w.subValue}</span>}
                  {w.unit && <span className="text-[10px] lg:text-xs font-medium text-white/80 lg:text-gray-500">{w.unit}</span>}
                </div>
                <span className="text-[10px] lg:text-xs font-medium opacity-90 lg:opacity-100 text-center leading-tight tracking-wide text-white lg:text-gray-500">{w.label}</span>
              </div>
            );
          })}
        </div>
      </div>


      {/* ── NEW CONTAINERS ── */}
      <div className="px-4 flex flex-col gap-4 -mt-[32px] md:-mt-0 md:pt-4 relative z-20">
        {/* Container 2: Ringkasan Populasi & Sapi Bunting (Merged) */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-display mb-6">
          {lang === 'id' ? 'Ringkasan Populasi & Kebuntingan' : 'Population & Pregnancy Summary'}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Total Populasi */}
          <div className="flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-gray-500">{lang === 'id' ? 'Total Populasi' : 'Total Population'}</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{populationStats.total}</h3>
                {popHistory.length >= 2 && (
                  <p className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${popHistory[popHistory.length - 1].val - popHistory[popHistory.length - 2].val >= 0 ? 'text-[#2f7d31]' : 'text-[#EF4444]'}`}>
                    {popHistory[popHistory.length - 1].val - popHistory[popHistory.length - 2].val > 0 && '+'}
                    {popHistory[popHistory.length - 1].val - popHistory[popHistory.length - 2].val} {lang === 'id' ? 'bulan ini' : 'this month'}
                  </p>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-[#2f7d31]/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-[#2f7d31]" />
              </div>
            </div>
            <div className="h-28 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <Tooltip cursor={{ fill: 'rgba(0,146,84,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(value) => [value, lang === 'id' ? 'Jumlah' : 'Amount']} />
                  <Bar dataKey="val" fill="#2f7d31" radius={[4, 4, 0, 0]} fillOpacity={0.8} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sapi Bunting */}
          <div className="flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-gray-500">{lang === 'id' ? 'Sapi Bunting' : 'Pregnant Cows'}</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{populationStats.pregnant}</h3>
                {pregHistory.length >= 2 && (
                  <p className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${pregHistory[pregHistory.length - 1].val - pregHistory[pregHistory.length - 2].val >= 0 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pregHistory[pregHistory.length - 1].val - pregHistory[pregHistory.length - 2].val >= 0 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}></span> 
                    {pregHistory[pregHistory.length - 1].val - pregHistory[pregHistory.length - 2].val > 0 && '+'}
                    {pregHistory[pregHistory.length - 1].val - pregHistory[pregHistory.length - 2].val} {lang === 'id' ? 'kasus bulan ini' : 'cases this month'}
                  </p>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                <HeartPulse className="w-4 h-4 text-[#F59E0B]" />
              </div>
            </div>
            <div className="h-28 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pregHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPreg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(value) => [value, lang === 'id' ? 'Jumlah' : 'Amount']} />
                  <Area type="monotone" dataKey="val" stroke="#F59E0B" strokeWidth={3} fillOpacity={1} fill="url(#colorPreg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Container 4: Status Kesehatan */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col relative overflow-hidden mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-display mb-6">{lang === 'id' ? 'Status Kesehatan' : 'Health Status'}</h3>
          
          <div className="flex-1 flex flex-col justify-center space-y-5 relative z-10">
             <div className="h-40 w-full flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: lang === 'id' ? 'Sangat Sehat' : 'Very Healthy', value: healthStats.sangatSehat, color: '#2f7d31' },
                        { name: lang === 'id' ? 'Observasi Ringan' : 'Mild Observation', value: healthStats.observasi, color: '#F59E0B' },
                        { name: lang === 'id' ? 'Perlu Penanganan' : 'Needs Action', value: healthStats.perluPenanganan, color: '#EF4444' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {[
                        { name: lang === 'id' ? 'Sangat Sehat' : 'Very Healthy', value: healthStats.sangatSehat, color: '#2f7d31' },
                        { name: lang === 'id' ? 'Observasi Ringan' : 'Mild Observation', value: healthStats.observasi, color: '#F59E0B' },
                        { name: lang === 'id' ? 'Perlu Penanganan' : 'Needs Action', value: healthStats.perluPenanganan, color: '#EF4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(value) => `${value}%`} />
                  </PieChart>
               </ResponsiveContainer>
             </div>
             
             <div className="flex justify-center gap-4 text-[10px] font-medium text-gray-600 mt-2">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#2f7d31]"></span>{lang === 'id' ? 'Sangat Sehat' : 'Very Healthy'}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>{lang === 'id' ? 'Observasi' : 'Observation'}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>{lang === 'id' ? 'Penanganan' : 'Treatment'}</div>
             </div>

             <div className="mt-2 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2f7d31]"></span>
                    <span className="text-gray-600">{lang === 'id' ? 'Sangat Sehat' : 'Very Healthy'}</span>
                  </div>
                  <span className="font-bold text-gray-900">{healthStats.sangatSehat}%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                    <span className="text-gray-600">{lang === 'id' ? 'Observasi Ringan' : 'Mild Observation'}</span>
                  </div>
                  <span className="font-bold text-gray-900">{healthStats.observasi}%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                    <span className="text-gray-600">{lang === 'id' ? 'Perlu Penanganan' : 'Needs Action'}</span>
                  </div>
                  <span className="font-bold text-gray-900">{healthStats.perluPenanganan}%</span>
                </div>
             </div>
          </div>
          
          <ShieldAlert className="absolute right-[-20px] bottom-[-20px] w-40 h-40 text-gray-50 pointer-events-none z-0" />
        </div>

        {/* Container 5 (REPLACED): Tren Suhu & Aktivitas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden mb-4">
          <div className="p-5 md:p-6 border-b border-gray-100 flex justify-between items-center">
             <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-display">{lang === 'id' ? 'Tren Suhu & Aktivitas' : 'Temperature & Activity Trend'}</h3>
             <div className="flex bg-gray-100 rounded-lg p-1">
               {['24h', '1wk', '30d'].map((t) => (
                 <button
                   key={t}
                   onClick={() => setTimeFilter(t)}
                   className={cn(
                     "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
                     timeFilter === t ? "bg-white text-[var(--accent)] shadow-sm" : "text-gray-500 hover:text-gray-700"
                   )}
                 >
                   {t === '24h' ? (lang === 'id' ? '24 Jam' : '24 Hours') : t === '1wk' ? (lang === 'id' ? '7 Hari' : '7 Days') : (lang === 'id' ? '30 Hari' : '30 Days')}
                 </button>
               ))}
             </div>
          </div>
          <div className="p-5 md:p-6 flex-1 w-full min-h-[300px]">
             {(() => {
                const filteredData = chartData.filter(d => {
                  if (!d.rawTime) return false;
                  const diff = new Date() - d.rawTime;
                  if (timeFilter === '24h') return diff <= 24 * 60 * 60 * 1000;
                  if (timeFilter === '1wk') return diff <= 7 * 24 * 60 * 60 * 1000;
                  if (timeFilter === '30d') return diff <= 30 * 24 * 60 * 60 * 1000;
                  return true;
                });
                if (filteredData.length === 0) {
                  return (
                   <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                     <Activity size={32} className="mb-2 opacity-30" />
                     <p className="text-sm font-medium">{t.sensor_empty || 'Belum ada data telemetri yang tersedia.'}</p>
                   </div>
                  );
                }
                return (
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.6} />
                     <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} minTickGap={30} />
                     <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                     <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                     <Tooltip 
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                       formatter={(value, name) => [value, name === 'temp' ? 'Suhu (°C)' : 'Aktivitas']}
                     />
                     <Line yAxisId="left" type="monotone" dataKey="temp" name="temp" stroke="#EF4444" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#EF4444' }} />
                     <Line yAxisId="right" type="monotone" dataKey="activity" name="activity" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#3B82F6' }} />
                   </LineChart>
                 </ResponsiveContainer>
                );
             })()}
          </div>
        </div>
      </div>

      {/* Container 6.5: Bandingkan Grafik Sensor (Temporarily Hidden as it lacks API) */}
      {/* 
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col mb-4 p-5 md:p-6 overflow-hidden">
        ... (Hidden pending API support) ...
      </div>
      */}

      {/* Container 7: Status Perangkat IoT Collar & List Perangkat */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col mb-4">
        {/* Status Perangkat Summary */}
        <div className="p-5 md:p-6 border-b border-gray-100 bg-gray-50/30">
           <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-display mb-4">{lang === 'id' ? 'Status Perangkat IoT Collar' : 'IoT Collar Device Status'}</h3>
           
           <div className="grid grid-cols-3 gap-2 md:gap-4">
              {collarStats.map((item, idx) => (
                <div key={idx} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full mb-3" style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}80` }}></span>
                  <span className="text-3xl font-black text-gray-900 leading-none mb-1">{item.value}</span>
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">{item.name}</span>
                </div>
              ))}
           </div>
        </div>

        {/* List Perangkat Table */}
        <div className="hidden lg:block overflow-visible">
          {filteredTableData.length === 0 ? (
            <div className="text-center p-8 text-[var(--color-text-secondary)]">
              {t.sensor_empty}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-[var(--color-sage-light)]/30">
              <thead style={{ background: 'var(--bg-card)' }}>
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                    {t.sensor_table_cow_collar}
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                    {t.sensor_table_activity}
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                    {t.sensor_table_battery_signal}
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                    {t.sensor_table_last_sync}
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">{lang === 'id' ? 'Aksi' : 'Action'}</span>
                  </th>
                </tr>
              </thead>
              <tbody style={{ background: 'var(--bg-surface)' }} className="divide-y divide-[var(--border)]">
                {filteredTableData.map((row) => {
                  const activityLabel = formatActivity(row.activityState, t);
                  const signalLabel = getSignalStrength(row.lastSyncRaw, t);
                  const lastSyncLabel = formatLastSync(row.lastSyncRaw, t);
                  return (
                    <tr key={row.id} className="hover:bg-[var(--color-cream)]/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={cn(
                            "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center border",
                            row.status === 'warning' ? 'bg-[var(--amber-dim)] border-[var(--amber)] text-[var(--amber)]' :
                            row.status === 'critical' ? 'bg-[var(--red-dim)] border-[var(--red)] text-[var(--red)]' :
                            'bg-[var(--accent-dim)] border-[var(--accent-border)] text-[var(--accent)]'
                          )}>
                            <Activity className="h-5 w-5" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-[var(--color-text-primary)]">{row.cowName}</div>
                            <div className="text-xs text-[var(--color-text-secondary)] font-medium">Collar: {row.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-0.5 inline-flex text-xs leading-5 font-medium rounded-full border",
                          row.activityState === 'ESTRUS' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          row.activityState === 'SICK' ? "bg-red-50 text-red-700 border-red-200" :
                          row.activityState === 'RESTING' ? "bg-slate-50 text-slate-600 border-slate-200" :
                          "bg-green-50 text-green-700 border-green-200"
                        )}>
                          {activityLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <Battery className={cn(
                              "w-4 h-4",
                              row.battery !== null && row.battery <= 20 ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"
                            )} />
                            <span className={cn(
                              "text-sm",
                              row.battery !== null && row.battery <= 20 ? "text-[var(--color-danger)] font-medium" : "text-[var(--color-text-secondary)]"
                            )}>{row.battery !== null ? `${row.battery}%` : '—'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                            <Wifi className="w-4 h-4 text-[var(--color-text-muted)]" />
                            <span className="text-sm">{signalLabel}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                        {lastSyncLabel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                        <button 
                          onClick={() => setOpenDropdownId(openDropdownId === row.id ? null : row.id)}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-forest)] transition-colors p-1 rounded-md hover:bg-[var(--color-sage-light)]/20 focus:opacity-100"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        
                        {openDropdownId === row.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                            <div className="absolute right-8 top-10 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[100] text-left overflow-hidden">
                            <button
                              onClick={() => {
                                setDownloadModalData(row);
                                setOpenDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#2E7D32] transition-colors flex items-center gap-3 group"
                            >
                              <FileText size={22} className="text-slate-400 group-hover:text-[#2E7D32] transition-colors" strokeWidth={2.2} />
                              Unduh Laporan
                            </button>
                            <button 
                              onClick={() => { 
                                setDeviceModalData(row); 
                                setOpenDropdownId(null); 
                              }} 
                              className="w-full text-left px-4 py-3 text-[14px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#2E7D32] transition-colors flex items-center gap-3 group"
                            >
                              <Settings2 size={22} className="text-slate-400 group-hover:text-[#2E7D32] transition-colors" strokeWidth={2.2} /> 
                              Atur Perangkat
                            </button>
                              <button onClick={() => { setDisconnectModalData(row); setOpenDropdownId(null); }} className="w-full text-left px-4 py-3 text-[14px] font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3 border-t border-gray-100 transition-colors">
                                <X size={22} className="text-red-500" strokeWidth={2.5} /> {lang === 'id' ? 'Putus Koneksi' : 'Disconnect'}
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile Card List */}
        <div className="block lg:hidden space-y-3 p-4">
          {filteredTableData.length === 0 ? (
            <div className="text-center py-4 text-[var(--color-text-secondary)]">
              {t.sensor_empty}
            </div>
          ) : (
            filteredTableData.map((row) => {
              const activityLabel = formatActivity(row.activityState, t);
              const signalLabel = getSignalStrength(row.lastSyncRaw, t);
              const lastSyncLabel = formatLastSync(row.lastSyncRaw, t);
              return (
                <div key={row.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', position: 'relative', zIndex: openDropdownId === row.id ? 50 : 1 }}>
                  <div className="flex items-center justify-between mb-3 relative">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center border",
                        row.status === 'warning' ? 'bg-[var(--amber-dim)] border-[var(--amber)] text-[var(--amber)]' :
                        row.status === 'critical' ? 'bg-[var(--red-dim)] border-[var(--red)] text-[var(--red)]' :
                        'bg-[var(--accent-dim)] border-[var(--accent-border)] text-[var(--accent)]'
                      )}>
                        <Activity className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{row.cowName}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Collar: {row.id}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                        row.activityState === 'ESTRUS' ? "bg-amber-50 text-amber-700 border-amber-200" :
                        row.activityState === 'SICK' ? "bg-red-50 text-red-700 border-red-200" :
                        row.activityState === 'RESTING' ? "bg-slate-50 text-slate-600 border-slate-200" :
                        "bg-green-50 text-green-700 border-green-200"
                      )}>
                        {activityLabel}
                      </span>
                      <button 
                        onClick={() => setOpenDropdownId(openDropdownId === row.id ? null : row.id)}
                        className="text-[var(--color-text-muted)] p-2 md:p-1 -mr-2 md:-mr-1 flex items-center justify-center min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0"
                      >
                        <MoreVertical className="w-5 h-5 md:w-4 md:h-4" />
                      </button>
                    </div>

                    {openDropdownId === row.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                        <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[100] text-left overflow-hidden">
                          <button onClick={() => { setDownloadModalData(row); setOpenDropdownId(null); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                            <ClipboardList className="w-4 h-4 text-emerald-600" /> {lang === 'id' ? 'Unduh Laporan' : 'Download Report'}
                          </button>
                          <button onClick={() => { toast.info('Membuka pengaturan...'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                            <Settings2 className="w-4 h-4 text-blue-600" /> {lang === 'id' ? 'Atur Perangkat' : 'Device Settings'}
                          </button>
                          <button onClick={() => { toast.error('Memutus koneksi dengan kalung...'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 border-t border-gray-100 transition-colors">
                            <X className="w-4 h-4" /> {lang === 'id' ? 'Putus Koneksi' : 'Disconnect'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                    <div className="flex justify-between">
                      <span>{lang === 'id' ? 'Baterai' : 'Battery'}</span>
                      <span className={cn(
                        "font-bold",
                        row.battery !== null && row.battery <= 20 ? "text-[var(--color-danger)]" : ""
                      )} style={{ color: row.battery !== null && row.battery <= 20 ? undefined : 'var(--text-1)' }}>
                        {row.battery !== null ? `${row.battery}%` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'id' ? 'Sinyal' : 'Signal'}</span>
                      <span style={{ color: 'var(--text-1)' }} className="font-semibold">{signalLabel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t.sensor_table_last_sync}</span>
                      <span style={{ color: 'var(--text-3)' }}>{lastSyncLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Pagination Details */}
        <div className="bg-[var(--color-cream)]/30 px-6 py-3 border-t border-[var(--color-sage-light)]/30 flex items-center justify-between sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t.sensor_pag_showing} <span className="font-medium">1</span> {t.sensor_pag_to} <span className="font-medium">{filteredTableData.length}</span> {t.sensor_pag_of} <span className="font-medium">{filteredTableData.length}</span> {t.sensor_pag_results}
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex items-center gap-1.5" aria-label="Pagination">
                <button 
                  style={{ 
                    background: 'var(--bg-surface)', 
                    border: '0.5px solid var(--border)', 
                    color: 'var(--text-2)', 
                    padding: '8px', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]"
                >
                  <ChevronLeft size={16} />
                </button>
                <button style={{ background: 'var(--accent)', border: '0.5px solid var(--accent)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  1
                </button>
                <button 
                  style={{ 
                    background: 'var(--bg-surface)', 
                    border: '0.5px solid var(--border)', 
                    color: 'var(--text-2)', 
                    padding: '8px', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Widget Settings Modal */}
      {showWidgetModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">{lang === 'id' ? 'Atur Widget Data' : 'Configure Data Widgets'}</h3>
              <button 
                onClick={() => setShowWidgetModal(false)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-gray-500 mb-4">
                {lang === 'id'
                  ? 'Pilih hingga 3 metrik utama untuk ditampilkan di bagian atas (Data Sensor). Anda telah memilih '
                  : 'Select up to 3 main metrics to display at the top. You have selected '}
                <span className="font-bold text-[var(--accent)]">{selectedWidgets.length}/3</span>.
              </p>
              
              <div className="space-y-2">
                {Object.values(widgetOptions).map(w => {
                  const isSelected = selectedWidgets.includes(w.id);
                  const Icon = w.icon;
                  return (
                    <label 
                      key={w.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)]"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (selectedWidgets.length >= 3) {
                              toast.error(lang === 'id' ? 'Maksimal 3 widget yang dapat dipilih' : 'Maximum of 3 widgets can be selected');
                              return;
                            }
                            setSelectedWidgets([...selectedWidgets, w.id]);
                          } else {
                            if (selectedWidgets.length <= 1) {
                              toast.error(lang === 'id' ? 'Minimal 1 widget harus dipilih' : 'At least 1 widget must be selected');
                              return;
                            }
                            setSelectedWidgets(selectedWidgets.filter(id => id !== w.id));
                          }
                        }}
                      />
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-gray-100 text-gray-500'}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{w.label}</p>
                        <p className="text-xs text-gray-500">{w.value} {w.unit}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100">
              <button 
                onClick={() => setShowWidgetModal(false)}
                className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-bold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {lang === 'id' ? 'Simpan Pengaturan' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Unduh Laporan */}
      {downloadModalData && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[440px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-7">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Unduh Laporan Sensor</h3>
                <button onClick={() => setDownloadModalData(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 bg-gray-50 hover:bg-gray-100 rounded-full">
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>
              <p className="text-[13px] font-medium text-gray-500 mb-7 leading-relaxed">
                Pilih rentang tanggal dan format file untuk mengunduh laporan sensor <strong className="text-gray-700">{downloadModalData.cowName}</strong>.
              </p>
              
              <div className="mb-8">
                <label className="block text-[13px] font-bold text-gray-900 mb-3">Pilih Rentang Tanggal</label>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <input type="date" id="reportStartDate" defaultValue={defaultStartDate} className="w-full text-sm font-semibold border-2 border-gray-100 rounded-xl px-4 py-2.5 outline-none focus:border-[#81C784] focus:ring-4 focus:ring-[#81C784]/20 text-gray-700 bg-white transition-all cursor-pointer" />
                    <p className="text-[11px] font-semibold text-gray-400 mt-2 ml-1 uppercase tracking-wide">Mulai</p>
                  </div>
                  <div className="text-gray-300 font-bold mt-2">-</div>
                  <div className="flex-1">
                    <input type="date" id="reportEndDate" defaultValue={defaultEndDate} className="w-full text-sm font-semibold border-2 border-gray-100 rounded-xl px-4 py-2.5 outline-none focus:border-[#81C784] focus:ring-4 focus:ring-[#81C784]/20 text-gray-700 bg-white transition-all cursor-pointer" />
                    <p className="text-[11px] font-semibold text-gray-400 mt-2 ml-1 uppercase tracking-wide">Selesai</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={async () => {
                    try {
                      toast.info('Menyiapkan laporan PDF...');
                      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
                      const res = await fetch(`/api/report/estrus-prediction`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          cow_id: downloadModalData.cow_id || downloadModalData.id,
                          start_date: document.getElementById('reportStartDate').value,
                          end_date: document.getElementById('reportEndDate').value
                        })
                      });
                      if (!res.ok) throw new Error("Gagal mengunduh laporan");
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Laporan_Sensor_${downloadModalData?.cowName || 'Sapi'}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                      toast.success('Laporan PDF berhasil diunduh');
                      setDownloadModalData(null);
                    } catch (e) {
                      console.error(e);
                      toast.error('Gagal mengunduh laporan PDF');
                    }
                  }}
                  className="w-full bg-[#8FBF9F]/20 hover:bg-[#8FBF9F]/30 text-[#2A4D3A] font-bold py-3.5 px-2 rounded-xl flex items-center justify-center gap-2 transition-all border border-[#8FBF9F]/40 active:scale-[0.98]"
                >
                  <FileText size={18} strokeWidth={2.5} />
                  <span className="text-[13px]">UNDUH FORMAT PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Atur Perangkat */}
      {deviceModalData && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Atur Perangkat IoT</h3>
              <button onClick={() => setDeviceModalData(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 bg-gray-50 hover:bg-gray-100 rounded-full">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-7 flex flex-col gap-8">
              {/* Status Section */}
              <div className="flex items-center justify-center gap-12">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center mb-3">
                    <div className="relative w-8 h-4 border-2 border-gray-400 rounded-sm p-[2px] flex items-center">
                      <div className="absolute -right-[3px] top-1/2 -translate-y-1/2 w-[2px] h-2 bg-gray-400 rounded-r-sm"></div>
                      <div className={`h-full rounded-[1px] transition-all duration-300 ${liveBattery < 20 ? 'bg-red-500' : liveBattery < 50 ? 'bg-amber-500' : 'bg-[#2E7D32]'}`} style={{ width: `${liveBattery}%` }}></div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Baterai</span>
                  <span className="text-2xl font-black text-gray-900">{liveBattery}%</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center mb-3">
                    <Wifi size={28} className={`transition-colors duration-300 ${liveSignal === 'Lemah' ? 'text-red-500' : liveSignal === 'Sedang' ? 'text-amber-500' : 'text-[#2E7D32]'}`} strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Sinyal</span>
                  <span className="text-2xl font-black text-gray-900">{liveSignal}</span>
                </div>
              </div>
              
              {/* Toggles */}
              <div className="bg-white rounded-2xl border-2 border-gray-100 divide-y-2 divide-gray-100 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="text-[13px] font-bold text-gray-900 mb-1">Notifikasi Baterai Lemah</h4>
                    <p className="text-[11px] font-semibold text-gray-500">Saat baterai di bawah 15%</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2E7D32]"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="text-[13px] font-bold text-gray-900 mb-1">Peringatan Sinyal Putus</h4>
                    <p className="text-[11px] font-semibold text-gray-500">Jika perangkat terputus</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2E7D32]"></div>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="p-5 bg-white border-t border-gray-100 flex items-center gap-3 w-full mt-4">
              <button 
                onClick={() => setDeviceModalData(null)}
                className="flex-1 py-3 text-[13px] font-bold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  toast.success('Pengaturan berhasil disimpan!');
                  setDeviceModalData(null);
                }}
                className="flex-1 py-3 text-[13px] font-bold bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl transition-all shadow-sm active:scale-95"
              >
                Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Putus Koneksi */}
      {disconnectModalData && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[380px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-7 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <TriangleAlert size={32} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">Putus Koneksi?</h3>
              <p className="text-[13px] font-medium text-gray-500 leading-relaxed mb-8">
                Anda yakin ingin memutus koneksi dengan kalung <strong className="text-gray-700">{disconnectModalData.id}</strong> pada <strong className="text-gray-700">{disconnectModalData.cowName}</strong>? Data sensor tidak akan disinkronkan lagi.
              </p>
              
              <div className="flex items-center gap-3 w-full">
                <button 
                  onClick={() => setDisconnectModalData(null)}
                  className="flex-1 px-5 py-3 text-[13px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={() => {
                    toast.success(`Koneksi ${disconnectModalData.cowName} terputus`);
                    setTableData(prev => prev.filter(c => c.id !== disconnectModalData.id));
                    setAllCowsData(prev => prev.filter(c => c.id !== disconnectModalData.id));
                    setDisconnectModalData(null);
                  }}
                  className="flex-1 px-5 py-3 text-[13px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-sm active:scale-95"
                >
                  Ya, Putuskan
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}        {/* End of px-4 wrapper */}
      </div>

    </div>
  );
}
