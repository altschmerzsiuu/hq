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
import { Brain, Activity, Droplets, Moon, Lightbulb, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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

  const translateActivity = (name) => {
    if (!name) return '';
    const key = name.toLowerCase();
    if (key.includes('aktif') || key.includes('estrus') || key.includes('active')) return t.behavior_legend_active;
    if (key.includes('makan') || key.includes('ruminating') || key.includes('eating')) return t.behavior_legend_eating;
    if (key.includes('istirahat') || key.includes('resting') || key.includes('sleeping') || key.includes('tidur')) return t.behavior_legend_resting;
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
      'Monday': lang === 'id' ? 'Senin' : 'Monday',
      'Tuesday': lang === 'id' ? 'Selasa' : 'Tuesday',
      'Wednesday': lang === 'id' ? 'Rabu' : 'Wednesday',
      'Thursday': lang === 'id' ? 'Kamis' : 'Thursday',
      'Friday': lang === 'id' ? 'Jumat' : 'Friday',
      'Saturday': lang === 'id' ? 'Sabtu' : 'Saturday',
      'Sunday': lang === 'id' ? 'Minggu' : 'Sunday',
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

  if (loading && cows.length === 0) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-[var(--color-sage-light)]/20 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[400px] bg-[var(--color-sage-light)]/20 rounded-2xl"></div>
          <div className="h-[400px] bg-[var(--color-sage-light)]/20 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)]">{t.behavior_title}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">{t.behavior_sub}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* PIE CHART (1/3 width on large screens) */}
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '24px' }} className="lg:col-span-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] font-display mb-4">{t.behavior_pie_title}</h2>

          <div className="h-[250px]">
            {localizedPieData.length === 0 || localizedPieData.every(item => item.value === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Activity className="w-8 h-8 text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t.behavior_pie_empty}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={localizedPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {localizedPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '0.5px solid var(--border)', 
                      background: 'var(--bg-card)', 
                      boxShadow: 'var(--shadow-dropdown)' 
                    }}
                    labelStyle={{ color: 'var(--color-text-primary)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-3 mt-4">
            {localizedPieData.map(item => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[var(--color-text-secondary)]">{item.name}</span>
                </div>
                <span className="font-bold text-[var(--color-text-primary)]">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* BAR CHART (2/3 width) */}
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '24px' }} className="lg:col-span-8 flex flex-col">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] font-display mb-6">{t.behavior_bar_title}</h2>

          <div className="flex-1 min-h-[300px]">
            {localizedWeeklyData.length === 0 || localizedWeeklyData.every(item => item.aktif === 0 && item.makan === 0 && item.istirahat === 0) ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-4">
                <Activity className="w-8 h-8 text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t.behavior_bar_empty}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={localizedWeeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-sage-light)" opacity={0.3} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '0.5px solid var(--border)', 
                      background: 'var(--bg-card)', 
                      boxShadow: 'var(--shadow-dropdown)' 
                    }}
                    labelStyle={{ color: 'var(--color-text-primary)' }}
                    cursor={{ fill: 'var(--color-sage-light)', opacity: 0.1 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />

                  <Bar dataKey="aktif" name={t.behavior_legend_active} stackId="a" fill="var(--color-gold)" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="makan" name={t.behavior_legend_eating} stackId="a" fill="var(--color-forest)" />
                  <Bar dataKey="istirahat" name={t.behavior_legend_resting} stackId="a" fill="var(--color-sage)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
