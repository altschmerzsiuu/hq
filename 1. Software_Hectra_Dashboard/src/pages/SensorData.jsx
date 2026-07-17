import { useState, useEffect } from 'react';
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
  HeartPulse
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
  const [timeFilter, setTimeFilter] = useState('1wk');
  const [showMoreReports, setShowMoreReports] = useState(false);
  const [populationStats, setPopulationStats] = useState({ total: 0, pregnant: 0 });
  const [healthStats, setHealthStats] = useState({ sangatSehat: 0, observasi: 0, perluPenanganan: 0 });
  const [collarStats, setCollarStats] = useState([]);
  const [popHistory, setPopHistory] = useState([]);
  const [pregHistory, setPregHistory] = useState([]);

  const fetchAllData = async (showMainLoader = false) => {
    if (showMainLoader) setLoading(true);
    setSyncing(true);
    try {
      const [cattleRes, telemetryRes] = await Promise.all([
        axiosInstance.get('/hewan'),
        axiosInstance.get('/sensor-data?limit=50')
      ]);
      const allCows = cattleRes.data || [];

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
      const liveCows = allCows
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

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-[var(--color-sage-light)]/20 rounded w-1/4 mb-8"></div>
        <div className="h-[300px] bg-[var(--color-sage-light)]/20 rounded-2xl mb-6"></div>
        <div className="h-[400px] bg-[var(--color-sage-light)]/20 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div style={{ color: 'var(--accent)' }}>
            <Activity size={32} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-1)] leading-tight tracking-tight">
              {t.sensor_title}
            </h1>
            <p className="text-[10px] md:text-sm font-extrabold text-[var(--accent)] uppercase tracking-wider mt-0.5">
              {t.sensor_sub}
            </p>
          </div>
        </div>
      </div>

      {/* ── NEW CONTAINERS ── */}
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
                  <Tooltip cursor={{ fill: 'rgba(0,146,84,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
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
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
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
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#2f7d31]"></span>Sangat Sehat</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>Observasi</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>Penanganan</div>
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

        {/* Container 5: Status Perangkat IoT Collar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden mb-4">
          {/* Grafik Collar */}
          <div className="p-5 md:p-6 h-full flex flex-col">
             <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-display mb-2">{lang === 'id' ? 'Status Perangkat IoT Collar' : 'IoT Collar Device Status'}</h3>
             
             <div className="grid grid-cols-3 gap-3 mt-4">
                {collarStats.map((item, idx) => (
                  <div key={idx} className="bg-[var(--color-cream)]/20 border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center text-center hover:shadow-sm transition-all">
                    <span className="w-2 h-2 rounded-full mb-2" style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}80` }}></span>
                    <span className="text-2xl font-black text-gray-900 leading-none mb-1">{item.value}</span>
                    <span className="text-[10px] text-gray-500 font-bold leading-tight">{item.name}</span>
                  </div>
                ))}
             </div>
          </div>
          
          <div className="border-t border-gray-100 w-full"></div>
          
          {/* List Perangkat */}
          <div className="hidden md:block overflow-x-auto">
          {filteredTableData.length === 0 ? (
            <div className="text-center p-8 text-[var(--color-text-secondary)]">
              {t.sensor_empty}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-[var(--color-sage-light)]/30">
              <thead style={{ background: 'var(--bg-card)' }}>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {t.sensor_table_cow_collar}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {t.sensor_table_activity}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {t.sensor_table_battery_signal}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-[var(--color-text-muted)] hover:text-[var(--color-forest)] transition-colors p-1 rounded-md hover:bg-[var(--color-sage-light)]/20 opacity-0 group-hover:opacity-100 focus:opacity-100">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile Card List */}
        <div className="block md:hidden space-y-3 p-4">
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
                <div key={row.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                  <div className="flex items-center justify-between mb-3">
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
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                      row.activityState === 'ESTRUS' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      row.activityState === 'SICK' ? "bg-red-50 text-red-700 border-red-200" :
                      row.activityState === 'RESTING' ? "bg-slate-50 text-slate-600 border-slate-200" :
                      "bg-green-50 text-green-700 border-green-200"
                    )}>
                      {activityLabel}
                    </span>
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
      {/* End of grid */}
      </div>
    </div>
  );
}
