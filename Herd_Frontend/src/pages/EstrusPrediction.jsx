import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Wand2,
  BrainCircuit,
  Search,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  Loader2,
  RefreshCw,
  Target,
  FlaskConical,
  Layers,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { handleError } from '@/lib/errorHandler';
import { cn } from '@/lib/utils';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyPrediction(pred, t) {
  const conf  = pred.confidence_final ?? 0;
  const inWin = pred.in_window_now;
  const days  = pred.days_until;

  if (inWin && conf >= 0.75) {
    return { type: 'estrus', label: t.prediction_filter_estrus,   color: 'red'   };
  } else if (inWin || (days >= 0 && days <= 3 && conf >= 0.6)) {
    return { type: 'pre-estrus', label: t.prediction_filter_approaching, color: 'amber' };
  } else if (conf < 0.4 && !inWin) {
    return { type: 'normal', label: t.prediction_filter_normal,               color: 'green' };
  }
  return { type: 'upcoming', label: t.status_scheduled, color: 'blue'  };
}

function colorSchemeFor(type) {
  const map = {
    estrus:     { bg: 'var(--red-dim)',    border: 'var(--red)',    text: 'var(--red)',    bar: 'var(--red)'    },
    'pre-estrus':{ bg: 'var(--amber-dim)', border: 'var(--amber)',  text: 'var(--amber)',  bar: 'var(--amber)'  },
    normal:     { bg: 'var(--accent-dim)', border: 'var(--accent)', text: 'var(--accent)', bar: 'var(--accent)' },
    upcoming:   { bg: 'var(--blue-dim)',   border: 'var(--blue)',   text: 'var(--blue)',   bar: 'var(--blue)'   },
  };
  return map[type] || map.upcoming;
}

function fmtDate(dateStr, lang) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDays(days, t) {
  if (days === null || days === undefined) return '—';
  if (days < 0) return `${Math.abs(days)} ${t.prediction_card_days_ago}`;
  if (days === 0) return t.prediction_card_today;
  if (days === 1) return t.prediction_card_tomorrow;
  return `${days} ${t.prediction_card_days_left}`;
}

