// src/pages/Dashboard.jsx
// HERD Dashboard — Neo Bio-Tech Intelligence UI (MP-3 §4, §7-9)

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scan, Plus, Cpu, FileText, Bell,
  Thermometer, AlertTriangle, BatteryWarning, CheckCircle2,
  Sparkles, Wifi, Zap, Calendar, X, Check, ChevronRight, Activity, Syringe, ClipboardList, ThermometerSun, Target, Sun
} from 'lucide-react';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import { handleError } from '@/lib/errorHandler';
import SeeAllLink from '@/components/ui/SeeAllLink';
import PairCollarModal from '@/components/shared/PairCollarModal';
import AddCowModal from '@/components/shared/AddCowModal';
import { useTernakStore } from '@/store/useTernakStore';
import { useAuthStore } from '@/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';

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

// ── SQUARE QUICK ACTION BUTTON ───────────────────────────────
function SquareQAButton({ icon: Icon, label, color = "var(--accent)", onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm transition-all group"
      style={{
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        cursor: 'pointer'
      }}
    >
      <Icon size={24} style={{ color }} className="mb-1" />
      <span style={{
        fontSize: '11px', color: 'var(--text-1)',
        fontFamily: 'DM Sans, sans-serif', fontWeight: 700, textAlign: 'center',
        lineHeight: 1.2
      }}>
        {label}
      </span>
    </button>
  );
}

