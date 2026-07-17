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
  Line,
  ReferenceArea
} from 'recharts';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import { handleError } from '@/lib/errorHandler';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

export default function CowAnalyticsView({ selectedCow }) {
  const { lang } = useSettingsStore();
  const t = translations[lang] || translations.id;

  // Zoom States
  const [refAreaLeft, setRefAreaLeft] = useState('');
  const [refAreaRight, setRefAreaRight] = useState('');
  const [zoomData, setZoomData] = useState(null);

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

        let behaviorRes = null;
        let telemetryRes = null;

        if (selectedCow.collar_id) {
          telemetryRes = await axiosInstance.get(`/sensor-data?collar_id=${selectedCow.collar_id}&limit=${limit}`);
        } else {
          telemetryRes = { data: [] }; // Mock empty data
        }
        
        const telemetryPayload = Array.isArray(telemetryRes?.data) ? telemetryRes.data : (telemetryRes?.data?.data || []);
        
        // CLIENT-SIDE TIME FILTER
        const now = new Date();
        let cutoffTime = new Date();
        if (timeFilter === '1hr') cutoffTime.setDate(now.getDate() - 1);
        else if (timeFilter === '1wk' || timeFilter === '1mg') cutoffTime.setDate(now.getDate() - 7);
        else if (timeFilter === '1bln') cutoffTime.setMonth(now.getMonth() - 1);
        else if (timeFilter === '3bln') cutoffTime.setMonth(now.getMonth() - 3);
        else if (timeFilter === '6bln') cutoffTime.setMonth(now.getMonth() - 6);
        else if (timeFilter === '1th') cutoffTime.setFullYear(now.getFullYear() - 1);
        
        const filteredTelemetry = telemetryPayload.filter(d => {
          if (!d.batch_ts && !d.created_at) return false;
          const ts = new Date(d.batch_ts || d.created_at);
          return ts >= cutoffTime;
        });

        // 1. Line Chart Data
        const sortedTelemetry = [...filteredTelemetry].reverse();
        const formattedChart = sortedTelemetry.map(d => {
          const ts = new Date(d.batch_ts || d.created_at);
          const timeStr = ts.toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' });
          const dateStr = ts.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'short', day: 'numeric' });
          return {
            time: timeFilter === '1hr' ? timeStr : `${dateStr} ${timeStr}`,
            temp: d.temperature !== null ? parseFloat(d.temperature.toFixed(1)) : null,
            activity: d.max_z !== null ? Math.round(d.max_z * 30) : 0
          };
        });
        setTelemetryData(formattedChart);
        setZoomData(null); // Reset zoom on new data

        // 2. Pie Chart Data (Dynamic from filtered telemetry)
        const counts = { EATING: 0, RUMINATING: 0, RESTING: 0, ESTRUS: 0, SICK: 0, UNKNOWN: 0 };
        filteredTelemetry.forEach(d => {
          const state = d.activity_state || 'UNKNOWN';
          if (counts[state] !== undefined) counts[state]++;
          else counts.UNKNOWN++;
        });
        const totalPie = Object.values(counts).reduce((a, b) => a + b, 0);
        const pct = (val) => totalPie > 0 ? Math.round((val / totalPie) * 100) : 0;
        
        const makanVal = pct(counts.EATING + counts.RUMINATING);
        const istirahatVal = pct(counts.RESTING);
        const aktifVal = pct(counts.ESTRUS);
        const lainnyaVal = pct(counts.SICK + counts.UNKNOWN);
        
        setPieData([
          { name: 'Makan / Memamah Biak', value: makanVal, color: '#2D4A3E' },
          { name: 'Istirahat / Tidur', value: istirahatVal, color: '#7A9E8E' },
          { name: 'Aktif / Estrus', value: aktifVal, color: '#C9963A' },
          { name: 'Aktivitas Lainnya', value: lainnyaVal, color: '#A8C5B8' }
        ]);

        // 3. Bar Chart Data (Dynamic grouping by day)
        const dailyStats = {};
        filteredTelemetry.forEach(d => {
          const ts = new Date(d.batch_ts || d.created_at);
          const dtStr = ts.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short' });
          if (!dailyStats[dtStr]) {
            dailyStats[dtStr] = { day: dtStr, ESTRUS: 0, EATING: 0, RUMINATING: 0, RESTING: 0, SICK: 0, UNKNOWN: 0, total: 0 };
          }
          const state = d.activity_state || 'UNKNOWN';
          if (dailyStats[dtStr][state] !== undefined) dailyStats[dtStr][state]++;
          else dailyStats[dtStr].UNKNOWN++;
          dailyStats[dtStr].total++;
        });
        
        const wData = Object.values(dailyStats).reverse().map(st => {
          const tDay = st.total;
          return {
            day: st.day,
            aktif: tDay > 0 ? Math.round((st.ESTRUS / tDay) * 100) : 0,
            makan: tDay > 0 ? Math.round(((st.EATING + st.RUMINATING) / tDay) * 100) : 0,
            istirahat: tDay > 0 ? Math.round((st.RESTING / tDay) * 100) : 0,
            lainnya: tDay > 0 ? Math.round(((st.SICK + st.UNKNOWN) / tDay) * 100) : 0
          };
        });
        setWeeklyData(wData);

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
        handleError(err, 'muat analitik ternak');
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

  const zoom = () => {
    if (refAreaLeft === refAreaRight || refAreaRight === '') {
      setRefAreaLeft('');
      setRefAreaRight('');
      return;
    }

    const dataToUse = zoomData || telemetryData;
    let index1 = dataToUse.findIndex((d) => d.time === refAreaLeft);
    let index2 = dataToUse.findIndex((d) => d.time === refAreaRight);
    
    if (index1 === -1 || index2 === -1) {
      setRefAreaLeft('');
      setRefAreaRight('');
      return;
    }

    if (index1 > index2) {
      [index1, index2] = [index2, index1];
    }
    
    const newZoomData = dataToUse.slice(index1, index2 + 1);
    setZoomData(newZoomData);
    setRefAreaLeft('');
    setRefAreaRight('');
  };

  const zoomOut = () => {
    setZoomData(null);
  };

  const getTimeFilterText = (tf) => {
    if (tf === '1hr') return lang === 'id' ? '24 Jam Terakhir' : 'Last 24 Hours';
    if (tf === '1wk' || tf === '1mg') return lang === 'id' ? '7 Hari Terakhir' : 'Last 7 Days';
    if (tf === '1bln') return lang === 'id' ? '30 Hari Terakhir' : 'Last 30 Days';
    if (tf === '3bln') return lang === 'id' ? '3 Bulan Terakhir' : 'Last 3 Months';
    if (tf === '6bln') return lang === 'id' ? '6 Bulan Terakhir' : 'Last 6 Months';
    if (tf === '1th') return lang === 'id' ? '1 Tahun Terakhir' : 'Last 1 Year';
    return '';
  };

  const localizedWeeklyData = weeklyData.map(item => ({
    ...item
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      {/* Time Filter Pill Bar (Always visible) */}
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
              disabled={loading}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                background: timeFilter === opt.key ? 'var(--color-primary)' : 'var(--bg-surface)',
                color: timeFilter === opt.key ? '#fff' : 'var(--text-2)',
                border: timeFilter === opt.key ? 'none' : '0.5px solid var(--border)',
              }}
            >
              {opt.label}
              {loading && timeFilter === opt.key && <Loader2 size={12} className="inline ml-1 animate-spin" />}
            </button>
          ))}
        </div>
      </div>

      <div className="transition-opacity duration-300 opacity-100 flex flex-col gap-6">
        {/* Health Summary Card */}

              <div style={{
                background: healthStatus === 'warning' ? 'var(--red-dim, #FFF1F1)' : 'var(--bg-card)',
                border: `0.5px solid ${healthStatus === 'warning' ? 'var(--red, #EF4444)' : 'var(--border)'}`,
                borderRadius: '16px',
                padding: '16px 18px',
                boxShadow: 'var(--shadow-card)',
              }} className="flex items-center justify-between gap-4">
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
                      {zoomData && (
                        <button 
                          onClick={zoomOut}
                          className="px-3 py-1 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-1)] border border-[var(--border)] rounded-md font-medium transition-colors"
                        >
                          {lang === 'id' ? 'Tampilkan Semua' : 'Zoom Out'}
                        </button>
                      )}
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
                  {loading ? (
                    <div className="w-full h-full bg-[var(--bg-surface)] animate-pulse rounded-xl" />
                  ) : telemetryData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <Activity className="w-10 h-10 text-[var(--text-3)] mb-2" />
                      <p className="text-sm font-medium text-[var(--text-2)]">{lang === 'id' ? 'Belum ada rekaman telemetry untuk grafik' : 'No telemetry records for chart yet'}</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={zoomData || telemetryData} 
                        margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                        onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                        onMouseMove={(e) => e && refAreaLeft && setRefAreaRight(e.activeLabel)}
                        onMouseUp={zoom}
                        onTouchStart={(e) => e && setRefAreaLeft(e.activeLabel)}
                        onTouchMove={(e) => e && refAreaLeft && setRefAreaRight(e.activeLabel)}
                        onTouchEnd={zoom}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-sage-light)" opacity={0.3} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} domain={['auto', 'auto']} label={{ value: lang === 'id' ? 'Suhu (°C)' : 'Temp (°C)', angle: -90, position: 'insideLeft', offset: -10, fill: 'var(--text-3)', fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} label={{ value: lang === 'id' ? 'Tingkat Aktivitas' : 'Activity Level', angle: 90, position: 'insideRight', offset: -10, fill: 'var(--text-3)', fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: '0.5px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-dropdown)' }}
                          labelStyle={{ fontWeight: 'bold', color: 'var(--text-1)' }}
                        />
                        <Line isAnimationActive={false} yAxisId="left" type="monotone" dataKey="temp" name={lang === 'id' ? 'Suhu' : 'Temp'} stroke="var(--color-warning)" strokeWidth={2} dot={(zoomData || telemetryData).length < 50 ? { fill: 'var(--color-warning)', r: 3, strokeWidth: 1, stroke: '#fff' } : false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={true} />
                        <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="activity" name={lang === 'id' ? 'Aktivitas' : 'Activity'} stroke="var(--color-forest)" strokeWidth={2} dot={(zoomData || telemetryData).length < 50 ? { fill: 'var(--color-forest)', r: 3, strokeWidth: 1, stroke: '#fff' } : false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={true} />
                        {refAreaLeft && refAreaRight ? (
                          <ReferenceArea yAxisId="left" x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--color-primary)" fillOpacity={0.1} />
                        ) : null}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Behavior Charts Grid */}
              <div className="grid grid-cols-1 gap-6">
                {/* Bar Chart */}
                <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '24px' }} className="flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-[var(--text-1)] font-display">{lang === 'id' ? 'Komparasi Perilaku' : 'Behavior Comparison'}</h2>
                    {getTimeFilterText(timeFilter) && (
                      <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '0.5px solid var(--border)' }}>
                        {getTimeFilterText(timeFilter)}
                      </span>
                    )}
                  </div>
                  <div className="h-[300px]">
                    {loading ? (
                      <div className="w-full h-full bg-[var(--bg-surface)] animate-pulse rounded-xl" />
                    ) : localizedWeeklyData.length === 0 || localizedWeeklyData.every(item => item.aktif === 0 && item.makan === 0 && item.istirahat === 0 && item.lainnya === 0) ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <Activity className="w-8 h-8 text-[var(--text-3)] mb-2" />
                        <p className="text-sm font-medium text-[var(--text-2)]">{lang === 'id' ? 'Belum ada data pada periode ini' : 'No data in this period'}</p>
                        <p className="text-xs text-[var(--text-3)] mt-1">{lang === 'id' ? 'Data aktivitas akan muncul jika ada rekaman sensor.' : 'Activity data will appear if sensor records exist.'}</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={localizedWeeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-3)' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
                          <Tooltip cursor={{ fill: 'var(--bg-surface)' }} contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-dropdown)', padding: '12px' }} />
                          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                          <Bar name={lang === 'id' ? 'Makan' : 'Eating'} dataKey="makan" stackId="a" fill="#2D4A3E" radius={[0, 0, 4, 4]} />
                          <Bar name={lang === 'id' ? 'Istirahat' : 'Resting'} dataKey="istirahat" stackId="a" fill="#7A9E8E" />
                          <Bar name={lang === 'id' ? 'Aktif' : 'Active'} dataKey="aktif" stackId="a" fill="#C9963A" />
                          <Bar name={lang === 'id' ? 'Lainnya' : 'Other'} dataKey="lainnya" stackId="a" fill="#A8C5B8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
      </div>
    </div>
  );
}