function methodBadge(metode, t) {
  const map = {
    calendar_only:      { label: t.prediction_method_calendar,          icon: CalendarClock, color: 'var(--blue)'  },
    'calendar+sensor':  { label: t.prediction_method_sensor, icon: Layers,        color: 'var(--amber)' },
    'calendar+ml':      { label: t.prediction_method_ml,     icon: TrendingUp,    color: 'var(--accent)'},
    full_hybrid:        { label: t.prediction_method_hybrid,    icon: FlaskConical,  color: 'var(--red)'   },
  };
  return map[metode] || { label: metode || 'AI', icon: BrainCircuit, color: 'var(--text-3)' };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EstrusPrediction() {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const location = useLocation();
  const [loading,      setLoading]      = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictions,  setPredictions]  = useState([]);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab,    setActiveTab]    = useState('aktif'); // 'aktif' | 'konfirmasi'
  const [calDate,      setCalDate]      = useState(new Date());
  const [selectedCalDate, setSelectedCalDate] = useState(null);
  const [hoveredCalDate, setHoveredCalDate] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => {
       if (selectedCalDate) setSelectedCalDate(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [selectedCalDate]);

  // ─ Fetch predictions ──────────────────────────────────────────────────────
  const fetchPredictions = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await axiosInstance.get('/estrus-predictions?status=all&limit=100');
      const data = Array.isArray(res.data) ? res.data : [];
      // Sort data by highest probability
      data.sort((a, b) => {
        return (b.confidence_final || 0.8) - (a.confidence_final || 0.8);
      });
      setPredictions(data);
    } catch (err) {
      console.error('Gagal fetch prediksi:', err);
      toast.error(lang === 'id' ? 'Gagal memuat data prediksi estrus.' : 'Failed to load estrus prediction data.');
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchPredictions();
  }, [fetchPredictions]);
  const [predictStage, setPredictStage] = useState('');

  // ─ Run prediction engine ──────────────────────────────────────────────────
  const handleRunPredict = async () => {
    setIsPredicting(true);
    setPredictStage(lang === 'id' ? 'Menghubungkan ke Model AI...' : 'Connecting to AI Model...');
    try {
      await new Promise(r => setTimeout(r, 1500));
      setPredictStage(lang === 'id' ? 'Menganalisis Sensor Akselerometer...' : 'Analyzing Accelerometer Sensor...');
      await new Promise(r => setTimeout(r, 2000));
      setPredictStage(lang === 'id' ? 'Menghitung Probabilitas Estrus...' : 'Calculating Estrus Probability...');
      await new Promise(r => setTimeout(r, 1500));
      setPredictStage(lang === 'id' ? 'Menyinkronkan Hasil...' : 'Syncing Results...');

      const res = await axiosInstance.post('/estrus-predictions/run');
      const { processed, errors } = res.data || {};
      if (errors > 0) {
        toast.error(lang === 'id' 
          ? `Selesai: ${processed} berhasil, ${errors} gagal.` 
          : `Completed: ${processed} succeeded, ${errors} failed.`);
      } else {
        toast.success(lang === 'id' 
          ? `Prediksi selesai! ${processed} sapi dianalisis.` 
          : `Prediction completed! ${processed} cows analyzed.`);
      }
      await fetchPredictions(false);
    } catch (err) {
      handleError(err, 'jalankan prediksi estrus');
    } finally {
      setIsPredicting(false);
      setPredictStage('');
    }
  };

  useEffect(() => {
    if (location.state?.runPredict) {
      handleRunPredict();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // ─ Filter & search ────────────────────────────────────────────────────────
  const unverified = predictions.filter(p => p.verified === null || p.verified === undefined);
  const nowMs = new Date().getTime();

  // Active if optimal IB is in the future or within the last 24h
  const activeListRaw = unverified.filter(p => {
    if (!p.prediksi_ib_optimal) return true;
    return new Date(p.prediksi_ib_optimal).getTime() > nowMs - 24 * 3600000;
  });

  // Needs confirmation if optimal IB is older than 24h ago
  const konfirmasiListRaw = unverified.filter(p => {
    if (!p.prediksi_ib_optimal) return false;
    return new Date(p.prediksi_ib_optimal).getTime() <= nowMs - 24 * 3600000;
  });

  const filteredActive = activeListRaw.filter(p => {
    const cl  = classifyPrediction(p, t);
    const matchStatus = statusFilter === 'all' || cl.type === statusFilter;
    const matchSearch = !search || (p.cow_name || p.cow_id || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredKonfirmasi = konfirmasiListRaw.filter(p => {
    const matchSearch = !search || (p.cow_name || p.cow_id || '').toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const currentDisplayList = activeTab === 'aktif' ? filteredActive : filteredKonfirmasi;

  // ─ Calendar Navigation ────────────────────────────────────────────────────
  const prevMonth = () => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1));
  const nextMonth = () => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1));

  // ─ Stats cards ────────────────────────────────────────────────────────────
  const countByType = (type) => activeListRaw.filter(p => classifyPrediction(p, t).type === type).length;
  const inWindowNow = activeListRaw.filter(p => p.in_window_now).length;

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-[var(--bg-hover)] rounded w-1/3 mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-[var(--bg-hover)] rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-[320px] bg-[var(--bg-hover)] rounded-2xl" />
          <div className="lg:col-span-2 h-[500px] bg-[var(--bg-hover)] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 lg:pb-8 overflow-x-hidden">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div 
        className="rounded-t-none rounded-b-[40px] md:rounded-[40px] md:mt-4 px-6 md:pt-8 pb-[56px] shadow-sm relative overflow-hidden mb-6 text-white flex flex-col justify-between -mx-4 md:mx-0"
        style={{ 
          paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
          background: 'linear-gradient(135deg, #be123c 0%, #881337 100%)' 
        }}
      >
        {/* Subtle Background Accent */}
        <Target 
          size={320} 
          strokeWidth={0.8} 
          className="absolute -right-12 text-white opacity-[0.08] rotate-12 pointer-events-none" 
          style={{ top: 'calc(env(safe-area-inset-top) - 2rem)' }}
        />

        <div className="flex flex-col sm:flex-row sm:items-stretch justify-between gap-4 relative z-10 min-h-[80px]">
          <div>
            <p className="text-[10px] md:text-[12px] font-black opacity-90 mb-1 uppercase tracking-widest text-rose-200">
              {lang === 'id' ? 'PEMANTAUAN MASA SUBUR & REPRODUKSI' : 'FERTILITY & REPRODUCTION MONITORING'}
            </p>
            <h1 className="text-[32px] md:text-[36px] font-black tracking-tight leading-none">
              {t.prediction_title}
            </h1>
            <p className="text-rose-100 mt-2 font-medium">{t.prediction_sub}</p>
          </div>
          <button 
            onClick={handleRunPredict}
            disabled={isPredicting}
            className="flex items-center justify-center gap-3 px-6 py-3 md:py-0 bg-white/20 border border-white/30 text-white font-bold rounded-2xl hover:bg-white/30 transition-all shadow-sm backdrop-blur-md self-stretch min-w-[200px] group"
          >
            <RefreshCw size={20} className={isPredicting ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
            <div className="text-left flex flex-col">
              <span className="text-[14px] leading-tight">{isPredicting ? (predictStage || t.prediction_run_analyzing) : t.prediction_run_btn}</span>
              <span className="text-[10px] font-normal opacity-80 leading-tight tracking-wide mt-1">
                {lang === 'id' ? 'Terakhir: Baru saja' : 'Last sync: Just now'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ── STAT SUMMARY CARDS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sapi Dalam Pemantauan */}
        <div className="bg-white border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col">
          <p className="text-[12px] font-bold text-[var(--text-2)] mb-3">{lang === 'id' ? 'Sapi Dalam Pemantauan' : 'Cows Monitored'}</p>
          <p className="text-[28px] font-black text-[var(--text-1)] leading-none mb-2">{new Set(predictions.map(p => p.cow_id)).size}</p>
          <p className="text-[10px] font-medium text-[var(--text-3)]">{lang === 'id' ? 'Terhubung sensor' : 'Sensors Connected'}</p>
        </div>

        {/* Card 2: Terdeteksi Birahi */}
        <div className="bg-white border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col">
          <p className="text-[12px] font-bold text-[var(--text-2)] mb-3">{lang === 'id' ? 'Terdeteksi Birahi' : 'Estrus Detected'}</p>
          <p className="text-[28px] font-black text-[var(--text-1)] leading-none mb-2">{countByType('estrus')}</p>
          <p className="text-[10px] font-medium text-[var(--text-3)]">{lang === 'id' ? 'Hari ini' : 'Today'}</p>
        </div>

        {/* Card 3: Akurasi Sistem */}
        <div className="bg-white border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col">
          <p className="text-[12px] font-bold text-[var(--text-2)] mb-3">{lang === 'id' ? 'Akurasi Sistem' : 'System Accuracy'}</p>
          <p className="text-[28px] font-black text-[var(--text-1)] leading-none mb-2">
            {predictions.some(p => p.verified !== null && p.verified !== undefined) ? 
              `${Math.round((predictions.filter(p => p.verified === true).length / predictions.filter(p => p.verified !== null && p.verified !== undefined).length) * 100)}%` 
              : '-'}
          </p>
          <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
            {lang === 'id' ? 'Berdasarkan konfirmasi' : 'Based on confirmation'}
          </p>
        </div>

        {/* Card 4: Rata-rata Siklus */}
        <div className="bg-white border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col">
          <p className="text-[12px] font-bold text-[var(--text-2)] mb-3">{lang === 'id' ? 'Rata-rata Siklus' : 'Average Cycle'}</p>
          <div className="flex items-baseline gap-1 mb-2">
            <p className="text-[28px] font-black text-[var(--text-1)] leading-none">
              {predictions.some(p => p.cycle_length) ? 
                (predictions.filter(p => p.cycle_length).reduce((a, b) => a + b.cycle_length, 0) / predictions.filter(p => p.cycle_length).length).toFixed(1) 
                : '-'}
            </p>
            <span className="text-[14px] font-bold text-[var(--text-1)]">{lang === 'id' ? 'Hari' : 'Days'}</span>
          </div>
          <p className="text-[10px] font-medium text-[var(--text-3)]">{lang === 'id' ? 'Riwayat data estrus' : 'Estrus data history'}</p>
        </div>
      </div>

      {/* ── MAIN GRID ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT PANEL: System Status */}
        <div className="lg:col-span-1">
          <div style={{ background: 'var(--bg-surface)', borderRadius: '20px', boxShadow: 'var(--shadow-card)', padding: '24px', border: '0.5px solid var(--border)', position: 'sticky', top: '24px' }}>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div style={{ background: 'var(--blue)', color: '#fff', width: 40, height: 40, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--text-1)] font-display">{lang === 'id' ? 'Kalender Prediksi Birahi' : 'Estrus Prediction Calendar'}</h2>
                <p className="text-xs text-[var(--text-2)]">{lang === 'id' ? 'Jadwal Pemantauan' : 'Monitoring Schedule'}</p>
              </div>
            </div>

            {/* Simple CSS Calendar */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 rounded-xl">
               <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-[var(--text-1)] capitalize">
                     {calDate.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <div className="flex gap-2">
                     <button onClick={prevMonth} className="w-6 h-6 rounded-md bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-3)] text-xs hover:bg-[var(--border)] transition-colors">{'<'}</button>
                     <button onClick={nextMonth} className="w-6 h-6 rounded-md bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-3)] text-xs hover:bg-[var(--border)] transition-colors">{'>'}</button>
                  </div>
               </div>
               
               <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['M','T','W','T','F','S','S'].map(d => (
                     <div key={d} className="text-[10px] font-bold text-[var(--text-3)]">{d}</div>
                  ))}
               </div>
               <div className="grid grid-cols-7 gap-1 text-center">
                  {/* Dynamic calendar matching actual prediction data */}
                  {[...Array(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate())].map((_, i) => {
                     const dateNum = i + 1;
                     const isToday = dateNum === new Date().getDate() && calDate.getMonth() === new Date().getMonth() && calDate.getFullYear() === new Date().getFullYear();
                     
                     const hasEstrus = activeListRaw.some(p => {
                        if (!p.prediksi_ib_optimal) return false;
                        const d = new Date(p.prediksi_ib_optimal);
                        return d.getDate() === dateNum && d.getMonth() === calDate.getMonth() && d.getFullYear() === calDate.getFullYear() && classifyPrediction(p, t).type === 'estrus';
                     });
                     
                     const isApproaching = activeListRaw.some(p => {
                        if (!p.prediksi_ib_optimal) return false;
                        const d = new Date(p.prediksi_ib_optimal);
                        return d.getDate() === dateNum && d.getMonth() === calDate.getMonth() && d.getFullYear() === calDate.getFullYear() && classifyPrediction(p, t).type === 'pre-estrus';
                     });
                     
                     let bg = 'transparent';
                     let text = 'var(--text-2)';
                     let ring = 'none';

                     if (isToday) {
                        bg = 'var(--text-1)';
                        text = 'var(--bg-surface)';
                     } else if (hasEstrus) {
                        ring = '2px solid var(--red)';
                     } else if (isApproaching) {
                        bg = 'var(--amber)';
                        text = '#fff';
                     }

                     const dateObj = new Date(calDate.getFullYear(), calDate.getMonth(), dateNum);
                     const isHovered = hoveredCalDate?.getTime() === dateObj.getTime();
                     const isSelected = selectedCalDate?.getTime() === dateObj.getTime();
                     const showTooltip = (isHovered || isSelected) && (hasEstrus || isApproaching);

                     return (
                        <div 
                           key={i} 
                           className="relative flex justify-center"
                           onMouseEnter={() => setHoveredCalDate(dateObj)}
                           onMouseLeave={() => setHoveredCalDate(null)}
                           onClick={(e) => {
                             e.stopPropagation();
                             if (isSelected) setSelectedCalDate(null);
                             else setSelectedCalDate(dateObj);
                           }}
                        >
                           <div 
                              className={`text-xs font-semibold w-8 h-8 flex items-center justify-center rounded-full cursor-pointer hover:bg-[var(--bg-hover)] ${isSelected ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                              style={{ background: bg, color: text, border: ring }}
                           >
                              {i + 1}
                           </div>

                           {/* Popover / Tooltip */}
                           {showTooltip && (
                              <div 
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max min-w-[140px] max-w-[220px] bg-white/95 backdrop-blur-md border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 slide-in-from-bottom-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isSelected && (
                                   <button onClick={() => setSelectedCalDate(null)} className="absolute top-1.5 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">×</button>
                                )}
                                {(() => {
                                   const todayEvents = activeListRaw.filter(p => {
                                      if (!p.prediksi_ib_optimal) return false;
                                      const d = new Date(p.prediksi_ib_optimal);
                                      return d.getDate() === dateObj.getDate() && d.getMonth() === dateObj.getMonth() && d.getFullYear() === dateObj.getFullYear();
                                   });
                                   if (todayEvents.length === 0) return null;
                                   
                                   const grouped = {};
                                   todayEvents.forEach(p => {
                                      const c = classifyPrediction(p, t);
                                      const name = p.cow_name || p.cow_id;
                                      if (!grouped[c.label]) {
                                        grouped[c.label] = { type: c.type, names: [] };
                                      }
                                      grouped[c.label].names.push(name);
                                   });

                                   const groupEntries = Object.entries(grouped);
                                   return (
                                      <div className="flex flex-col gap-3">
                                        {groupEntries.map(([label, data], idx) => (
                                           <div key={idx} className="flex flex-col items-center text-center w-full px-2">
                                              <span className="font-extrabold text-slate-800 text-[15px] tracking-tight leading-tight mb-1.5">
                                                {data.names.join(', ')}
                                              </span>
                                              <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${data.type === 'estrus' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'bg-amber-50 text-amber-600 border border-amber-100/50'}`}>
                                                {label}
                                              </div>
                                              {idx < groupEntries.length - 1 && (
                                                <hr className="w-full mt-3 border-gray-100" />
                                              )}
                                           </div>
                                        ))}
                                      </div>
                                   )
                                })()}
                                {/* Triangle arrow pointing down */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-white drop-shadow-sm"></div>
                              </div>
                           )}
                        </div>
                     )
                  })}
               </div>
               
               <div className="mt-4 flex flex-col gap-2 pt-3 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-[var(--red)]"></div>
                     <span className="text-[11px] text-[var(--text-2)]">{lang === 'id' ? 'Siap IB' : 'Ready for AI'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-[var(--amber)]"></div>
                     <span className="text-[11px] text-[var(--text-2)]">{lang === 'id' ? 'Mendekati' : 'Approaching'}</span>
                  </div>
               </div>
               

            </div>

            {/* Info note */}
            <div style={{ marginTop: '16px', background: 'var(--bg-hover)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <CheckCircle2 style={{ width: 15, height: 15, color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                <strong>{t.prediction_note_auto}</strong> {t.prediction_note_desc}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Result Lists */}
        <div className="lg:col-span-2">
          
          {/* TABS */}
          <div className="flex items-center gap-6 border-b border-[var(--border)] mb-6">
             <button
                onClick={() => setActiveTab('aktif')}
                className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'aktif' ? 'text-[var(--text-1)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
             >
                {lang === 'id' ? 'Pemantauan Aktif' : 'Active Monitoring'}
                {activeTab === 'aktif' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--text-1)] rounded-t-full"></div>}
             </button>
             <button
                onClick={() => setActiveTab('konfirmasi')}
                className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'konfirmasi' ? 'text-[var(--text-1)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
             >
                {lang === 'id' ? 'Menunggu Konfirmasi' : 'Awaiting Confirmation'}
                {konfirmasiListRaw.length > 0 && (
                   <span className="bg-[var(--red)] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {konfirmasiListRaw.length}
                   </span>
                )}
                {activeTab === 'konfirmasi' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--text-1)] rounded-t-full"></div>}
             </button>
          </div>

          <div className="flex flex-col gap-4 mb-6 w-full">
            {/* Status Filters - Only show in Active Tab */}
            {activeTab === 'aktif' && (
              <div className="flex flex-wrap items-center gap-3 w-full">
                {[
                  { value: 'all',        label: t.prediction_filter_all },
                  { value: 'estrus',     label: lang === 'id' ? 'Birahi' : 'Estrus', dot: 'var(--red)' },
                  { value: 'pre-estrus', label: lang === 'id' ? 'Dekat' : 'Near',  dot: 'var(--amber)' },
                  { value: 'normal',     label: lang === 'id' ? 'Normal' : 'Normal', dot: 'var(--green)' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className="flex-1 sm:flex-none justify-center"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '8px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                      fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                      border: `0.5px solid ${statusFilter === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: statusFilter === opt.value ? 'var(--accent-dim)' : 'var(--bg-card)',
                      color: statusFilter === opt.value ? 'var(--accent)' : 'var(--text-2)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.dot && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: opt.dot, flexShrink: 0, display: 'inline-block' }} />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-[var(--text-3)]" />
                <input
                  type="text"
                  placeholder={t.prediction_search_placeholder}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 md:py-3 text-sm border border-[var(--border)] rounded-full outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                  style={{
                    background: 'var(--bg-card)', color: 'var(--text-1)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
              </div>
          </div>

          {/* Result List */}
          {currentDisplayList.length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
              <CheckCircle2 style={{ width: 40, height: 40, color: 'var(--text-3)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-2)', fontWeight: 600 }}>
                {activeTab === 'konfirmasi' ? (lang === 'id' ? 'Semua konfirmasi sudah diselesaikan!' : 'All confirmations completed!') : (activeListRaw.length === 0 ? t.prediction_empty_title : t.prediction_empty_filter)}
              </p>
              <p style={{ color: 'var(--text-3)', fontSize: '12px', marginTop: '4px' }}>
                {predictions.length === 0 ? t.prediction_empty_sub : t.prediction_empty_filter_sub}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentDisplayList.map(p => (
                activeTab === 'aktif' ? (
                   <PredictionCard
                     key={p.id}
                     pred={p}
                   />
                ) : (
                   <FeedbackCard
                     key={p.id}
                     pred={p}
                     onFeedbackSubmitted={() => fetchPredictions(false)}
                   />
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PredictionCard({ pred, onFeedbackSubmitted }) {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const classification = classifyPrediction(pred, t);
  const cs  = colorSchemeFor(classification.type);
  const conf = Math.round((pred.confidence_final ?? 0) * 100);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleFeedback = async (isCorrect) => {
    setSubmitting(true);
    try {
      await axiosInstance.post(`/estrus-predictions/${pred.id}/feedback`, { verified: isCorrect });
      toast.success(lang === 'id' ? 'Feedback berhasil disimpan!' : 'Feedback successfully saved!');
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    } catch (err) {
      handleError(err, 'kirim feedback estrus');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={() => {
        toast(lang === 'id' ? `Membuka profil detail ${pred.cow_name || pred.cow_id}...` : `Opening ${pred.cow_name || pred.cow_id} profile...`, { icon: '🐄' });
        navigate('/ternak', { state: { selectedCowId: pred.cow_id || pred.id, activeTab: 'estrus' } });
      }}
      style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-card)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      className="hover:shadow-lg hover:-translate-y-0.5 flex-col sm:flex-row gap-4 group"
    >
      <div className="flex items-center gap-4 flex-1 w-full">
        {/* Cow Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-1)' }}>
              {pred.cow_name || pred.cow_id}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'monospace', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '6px' }}>
              {pred.cow_id}
            </span>
            {pred.in_window_now && (
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff', background: 'var(--red)', padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.02em' }}>
                {t.prediction_card_active_window}
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
             Status: <strong style={{ color: cs.text }}>{classification.label}</strong>
             <span className="mx-2 text-[var(--border)]">|</span>
             {t.prediction_card_optimal_ib}: <strong style={{ color: 'var(--text-1)' }}>{fmtDate(pred.prediksi_ib_optimal, lang)}</strong>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
        {/* Accuracy */}
        <div className="text-left sm:text-right flex-1 sm:flex-none">
          <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            {t.prediction_card_conf_label}
          </p>
          <p style={{ fontSize: '20px', fontWeight: 900, color: cs.text, lineHeight: 1 }}>
            {conf}%
          </p>
        </div>

        {/* Chevron Navigation Indicator */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-hover)] text-[var(--text-3)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors shrink-0">
          <ChevronRight size={20} />
        </div>
      </div>
    </div>
  );
}

function FeedbackCard({ pred, onFeedbackSubmitted }) {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const conf = Math.round((pred.confidence_final ?? 0) * 100);
  const [submittingType, setSubmittingType] = useState(null);

  const handleFeedback = async (isCorrect) => {
    setSubmittingType(isCorrect ? 'true' : 'false');
    
    // Dramatic delay for UX
    await new Promise(r => setTimeout(r, 1200));

    try {
      await axiosInstance.post(`/estrus-predictions/${pred.id}/feedback`, { verified: isCorrect });
      toast.success(lang === 'id' ? 'Konfirmasi berhasil disimpan!' : 'Confirmation successfully saved!');
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    } catch (err) {
      handleError(err, 'kirim konfirmasi estrus');
    } finally {
      setSubmittingType(null);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
      }}
      className="shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-1)' }}>
              {pred.cow_name || pred.cow_id}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'monospace', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '6px' }}>
              {pred.cow_id}
            </span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.5 }}>
             {lang === 'id' ? 'Sistem memprediksi sapi ini memasuki masa estrus (siap IB) pada ' : 'System predicted this cow entered estrus (ready for AI) on '}
             <strong style={{ color: 'var(--text-1)' }}>{fmtDate(pred.prediksi_ib_optimal, lang)}</strong> 
             {lang === 'id' ? ' dengan akurasi ' : ' with confidence '}
             <strong style={{ color: 'var(--accent)' }}>{conf}%</strong>.
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 600, marginTop: '12px' }}>
             {lang === 'id' ? 'Apakah prediksi ini benar terjadi di lapangan?' : 'Did this prediction occur in the field?'}
          </p>
        </div>
        <div className="bg-[var(--bg-hover)] p-3 rounded-full shrink-0">
           <BrainCircuit size={24} className="text-[var(--accent)]" />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2">
         <button
            onClick={() => handleFeedback(true)}
            disabled={submittingType !== null}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submittingType === 'true' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {lang === 'id' ? 'Benar, Sudah' : 'Yes, Done'}
          </button>
          <button
            onClick={() => handleFeedback(false)}
            disabled={submittingType !== null}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 active:bg-rose-100 transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
             {submittingType === 'false' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : null}
            {lang === 'id' ? 'Salah, Belum' : 'No, Not Yet'}
          </button>
      </div>
    </div>
  );
}
