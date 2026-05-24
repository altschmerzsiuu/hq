import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Activity, 
  Thermometer, 
  Battery, 
  Wifi,
  MoreVertical,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { cn } from '@/lib/utils';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';

function formatLastSync(lastSyncStr) {
  if (!lastSyncStr) return 'Tidak Pernah';
  const lastSync = new Date(lastSyncStr);
  const diffMs = new Date() - lastSync;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari lalu`;
}

function getSignalStrength(lastSyncStr) {
  if (!lastSyncStr) return 'Lemah';
  const lastSync = new Date(lastSyncStr);
  const diffMs = new Date() - lastSync;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  
  if (diffMin < 5) return 'Kuat';
  if (diffMin < 30) return 'Sedang';
  return 'Lemah';
}

function formatActivity(state) {
  if (!state) return 'Normal';
  const map = {
    RESTING: 'Istirahat',
    EATING: 'Makan',
    RUMINATING: 'Memamah Biak',
    ESTRUS: 'Estrus / Aktif',
    SICK: 'Sakit',
    UNKNOWN: 'Normal'
  };
  return map[state.toUpperCase()] || state;
}

export default function SensorData() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState([]);

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
            activity: formatActivity(cow.activity_state),
            battery: cow.battery,
            signal: getSignalStrength(cow.last_sync),
            lastSync: formatLastSync(cow.last_sync),
            status: status
          };
        });

      setTableData(liveCows);

      // Process telemetry data for chart (chronological order)
      const sortedTelemetry = [...(telemetryRes.data || [])].reverse();
      const formattedChart = sortedTelemetry.map(d => {
        const timeStr = d.batch_ts ? new Date(d.batch_ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';
        return {
          time: timeStr,
          temp: d.temperature !== null ? parseFloat(d.temperature.toFixed(1)) : null,
          activity: d.max_z !== null ? Math.round(d.max_z * 30) : 0
        };
      });

      setChartData(formattedChart);

      if (!showMainLoader) {
        toast.success('Data sensor berhasil disinkronkan.');
      }
    } catch (err) {
      console.error('Gagal memuat data sensor:', err);
      toast.error('Gagal mengambil data sensor terbaru.');
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
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)]">Data Sensor</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Pantau suhu, aktivitas, dan status baterai IoT Collar.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchAllData(false)}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-2)] hover:text-[var(--accent)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin text-[var(--accent)]")} />
            {syncing ? 'Sinkronisasi...' : 'Sinkronisasi'}
          </button>
        </div>
      </div>

      {/* CHART AREA */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '24px', border: '0.5px solid var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] font-display">Grafik Real-time (Rata-rata Kandang)</h2>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--color-warning)]"></span>
              <span className="text-[var(--color-text-secondary)]">Suhu (°C)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--color-forest)]"></span>
              <span className="text-[var(--color-text-secondary)]">Aktivitas</span>
            </div>
          </div>
        </div>
        <div className="w-full h-[220px] md:h-[280px]" style={{ minWidth: 0 }}>
          {chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Activity className="w-10 h-10 text-[var(--color-text-muted)] mb-2" />
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">Belum ada rekaman telemetry untuk grafik</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-sage-light)" opacity={0.3} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} domain={[35, 42]} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '0.5px solid var(--border)', 
                    background: 'var(--bg-card)', 
                    boxShadow: 'var(--shadow-dropdown)' 
                  }}
                  labelStyle={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}
                />
                <Line yAxisId="left" type="monotone" dataKey="temp" stroke="var(--color-warning)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={true} />
                <Line yAxisId="right" type="monotone" dataKey="activity" stroke="var(--color-forest)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={true} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* TABLE SECTION */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        
        {/* Table Toolbar */}
        <div className="p-4 border-b border-[var(--color-sage-light)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
            </div>
            <input
              type="text"
              placeholder="Cari ID Collar, Nama, atau RFID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-[var(--border)] rounded-lg leading-5 bg-[var(--bg-card)] text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 border border-[var(--color-sage-light)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-sage-light)]/20 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          {filteredTableData.length === 0 ? (
            <div className="text-center p-8 text-[var(--color-text-secondary)]">
              Tidak ada collar aktif yang ditemukan.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-[var(--color-sage-light)]/30">
              <thead style={{ background: 'var(--bg-card)' }}>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Sapi / Collar
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Suhu
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Aktivitas
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Baterai & Sinyal
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Terakhir Sync
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody style={{ background: 'var(--bg-surface)' }} className="divide-y divide-[var(--border)]">
                {filteredTableData.map((row) => (
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
                      <div className="flex items-center gap-1.5">
                        <Thermometer className={cn(
                          "w-4 h-4", 
                          row.temp !== null && row.temp >= 39.0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"
                        )} />
                        <span className={cn(
                          "text-sm font-medium",
                          row.temp !== null && row.temp >= 39.0 ? "text-[var(--color-danger)] font-bold" : "text-[var(--color-text-secondary)]"
                        )}>
                          {row.temp !== null ? `${row.temp}°C` : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-0.5 inline-flex text-xs leading-5 font-medium rounded-full border",
                        row.activity === 'Estrus / Aktif' || row.activity === 'Tinggi' ? "bg-amber-50 text-amber-700 border-amber-200" :
                        row.activity === 'Sakit' ? "bg-red-50 text-red-700 border-red-200" :
                        row.activity === 'Istirahat' ? "bg-slate-50 text-slate-600 border-slate-200" :
                        "bg-green-50 text-green-700 border-green-200"
                      )}>
                        {row.activity}
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
                          <span className="text-sm">{row.signal}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                      {row.lastSync}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-[var(--color-text-muted)] hover:text-[var(--color-forest)] transition-colors p-1 rounded-md hover:bg-[var(--color-sage-light)]/20 opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile Card List */}
        <div className="block md:hidden space-y-3 p-4">
          {filteredTableData.length === 0 ? (
            <div className="text-center py-4 text-[var(--color-text-secondary)]">
              Tidak ada collar aktif yang ditemukan.
            </div>
          ) : (
            filteredTableData.map((row) => (
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
                    row.activity === 'Estrus / Aktif' || row.activity === 'Tinggi' ? "bg-amber-50 text-amber-700 border-amber-200" :
                    row.activity === 'Sakit' ? "bg-red-50 text-red-700 border-red-200" :
                    row.activity === 'Istirahat' ? "bg-slate-50 text-slate-600 border-slate-200" :
                    "bg-green-50 text-green-700 border-green-200"
                  )}>
                    {row.activity}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                  <div className="flex justify-between">
                    <span>Suhu</span>
                    <span className={cn(
                      "font-bold",
                      row.temp !== null && row.temp >= 39.0 ? "text-[var(--color-danger)]" : ""
                    )} style={{ color: row.temp !== null && row.temp >= 39.0 ? undefined : 'var(--text-1)' }}>
                      {row.temp !== null ? `${row.temp}°C` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Baterai</span>
                    <span className={cn(
                      "font-bold",
                      row.battery !== null && row.battery <= 20 ? "text-[var(--color-danger)]" : ""
                    )} style={{ color: row.battery !== null && row.battery <= 20 ? undefined : 'var(--text-1)' }}>
                      {row.battery !== null ? `${row.battery}%` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sinyal</span>
                    <span style={{ color: 'var(--text-1)' }} className="font-semibold">{row.signal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Terakhir Sync</span>
                    <span style={{ color: 'var(--text-3)' }}>{row.lastSync}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Pagination Details */}
        <div className="bg-[var(--color-cream)]/30 px-6 py-3 border-t border-[var(--color-sage-light)]/30 flex items-center justify-between sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Menampilkan <span className="font-medium">1</span> sampai <span className="font-medium">{filteredTableData.length}</span> dari <span className="font-medium">{filteredTableData.length}</span> hasil
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
    </div>
  );
}
