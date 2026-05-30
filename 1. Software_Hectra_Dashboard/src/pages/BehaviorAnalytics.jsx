import { useState, useEffect } from 'react';
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
  Legend
} from 'recharts';
import { Activity, Info, Loader2 } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

export default function BehaviorAnalytics() {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const [loading, setLoading] = useState(true);
  const [selectedCow, setSelectedCow] = useState('all');
  const [cows, setCows] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);

  // Fetch cows list
  useEffect(() => {
    const fetchCows = async () => {
      try {
        const res = await axiosInstance.get('/hewan');
        setCows(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Gagal fetch data sapi:', err);
        toast.error(lang === 'id' ? 'Gagal memuat daftar sapi.' : 'Failed to load cattle list.');
      }
    };
    fetchCows();
  }, [lang]);

  // Fetch behavior data when selected cow changes
  useEffect(() => {
    const fetchBehavior = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/behavior?cow_id=${selectedCow}`);
        setPieData(res.data.pie_data || []);
        setWeeklyData(res.data.weekly_data || []);
      } catch (err) {
        console.error('Gagal fetch behavior:', err);
        toast.error(lang === 'id' ? 'Gagal memuat data perilaku.' : 'Failed to load behavior analytics data.');
      } finally {
        setLoading(false);
      }
    };
    fetchBehavior();
  }, [selectedCow, lang]);

  // Translate raw activity state names from backend to clear UI labels
  const translateActivity = (name) => {
    if (!name) return t.behavior_legend_other;
    const key = name.toLowerCase();
    // Active / high movement / estrus (collar uses ESTRUS state for high activity)
    if (key.includes('aktif') || key.includes('estrus') || key.includes('active') || key === 'active') return t.behavior_legend_active;
    // Eating & ruminating
    if (key.includes('makan') || key.includes('ruminating') || key.includes('eating') || key.includes('ruminasi')) return t.behavior_legend_eating;
    // Resting / sleeping
    if (key.includes('istirahat') || key.includes('resting') || key.includes('sleeping') || key.includes('tidur')) return t.behavior_legend_resting;
    // Unknown / other / unclassified
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

  // Custom tooltip for pie chart
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

  // Custom tooltip for bar chart
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

  if (loading && cows.length === 0) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-[var(--bg-hover)] rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[400px] bg-[var(--bg-hover)] rounded-2xl"></div>
          <div className="h-[400px] bg-[var(--bg-hover)] rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--text-1)]">{t.behavior_title}</h1>
          <p className="text-[var(--text-2)] mt-1 text-sm">{t.behavior_sub}</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-gold)]" />}
          <select
            value={selectedCow}
            onChange={(e) => setSelectedCow(e.target.value)}
            style={{
              padding: '8px 16px',
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              color: 'var(--text-1)',
              outline: 'none',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            <option value="all" style={{ background: 'var(--bg-card)', color: 'var(--text-1)' }}>
              {t.behavior_filter_all}
            </option>
            {cows.map(cow => (
              <option key={cow.cow_id} value={cow.cow_id} style={{ background: 'var(--bg-card)', color: 'var(--text-1)' }}>
                {cow.nama || (lang === 'id' ? 'Sapi' : 'Cattle')} ({cow.cow_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* INFO NOTE — sensor classification context */}
      <div style={{ background: 'var(--blue-dim, rgba(59,130,246,0.08))', border: '0.5px solid var(--blue, #3b82f6)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <Info style={{ width: 15, height: 15, color: 'var(--blue, #3b82f6)', flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: '12px', color: 'var(--blue, #3b82f6)', lineHeight: 1.6 }}>
          {t.behavior_note}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* PIE CHART */}
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '24px' }} className="lg:col-span-4">
          <h2 className="text-lg font-semibold text-[var(--text-1)] font-display mb-4">{t.behavior_pie_title}</h2>

          <div className="h-[220px]">
            {localizedPieData.length === 0 || localizedPieData.every(item => item.value === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Activity className="w-8 h-8 text-[var(--text-3)] mb-2" />
                <p className="text-sm font-medium text-[var(--text-2)]">{t.behavior_pie_empty}</p>
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

        {/* BAR CHART */}
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '24px' }} className="lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-[var(--text-1)] font-display">{t.behavior_bar_title}</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-card)', padding: '3px 8px', borderRadius: '6px', border: '0.5px solid var(--border)' }}>
              {lang === 'id' ? '7 hari terakhir' : 'Last 7 days'}
            </span>
          </div>

          <div className="flex-1 min-h-[300px]">
            {localizedWeeklyData.length === 0 || localizedWeeklyData.every(item => item.aktif === 0 && item.makan === 0 && item.istirahat === 0) ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-4">
                <Activity className="w-8 h-8 text-[var(--text-3)] mb-2" />
                <p className="text-sm font-medium text-[var(--text-2)]">{t.behavior_bar_empty}</p>
                <p className="text-xs text-[var(--text-3)] mt-1">{lang === 'id' ? 'Data aktivitas akan muncul setelah collar aktif mengirim data selama beberapa hari.' : 'Activity data will appear after active collars send data for a few days.'}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={localizedWeeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--bg-hover)', opacity: 0.5 }} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: 'var(--text-2)' }}
                  />
                  <Bar dataKey="aktif"    name={t.behavior_legend_active}  stackId="a" fill="var(--color-gold, #C9963A)" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="makan"    name={t.behavior_legend_eating}  stackId="a" fill="var(--color-forest, #2D4A3E)" />
                  <Bar dataKey="istirahat" name={t.behavior_legend_resting} stackId="a" fill="var(--color-sage, #7A9E8E)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
