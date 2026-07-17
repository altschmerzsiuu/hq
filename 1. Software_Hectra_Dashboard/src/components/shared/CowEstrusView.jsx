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
  Target
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
  if (days < 0)  return `${Math.abs(days)} ${t.prediction_card_days_ago}`;
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
      const res = await axiosInstance.get(`/estrus-predictions?cow_id=${cowId}&limit=1`);
      const data = Array.isArray(res.data) ? res.data : [];
      setPrediction(data[0] ?? null);
    } catch (err) {
      console.error('Gagal fetch estrus prediction:', err);
    } finally {
      setLoading(false);
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
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '16px 18px', boxShadow: 'var(--shadow-card)' }} className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div style={{ background: 'var(--accent)', color: '#fff', width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
              {lang === 'id' ? 'Analisis AI Estrus' : 'AI Estrus Analysis'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {lang === 'id' ? `Siklus estrus ${selectedCow?.nama || 'sapi'}` : `${selectedCow?.nama || 'Cow'}'s estrus cycle`}
            </p>
          </div>
        </div>
        <button
          onClick={handleRunPredict}
          disabled={isPredicting}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '10px',
            background: isPredicting ? 'var(--bg-hover)' : 'var(--accent)',
            color: isPredicting ? 'var(--text-2)' : '#fff',
            border: 'none', cursor: isPredicting ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: 700,
            opacity: isPredicting ? 0.6 : 1, flexShrink: 0,
          }}
        >
          {isPredicting
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {lang === 'id' ? 'Proses...' : 'Processing...'}</>
            : <><Wand2 className="w-3.5 h-3.5" /> {lang === 'id' ? 'Prediksi' : 'Predict'}</>
          }
        </button>
      </div>

      {/* No data yet */}
      {!prediction ? (
        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
          <BrainCircuit style={{ width: 36, height: 36, color: 'var(--text-3)', margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 600, color: 'var(--text-2)', fontSize: '14px' }}>
            {lang === 'id' ? 'Belum ada prediksi' : 'No predictions yet'}
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: '12px', marginTop: '4px' }}>
            {lang === 'id' ? 'Tekan tombol Prediksi di atas untuk menganalisis siklus estrus.' : 'Tap Predict above to analyze the estrus cycle.'}
          </p>
        </div>
      ) : (
        <div style={{
          background: cs.bg, border: `0.5px solid ${cs.border}`,
          borderRadius: '16px', boxShadow: 'var(--shadow-card)',
          padding: '20px', display: 'flex', flexDirection: 'column',
          gap: '14px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: cs.bar, borderRadius: '4px 0 0 4px' }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', paddingLeft: '8px' }}>
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
              <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '3px' }}>{classification.label}</p>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{t.prediction_card_conf_label}</p>
              <div style={{ position: 'relative', width: 52, height: 52 }}>
                <svg viewBox="0 0 36 36" style={{ width: 52, height: 52, transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={cs.bar} strokeWidth="2.5"
                    strokeDasharray={`${conf} ${100 - conf}`} strokeLinecap="round" />
                </svg>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: cs.text }}>
                  {conf}%
                </span>
              </div>
            </div>
          </div>

          {/* Core Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '8px', marginTop: '4px' }}>
            {/* Optimal IB - Enlarge */}
            <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid ${cs.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05 }}>
                <Target size={64} color={cs.text} />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{t.prediction_card_optimal_ib || 'Optimal IB'}</p>
              <p style={{ fontSize: '20px', fontWeight: 800, color: cs.text }}>{fmtDate(prediction.prediksi_ib_optimal, lang)}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {/* Window */}
              <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '10px', border: '0.5px solid var(--border)' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.prediction_card_window_label || 'Window'}</p>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginTop: '2px', lineHeight: 1.3 }}>{fmtDate(prediction.window_awal, lang)} –<br/>{fmtDate(prediction.window_akhir, lang)}</p>
              </div>
              {/* Countdown */}
              <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '10px', border: '0.5px solid var(--border)' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.prediction_card_countdown || 'Countdown'}</p>
                <p style={{ fontSize: '15px', fontWeight: 800, color: cs.text, marginTop: '2px' }}>{fmtDays(prediction.days_until, t)}</p>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '8px', borderTop: '0.5px solid var(--border)', paddingTop: '12px' }}>
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
