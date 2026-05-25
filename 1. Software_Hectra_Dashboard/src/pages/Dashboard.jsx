// src/pages/Dashboard.jsx
// Hectra Dashboard — Neo Bio-Tech Intelligence UI (MP-3 §4, §7-9)

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scan, Plus, Cpu, FileText,
  Thermometer, AlertTriangle, BatteryWarning, CheckCircle2,
  Sparkles, Wifi, Zap, Calendar, X
} from 'lucide-react';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import SeeAllLink from '@/components/ui/SeeAllLink';
import PairCollarModal from '@/components/shared/PairCollarModal';
import { useTernakStore } from '@/store/useTernakStore';
import { useAuthStore } from '@/store/authStore';

// ── CONFIDENCE RING SVG ──────────────────────────────────────
function ConfidenceRing({ value = null, label }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const hasValue = value !== null && value !== undefined && !isNaN(value);
  const offset = hasValue ? circ * (1 - value / 100) : circ;

  return (
    <div style={{ position: 'relative', width: '105px', height: '105px', flexShrink: 0 }}>
      <svg width="105" height="105" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="52.5" cy="52.5" r={r} fill="none" stroke="var(--border-2)" strokeWidth="5" />
        <circle
          cx="52.5" cy="52.5" r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '6px',
      }}>
        <span style={{
          fontSize: '22px', fontWeight: 800, color: 'var(--accent)',
          fontFamily: 'DM Sans, sans-serif', lineHeight: 1,
        }}>{hasValue ? `${value}%` : '—'}</span>
        <span style={{
          fontSize: '9.5px', color: 'var(--text-2)',
          fontFamily: 'Inter, sans-serif', marginTop: '3px',
          letterSpacing: '0.02em',
          textAlign: 'center',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>{label}</span>
      </div>
    </div>
  );
}

// ── STAT CARD ────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div
      className="stat-card"
      style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: '12px',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="eyebrow">{label}</span>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px',
          background: color + '1A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <div style={{
        fontSize: '30px', fontWeight: 700, color: color,
        fontFamily: 'DM Sans, sans-serif', lineHeight: 1, letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif' }}>
        {sub}
      </div>
    </div>
  );
}

// ── QUICK ACTION CIRCLE ──────────────────────────────────────
function QAButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, minWidth: '64px' }}
    >
      <div
        className="qa-circle"
        style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon size={22} style={{ color: 'var(--accent)' }} />
      </div>
      <span style={{
        fontSize: '11px', color: 'var(--text-2)',
        fontFamily: 'Inter, sans-serif', fontWeight: 500, textAlign: 'center',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </button>
  );
}

