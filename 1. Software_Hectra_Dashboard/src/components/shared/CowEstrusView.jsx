import { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  AlertCircle,
  CalendarClock,
  Loader2,
  Wand2,
  Layers,
  TrendingUp,
  Lock,
  Target,
  Info,
  RefreshCw
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import { handleError } from '@/lib/errorHandler';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

function classifyPrediction(pred, t) {
  const conf  = pred.confidence_final ?? 0;
  const inWin = pred.in_window_now;
  const days  = pred.days_until;
  if (inWin && conf >= 0.75)                              return { type: 'estrus',     label: t.prediction_filter_estrus,       color: 'red'   };
  if (inWin || (days >= 0 && days <= 3 && conf >= 0.6))  return { type: 'pre-estrus', label: t.prediction_filter_approaching,  color: 'amber' };
  if (conf < 0.4 && !inWin)                              return { type: 'normal',     label: t.prediction_filter_normal,       color: 'green' };
  return { type: 'upcoming', label: t.status_scheduled, color: 'blue' };
}

function colorSchemeFor(type) {
  const map = {
    estrus:       { bg: 'var(--red-dim)',    border: 'var(--red)',    text: 'var(--red)',    bar: 'var(--red)'    },
    'pre-estrus': { bg: 'var(--amber-dim)', border: 'var(--amber)',  text: 'var(--amber)',  bar: 'var(--amber)'  },
    normal:       { bg: 'var(--accent-dim)', border: 'var(--accent)', text: 'var(--accent)', bar: 'var(--accent)' },
    upcoming:     { bg: 'var(--blue-dim)',   border: 'var(--blue)',   text: 'var(--blue)',   bar: 'var(--blue)'   },
  };
  return map[type] || map.upcoming;
}

function fmtDate(dateStr, lang) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDays(days, t) {
  if (days === null || days === undefined) return '—';
  if (days < 0) {
    const text = t.prediction_card_days_ago || 'hari lalu';
    const capText = text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${Math.abs(days)} ${capText}`;
  }
  if (days === 0) return t.prediction_card_today;
  if (days === 1) return t.prediction_card_tomorrow;
  return `${days} ${t.prediction_card_days_left}`;
}

export default function CowEstrusView({ selectedCow, reproHistory = [] }) {
  const { lang } = useSettingsStore();
  const t = translations[lang];

  const [loading, setLoading]       = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);

  // Locked if cow is currently pregnant
  const latestRepro = reproHistory[0] ?? null;
  const isPregnant  = latestRepro
    ? (latestRepro.results === true || latestRepro.results === 'true' || latestRepro.is_pregnant === true)
    : false;
  const isUnlocked  = !isPregnant;

  const fetchPrediction = useCallback(async () => {
    if (!selectedCow) return;
    setLoading(true);
    try {
      const cowId = selectedCow.id || selectedCow.cow_id;
      
      // MOCK DATA UNTUK ARA
      if (cowId.toUpperCase() === 'ARA') {
        setTimeout(() => {
          setPrediction({
            confidence_final: 0.85,
            in_window_now: true,
            days_until: 0,
            prediksi_ib_optimal: new Date(Date.now() + 86400000).toISOString(),
            window_awal: new Date().toISOString(),
            window_akhir: new Date(Date.now() + 172800000).toISOString()
          });
          setLoading(false);
        }, 800);
        return;
      }

      const res = await axiosInstance.get(`/estrus-predictions?cow_id=${cowId}&limit=1`);
      const data = Array.isArray(res.data) ? res.data : [];
      setPrediction(data[0] ?? null);
    } catch (err) {
      console.error('Gagal fetch estrus prediction:', err);
    } finally {
      if (selectedCow.id?.toUpperCase() !== 'ARA') setLoading(false);
    }
  }, [selectedCow]);

  useEffect(() => { if (isUnlocked) fetchPrediction(); else setLoading(false); }, [fetchPrediction, isUnlocked]);

  const handleRunPredict = async () => {
    setIsPredicting(true);
    try {
      await axiosInstance.post('/estrus-predictions/run');
      toast.success(lang === 'id' ? `Prediksi selesai!` : `Prediction done!`);
      await fetchPrediction();
    } catch (err) {
      handleError(err, 'jalankan prediksi estrus per sapi');
    } finally {
      setIsPredicting(false);
    }
  };

  // ── Locked ──────────────────────────────────────────────────────────────────
  if (!isUnlocked) {
    const estCalving = latestRepro?.tanggal_ib || latestRepro?.service_date
      ? fmtDate(new Date(new Date(latestRepro.tanggal_ib || latestRepro.service_date).getTime() + 283 * 86400000).toISOString(), lang)
      : null;
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '20px', padding: '32px', maxWidth: '340px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ background: 'var(--color-success-bg,#ECFDF5)', borderRadius: '16px', padding: '14px', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock className="w-7 h-7" style={{ color: 'var(--color-forest)' }} />
          </div>
          <p className="font-bold text-base" style={{ color: 'var(--text-1)' }}>
            {lang === 'id' ? `${selectedCow?.nama || 'Sapi'} Sedang Bunting` : `${selectedCow?.nama || 'Cow'} is Pregnant`}
          </p>
          <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-3)' }}>
            {lang === 'id'
              ? 'Prediksi Estrus tidak relevan saat sapi sedang bunting. Fitur ini akan otomatis terbuka setelah sapi melahirkan atau status berubah.'
              : 'Estrus prediction is not relevant while pregnant. This feature will unlock after calving or when status changes.'}
          </p>
          {estCalving && (
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '10px 14px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarClock className="w-4 h-4 shrink-0" style={{ color: 'var(--color-forest)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                {lang === 'id' ? 'Perkiraan Lahir: ' : 'Est. Calving: '}{estCalving}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          {lang === 'id' ? 'Memuat prediksi estrus...' : 'Loading estrus prediction...'}
        </p>
      </div>
    );
  }

  // ── Prediction display ──────────────────────────────────────────────────────
  const classification = prediction ? classifyPrediction(prediction, t) : null;
  const cs   = classification ? colorSchemeFor(classification.type) : null;
  const conf = prediction ? Math.round((prediction.confidence_final ?? 0) * 100) : 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* Run button card */}
      {prediction && (
        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '16px 18px', boxShadow: 'var(--shadow-card)' }} className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
              {lang === 'id' ? 'Analisis AI Estrus' : 'AI Estrus Analysis'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {lang === 'id' ? `Siklus estrus ${selectedCow?.nama || 'sapi'}` : `${selectedCow?.nama || 'Cow'}'s estrus cycle`}
            </p>
          </div>
          <button
            onClick={handleRunPredict}
            disabled={isPredicting}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '10px',
              background: isPredicting ? 'var(--bg-hover)' : 'var(--color-primary)', color: isPredicting ? 'var(--text-2)' : 'white'}}
          >
            {isPredicting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {lang === 'id' ? 'Proses...' : 'Processing...'}</>
              : <><RefreshCw className="w-3.5 h-3.5" /> {lang === 'id' ? 'Prediksi Ulang' : 'Repredict'}</>
            }
          </button>
        </div>
      )}

      {/* No data yet */}
      {!prediction ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-[24px] border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <BrainCircuit size={40} className="text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {lang === 'id' ? 'Belum Ada Prediksi Estrus' : 'No Estrus Prediction Yet'}
          </h3>
          <p className="text-gray-500 max-w-sm mb-8 leading-relaxed">
            {lang === 'id' ? 'Jalankan AI untuk menganalisis siklus estrus sapi ini berdasarkan data historis dan sensor.' : 'Run AI to analyze this cow\'s estrus cycle based on historical and sensor data.'}
          </p>
          <button
            onClick={handleRunPredict}
            disabled={isPredicting}
            className="group relative flex items-center gap-4 bg-white pr-6 pl-2 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-500/30 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 relative z-10">
              {isPredicting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            </div>
            <span className="text-[15px] font-bold text-gray-700 group-hover:text-blue-600 transition-colors duration-300 relative z-10">
              {isPredicting ? (lang === 'id' ? 'Memproses AI...' : 'Processing AI...') : (lang === 'id' ? 'Jalankan Prediksi AI' : 'Run AI Prediction')}
            </span>
          </button>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '0.5px solid var(--border)',
          borderRadius: '16px', boxShadow: 'var(--shadow-card)',
          padding: '20px', display: 'flex', flexDirection: 'column',
          gap: '16px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-1)' }}>
                  {lang === 'id' ? 'Hasil Prediksi Estrus' : 'Estrus Prediction Result'}
                </h3>
                {prediction.in_window_now && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', background: 'var(--red)', padding: '2px 8px', borderRadius: '20px' }}>
                    {t.prediction_card_active_window}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '4px', fontWeight: 500 }}>{classification.label}</p>
            </div>
            
            {/* Simple Confidence Pill */}
            <div 
              onClick={() => toast(lang === 'id' ? 'Info AI' : 'AI Info', { description: lang === 'id' ? 'Tingkat keyakinan prediksi AI berdasarkan riwayat data estrus dan kawin sapi.' : 'AI prediction confidence level based on estrus and breeding history.' })}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '12px', border: '0.5px solid var(--border)', flexShrink: 0, cursor: 'pointer' }}
            >
              <BrainCircuit size={14} style={{ color: cs.text }} />
              <span style={{ fontSize: '12px', fontWeight: 800, color: cs.text }}>{conf}%</span>
            </div>
          </div>

          {/* Core Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Optimal IB - Highlighted */}
            <div style={{ padding: '16px', background: cs.bg, borderRadius: '12px', border: `0.5px solid ${cs.border}`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'absolute', right: '-10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.1 }}>
                <Target size={80} color={cs.text} />
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ fontSize: '11px', color: cs.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', opacity: 0.85 }}>{t.prediction_card_optimal_ib || 'Optimal IB'}</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: cs.text }}>{fmtDate(prediction.prediksi_ib_optimal, lang)}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {/* Window */}
              <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '12px', border: '0.5px solid var(--border)' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.prediction_card_window_label || 'Window'}</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginTop: '4px', lineHeight: 1.4 }}>{fmtDate(prediction.window_awal, lang)} –<br/>{fmtDate(prediction.window_akhir, lang)}</p>
              </div>
              {/* Countdown */}
              <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: '12px', border: '0.5px solid var(--border)' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.prediction_card_countdown || 'Countdown'}</p>
                <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-1)', marginTop: '4px' }}>{fmtDays(prediction.days_until, t)}</p>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', borderTop: '0.5px solid var(--border)', paddingTop: '14px' }}>
            <AlertCircle style={{ width: 14, height: 14, color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>
              {lang === 'id'
                ? 'Akurasi meningkat setiap kali data kawin baru ditambahkan.'
                : 'Accuracy improves each time new breeding data is added.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