// ── INTELLIGENCE CARD ────────────────────────────────────────
function IntelCard({ urgency, icon: Icon, title, sub, conf, time, recommendation, t }) {
  const colorMap = {
    critical: { color: 'var(--red)', bg: 'var(--red-dim)', bar: 'intel-bar-red', badge: t.intel_critical_badge },
    monitor: { color: 'var(--amber)', bg: 'var(--amber-dim)', bar: 'intel-bar-amber', badge: t.intel_monitor_badge },
    scheduled: { color: 'var(--accent)', bg: 'var(--accent-dim)', bar: 'intel-bar-green', badge: t.intel_sched_badge },
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
    normal: { color: 'var(--accent)', bg: 'var(--accent-dim)', label: t.herd_normal },
    estrus: { color: 'var(--red)', bg: 'var(--red-dim)', label: t.herd_estrus },
    monitor: { color: 'var(--amber)', bg: 'var(--amber-dim)', label: t.herd_monitor },
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
// ── RECOMMENDATION CARD ──────────────────────────────────────
function RecommendationCard({ title, badgeText, id, name, daysLeft, icon: Icon, message }) {
  const actionName = title.split('—')[1]?.trim() || title;
  const displayTitle = `${name} | ${id}`;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:border-[#2f7d31]/30 transition-all cursor-pointer relative">
      <span className="absolute top-4 right-4 text-[10px] font-bold text-blue-600 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
        {badgeText}
      </span>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-blue-500" />
        </div>
        <div className="flex flex-col flex-1 min-w-0 pr-16">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-bold text-gray-900 font-display truncate">{displayTitle}</h4>
          </div>
          <p className="text-xs text-gray-600 font-medium mb-1.5">
            {actionName} • Dalam {daysLeft} hari
          </p>
          {message && (
            <p className="text-[11px] text-gray-700 leading-snug">
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="h-px w-full bg-gray-100 my-1" />

      <div className="flex items-center justify-between gap-2">
        <button className="flex items-center gap-2 bg-[#2f7d31] hover:bg-[#007b46] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">
          <Check size={14} /> Selesai
        </button>
        <button className="flex items-center justify-center w-8 h-8 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── WEEKLY INSIGHTS MOCK DATA & SLIDESHOW ────────────────────
const WEEKLY_INSIGHTS = [
  {
    id: 0,
    title: "KESEHATAN KANDANG",
    summary: "Status: Optimal. Kondisi lingkungan dan aktivitas ternak terpantau stabil.",
    detail: "Berdasarkan pantauan sensor 24 jam terakhir, seluruh metrik utama kandang (suhu, kelembapan, dan aktivitas gerak) berada dalam rentang ideal. Tidak ditemukan anomali yang signifikan.",
    icon: Sparkles,
    color: "#fff",
    bg: "#1a1a1a",
    bgImage: "/kesehatan_kandang.png",
    isDark: true,
    hasDetail: false
  },
  {
    id: 1,
    title: "SUHU",
    summary: "Rata-rata suhu kawanan sedikit meningkat siang ini. Pastikan ventilasi menyala optimal.",
    hasDetail: true,
    detail: "Data sensor menunjukkan suhu rata-rata mencapai 30°C antara pukul 12.00 hingga 14.00, yang berpotensi memicu stres panas ringan pada sapi laktasi. Langkah preventif yang disarankan: menyalakan kipas ekstra dan memastikan ketersediaan air minum yang cukup di setiap kandang.",
    pattern: "radial-gradient(circle at 100% 0%, rgba(245,158,11,0.12) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(245,158,11,0.05) 0%, transparent 50%)",
    patternSize: "cover",
    isDark: false,
    icon: ThermometerSun
  },
  {
    id: 2,
    title: "BIRAHI",
    summary: "3 sapi menunjukkan tanda-tanda awal birahi. Persiapkan jadwal IB.",
    hasDetail: true,
    detail: "Sapi dengan ID C3938A, C4618A, dan C2911B mengalami peningkatan langkah kaki dan penurunan waktu istirahat yang signifikan dalam 12 jam terakhir, menandakan permulaan fase estrus. Tim reproduksi disarankan untuk bersiap melakukan inseminasi buatan (IB) pada sore hari atau besok pagi untuk tingkat keberhasilan terbaik.",
    pattern: "radial-gradient(circle at 0% 100%, rgba(16,185,129,0.15) 0%, transparent 60%), radial-gradient(circle at 100% 0%, rgba(16,185,129,0.05) 0%, transparent 40%)",
    patternSize: "cover",
    isDark: false,
    icon: Target
  },
  {
    id: 3,
    title: "AKTIVITAS",
    summary: "Aktivitas makan turun 5% di area B. Cek kualitas pakan.",
    hasDetail: true,
    detail: "Sensor kalung mendeteksi penurunan durasi makan (ruminasi) pada kelompok sapi di Area B dibandingkan rata-rata harian. Hal ini mungkin disebabkan oleh kualitas pakan yang kurang segar atau masalah pada sistem distribusi pakan. Periksa silase dan konsentrat yang disajikan hari ini.",
    pattern: "radial-gradient(rgba(59,130,246,0.06) 2px, transparent 2px)",
    patternSize: "20px 20px",
    isDark: false,
    icon: Activity
  }
];

function InsightSlideshow({ onOpenDetail }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % WEEKLY_INSIGHTS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (diff > 50) {
      // swipe left
      setCurrentIndex((prev) => (prev + 1) % WEEKLY_INSIGHTS.length);
    } else if (diff < -50) {
      // swipe right
      setCurrentIndex((prev) => (prev - 1 + WEEKLY_INSIGHTS.length) % WEEKLY_INSIGHTS.length);
    }
    touchStartX.current = null;
  };

  const insight = WEEKLY_INSIGHTS[currentIndex];
  const Icon = insight.icon;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: '280px',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-sm)',
        margin: '0',
      }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            background: insight.bgImage ? 'linear-gradient(to right, #1a1a1a, #2a2a2a)' : 'var(--bg-surface)',
            backgroundImage: insight.bgImage ? `url(${insight.bgImage})` : (insight.pattern || 'none'),
            backgroundSize: insight.bgImage ? 'cover' : (insight.patternSize || 'auto'),
            backgroundPosition: insight.bgImage ? 'center' : '0 0',
            border: insight.bgImage ? 'none' : '0.5px solid var(--border)',
            borderRadius: '16px',
          }}
        >
          {insight.bgImage && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '16px' }} />
          )}

          {/* Top right indicator dots */}
          <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '4px', zIndex: 1 }}>
            {WEEKLY_INSIGHTS.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: idx === currentIndex ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: idx === currentIndex ? (insight.isDark ? '#fff' : 'var(--accent)') : (insight.isDark ? 'rgba(255,255,255,0.3)' : 'var(--border-2)'),
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>

          {/* Bottom left text content */}
          <div
            className="flex flex-col gap-1.5 z-10"
            style={{
              position: 'absolute', bottom: '20px', left: '20px', right: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: insight.isDark ? 'var(--accent)' : insight.color, boxShadow: `0 0 8px ${insight.isDark ? 'var(--accent)' : insight.color}` }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: insight.isDark ? '#fff' : insight.color, letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                SOROTAN MINGGU INI
              </span>
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: 700, color: insight.isDark ? '#fff' : 'var(--text-1)', margin: 0, fontFamily: 'DM Sans, sans-serif' }}>
              {insight.title}
            </h3>
            <p style={{ fontSize: '14px', color: insight.isDark ? 'rgba(255,255,255,0.9)' : 'var(--text-2)', lineHeight: 1.4, margin: '2px 0 0 0', maxWidth: '85%' }}>
              {insight.summary}
            </p>

            {insight.hasDetail && (
              <button
                onClick={() => onOpenDetail(insight)}
                style={{
                  padding: '6px 14px', background: 'transparent', border: insight.isDark ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--border-2)',
                  borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: insight.isDark ? '#fff' : 'var(--text-1)',
                  cursor: 'pointer', transition: 'all 0.2s', width: 'fit-content', marginTop: '6px'
                }}
                className={insight.isDark ? "hover:bg-white/10" : "hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"}
              >
                Baca Selengkapnya
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
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
  const [activeEstrusPredictions, setActiveEstrusPredictions] = useState([]);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const { sapiList, fetchSapiList, tambahReproduksi, loading: reproLoading } = useTernakStore();
  const [isReproModalOpen, setIsReproModalOpen] = useState(false);
  const [isEstrusModalOpen, setIsEstrusModalOpen] = useState(false);
  const [isAddCowModalOpen, setIsAddCowModalOpen] = useState(false);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [reproForm, setReproForm] = useState({
    rfid: '',
    tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
    bunting: '', hpl: '', catatan: ''
  });

  const handleTanggalIBChange = (e) => {
    const val = e.target.value;
    if (val) {
      const date = new Date(val);
      let b = '', h = '';
      if (!isNaN(date.getTime())) {
        const bDate = new Date(val);
        bDate.setMonth(bDate.getMonth() + 3);
        b = bDate.toISOString().split('T')[0];

        const hDate = new Date(val);
        hDate.setMonth(hDate.getMonth() + 9);
        hDate.setDate(hDate.getDate() + 10);
        h = hDate.toISOString().split('T')[0];
      }
      setReproForm({ ...reproForm, tanggal_ib: val, bunting: b, hpl: h });
    } else {
      setReproForm({ ...reproForm, tanggal_ib: val, bunting: '', hpl: '' });
    }
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
        bunting: '', hpl: '', catatan: ''
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
      link.download = `HERD_Laporan_Kandang_${new Date().toISOString().slice(0, 10)}.pdf`;
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
      handleError(err, 'buat laporan PDF');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Call all API endpoints concurrently
        const [statsRes, herdRes, intelRes, estrusRes] = await Promise.all([
          axiosInstance.get('/dashboard/stats'),
          axiosInstance.get('/hewan'),
          axiosInstance.get('/notifications?limit=5'),
          axiosInstance.get('/estrus-predictions?status=active')
        ]);

        const statsData = statsRes.data;
        const herdData = herdRes.data;
        const intelData = intelRes.data?.logs || [];
        const estrusData = estrusRes.data || [];
        
        setActiveEstrusPredictions(Array.isArray(estrusData) ? estrusData : []);

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
            } else if (item.severity?.toUpperCase() === 'WARNING' || item.type?.toLowerCase() === 'anomaly' || item.severity?.toLowerCase() === 'battery') {
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
        console.error('[HERD Dashboard] Error fetching real-time data:', err);
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
    if (currentHour >= 5 && currentHour < 12) greetingText = 'Selamat Pagi';
    else if (currentHour >= 12 && currentHour < 15) greetingText = 'Selamat Siang';
    else if (currentHour >= 15 && currentHour < 18) greetingText = 'Selamat Sore';
    else greetingText = 'Selamat Malam';
  } else {
    if (currentHour >= 5 && currentHour < 12) greetingText = 'Good Morning';
    else if (currentHour >= 12 && currentHour < 18) greetingText = 'Good Afternoon';
    else greetingText = 'Good Evening';
  }

  let statusMessage = '';
  if (stats.estrus > 0) {
    statusMessage = lang === 'id'
      ? `Ada ${stats.estrus} sapi yang terdeteksi birahi hari ini. Sebaiknya segera dicek untuk persiapan inseminasi buatan.`
      : `We detected ${stats.estrus} cows in active estrus today. Please review the details for artificial insemination.`;
  } else if (stats.ibWindows > 0) {
    statusMessage = lang === 'id'
      ? `Kondisi kandang aman. Ada ${stats.ibWindows} jadwal IB aktif yang perlu kamu persiapkan.`
      : `The barn condition is stable. There are ${stats.ibWindows} active breeding windows ready for prep.`;
  } else if (stats.avgTemp && parseFloat(stats.avgTemp) > 39.0) {
    statusMessage = lang === 'id'
      ? `Secara umum aman, tapi suhu rata-rata ternak sedikit hangat di ${stats.avgTemp}°C. Sebaiknya pantau ventilasi kandang agar tetap nyaman.`
      : `All looks good, but the herd's average temperature is slightly warm (${stats.avgTemp}°C). Keep an eye on ventilation.`;
  } else if (stats.collars > 0) {
    statusMessage = lang === 'id'
      ? `Sistem sedang memantau ${stats.collars} kalung sensor. Seluruh kondisi ternak terpantau stabil.`
      : `System is actively monitoring ${stats.collars} collar sensors. The herd status is fully stable.`;
  } else {
    statusMessage = lang === 'id'
      ? `Kondisi kandang terpantau stabil. Tidak ada anomali reproduksi yang terdeteksi.`
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

        {/* ─── 0. GREETING (GRADIENT DESIGN) ────────────────────────── */}
        <div 
          className="rounded-t-none rounded-b-[40px] p-6 pt-[76px] shadow-lg relative overflow-hidden mb-2 text-white flex flex-col justify-between -mx-4 md:-mx-[22px]" 
          style={{ 
            minHeight: '260px',
            background: 'linear-gradient(180deg, #2f7d31 0%, #164018 100%)'
          }}
        >
          {/* Subtle Sun Accent */}
          <Sun 
            size={180} 
            strokeWidth={1} 
            className="absolute -top-10 -right-10 text-white opacity-5 rotate-12 pointer-events-none" 
          />

          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[14px] font-medium opacity-90 mb-0.5">{greetingText}</p>
              <h1 className="text-[26px] md:text-[30px] font-black tracking-tight leading-none mb-2">{userName}</h1>
              <p className="text-[13px] font-medium opacity-80 max-w-[80%]">
                {lang === 'id' ? 'Ini ringkasan kondisi peternakanmu hari ini' : 'Here is your herd condition summary today'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center mt-8">
            <div className="flex-1">
              <div className="text-[40px] font-black leading-none">{stats.collars}</div>
              <div className="text-[13px] font-medium mt-1 opacity-90">{lang === 'id' ? 'Ternak dipantau' : 'Cows monitored'}</div>
            </div>
            <div className="w-px h-14 bg-white/30 mx-4 md:mx-6"></div>
            <div className="flex-1">
              <div className="text-[40px] font-black leading-none">{intel.filter(i => i.urgency === 'critical' || i.urgency === 'monitor').length}</div>
              <div className="text-[13px] font-medium mt-1 opacity-90">{lang === 'id' ? 'Perlu tindakan' : 'Action needed'}</div>
            </div>
          </div>
        </div>


        {/* ─── 2. URGENT ACTIONS CONTAINER ─────────────────────── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
          borderRadius: '12px',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {/* Subheader */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--red)' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', fontFamily: 'DM Sans, sans-serif' }}>
              Ada hal yang perlu kamu perhatikan hari ini
            </span>
          </div>

          {/* Urgent Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {intel.filter(card => card.urgency === 'critical' || card.urgency === 'monitor').length > 0 ? (
              intel.filter(card => card.urgency === 'critical' || card.urgency === 'monitor').map((card, i) => (
                <IntelCard key={i} {...card} t={t} />
              ))
            ) : (
              <div style={{
                padding: '14px', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                borderRadius: '10px', fontSize: '13px', color: 'var(--text-2)', textAlign: 'center'
              }}>
                Kondisi semua ternak terpantau aman. Tidak ada tindakan mendesak yang perlu dilakukan sekarang.
              </div>
            )}
          </div>
        </div>

        {/* ─── 3. QUICK ACTIONS ──────────────────────────────── */}
        <div>
          <p className="eyebrow" style={{ marginBottom: '12px' }}>AKSI CEPAT</p>
          <div className="flex flex-row gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2">
            <SquareQAButton icon={Plus} label="Tambah Ternak" onClick={() => setIsAddCowModalOpen(true)} />
            <SquareQAButton icon={Syringe} label="Tambah Data IB" onClick={() => {
              fetchSapiList();
              setIsReproModalOpen(true);
            }} />
            <SquareQAButton icon={Cpu} label="Pasang Kalung" onClick={() => setIsPairModalOpen(true)} />
            <SquareQAButton icon={Zap} label="Prediksi Estrus" onClick={() => setIsEstrusModalOpen(true)} />
          </div>
        </div>

        {/* ─── 4. CARD SOROTAN (WEEKLY INSIGHT) ──────────────── */}
        <InsightSlideshow onOpenDetail={(insight) => {
          setSelectedInsight(insight);
          setIsInsightModalOpen(true);
        }} />

        {/* ─── 4. REKOMENDASI LAINNYA ────────────────────────── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
          borderRadius: '12px',
          padding: '18px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p className="eyebrow" style={{ marginBottom: 0 }}>REKOMENDASI LAINNYA</p>
            {intel.filter(card => card.urgency === 'scheduled').length > 2 && (
              <button 
                onClick={() => setShowAllRecommendations(!showAllRecommendations)}
                className="text-xs font-bold text-[var(--color-primary)] hover:underline bg-transparent border-none cursor-pointer px-2 py-1 rounded-md hover:bg-[var(--color-primary)]/10 transition-colors"
              >
                {showAllRecommendations 
                  ? (lang === 'id' ? 'Tampilkan Lebih Sedikit' : 'View Less')
                  : (lang === 'id' ? 'Lihat Semua' : 'View All')}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {intel.filter(card => card.urgency === 'scheduled').length > 0 ? (
              <>
                {/* 2 Item Pertama Selalu Ditampilkan */}
                {intel.filter(card => card.urgency === 'scheduled')
                  .slice(0, 2)
                  .map((card, i) => {
                  const cowName = card.title.split('—')[0].trim() || 'Ternak';
                  let friendlyMsg = '';
                  if (card.title.toLowerCase().includes('kebuntingan')) {
                    friendlyMsg = `Update kebuntingan ${cowName} perlu dicatat. Sebaiknya diperbarui sekarang agar data kehamilan tetap akurat dan bisa diprediksi dengan baik.`;
                  } else if (card.title.toLowerCase().includes('inseminasi')) {
                    friendlyMsg = `Jadwal inseminasi ${cowName} sudah tiba. Pastikan persiapan sudah matang agar peluang kebuntingan maksimal.`;
                  } else if (card.title.toLowerCase().includes('estrus') || card.title.toLowerCase().includes('birahi')) {
                    friendlyMsg = `${cowName} menunjukkan tanda birahi. Waktu terbaik untuk inseminasi adalah 12–18 jam ke depan, jangan sampai terlewat.`;
                  } else {
                    friendlyMsg = `Ada hal yang perlu kamu tindak lanjuti untuk ${cowName}. Sebaiknya segera dicek agar tidak terlewat.`;
                  }
                  return (
                    <RecommendationCard
                      key={i}
                      title={card.title}
                      badgeText="SEDANG"
                      id={`C${Math.floor(Math.random() * 9000) + 1000}A`}
                      name={cowName}
                      daysLeft={Math.floor(Math.random() * 10) + 1}
                      icon={card.icon}
                      message={friendlyMsg}
                    />
                  );
                })}

                {/* Sisa Item dengan Transisi Smooth */}
                {intel.filter(card => card.urgency === 'scheduled').length > 2 && (
                  <div style={{ display: 'grid', gridTemplateRows: showAllRecommendations ? '1fr' : '0fr', transition: 'grid-template-rows 400ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: showAllRecommendations ? '10px' : '0px', transition: 'padding-top 400ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        {intel.filter(card => card.urgency === 'scheduled')
                          .slice(2)
                          .map((card, i) => {
                          const cowName = card.title.split('—')[0].trim() || 'Ternak';
                          let friendlyMsg = '';
                          if (card.title.toLowerCase().includes('kebuntingan')) {
                            friendlyMsg = `Update kebuntingan ${cowName} perlu dicatat. Sebaiknya diperbarui sekarang agar data kehamilan tetap akurat dan bisa diprediksi dengan baik.`;
                          } else if (card.title.toLowerCase().includes('inseminasi')) {
                            friendlyMsg = `Jadwal inseminasi ${cowName} sudah tiba. Pastikan persiapan sudah matang agar peluang kebuntingan maksimal.`;
                          } else if (card.title.toLowerCase().includes('estrus') || card.title.toLowerCase().includes('birahi')) {
                            friendlyMsg = `${cowName} menunjukkan tanda birahi. Waktu terbaik untuk inseminasi adalah 12–18 jam ke depan, jangan sampai terlewat.`;
                          } else {
                            friendlyMsg = `Ada hal yang perlu kamu tindak lanjuti untuk ${cowName}. Sebaiknya segera dicek agar tidak terlewat.`;
                          }
                          return (
                            <RecommendationCard
                              key={i + 2}
                              title={card.title}
                              badgeText="SEDANG"
                              id={`C${Math.floor(Math.random() * 9000) + 1000}A`}
                              name={cowName}
                              daysLeft={Math.floor(Math.random() * 10) + 1}
                              icon={card.icon}
                              message={friendlyMsg}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                padding: '14px', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                borderRadius: '10px', fontSize: '13px', color: 'var(--text-2)', textAlign: 'center'
              }}>
                Semua kondisi ternak hari ini dalam keadaan baik. Tidak ada rekomendasi tambahan untuk saat ini.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL: Tambah Reproduksi */}
      {isReproModalOpen && (
        <div className="fixed inset-0 z-[999] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in overflow-hidden touch-none">
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 w-full max-w-lg animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto overflow-x-hidden no-scrollbar">
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
                  style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                  className="w-full px-3 h-[42px] rounded-xl text-sm outline-none focus:border-[var(--color-primary)]"
                  required
                  value={reproForm.rfid}
                  onChange={e => setReproForm({ ...reproForm, rfid: e.target.value })}
                >
                  <option value="">-- {t.repro_choose_cow} --</option>
                  {sapiList.map(s => (
                    <option key={s.id} value={s.id}>{s.nama} ({s.id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="w-full min-w-0">
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_ib_date}</label>
                  <input
                    type="date"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }}
                    className="w-full px-4 h-[48px] rounded-xl text-sm outline-none focus:border-[var(--color-primary)]"
                    required
                    value={reproForm.tanggal_ib}
                    onChange={handleTanggalIBChange}
                  />
                </div>
                <div className="w-full min-w-0">
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_ib_count}</label>
                  <input type="number" min="1" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }} className="w-full px-4 h-[48px] rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" value={reproForm.jumlah_ib} onChange={e => setReproForm({ ...reproForm, jumlah_ib: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_inseminator}</label>
                <input
                  type="text"
                  placeholder={t.repro_inseminator_placeholder}
                  style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }}
                  className="w-full min-w-0 px-4 h-[48px] rounded-xl text-sm outline-none focus:border-[var(--color-primary)]"
                  value={reproForm.pemberi_ib}
                  onChange={e => setReproForm({ ...reproForm, pemberi_ib: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_notes}</label>
                <textarea rows="2" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }} className="w-full min-w-0 px-4 py-3 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] resize-none" placeholder={t.repro_notes_placeholder} value={reproForm.catatan} onChange={e => setReproForm({ ...reproForm, catatan: e.target.value })} />
              </div>

              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
                <h4 className="text-sm font-bold text-[var(--color-primary)] flex items-center gap-2 mb-4 uppercase tracking-wide">
                  <Calendar size={16} /> ESTIMASI JADWAL (AUTO)
                </h4>
                
                {(() => {
                  const ibDate = reproForm.tanggal_ib ? new Date(reproForm.tanggal_ib) : null;
                  const formatDate = (date) => {
                    if (!date || isNaN(date.getTime())) return '—';
                    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                  };

                  const estrusReturn = ibDate ? new Date(ibDate.getTime() + 21 * 24 * 60 * 60 * 1000) : null;
                  const pregCheck = ibDate ? new Date(ibDate.getTime() + 60 * 24 * 60 * 60 * 1000) : null;
                  const hpl = ibDate ? new Date(ibDate.getTime() + 283 * 24 * 60 * 60 * 1000) : null;
                  const weaning = hpl ? new Date(hpl.getTime() + 180 * 24 * 60 * 60 * 1000) : null;

                  return (
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                      <div>
                        <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-1">Deteksi Birahi Kembali</p>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{formatDate(estrusReturn)}</p>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-1">Pemeriksaan Kebuntingan</p>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{formatDate(pregCheck)}</p>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-1">Perkiraan Melahirkan (HPL)</p>
                        <p className="text-sm font-bold text-[var(--color-primary)]">{formatDate(hpl)}</p>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-1">Estimasi Lepas Sapih</p>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{formatDate(weaning)}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsReproModalOpen(false)} style={{ border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }} className="w-1/2 py-3 text-center">{t.btn_cancel}</button>
                <button type="submit" className="w-1/2 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-lg text-center" disabled={reproLoading}>
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

      {/* MODAL: Insight Detail */}
      {isInsightModalOpen && selectedInsight && (
        <div className="fixed inset-0 z-[999] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: `${selectedInsight.color}1A`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <selectedInsight.icon size={20} style={{ color: selectedInsight.color }} />
                </div>
                <h2 className="text-lg font-heading font-bold text-[var(--color-primary)]">
                  {selectedInsight.title}
                </h2>
              </div>
              <button onClick={() => setIsInsightModalOpen(false)} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <p style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: 600, lineHeight: 1.5 }}>
                {selectedInsight.summary}
              </p>
              <div style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-2)', borderRadius: '12px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                  {selectedInsight.detail}
                </p>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => setIsInsightModalOpen(false)}
                className="w-full py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {isEstrusModalOpen && (
        <div className="fixed inset-0 z-[999] flex justify-center items-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--bg-card)] w-full max-w-md rounded-[24px] shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)] flex items-center gap-2">
                <Zap size={22} className="text-[var(--color-accent)]" /> 
                Prediksi Estrus AI
              </h2>
              <button onClick={() => setIsEstrusModalOpen(false)} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--border)] transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4 mb-6">
                <div className="bg-white p-3 rounded-xl shadow-sm text-blue-500 h-fit flex-shrink-0">
                  <Activity size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 mb-1">Analisis Berhasil</h4>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    Sistem mendeteksi sapi dengan probabilitas tinggi mengalami estrus hari ini berdasarkan pola aktivitas pergerakan.
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {activeEstrusPredictions.slice(0, 5).map((pred, idx) => {
                  const prob = Math.round((pred.confidence_final || 0) * 100);
                  return (
                    <div 
                      key={pred.id} 
                      onClick={() => {
                        setIsEstrusModalOpen(false);
                        navigate('/ternak', { state: { selectedCowId: pred.cow_id } });
                      }}
                      className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full bg-[var(--color-accent)] ${idx === 0 ? 'animate-pulse' : ''}`} />
                        <div>
                          <p className="font-bold text-gray-900">{pred.cow_name || 'Sapi'} | {pred.cow_id}</p>
                          <p className="text-xs text-gray-500">Probabilitas: {prob}%</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  );
                })}
                {activeEstrusPredictions.length === 0 && (
                  <p className="text-sm text-center text-gray-500 py-4">Belum ada sapi terdeteksi estrus saat ini.</p>
                )}
              </div>

              <div className="flex">
                <button type="button" onClick={() => setIsEstrusModalOpen(false)} style={{ padding: '12px 24px', color: 'var(--color-primary)', fontWeight: 700, borderRadius: '12px', background: 'var(--color-primary-dim)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flex: 1 }}>Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── ADD COW MODAL ── */}
      <AddCowModal
        isOpen={isAddCowModalOpen}
        onClose={() => setIsAddCowModalOpen(false)}
        onSuccess={() => {
          setIsAddCowModalOpen(false);
          // Optional: refresh dashboard data if needed
          fetchDashboardData();
        }}
      />
    </>
  );
}
