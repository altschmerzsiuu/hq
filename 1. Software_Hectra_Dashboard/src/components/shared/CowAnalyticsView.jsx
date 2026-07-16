import React, { useState, useEffect } from 'react';
import { Activity, Loader2, AlertCircle, Stethoscope, CheckCircle2 } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

export default function CowAnalyticsView({ selectedCow }) {
  const { lang } = useSettingsStore();
  const t = translations[lang];

  const [loading, setLoading] = useState(false);
  const [pieData, setPieData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [telemetryData, setTelemetryData] = useState([]);
  const [timeFilter, setTimeFilter] = useState('1wk'); // Default to 1 week
  const [healthStatus, setHealthStatus] = useState(null); // null | 'ok' | 'warning'

  useEffect(() => {
    if (!selectedCow) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        let limit = 50;
        if (timeFilter === '1wk') limit = 350;
        if (timeFilter === '1bln') limit = 1000;
        if (timeFilter === '3bln') limit = 3000;
        if (timeFilter === '6bln') limit = 6000;
        if (timeFilter === '1th') limit = 12000;

        const [behaviorRes, telemetryRes] = await Promise.all([
          axiosInstance.get(`/behavior?cow_id=${selectedCow.id || selectedCow.cow_id}`),
          axiosInstance.get(`/sensor-data?collar_id=${selectedCow.collar_id}&limit=${limit}`)
        ]);
        
        setPieData(behaviorRes.data.pie_data || []);
        setWeeklyData(behaviorRes.data.weekly_data || []);

        const sortedTelemetry = [...(telemetryRes.data || [])].reverse();
        const formattedChart = sortedTelemetry.map(d => {
          const timeStr = d.batch_ts ? new Date(d.batch_ts).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
          return {
            time: timeStr,
            temp: d.temperature !== null ? parseFloat(d.temperature.toFixed(1)) : null,
            activity: d.max_z !== null ? Math.round(d.max_z * 30) : 0
          };
        });
        setTelemetryData(formattedChart);

        // --- Smart health check ---
        if (formattedChart.length > 5) {
          const recent = formattedChart.slice(-20);
          const avgActivity = recent.reduce((s, d) => s + (d.activity || 0), 0) / recent.length;
          const avgTemp = recent.filter(d => d.temp).reduce((s, d) => s + d.temp, 0) / (recent.filter(d => d.temp).length || 1);
          const allActivity = formattedChart.reduce((s, d) => s + (d.activity || 0), 0) / formattedChart.length;
          const activityDrop = allActivity > 0 ? ((allActivity - avgActivity) / allActivity) : 0;
          if (activityDrop > 0.4 || avgTemp > 39.5) {
            setHealthStatus('warning');
          } else {
            setHealthStatus('ok');
          }
        } else {
          setHealthStatus(null);
        }

      } catch (err) {
        console.error('Gagal fetch analytics:', err);
        toast.error(lang === 'id' ? 'Gagal memuat data analitik ternak.' : 'Failed to load cattle analytics data.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedCow, lang, timeFilter]);

  if (!selectedCow) return null;

  // Translate raw activity state names from backend to clear UI labels
  const translateActivity = (name) => {
    if (!name) return t.behavior_legend_other;
    const key = name.toLowerCase();
    if (key.includes('aktif') || key.includes('estrus') || key.includes('active') || key === 'active') return t.behavior_legend_active;
    if (key.includes('makan') || key.includes('ruminating') || key.includes('eating') || key.includes('ruminasi')) return t.behavior_legend_eating;
    if (key.includes('istirahat') || key.includes('resting') || key.includes('sleeping') || key.includes('tidur')) return t.behavior_legend_resting;
    if (key.includes('lainnya') || key.includes('unknown') || key.includes('other') || key.includes('sick') || key.includes('sakit')) return t.behavior_legend_other;
    return name;
  };

  const formatDayTick = (day) => {
    if (!day) return '';
    const map = {
      'Sen': lang === 'id' ? 'Sen' : 'Mon',
      'Sel': lang === 'id' ? 'Sel' : 'Tue',
      'Rab': lang === 'id' ? 'Rab' : 'Wed',
      'Kam': lang === 'id' ? 'Kam' : 'Thu',
      'Jum': lang === 'id' ? 'Jum' : 'Fri',
      'Sab': lang === 'id' ? 'Sab' : 'Sat',
      'Min': lang === 'id' ? 'Min' : 'Sun',
      'Monday': lang === 'id' ? 'Sen' : 'Mon',
      'Tuesday': lang === 'id' ? 'Sel' : 'Tue',
      'Wednesday': lang === 'id' ? 'Rab' : 'Wed',
      'Thursday': lang === 'id' ? 'Kam' : 'Thu',
      'Friday': lang === 'id' ? 'Jum' : 'Fri',
      'Saturday': lang === 'id' ? 'Sab' : 'Sat',
      'Sunday': lang === 'id' ? 'Min' : 'Sun',
    };
    return map[day] || day;
  };

  const localizedPieData = pieData.map(item => ({
    ...item,
    name: translateActivity(item.name)
  }));

  const localizedWeeklyData = weeklyData.map(item => ({
    ...item,
    day: formatDayTick(item.day)
  }));

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    return (
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--shadow-dropdown)' }}>
        <p style={{ fontWeight: 700, fontSize: '13px', color: entry.payload.color }}>{entry.name}</p>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>{entry.value}% {lang === 'id' ? 'dari total hari ini' : 'of today\'s data'}</p>
      </div>
    );
  };

  const BarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--shadow-dropdown)' }}>
        <p style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-1)', marginBottom: '6px' }}>{label}</p>
        {payload.map(p => (
          <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill, flexShrink: 0, display: 'inline-block' }} />
            <span>{p.name}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-1)', marginLeft: 'auto' }}>{p.value}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
              <p className="text-sm text-[var(--text-2)]">Memuat data analitik...</p>
            </div>
          ) : (
            <>
              {/* Time Filter Pill Bar */}
              <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '10px 12px', boxShadow: 'var(--shadow-card)' }} className="mb-4">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {[
                    { key: '1hr',  label: '1 Hr'  },
                    { key: '1wk',  label: '1 Mg'  },
                    { key: '1bln', label: '1 Bln' },
                    { key: '3bln', label: '3 Bln' },
                    { key: '6bln', label: '6 Bln' },
                    { key: '1th',  label: '1 Th'  },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setTimeFilter(opt.key)}
                      className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={{
                        background: timeFilter === opt.key ? 'var(--color-primary)' : 'var(--bg-surface)',
                        color: timeFilter === opt.key ? '#fff' : 'var(--text-2)',
                        border: timeFilter === opt.key ? 'none' : '0.5px solid var(--border)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Health Summary Card */}
              <div style={{
                background: healthStatus === 'warning' ? 'var(--red-dim, #FFF1F1)' : 'var(--bg-card)',
                border: `0.5px solid ${healthStatus === 'warning' ? 'var(--red, #EF4444)' : 'var(--border)'}`,
                borderRadius: '16px',
                padding: '16px 18px',
                boxShadow: 'var(--shadow-card)',
              }} className="mb-2 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div style={{
                    background: healthStatus === 'warning' ? '#FEE2E2' : 'var(--bg-surface)',
                    borderRadius: '12px',
                    padding: '8px',
                    flexShrink: 0
                  }}>
                    {healthStatus === 'warning'
                      ? <AlertCircle className="w-5 h-5" style={{ color: 'var(--red, #EF4444)' }} />
                      : <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--color-forest)' }} />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                      {healthStatus === null
                        ? (lang === 'id' ? 'Ringkasan Kesehatan' : 'Health Summary')
                        : healthStatus === 'warning'
                          ? (lang === 'id' ? 'Indikasi Butuh Perhatian' : 'Attention Needed')
                          : (lang === 'id' ? 'Kondisi Normal' : 'Normal Condition')}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {healthStatus === null
                        ? (lang === 'id' ? 'Belum cukup data sensor untuk disimpulkan.' : 'Not enough sensor data to conclude.')
                        : healthStatus === 'warning'
                          ? (lang === 'id' ? `Aktivitas ${selectedCow?.nama || 'sapi'} terdeteksi menurun drastis atau suhu tinggi. Disarankan pemeriksaan.` : `${selectedCow?.nama || 'Cow'}'s activity dropped significantly or temperature is high. Inspection recommended.`)
                          : (lang === 'id' ? `Aktivitas dan suhu ${selectedCow?.nama || 'sapi'} dalam rentang normal.` : `${selectedCow?.nama || 'Cow'}'s activity and temperature are within normal range.`)}
                    </p>
                  </div>
                </div>
                <button
                  disabled={healthStatus !== 'warning'}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: healthStatus === 'warning' ? 'var(--red, #EF4444)' : 'var(--bg-surface)',
                    color: healthStatus === 'warning' ? '#fff' : 'var(--text-3)',
                    border: '0.5px solid var(--border)',
                    cursor: healthStatus === 'warning' ? 'pointer' : 'not-allowed',
                    opacity: healthStatus === 'warning' ? 1 : 0.5,
                  }}
                >
                  <Stethoscope className="w-4 h-4" />
                  {lang === 'id' ? 'Lapor Sakit' : 'Report Sick'}
                </button>
              </div>

              {/* Telemetry Line Chart */}
              <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '24px' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <h3 className="text-lg font-semibold text-[var(--text-1)] font-display">{t.sensor_chart_telemetry || "Suhu & Aktivitas"}</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Legends */}
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[var(--color-warning)]"></span>
                        <span className="text-[var(--text-2)]">{t.sensor_chart_temp || "Suhu"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[var(--color-forest)]"></span>
                        <span className="text-[var(--text-2)]">{t.sensor_chart_activity || "Aktivitas"}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-full h-[220px] md:h-[280px]" style={{ minWidth: 0 }}>
                  {telemetryData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <Activity className="w-10 h-10 text-[var(--text-3)] mb-2" />
                      <p className="text-sm font-medium text-[var(--text-2)]">{lang === 'id' ? 'Belum ada rekaman telemetry untuk grafik' : 'No telemetry records for chart yet'}</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={telemetryData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-sage-light)" opacity={0.3} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} domain={[35, 42]} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: '0.5px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-dropdown)' }}
                          labelStyle={{ fontWeight: 'bold', color: 'var(--text-1)' }}
                        />
                        <Line yAxisId="left" type="monotone" dataKey="temp" stroke="var(--color-warning)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={true} />
                        <Line yAxisId="right" type="monotone" dataKey="activity" stroke="var(--color-forest)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={true} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Behavior Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Pie Chart */}
                <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '24px' }} className="lg:col-span-4">
                  <h2 className="text-lg font-semibold text-[var(--text-1)] font-display mb-4">{t.behavior_pie_title || "Distribusi Aktivitas"}</h2>
                  <div className="h-[220px]">
                    {localizedPieData.length === 0 || localizedPieData.every(item => item.value === 0) ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <Activity className="w-8 h-8 text-[var(--text-3)] mb-2" />
                        <p className="text-sm font-medium text-[var(--text-2)]">{t.behavior_pie_empty || "Tidak ada data sensor hari ini"}</p>
                        <p className="text-xs text-[var(--text-3)] mt-1">{lang === 'id' ? 'Pasangkan collar sensor pada sapi untuk melihat data.' : 'Pair a sensor collar to see activity data.'}</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={localizedPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                          >
                            {localizedPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  {/* Legend */}
                  <div className="space-y-2.5 mt-4">
                    {localizedPieData.map(item => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                          <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: item.value > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                          {item.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bar Chart */}
                <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '24px' }} className="lg:col-span-8 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-[var(--text-1)] font-display">{t.behavior_bar_title || "Komparasi Perilaku"}</h2>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '0.5px solid var(--border)' }}>
                      {lang === 'id' ? '7 hari terakhir' : 'Last 7 days'}
                    </span>
                  </div>
                  <div className="flex-1 min-h-[300px]">
                    {localizedWeeklyData.length === 0 || localizedWeeklyData.every(item => item.aktif === 0 && item.makan === 0 && item.istirahat === 0) ? (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-4">
                        <Activity className="w-8 h-8 text-[var(--text-3)] mb-2" />
                        <p className="text-sm font-medium text-[var(--text-2)]">{t.behavior_bar_empty || "Belum ada data sensor mingguan"}</p>
                        <p className="text-xs text-[var(--text-3)] mt-1">{lang === 'id' ? 'Data aktivitas akan muncul setelah collar aktif mengirim data selama beberapa hari.' : 'Activity data will appear after active collars send data for a few days.'}</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={localizedWeeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} tickFormatter={v => `${v}%`} />
                          <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--bg-hover)', opacity: 0.5 }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: 'var(--text-2)' }} />
                          <Bar dataKey="aktif"    name={t.behavior_legend_active}  stackId="a" fill="var(--color-gold, #C9963A)" radius={[0, 0, 4, 4]} />
                          <Bar dataKey="makan"    name={t.behavior_legend_eating}  stackId="a" fill="var(--color-forest, #2D4A3E)" />
                          <Bar dataKey="istirahat" name={t.behavior_legend_resting} stackId="a" fill="var(--color-sage, #7A9E8E)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
    </div>
  );
}