// ── INTELLIGENCE CARD ────────────────────────────────────────
function IntelCard({ urgency, icon: Icon, title, sub, conf, time, recommendation, t }) {
  const colorMap = {
    critical:  { color: 'var(--red)',   bg: 'var(--red-dim)',   bar: 'intel-bar-red',   badge: t.intel_critical_badge },
    monitor:   { color: 'var(--amber)', bg: 'var(--amber-dim)', bar: 'intel-bar-amber', badge: t.intel_monitor_badge },
    scheduled: { color: 'var(--accent)',bg: 'var(--accent-dim)',bar: 'intel-bar-green', badge: t.intel_sched_badge },
  };
  const { color, bg, bar, badge } = colorMap[urgency] || colorMap.monitor;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      padding: '14px',
      background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
      borderRadius: '10px', position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* Left accent bar */}
      <div className={bar} style={{ position: 'absolute', left: 0, top: '12px', bottom: '12px', width: '3px', borderRadius: '0 2px 2px 0' }} />

      {/* Icon */}
      <div style={{
        width: '34px', height: '34px', borderRadius: '8px',
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        marginLeft: '6px',
      }}>
        <Icon size={16} style={{ color }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
          <span style={{
            fontSize: '13px', fontWeight: 600, color: 'var(--text-1)',
            fontFamily: 'DM Sans, sans-serif',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{
              fontSize: '10px', fontWeight: 600, color, fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: '999px', background: bg,
            }}>{badge}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif' }}>{time}</span>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
          {sub}
        </p>

        {recommendation && (
          <p style={{ 
            fontSize: '11px', 
            color: 'var(--accent)', 
            fontFamily: 'Inter, sans-serif', 
            fontWeight: 600,
            marginTop: '8px',
            background: 'var(--accent-dim)',
            border: '0.5px solid var(--accent-border)',
            padding: '4px 10px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            💡 {recommendation}
          </p>
        )}

        {/* Confidence bar */}
        {conf < 100 && (
          <div style={{ marginTop: '8px', height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${conf}%`, background: color,
              borderRadius: '2px', transition: 'width 0.8s ease',
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── STATUS BADGE ─────────────────────────────────────────────
function StatusBadge({ status, t }) {
  const map = {
    normal:  { color: 'var(--accent)', bg: 'var(--accent-dim)', label: t.herd_normal },
    estrus:  { color: 'var(--red)',    bg: 'var(--red-dim)',    label: t.herd_estrus },
    monitor: { color: 'var(--amber)',  bg: 'var(--amber-dim)',  label: t.herd_monitor },
  };
  const { color, bg, label } = map[status] || map.normal;
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      color, background: bg, padding: '2px 8px', borderRadius: '999px',
      fontFamily: 'Inter, sans-serif',
    }}>{label}</span>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────
// ── HELPERS ──────────────────────────────────────────────────
function formatRelativeTime(isoString, lang) {
  if (!isoString) return lang === 'id' ? 'Baru saja' : 'Just now';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return lang === 'id' ? 'Baru saja' : 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return lang === 'id' ? `${minutes} mnt lalu` : `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return lang === 'id' ? `${hours} jam lalu` : `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return lang === 'id' ? `${days} hari lalu` : `${days} days ago`;
  } catch (e) {
    return lang === 'id' ? 'Baru saja' : 'Just now';
  }
}

// ── MAIN COMPONENT ───────────────────────────────────────────
export default function Dashboard() {
  const { lang } = useSettingsStore();
  const { user } = useAuthStore();
  const t = translations[lang];
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    aiConf: null,
    collars: 0,
    estrus: 0,
    avgTemp: null,
    ibWindows: 0,
    lastSync: 'Syncing...',
  });
  const [herd, setHerd] = useState([]);
  const [intel, setIntel] = useState([]);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const { sapiList, fetchSapiList, tambahReproduksi, loading: reproLoading } = useTernakStore();
  const [isReproModalOpen, setIsReproModalOpen] = useState(false);
  const [reproForm, setReproForm] = useState({
    rfid: '',
    tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
    birahi: '', bunting: '', hpl: '', sapih: '', catatan: ''
  });

  const handleBirahiChange = (e) => {
    const val = e.target.value;
    setReproForm(prev => {
      let b = prev.bunting;
      let h = prev.hpl;
      if (val) {
        const bDate = new Date(val);
        bDate.setMonth(bDate.getMonth() + 3);
        b = bDate.toISOString().split('T')[0];
        
        const hDate = new Date(val);
        hDate.setMonth(hDate.getMonth() + 9);
        hDate.setDate(hDate.getDate() + 10);
        h = hDate.toISOString().split('T')[0];
      }
      return { ...prev, birahi: val, bunting: b, hpl: h };
    });
  };

  const onTambahReproduksi = async (e) => {
    e.preventDefault();
    if (!reproForm.rfid) {
      toast.error(lang === 'id' ? 'Silakan pilih sapi terlebih dahulu.' : 'Please select a cow first.');
      return;
    }
    const res = await tambahReproduksi(reproForm);
    if (res.success) {
      setIsReproModalOpen(false);
      setReproForm({
        rfid: '',
        tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
        birahi: '', bunting: '', hpl: '', sapih: '', catatan: ''
      });
      toast.success(lang === 'id' ? "Riwayat reproduksi berhasil disimpan!" : "Reproduction record saved successfully!");
    } else {
      toast.error(res.message || (lang === 'id' ? 'Gagal menambah riwayat reproduksi.' : 'Failed to add reproduction record.'));
    }
  };

  const [pairSelectedSapi, setPairSelectedSapi] = useState(null);
  const [pairSelectedCollar, setPairSelectedCollar] = useState(null);

  const handleExportPDF = async () => {
    // Show beautiful premium toast alert
    toast.info(lang === 'id' 
      ? "Sedang membuat laporan PDF profesional, mohon tunggu..." 
      : "Generating professional PDF report, please wait..."
    );

    try {
      const response = await axiosInstance.post('/report/estrus-prediction', {}, {
        responseType: 'blob',
        timeout: 60000 // 60s timeout for Playwright PDF generation
      });

      // Construct a download link for the PDF blob
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Hectra_Laporan_Kandang_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show beautiful success toast
      toast.success(lang === 'id' 
        ? "Laporan PDF berhasil diunduh!" 
        : "PDF report downloaded successfully!"
      );
    } catch (err) {
      console.error(err);
      toast.error(lang === 'id'
        ? `Gagal membuat laporan: ${err.message || 'Error server'}`
        : `Failed to generate report: ${err.message || 'Server error'}`
      );
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Call all API endpoints concurrently
        const [statsRes, herdRes, intelRes] = await Promise.all([
          axiosInstance.get('/dashboard/stats'),
          axiosInstance.get('/hewan'),
          axiosInstance.get('/notifications?limit=5')
        ]);

        const statsData = statsRes.data;
        const herdData = herdRes.data;
        const intelData = intelRes.data?.logs || [];

        // 1. Process stats
        setStats({
          aiConf: statsData.ai_conf !== null && statsData.ai_conf !== undefined ? statsData.ai_conf : null,
          collars: statsData.sensors_active || 0,
          estrus: statsData.high_risk || 0,
          avgTemp: statsData.avg_temp !== null && statsData.avg_temp !== undefined ? statsData.avg_temp : null,
          ibWindows: statsData.ib_windows || 0,
          lastSync: statsData.last_sync || (lang === 'id' ? 'Baru saja' : 'Just now'),
        });

        // 2. Process herd list
        const mappedHerd = (herdData || []).map(cow => {
          let cowStatus = 'normal';
          if (cow.estrus_detected === 1) {
            cowStatus = 'estrus';
          } else if (cow.status === 'Sakit' || cow.status === 'Butuh Perawatan' || (cow.temp !== null && cow.temp !== undefined && cow.temp > 39.0)) {
            cowStatus = 'monitor';
          }
          return {
            id: cow.cow_id,
            name: cow.nama || 'Sapi',
            status: cowStatus,
            temp: cow.temp !== null && cow.temp !== undefined ? cow.temp : null,
            battery: cow.battery !== null && cow.battery !== undefined ? cow.battery : null
          };
        }).slice(0, 5);
        setHerd(mappedHerd);

        // 3. Process reproductive intelligence stream (intel)
        if (intelData && intelData.length > 0) {
          const mappedIntel = intelData.map(item => {
            let urgency = 'info';
            if (item.severity?.toUpperCase() === 'HIGH' || item.type?.toLowerCase() === 'estrus' || item.severity?.toLowerCase() === 'critical') {
              urgency = 'critical';
            } else if (item.severity?.toUpperCase() === 'WARNING' || item.type?.toLowerCase() === 'anomaly' || item.type?.toLowerCase() === 'battery') {
              urgency = 'monitor';
            } else {
              urgency = 'scheduled';
            }

            // Determine Icon
            let cardIcon = Zap;
            if (item.type?.toLowerCase() === 'estrus') cardIcon = Zap;
            else if (item.type?.toLowerCase() === 'insemination') cardIcon = Calendar;
            else if (item.type?.toLowerCase() === 'pregnancy') cardIcon = CheckCircle2;
            else if (item.type?.toLowerCase() === 'anomaly' || item.type?.toLowerCase() === 'anomal') cardIcon = Thermometer;
            else if (item.type?.toLowerCase() === 'battery') cardIcon = BatteryWarning;

            // Title
            const prefix = item.cow_name ? `${item.cow_name} — ` : '';
            let title = prefix;
            switch (item.type?.toLowerCase()) {
              case 'estrus':
                title += lang === 'id' ? 'Deteksi Birahi (Estrus)' : 'Estrus Detected';
                break;
              case 'insemination':
                title += lang === 'id' ? 'Catatan Inseminasi Buatan' : 'AI Record Logged';
                break;
              case 'pregnancy':
                title += lang === 'id' ? 'Update Kebuntingan' : 'Pregnancy Status Update';
                break;
              case 'anomaly':
              case 'anomal':
                title += lang === 'id' ? 'Anomali Suhu Tubuh' : 'Temperature Anomaly';
                break;
              case 'battery':
                title += lang === 'id' ? 'Baterai Kalung Lemah' : 'Collar Battery Low';
                break;
              default:
                title += item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : (lang === 'id' ? 'Pemberitahuan' : 'Alert');
            }

            // Subtitle & Action Recommendation
            let recommendation = '';
            switch (item.type?.toLowerCase()) {
              case 'estrus':
                recommendation = lang === 'id'
                  ? 'Segera lakukan Inseminasi Buatan (IB) dalam jendela optimal 12-18 jam.'
                  : 'Schedule Artificial Insemination (AI) within the optimal 12-18 hour window.';
                break;
              case 'anomaly':
              case 'anomal':
                recommendation = lang === 'id'
                  ? 'Isolasi sapi dan hubungi dokter hewan untuk check-up kesehatan.'
                  : 'Isolate the cow and contact the veterinarian for a health check-up.';
                break;
              case 'battery':
                recommendation = lang === 'id'
                  ? 'Harap ganti baterai kalung sensor dalam 24 jam.'
                  : 'Please replace the collar battery within 24 hours.';
                break;
              case 'insemination':
                recommendation = lang === 'id'
                  ? 'Pantau aktivitas harian sapi selama 21 hari untuk prediksi kebuntingan.'
                  : 'Monitor daily cow activity for 21 days to predict pregnancy success.';
                break;
              case 'pregnancy':
                recommendation = lang === 'id'
                  ? 'Sesuaikan pakan konsentrat dan vitamin kebuntingan sesuai resep mantri.'
                  : 'Adjust feed and pregnancy vitamins according to veterinarian prescription.';
                break;
              default:
                recommendation = lang === 'id'
                  ? 'Periksa detail dan status ternak secara berkala.'
                  : 'Review the cow details and status periodically.';
            }

            return {
              urgency,
              icon: cardIcon,
              title,
              sub: item.message,
              recommendation,
              conf: 100, // standard severity
              time: formatRelativeTime(item.timestamp, lang),
            };
          });
          setIntel(mappedIntel);
        } else {
          // Fallback if no predictions in DB yet
          setIntel([
            {
              urgency: 'scheduled',
              icon: CheckCircle2,
              title: lang === 'id' ? 'Registri Sistem Aktif' : 'System Registry Active',
              sub: lang === 'id' 
                ? 'Semua sensor kalung memantau aktivitas ternak secara normal. Tidak ada estrus terdeteksi.'
                : 'All collar sensors are monitoring herd activity normally. No estrus detected.',
              conf: 100,
              time: lang === 'id' ? 'Baru saja' : 'Just now',
            }
          ]);
        }
      } catch (err) {
        console.error('[Hectra Dashboard] Error fetching real-time data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [lang]);

  // Get time-based greeting and status message
  const currentHour = new Date().getHours();
  let greetingText = '';

  if (lang === 'id') {
    if (currentHour >= 5 && currentHour < 12) greetingText = 'Selamat pagi';
    else if (currentHour >= 12 && currentHour < 15) greetingText = 'Selamat siang';
    else if (currentHour >= 15 && currentHour < 18) greetingText = 'Selamat sore';
    else greetingText = 'Selamat malam';
  } else {
    if (currentHour >= 5 && currentHour < 12) greetingText = 'Good morning';
    else if (currentHour >= 12 && currentHour < 18) greetingText = 'Good afternoon';
    else greetingText = 'Good evening';
  }

  let statusMessage = '';
  if (stats.estrus > 0) {
    statusMessage = lang === 'id'
      ? `Hari ini ada ${stats.estrus} sapi yang terdeteksi estrus. Segera periksa detailnya untuk inseminasi buatan.`
      : `We detected ${stats.estrus} cows in active estrus today. Please review the details for artificial insemination.`;
  } else if (stats.ibWindows > 0) {
    statusMessage = lang === 'id'
      ? `Kondisi kandang aman. Ada ${stats.ibWindows} jadwal IB aktif yang siap Anda persiapkan.`
      : `The barn condition is stable. There are ${stats.ibWindows} active breeding windows ready for prep.`;
  } else if (stats.avgTemp && parseFloat(stats.avgTemp) > 39.0) {
    statusMessage = lang === 'id'
      ? `Semua aman, tapi suhu rata-rata ternak sedikit hangat (${stats.avgTemp}°C). Pantau ventilasi kandang ya.`
      : `All looks good, but the herd's average temperature is slightly warm (${stats.avgTemp}°C). Keep an eye on ventilation.`;
  } else if (stats.collars > 0) {
    statusMessage = lang === 'id'
      ? `Sistem aktif memantau ${stats.collars} kalung sensor. Seluruh kondisi ternak terpantau stabil.`
      : `System is actively monitoring ${stats.collars} collar sensors. The herd status is fully stable.`;
  } else {
    statusMessage = lang === 'id'
      ? `Kondisi kawanan stabil, tidak ada anomali reproduksi terdeteksi.`
      : `Herd condition is stable, no reproductive anomalies detected.`;
  }

  const userName = user?.full_name || (lang === 'id' ? 'Peternak' : 'Farmer');

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[80, 160, 200, 260].map((h, i) => (
          <div key={i} style={{
            height: `${h}px`, borderRadius: '12px',
            background: 'var(--border)', opacity: 0.5,
            animation: 'pulse-dot 1.5s infinite',
          }} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ─── 1. HERO SECTION ───────────────────────────────── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: '12px',
        padding: '20px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Eyebrow */}
          <p className="eyebrow" style={{ marginBottom: '8px' }}>{t.hero_eyebrow}</p>

          {/* Title */}
          <h1 style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: '26px', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--text-1)', lineHeight: 1.2, margin: 0,
          }}>
            {t.hero_status_stable}
            <span style={{ color: 'var(--accent)' }}>{t.hero_status_word}</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '13px', color: 'var(--text-2)', fontFamily: 'Inter, sans-serif',
            marginTop: '8px', lineHeight: 1.6,
          }}>
            {`${greetingText}, ${userName}. ${statusMessage}`}
          </p>

          {/* Meta row */}
          <div style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '14px',
          }}>
            {[
              { label: t.hero_last_sync, value: stats.lastSync },
              { label: 'Model', value: t.hero_model },
              { label: t.hero_collars_online, value: `${stats.collars}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif' }}>{label}:</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', fontFamily: 'Inter, sans-serif' }}>{value}</span>
              </div>
            ))}

            {/* Gendhis badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '999px',
              background: 'var(--accent-dim)', border: '0.5px solid var(--accent-border)',
            }}>
              <Sparkles size={11} style={{ color: 'var(--accent)' }} />
              <span style={{
                fontSize: '10px', fontWeight: 600, color: 'var(--accent)',
                fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
              }}>
                {t.hero_gendhis_active}
              </span>
            </div>
          </div>
        </div>

        {/* Confidence Ring */}
        <ConfidenceRing value={stats.aiConf} label={t.hero_ai_conf} />
      </div>

      {/* ─── 2. STATS GRID ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t.stat_active_collars}
          value={stats.collars}
          sub={t.stat_all_online}
          color="var(--accent)"
          icon={Wifi}
        />
        <StatCard
          label={t.stat_estrus_signals}
          value={stats.estrus}
          sub={t.stat_trend_up}
          color="var(--red)"
          icon={Zap}
        />
        <StatCard
          label={t.stat_avg_temp}
          value={stats.avgTemp !== null && stats.avgTemp !== undefined ? `${stats.avgTemp}°` : '—'}
          sub={t.stat_normal_range}
          color="var(--amber)"
          icon={Thermometer}
        />
        <StatCard
          label={t.stat_breeding_windows}
          value={stats.ibWindows}
          sub={t.stat_next_window}
          color="var(--blue)"
          icon={CheckCircle2}
        />
      </div>

      {/* ─── 3. QUICK ACTIONS ──────────────────────────────── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: '12px',
        padding: '18px 22px',
      }}>
        <p className="eyebrow hidden md:block" style={{ marginBottom: '16px' }}>{t.section_quick_actions}</p>
        <div className="flex flex-row overflow-x-auto no-scrollbar gap-6 pb-2 md:flex-wrap">
          <QAButton icon={Plus}     label={t.qa_add_ib} onClick={() => {
            fetchSapiList();
            setIsReproModalOpen(true);
          }} />
          <QAButton icon={Cpu}      label={t.qa_pair_collar} onClick={() => setIsPairModalOpen(true)} />
          <QAButton icon={Zap}      label={t.qa_run_prediction} onClick={() => navigate('/estrus-prediction', { state: { runPredict: true } })} />
          <QAButton icon={FileText} label={t.qa_export} onClick={handleExportPDF} />
        </div>
      </div>

      {/* ─── 4. HERD STATUS ────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: '12px',
        padding: '18px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <p className="eyebrow">{t.section_herd_status}</p>
          <SeeAllLink label={t.section_view_all} to="/ternak" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {herd.map((cow) => (
            <div key={cow.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--bg-card)', border: '0.5px solid var(--border)',
              borderRadius: '8px', gap: '12px',
              transition: 'border-color 0.15s, background 0.15s',
              cursor: 'pointer',
            }}
              className="hover:border-[var(--border-2)] hover:bg-[var(--bg-hover)]"
            >
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'var(--accent-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, color: 'var(--accent)',
                  fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
                }}>
                  {(() => {
                    if (!cow.name) return 'SP';
                    const parts = cow.name.trim().split(/\s+/);
                    if (parts.length >= 2) {
                      return (parts[0][0] + parts[1][0]).toUpperCase();
                    }
                    return cow.name.slice(0, 2).toUpperCase();
                  })()}
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', fontFamily: 'DM Sans, sans-serif' }}>
                    {cow.name}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif' }}>
                    ID: {cow.id}
                  </p>
                </div>
              </div>

              {/* Temp */}
              <span style={{
                fontSize: '13px', fontWeight: 700, color: cow.temp ? (cow.temp >= 39 ? 'var(--red)' : 'var(--amber)') : 'var(--text-3)',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                {cow.temp ? `${cow.temp}°C` : '—'}
              </span>

              {/* Battery */}
              <span style={{
                fontSize: '11px', color: cow.battery ? (cow.battery < 20 ? 'var(--red)' : 'var(--text-3)') : 'var(--text-3)',
                fontFamily: 'Inter, sans-serif', minWidth: '36px', textAlign: 'right',
              }}>
                {cow.battery !== null && cow.battery !== undefined ? `${cow.battery}%` : '—'}
              </span>

              {/* Status */}
              <StatusBadge status={cow.status} t={t} />
            </div>
          ))}
        </div>
      </div>

      {/* ─── 5. REPRODUCTIVE INTELLIGENCE ─────────────────── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: '12px',
        padding: '18px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <p className="eyebrow">{t.section_repro_intel}</p>
          <SeeAllLink label={t.section_see_all} to="/notifications" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {intel.map((card, i) => (
            <IntelCard key={i} {...card} t={t} />
          ))}
        </div>
      </div>

      </div>

      {/* MODAL: Tambah Reproduksi */}
      {isReproModalOpen && (
        <div className="fixed inset-0 z-[999] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 w-full max-w-lg animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">
                {t.repro_record_new}
              </h2>
              <button onClick={() => setIsReproModalOpen(false)} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)]">
                <X size={20} />
              </button>
            </div>

            <form className="space-y-4" onSubmit={onTambahReproduksi}>
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
                  {t.repro_select_cow}
                </label>
                <select 
                  style={{ width: '100%', padding: '10px 14px', border: '0.5px solid var(--border)', borderRadius: '10px', background: 'var(--bg-surface)', color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                  required
                  value={reproForm.rfid}
                  onChange={e => setReproForm({...reproForm, rfid: e.target.value})}
                >
                  <option value="">-- {t.repro_choose_cow} --</option>
                  {sapiList.map(s => (
                    <option key={s.id} value={s.id}>{s.nama} ({s.id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_ib_date}</label>
                  <input 
                    type="date" 
                    style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" 
                    required
                    value={reproForm.tanggal_ib}
                    onChange={e => setReproForm({...reproForm, tanggal_ib: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_ib_count}</label>
                  <input type="number" min="1" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" value={reproForm.jumlah_ib} onChange={e => setReproForm({...reproForm, jumlah_ib: e.target.value})}/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_inseminator}</label>
                <input 
                  type="text" 
                  placeholder={t.repro_inseminator_placeholder} 
                  style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" 
                  value={reproForm.pemberi_ib}
                  onChange={e => setReproForm({...reproForm, pemberi_ib: e.target.value})}
                />
              </div>

              <div className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl space-y-4">
                <h4 className="text-sm font-bold text-[var(--color-primary)] flex items-center gap-2">
                  <Calendar size={16}/> {t.repro_auto_calculator}
                </h4>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_estrus_date}</label>
                  <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" value={reproForm.birahi} onChange={handleBirahiChange}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_pregnancy_pred}</label>
                    <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm" value={reproForm.bunting} onChange={e => setReproForm({...reproForm, bunting: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_estimated_hpl}</label>
                    <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--color-primary)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm font-bold" value={reproForm.hpl} onChange={e => setReproForm({...reproForm, hpl: e.target.value})} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_weaning_date}</label>
                <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" value={reproForm.sapih} onChange={e => setReproForm({...reproForm, sapih: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_notes}</label>
                <textarea rows="2" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] resize-none" placeholder={t.repro_notes_placeholder} value={reproForm.catatan} onChange={e => setReproForm({...reproForm, catatan: e.target.value})} />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsReproModalOpen(false)} style={{ padding: '10px 24px', border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flex: 1 }}>{t.btn_cancel}</button>
                <button type="submit" className="flex-1 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-lg" disabled={reproLoading}>
                  {reproLoading ? t.repro_saving : t.repro_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PairCollarModal
        isOpen={isPairModalOpen}
        onClose={() => {
          setPairSelectedSapi(null);
          setPairSelectedCollar(null);
          setIsPairModalOpen(false);
        }}
        pairSelectedSapi={pairSelectedSapi}
        setPairSelectedSapi={setPairSelectedSapi}
        pairSelectedCollar={pairSelectedCollar}
        setPairSelectedCollar={setPairSelectedCollar}
      />
    </>
  );
}
