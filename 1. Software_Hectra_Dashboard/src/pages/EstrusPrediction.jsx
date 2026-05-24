import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
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
import { cn } from '@/lib/utils';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyPrediction(pred) {
  const conf  = pred.confidence_final ?? 0;
  const inWin = pred.in_window_now;
  const days  = pred.days_until;

  if (inWin && conf >= 0.75) {
    return { type: 'estrus', label: '🔴 Estrus Sekarang',   color: 'red'   };
  } else if (inWin || (days >= 0 && days <= 3 && conf >= 0.6)) {
    return { type: 'pre-estrus', label: '🟡 Mendekati Estrus', color: 'amber' };
  } else if (conf < 0.4 && !inWin) {
    return { type: 'normal', label: '🟢 Normal',               color: 'green' };
  }
  return { type: 'upcoming', label: '🔵 Terjadwal',            color: 'blue'  };
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

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDays(days) {
  if (days === null || days === undefined) return '—';
  if (days < 0) return `${Math.abs(days)} hari lalu`;
  if (days === 0) return 'Hari ini!';
  if (days === 1) return 'Besok';
  return `${days} hari lagi`;
}

function methodBadge(metode) {
  const map = {
    calendar_only:      { label: 'Kalender',          icon: CalendarClock, color: 'var(--blue)'  },
    'calendar+sensor':  { label: 'Kalender + Sensor', icon: Layers,        color: 'var(--amber)' },
    'calendar+ml':      { label: 'Kalender + ML',     icon: TrendingUp,    color: 'var(--accent)'},
    full_hybrid:        { label: 'Full Hybrid AI',    icon: FlaskConical,  color: 'var(--red)'   },
  };
  return map[metode] || { label: metode || 'AI', icon: BrainCircuit, color: 'var(--text-3)' };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EstrusPrediction() {
  const location = useLocation();
  const [loading,      setLoading]      = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictions,  setPredictions]  = useState([]);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ─ Fetch predictions ──────────────────────────────────────────────────────
  const fetchPredictions = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await axiosInstance.get('/estrus-predictions?status=all&limit=100');
      setPredictions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Gagal fetch prediksi:', err);
      toast.error('Gagal memuat data prediksi estrus.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPredictions(); }, [fetchPredictions]);

  // ─ Run prediction engine ──────────────────────────────────────────────────
  const handleRunPredict = async () => {
    setIsPredicting(true);
    try {
      const res = await axiosInstance.post('/estrus-predictions/run');
      const { processed, errors } = res.data || {};
      if (errors > 0) {
        toast.error(`Selesai: ${processed} berhasil, ${errors} gagal.`);
      } else {
        toast.success(`✅ Prediksi selesai! ${processed} sapi dianalisis.`);
      }
      await fetchPredictions(false);
    } catch (err) {
      toast.error('Gagal menjalankan prediksi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsPredicting(false);
    }
  };

  useEffect(() => {
    if (location.state?.runPredict) {
      handleRunPredict();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // ─ Filter & search ────────────────────────────────────────────────────────
  const filtered = predictions.filter(p => {
    const cl  = classifyPrediction(p);
    const matchStatus = statusFilter === 'all' || cl.type === statusFilter;
    const matchSearch = !search || (p.cow_name || p.cow_id || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // ─ Stats cards ────────────────────────────────────────────────────────────
  const countByType = (type) => predictions.filter(p => classifyPrediction(p).type === type).length;
  const inWindowNow = predictions.filter(p => p.in_window_now).length;

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
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--text-1)]">
            Prediksi Estrus AI
          </h1>
          <p className="text-[var(--text-2)] mt-1 text-sm">
            Deteksi birahi 3-Layer: Kalender → Sensor SVM → XGBoost Historis.
          </p>
        </div>
        <button
          onClick={() => fetchPredictions()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', border: '0.5px solid var(--border)',
            borderRadius: '10px', background: 'var(--bg-surface)',
            color: 'var(--text-2)', cursor: 'pointer',
            fontSize: '13px', fontWeight: 500, fontFamily: 'Inter, sans-serif',
            transition: 'background 0.15s',
          }}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── STAT SUMMARY CARDS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sapi',     value: predictions.length, color: 'var(--text-1)',   icon: Target },
          { label: 'Estrus Sekarang',value: countByType('estrus'),       color: 'var(--red)',   icon: AlertCircle  },
          { label: 'Mendekati',      value: countByType('pre-estrus'),   color: 'var(--amber)', icon: Clock        },
          { label: 'Dalam Window',   value: inWindowNow,                 color: 'var(--blue)',  icon: CalendarClock },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
              <Icon style={{ width: 16, height: 16, color }} />
            </div>
            <p style={{ fontSize: '28px', fontWeight: 800, color, fontFamily: 'DM Sans, sans-serif', lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── MAIN GRID ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT PANEL: Predict Controls */}
        <div className="lg:col-span-1">
          <div style={{ background: 'var(--bg-surface)', borderRadius: '20px', boxShadow: 'var(--shadow-card)', padding: '24px', border: '0.5px solid var(--border)', position: 'sticky', top: '24px' }}>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div style={{ background: 'var(--accent)', color: '#fff', width: 40, height: 40, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--text-1)] font-display">Jalankan Prediksi</h2>
                <p className="text-xs text-[var(--text-2)]">Semua sapi • 3-Layer AI</p>
              </div>
            </div>

            {/* Layers Explainer */}
            <div className="space-y-2.5 mb-6">
              {[
                { icon: CalendarClock, color: 'var(--blue)',   title: 'Layer 1: Kalender',  desc: 'Siklus 21 hari + riwayat birahi' },
                { icon: Layers,        color: 'var(--amber)',  title: 'Layer 2: Sensor SVM', desc: 'Gerak akselerometer + suhu tubuh' },
                { icon: TrendingUp,    color: 'var(--accent)', title: 'Layer 3: XGBoost',   desc: 'Pola historis reproduksi' },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '10px', border: '0.5px solid var(--border)' }}>
                  <Icon style={{ width: 16, height: 16, color, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)' }}>{title}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-2)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunPredict}
              disabled={isPredicting}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '8px', padding: '11px 16px', borderRadius: '12px',
                background: isPredicting ? 'var(--bg-hover)' : 'var(--accent)',
                color: isPredicting ? 'var(--text-2)' : '#fff',
                border: 'none', cursor: isPredicting ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
                transition: 'opacity 0.15s, background 0.15s',
                opacity: isPredicting ? 0.7 : 1,
              }}
            >
              {isPredicting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menganalisis...</>
              ) : (
                <><Wand2 className="w-4 h-4" /> Jalankan Prediksi AI</>
              )}
            </button>

            {/* Info note */}
            <div style={{ marginTop: '16px', background: 'var(--blue-dim)', border: '0.5px solid var(--blue)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <AlertCircle style={{ width: 15, height: 15, color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '12px', color: 'var(--blue)', lineHeight: 1.5 }}>
                <strong>Otomatis:</strong> Model berjalan otomatis setiap 4 jam. Tekan tombol hanya jika ada perubahan mendadak.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Prediction Results */}
        <div className="lg:col-span-2 space-y-5">

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--text-1)] font-display">Hasil Prediksi</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filter pills */}
              {[
                { value: 'all',         label: 'Semua'   },
                { value: 'estrus',      label: '🔴 Estrus' },
                { value: 'pre-estrus',  label: '🟡 Dekat'  },
                { value: 'normal',      label: '🟢 Normal' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  style={{
                    padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                    border: `0.5px solid ${statusFilter === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: statusFilter === opt.value ? 'var(--accent-dim)' : 'var(--bg-card)',
                    color: statusFilter === opt.value ? 'var(--accent)' : 'var(--text-2)',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-3)' }} />
                <input
                  type="text"
                  placeholder="Cari sapi..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    paddingLeft: '30px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px',
                    border: '0.5px solid var(--border)', borderRadius: '20px', fontSize: '12px',
                    background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none',
                    fontFamily: 'Inter, sans-serif', width: '160px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Result List */}
          {filtered.length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
              <BrainCircuit style={{ width: 40, height: 40, color: 'var(--text-3)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-2)', fontWeight: 600 }}>
                {predictions.length === 0 ? 'Belum ada data prediksi' : 'Tidak ada yang cocok filter'}
              </p>
              <p style={{ color: 'var(--text-3)', fontSize: '13px', marginTop: 6 }}>
                {predictions.length === 0
                  ? 'Klik "Jalankan Prediksi AI" untuk mulai analisis.'
                  : 'Coba ubah filter atau kata kunci pencarian.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((pred) => (
                <PredictionCard 
                  key={pred.id} 
                  pred={pred} 
                  onFeedbackSubmitted={() => fetchPredictions(false)}
                />
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', paddingTop: '8px' }}>
              Menampilkan {filtered.length} dari {predictions.length} sapi
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Prediction Card ───────────────────────────────────────────────────────────

function PredictionCard({ pred, onFeedbackSubmitted }) {
  const classification = classifyPrediction(pred);
  const cs  = colorSchemeFor(classification.type);
  const mb  = methodBadge(pred.metode);
  const MbIcon = mb.icon;
  const conf = Math.round((pred.confidence_final ?? 0) * 100);
  const [submitting, setSubmitting] = useState(false);

  const handleFeedback = async (isCorrect) => {
    setSubmitting(true);
    try {
      await axiosInstance.post(`/estrus-predictions/${pred.id}/feedback`, { verified: isCorrect });
      toast.success('Feedback berhasil disimpan!');
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    } catch (err) {
      console.error('Gagal menyimpan feedback:', err);
      toast.error('Gagal mengirim feedback: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: '14px',
        boxShadow: 'var(--shadow-card)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: cs.bar, borderRadius: '4px 0 0 4px' }} />

      {/* Row 1: Name + Badge + Confidence */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', paddingLeft: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-1)' }}>
              {pred.cow_name || pred.cow_id}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'monospace', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px' }}>
              {pred.cow_id}
            </span>
            {pred.in_window_now && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', background: 'var(--red)', padding: '2px 8px', borderRadius: '20px' }}>
                WINDOW AKTIF!
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '3px' }}>
            {pred.breed || 'Sapi'} • {classification.label}
          </p>
        </div>

        {/* Confidence Ring */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Conf.</p>
          <div style={{ position: 'relative', width: 52, height: 52 }}>
            <svg viewBox="0 0 36 36" style={{ width: 52, height: 52, transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={cs.bar} strokeWidth="2.5"
                strokeDasharray={`${conf} ${100 - conf}`}
                strokeLinecap="round"
              />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: cs.text }}>
              {conf}%
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Date info */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingLeft: '8px' }}>
        {[
          { label: 'Prediksi',   value: fmtDate(pred.prediksi_tanggal) },
          { label: 'Window',     value: `${fmtDate(pred.window_awal)} – ${fmtDate(pred.window_akhir)}` },
          { label: 'Optimal IB', value: fmtDate(pred.prediksi_ib_optimal) },
          { label: 'Countdown',  value: fmtDays(pred.days_until), highlight: true },
        ].map(({ label, value, highlight }) => (
          <div key={label} style={{ padding: '6px 10px', background: 'var(--bg-card)', borderRadius: '8px', border: '0.5px solid var(--border)' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            <p style={{ fontSize: '12px', fontWeight: 700, color: highlight ? cs.text : 'var(--text-1)', marginTop: '1px' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Row 3: Method + Layer confidences */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingLeft: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', border: `0.5px solid ${mb.color}`, background: 'transparent' }}>
          <MbIcon style={{ width: 12, height: 12, color: mb.color }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: mb.color }}>{mb.label}</span>
        </div>
        {[
          { label: 'L1', value: pred.confidence_layer1 },
          { label: 'L2', value: pred.confidence_layer2 },
          { label: 'L3', value: pred.confidence_layer3 },
        ].filter(l => l.value !== null && l.value !== undefined).map(({ label, value }) => (
          <span key={label} style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-hover)', padding: '3px 8px', borderRadius: '6px' }}>
            {label}: <strong style={{ color: 'var(--text-2)' }}>{Math.round(value * 100)}%</strong>
          </span>
        ))}
      </div>

      {/* Row 4: Feedback section */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          paddingLeft: '8px', 
          borderTop: '0.5px solid var(--border)', 
          paddingTop: '12px', 
          marginTop: '4px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        {pred.verified === null || pred.verified === undefined ? (
          <>
            <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 500 }}>
              Apakah prediksi ini akurat?
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleFeedback(true)}
                disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '0.5px solid rgba(16, 185, 129, 0.2)',
                  cursor: submitting ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                Benar ✅
              </button>
              <button
                onClick={() => handleFeedback(false)}
                disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '0.5px solid rgba(239, 68, 68, 0.2)',
                  cursor: submitting ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                Salah ❌
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {pred.verified ? (
              <span 
                style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: '#10b981', 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  padding: '4px 10px', 
                  borderRadius: '20px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  border: '0.5px solid rgba(16, 185, 129, 0.2)'
                }}
              >
                Prediksi Benar ✅
              </span>
            ) : (
              <span 
                style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: '#ef4444', 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  padding: '4px 10px', 
                  borderRadius: '20px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  border: '0.5px solid rgba(239, 68, 68, 0.2)'
                }}
              >
                Prediksi Salah ❌
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              (Feedback Terkirim)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
