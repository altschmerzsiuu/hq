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

  const fetchAllData = async (showMainLoader = false) => {
    if (showMainLoader) setLoading(true);
    setSyncing(true);
    try {
      const [cattleRes, telemetryRes] = await Promise.all([
        axiosInstance.get('/hewan'),
        axiosInstance.get('/sensor-data?limit=50')
      ]);

      // Process table data: only show cows that have a collar_id
      const liveCows = (cattleRes.data || [])
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
      const sortedTelemetry = [...(telemetryRes.data || [])].reverse();
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

  // Mock data for new widgets
  const mockPopulation = [
    { name: 'Jan', val: 900 },
    { name: 'Feb', val: 950 },
    { name: 'Mar', val: 1000 },
    { name: 'Apr', val: 1100 },
    { name: 'Mei', val: 1284 }
  ];

  const mockPregnant = [
    { name: 'Jan', val: 20 },
    { name: 'Feb', val: 30 },
    { name: 'Mar', val: 50 },
    { name: 'Apr', val: 70 },
    { name: 'Mei', val: 82 }
  ];

  const mockMonthlyTrend = [
    { name: 'Jan', val: 15 },
    { name: 'Feb', val: 18 },
    { name: 'Mar', val: 12 },
    { name: 'Apr', val: 25 },
    { name: 'Mei', val: 35 },
    { name: 'Jun', val: 10 }
  ];

  const healthData = {
    sangatSehat: 92,
    observasi: 6,
    perluPenanganan: 2
  };
  
  const collarData = [
    { name: 'Normal', value: 85, color: '#009254' },
    { name: 'Baterai Lemah', value: 10, color: '#F59E0B' },
    { name: 'Sinyal Hilang', value: 5, color: '#EF4444' }
  ];

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
                <h3 className="text-2xl font-black text-gray-900 mt-1">1,284</h3>
                <p className="text-[10px] font-bold text-[#009254] mt-1 flex items-center gap-1">
                  <span className="text-[#009254]">📈</span> +12 {lang === 'id' ? 'bulan ini' : 'this month'}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#009254]/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-[#009254]" />
              </div>
            </div>
            <div className="h-28 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockPopulation} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <Tooltip cursor={{ fill: 'rgba(0,146,84,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="val" fill="#009254" radius={[4, 4, 0, 0]} fillOpacity={0.8} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sapi Bunting */}
          <div className="flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-gray-500">{lang === 'id' ? 'Sapi Bunting' : 'Pregnant Cows'}</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">82</h3>
                <p className="text-[10px] font-bold text-[#F59E0B] mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span> 
                  4 {lang === 'id' ? 'kelahiran diprediksi minggu ini' : 'births predicted this week'}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                <HeartPulse className="w-4 h-4 text-[#F59E0B]" />
              </div>
            </div>
            <div className="h-28 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockPregnant} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Container 3: Trend Bulanan */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-display">{lang === 'id' ? 'Trend Kesehatan' : 'Health Trend'}</h3>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockMonthlyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                  {mockMonthlyTrend.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Mei' ? '#009254' : '#F3F4F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Container 4: Status Kesehatan */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col relative overflow-hidden">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-display mb-6">{lang === 'id' ? 'Status Kesehatan' : 'Health Status'}</h3>
          
          <div className="flex-1 flex flex-col justify-center space-y-5 relative z-10">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#009254]"></div>
                  <span className="font-medium text-gray-700">{lang === 'id' ? 'Sangat Sehat' : 'Very Healthy'}</span>
                </div>
                <span className="font-black text-gray-900">{healthData.sangatSehat}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#009254] rounded-full" style={{ width: `${healthData.sangatSehat}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></div>
                  <span className="font-medium text-gray-700">{lang === 'id' ? 'Observasi Ringan' : 'Mild Observation'}</span>
                </div>
                <span className="font-black text-gray-900">{healthData.observasi}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#F59E0B] rounded-full" style={{ width: `${healthData.observasi}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></div>
                  <span className="font-medium text-gray-700">{lang === 'id' ? 'Perlu Penanganan' : 'Needs Action'}</span>
                </div>
                <span className="font-black text-gray-900">{healthData.perluPenanganan}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#EF4444] rounded-full" style={{ width: `${healthData.perluPenanganan}%` }}></div>
              </div>
            </div>
          </div>
          
          <ShieldAlert className="absolute right-[-20px] bottom-[-20px] w-40 h-40 text-gray-50 pointer-events-none z-0" />
        </div>
      </div>


      {/* Container 5 & TABLE SECTION: Status Perangkat IoT Collar & List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden mb-4">
        
        {/* Grafik Collar */}
        <div className="p-5 md:p-6 border-b border-gray-100">
           <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-display mb-2">{lang === 'id' ? 'Status Perangkat IoT Collar' : 'IoT Collar Device Status'}</h3>
           <div className="h-40 w-full flex items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={collarData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {collarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                </PieChart>
             </ResponsiveContainer>
           </div>
           <div className="flex justify-center gap-4 text-[10px] font-medium text-gray-600 mt-2">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#009254]"></span>Normal</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>Bat. Lemah</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>Sinyal Hilang</div>
           </div>
        </div>
        
        {/* Desktop Table */}
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

      {/* Container 6: Laporan Bulanan */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-display">{lang === 'id' ? 'Laporan Bulanan' : 'Monthly Reports'}</h3>
          <span 
            onClick={() => setShowMoreReports(!showMoreReports)}
            className="text-[11px] font-bold text-[#009254] cursor-pointer hover:underline"
          >
            {showMoreReports 
              ? (lang === 'id' ? 'Lihat Lebih Sedikit' : 'View Less') 
              : (lang === 'id' ? 'Lihat Lebih Banyak' : 'View More')}
          </span>
        </div>
        
        <div className="space-y-3 flex flex-col justify-center">
          {/* Report Item 1 */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-[#009254]/30 transition-colors group bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#009254]/10 flex items-center justify-center text-[#009254]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 group-hover:text-[#009254] transition-colors line-clamp-1">Laporan Operasional W21-2024</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">14 Mei - 20 Mei 2024 • 2.4 MB</p>
              </div>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm shrink-0">
              <Download className="w-3 h-3" /> <span className="hidden sm:inline">Unduh</span>
            </button>
          </div>

          {/* Report Item 2 */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-[#009254]/30 transition-colors group bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#009254]/10 flex items-center justify-center text-[#009254]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 group-hover:text-[#009254] transition-colors line-clamp-1">Analisis Kesehatan & Birahi W20</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">7 Mei - 13 Mei 2024 • 1.8 MB</p>
              </div>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm shrink-0">
              <Download className="w-3 h-3" /> <span className="hidden sm:inline">Unduh</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
