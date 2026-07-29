// src/pages/Dashboard.jsx
// HERD Dashboard — Neo Bio-Tech Intelligence UI (MP-3 §4, §7-9)

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Scan, Plus, Cpu, FileText, Bell,
  Thermometer, AlertTriangle, BatteryWarning, CheckCircle2,
  Sparkles, Wifi, Zap, Calendar, X, Check, ChevronRight, Activity, Syringe, ClipboardList, ThermometerSun, Target, Sun, Settings2, Database, ShieldAlert
} from 'lucide-react';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import { handleError } from '@/lib/errorHandler';
import SeeAllLink from '@/components/ui/SeeAllLink';
import PairCollarModal from '@/components/shared/PairCollarModal';
import AddCowModal from '@/components/shared/AddCowModal';
import ReproModal from '@/components/shared/ReproModal';
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
      <div className="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `${color}15`, color }}>
        <Icon size={20} />
      </div>
      <span className="text-[11px] font-bold text-[var(--text-1)] text-center group-hover:text-[var(--color-primary)] transition-colors">{label}</span>
    </button>
  );
}

// ── ANIMATED QUICK ACTION BUTTON (DESKTOP) — Kontak-style expand ─
function AnimatedQAButton({ icon: Icon, label, onClick }) {
  const spanRef = React.useRef(null);
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center rounded-full bg-white border border-gray-200 shadow-sm cursor-pointer transition-all duration-300 hover:border-[var(--color-primary)] hover:shadow-md hover:bg-[var(--color-primary-dim)]"
      style={{ padding: '11px', gap: 0 }}
      onMouseEnter={e => {
        e.currentTarget.style.paddingLeft = '18px';
        e.currentTarget.style.paddingRight = '18px';
        e.currentTarget.style.gap = '8px';
        e.currentTarget.style.background = 'var(--color-primary)';
        e.currentTarget.style.borderColor = 'var(--color-primary)';
        if (spanRef.current) { spanRef.current.style.fontSize = '13px'; spanRef.current.style.color = '#fff'; }
        const icon = e.currentTarget.querySelector('svg');
        if (icon) icon.style.color = '#fff';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.paddingLeft = '11px';
        e.currentTarget.style.paddingRight = '11px';
        e.currentTarget.style.gap = '0';
        e.currentTarget.style.background = '';
        e.currentTarget.style.borderColor = '';
        if (spanRef.current) { spanRef.current.style.fontSize = '0'; spanRef.current.style.color = ''; }
        const icon = e.currentTarget.querySelector('svg');
        if (icon) icon.style.color = '';
      }}
    >
      <Icon size={20} className="text-gray-600 group-hover:text-[var(--color-primary)] flex-shrink-0 transition-colors duration-200" />
      <span
        ref={spanRef}
        className="font-bold text-[var(--color-primary)] whitespace-nowrap overflow-hidden transition-all duration-300"
        style={{ fontSize: 0 }}
      >
        {label}
      </span>
    </button>
  );
}

// ── TREN AKTIVITAS CHART ─────────────────────────────────────
const CHART_DATA = {
  Hari: {
    bars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    labels: ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17'],
  },
  Minggu: {
    bars: [0, 0, 0, 0, 0, 0, 0],
    labels: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  },
  Bulan: {
    bars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
  },
};

function TrenAktivitasChart({ lang }) {
  const [activeFilter, setActiveFilter] = useState('Minggu');
  const data = CHART_DATA[activeFilter];
  return (
    <div className="bg-white border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col flex-1 w-full relative h-full min-h-[320px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="font-bold text-[var(--text-1)] text-lg whitespace-nowrap">{lang === 'id' ? 'Tren Aktivitas Kawanan' : 'Herd Activity Trend'}</h3>
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-hide">
          {['Hari', 'Minggu', 'Bulan'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                activeFilter === filter
                  ? 'bg-[#16A34A] text-white'
                  : 'text-[var(--text-2)] hover:text-[#16A34A] hover:bg-green-50'
              }`}
            > {lang === 'id' ? filter : filter === 'Hari' ? 'Day' : filter === 'Minggu' ? 'Week' : 'Month'} </button>
          ))}
        </div>
      </div>
      <div className="flex-1 w-full overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar">
        <div className="flex items-end justify-between gap-2 px-2 h-[200px] mt-4" style={{ minWidth: data.bars.length > 7 ? '500px' : '100%' }}>
          {data.bars.map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1 min-w-[30px] group cursor-pointer h-full justify-end">
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 group-hover:text-[#16A34A] transition-colors">{h}</span>
              <div className="w-full max-w-[35px] flex justify-center items-end bg-green-50 rounded-t-xl relative group-hover:bg-green-100 transition-colors" style={{ height: '85%' }}>
                <div className="w-full bg-[#16A34A] rounded-t-xl transition-all duration-500 group-hover:opacity-80" style={{ height: `${h}%`, minHeight: h === 0 ? '4px' : `${h}%` }}></div>
              </div>
              <span className="text-[10px] sm:text-[11px] text-gray-500 font-bold uppercase whitespace-nowrap mt-1">{data.labels[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
function RecommendationCard({ title, badgeText, id, name, daysLeft, icon: Icon, message, cow_id }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const actionName = title.split('—')[1]?.trim() || title;
  const displayTitle = name;

  const handleAction = (e) => {
    e.stopPropagation();
    toast.success('Melanjutkan tindakan rekomendasi sistem...');

    if (name || cow_id || id) {
      navigate('/ternak', { state: { selectedCowId: name || cow_id || id, fromDashboard: true } });
    } else {
      navigate('/ternak');
    }
  };

  const handleFinish = (e) => {
    e.stopPropagation();
    toast.success('Tugas ditandai selesai!');
    setIsExpanded(false);
  };

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col shadow-sm hover:border-[#2f7d31]/30 transition-all cursor-pointer relative overflow-hidden"
    >
      <span className="absolute top-4 right-4 text-[10px] font-bold text-blue-600 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
        {badgeText}
      </span>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-blue-500" />
        </div>
        <div className="flex flex-col flex-1 min-w-0 pr-16">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-bold text-gray-900 font-display truncate capitalize">{displayTitle}</h4>
          </div>
          <p className="text-xs text-gray-600 font-medium mb-1.5 flex items-center gap-1">
            {actionName} | Dalam {daysLeft} hari
          </p>
          {!isExpanded && (
            <p className="text-[10px] text-[var(--color-primary)] font-semibold mt-1 opacity-80 flex items-center gap-1">
              Ketuk untuk detail <ChevronRight size={10} />
            </p>
          )}
        </div>
      </div>

      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr', opacity: isExpanded ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          {message && (
            <div className="mt-3 text-[11px] text-gray-700 leading-snug">
              {message}
            </div>
          )}
          <div className="h-px w-full bg-gray-100 my-3" />
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 bg-[#2f7d31] hover:bg-[#007b46] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <Check size={14} /> Selesai
            </button>
            <button
              onClick={handleAction}
              className="flex items-center justify-center w-8 h-8 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
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

// ── DASHBOARD SLOT CARD ──────────────────────────────────────
function DashSlotCard({ slotType, activePopover, setActivePopover, slotId, stats, herd, intel, sapiList, navigate, lang, t, ChevronRight }) {
  let count = 0;
  let label = '';
  let popoverData = [];
  let Icon = Database;

  const actionable = intel.filter(i => i.urgency === 'critical' || i.urgency === 'monitor');
  const monitored = herd.filter(c => !!c.collar_id);

  if (slotType === 'total') {
    count = herd.length;
    label = lang === 'id' ? 'Total ternak' : 'Total cows';
    popoverData = sapiList;
    Icon = Database;
  } else if (slotType === 'sehat') {
    count = herd.length;
    label = lang === 'id' ? 'Kondisi sehat' : 'Healthy';
    popoverData = sapiList;
    Icon = CheckCircle2;
  } else if (slotType === 'estrus') {
    count = stats.estrus ?? 0;
    label = lang === 'id' ? 'Sedang Birahi' : 'In estrus';
    popoverData = [];
    Icon = Zap;
  } else if (slotType === 'tindakan') {
    count = actionable.length;
    label = lang === 'id' ? 'Perlu tindakan' : 'Action needed';
    popoverData = actionable;
    Icon = ShieldAlert;
  }

  const handleClick = (e) => {
    e.stopPropagation();
    if (count === 0) {
      if (slotType === 'pantau') toast.error("lang === 'id' ? 'Waduh, belum ada ternak yang dipantau nih! Yuk pasang kalungnya dulu' : 'Oops, no cattle are being monitored yet! Let\'s pair the collar first'");
      if (slotType === 'tindakan') toast.success("Semua ternak dalam kondisi baik. Tidak ada tindakan mendesak.");
      if (slotType === 'total' && count === 0) toast.error("Belum ada data ternak.");
      return;
    }
    setActivePopover(activePopover === slotId ? null : slotId);
  };

  return (
    <div className="flex-1 relative">
      <div
        onClick={handleClick}
        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 md:p-3 flex flex-col gap-1.5 md:gap-2 relative cursor-pointer hover:bg-white/20 transition-colors shadow-sm"
      >
        <div className="flex items-center gap-1.5 md:gap-2 text-white/80 overflow-hidden">
          <Icon size={14} className="flex-shrink-0" />
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider truncate">{label}</span>
        </div>
        <div className="flex items-baseline gap-0.5 md:gap-1">
          <span className="text-lg md:text-xl font-black">{count}</span>
        </div>
      </div>

      {activePopover === slotId && (
        <div
          className="absolute top-full left-0 mt-2 w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-h-64 overflow-y-auto p-3 flex flex-col gap-2">
            {popoverData.map((c, i) => {
              let statusText = 'Sehat';
              let colorClass = 'text-[var(--accent)]';

              const cowId = c.cow_id || c.id || c.rfid;
              const cowName = c.cow_name || c.name || c.nama || (cowId ? `Sapi #${cowId.slice(0, 5)}` : (c.title ? c.title.split('—')[0].trim() : 'Unknown'));

              if (c.status === 'estrus' || c.urgency === 'critical') {
                statusText = c.status === 'estrus' ? 'Birahi' : 'Kritis';
                colorClass = 'text-[var(--red)]';
              } else if (c.status === 'monitor' || c.urgency === 'monitor') {
                statusText = c.rawStatus ? c.rawStatus.charAt(0).toUpperCase() + c.rawStatus.slice(1).toLowerCase() : 'Butuh Perawatan';
                colorClass = 'text-[var(--amber)]';
              } else if (c.rawStatus && c.rawStatus.toLowerCase() !== 'sehat' && c.rawStatus.toLowerCase() !== 'normal') {
                statusText = c.rawStatus.charAt(0).toUpperCase() + c.rawStatus.slice(1).toLowerCase();
              }

              const shortId = cowId ? (cowId.length > 5 ? cowId.slice(0, 5).toUpperCase() + '...' : cowId.toUpperCase()) : 'N/A';

              return (
                <div key={i} onClick={() => navigate('/ternak', { state: { selectedCowId: cowId, fromDashboard: true } })} className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--bg-card)] cursor-pointer text-left">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-1)] m-0">{cowName}</p>
                    <p className={`text-[12px] font-semibold m-0 mt-0.5 ${colorClass}`}>
                      {shortId} <span className="text-[var(--text-3)] font-normal mx-1">|</span> {statusText}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-3)]" />
                </div>
              );
            })}
          </div>
          <div className="border-t border-[var(--border)] p-2">
            <button
              onClick={() => navigate('/ternak')}
              className="w-full py-2.5 text-[13px] font-bold text-[var(--text-1)] bg-[var(--bg-card)] rounded-[14px] hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              Lihat Lebih Lanjut <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

  const [activePopover, setActivePopover] = useState(null);
  const [activeEstrusPredictions, setActiveEstrusPredictions] = useState([]);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const { sapiList, fetchSapiList, tambahReproduksi, loading: reproLoading } = useTernakStore();
  const [isReproModalOpen, setIsReproModalOpen] = useState(false);
  const [isEstrusModalOpen, setIsEstrusModalOpen] = useState(false);
  const [isAddCowModalOpen, setIsAddCowModalOpen] = useState(false);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);

  const [selectedWidgets, setSelectedWidgets] = useState(() => {
    const valid = ['total', 'sehat', 'estrus', 'tindakan'];
    let s1 = localStorage.getItem('dash_slot1');
    let s2 = localStorage.getItem('dash_slot2');
    if (!valid.includes(s1)) s1 = 'total';
    if (!valid.includes(s2)) s2 = 'sehat';
    if (s1 === s2) { s1 = 'total'; s2 = 'sehat'; }
    return [s1, s2];
  });
  const [showWidgetModal, setShowWidgetModal] = useState(false);

  useEffect(() => {
    if (selectedWidgets[0]) localStorage.setItem('dash_slot1', selectedWidgets[0]);
    if (selectedWidgets[1]) localStorage.setItem('dash_slot2', selectedWidgets[1]);
  }, [selectedWidgets]);

  useEffect(() => {
    const mainContainer = document.getElementById('main-scroll-container');
    const isAnyModalOpen = isInsightModalOpen || isPairModalOpen || isReproModalOpen || isEstrusModalOpen || isAddCowModalOpen;

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      if (mainContainer) {
        mainContainer.style.overflow = 'hidden';
        mainContainer.style.touchAction = 'none';
      }
    } else {
      document.body.style.overflow = 'auto';
      if (mainContainer) {
        mainContainer.style.overflow = 'auto';
        mainContainer.style.touchAction = '';
      }
    }

    return () => {
      document.body.style.overflow = 'auto';
      if (mainContainer) {
        mainContainer.style.overflow = 'auto';
        mainContainer.style.touchAction = '';
      }
    };
  }, [isInsightModalOpen, isPairModalOpen, isReproModalOpen, isEstrusModalOpen, isAddCowModalOpen]);


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
            id: cow.cow_id || cow.id, // Handle fallback
            name: cow.nama || 'Sapi',
            status: cowStatus,
            rawStatus: cow.status_kesehatan || cow.status || '',
            temp: cow.temp !== null && cow.temp !== undefined ? cow.temp : null,
            battery: cow.battery !== null && cow.battery !== undefined ? cow.battery : null,
            collar_id: cow.collar_id || null
          };
        });
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
                title += lang === 'id' ? 'Deteksi Birahi' : 'Estrus Detected';
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
              cow_id: item.cow_id,
              cow_name: item.cow_name || item.title?.split('—')[0]?.trim() || '',
            };
          });
          setIntel(mappedIntel);
        } else {
          // Fallback if no predictions in DB yet
          setIntel([]);
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
      <div onClick={() => setActivePopover(null)} className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ─── MOBILE VIEW (OLD DESIGN) ─── */}
        <div className="flex md:hidden flex-col gap-4">
          {/* ─── 0. GREETING (GRADIENT DESIGN) ─── */}
          <div
            className="rounded-t-none rounded-b-[40px] p-6 pt-[86px] shadow-lg relative overflow-hidden text-white flex flex-col justify-between -mx-4 mb-2"
            style={{
              minHeight: '260px',
              background: 'linear-gradient(180deg, #2f7d31 0%, #164018 100%)'
            }}
          >
            {/* Subtle Sun Accent */}
            <div className="absolute inset-0 overflow-hidden rounded-b-[40px] pointer-events-none">
              <Sun
                size={180}
                strokeWidth={1}
                className="absolute -top-10 -right-10 text-white opacity-5 rotate-12"
              />
            </div>

            <div className="flex justify-between items-start relative z-10">
              <div className="w-full">
                <div className="flex justify-between items-start w-full">
                  <div>
                    <p className="text-[14px] font-medium opacity-90 mb-0.5">{greetingText}</p>
                    <h1 className="text-[26px] font-black tracking-tight leading-none mb-2">{userName}</h1>
                    <p className="text-[13px] font-medium opacity-80 max-w-[80%]">
                      {lang === 'id' ? 'Ini ringkasan kondisi peternakanmu hari ini' : 'Here is your herd condition summary today'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowWidgetModal(true); }}
                    className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                  >
                    <Settings2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-8 relative z-20">
              <DashSlotCard
                slotType={selectedWidgets[0] || 'total'}
                activePopover={activePopover} setActivePopover={setActivePopover}
                slotId="slot1" stats={stats} herd={herd} intel={intel}
                sapiList={herd} navigate={navigate} lang={lang} t={t} ChevronRight={ChevronRight}
              />
              <DashSlotCard
                slotType={selectedWidgets[1] || 'sehat'}
                activePopover={activePopover} setActivePopover={setActivePopover}
                slotId="slot2" stats={stats} herd={herd} intel={intel}
                sapiList={herd} navigate={navigate} lang={lang} t={t} ChevronRight={ChevronRight}
              />
            </div>
          </div>

          {/* ─── 2. URGENT ACTIONS CONTAINER ─── */}
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
                {lang === 'id' ? 'Ada hal yang perlu kamu perhatikan hari ini' : 'Things to pay attention to today'}
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
                  {lang === 'id' ? 'Kondisi semua ternak terpantau aman. Tidak ada tindakan mendesak yang perlu dilakukan sekarang.' : 'All cattle conditions are monitored safe. No urgent action needed now.'}
                </div>
              )}
            </div>
          </div>

          {/* ─── 3. QUICK ACTIONS ─── */}
          <div>
            <p className="eyebrow" style={{ marginBottom: '12px' }}>AKSI CEPAT</p>
            <div className="flex flex-row gap-3 overflow-x-auto no-scrollbar pb-2">
              <SquareQAButton icon={Plus} label={lang === 'id' ? 'Tambah Ternak' : 'Add Cattle'} onClick={() => setIsAddCowModalOpen(true)} />
              <SquareQAButton icon={Syringe} label={lang === 'id' ? 'Tambah Data IB' : 'Add AI Data'} onClick={() => {
                fetchSapiList();
                setIsReproModalOpen(true);
              }} />
              <SquareQAButton icon={Cpu} label={lang === 'id' ? 'Pasang Kalung' : 'Pair Collar'} onClick={() => setIsPairModalOpen(true)} />
              <SquareQAButton icon={Zap} label={lang === 'id' ? 'Prediksi Birahi' : 'Estrus Prediction'} onClick={() => setIsEstrusModalOpen(true)} />
            </div>
          </div>

          {/* ─── 5. REKOMENDASI LAINNYA ─── */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 22px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p className="eyebrow" style={{ marginBottom: 0 }}>REKOMENDASI LAINNYA</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {intel.filter(card => card.urgency === 'scheduled').length > 0 ? (
                <>
                  {intel.filter(card => card.urgency === 'scheduled')
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
                        friendlyMsg = card.sub || card.recommendation || `Ada hal yang perlu kamu tindak lanjuti untuk ${cowName}. Sebaiknya segera dicek agar tidak terlewat.`;
                      }
                      return (
                        <RecommendationCard
                          key={i}
                          title={card.title}
                          badgeText="SEDANG"
                          id={card.cow_id ? `C${card.cow_id.slice(0, 4).toUpperCase()}A` : `C${Math.floor(Math.random() * 9000) + 1000}A`}
                          name={cowName}
                          daysLeft={Math.floor(Math.random() * 10) + 1}
                          icon={card.icon}
                          message={friendlyMsg}
                          cow_id={card.cow_id}
                        />
                      );
                    })}
                </>
              ) : (
                <div style={{
                  padding: '14px', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                  borderRadius: '10px', fontSize: '13px', color: 'var(--text-2)', textAlign: 'center'
                }}>
                  {lang === 'id' ? 'Semua kondisi ternak hari ini dalam keadaan baik. Tidak ada rekomendasi tambahan untuk saat ini.' : 'All cattle conditions today are good. No additional recommendations at this time.'}
                </div>
              )}
            </div>
          </div>

          {/* ─── 6. MOBILE WIDGETS ─── */}
          <div className="flex flex-col gap-4 mb-4">
            {/* Ringkasan Birahi (Donut) */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col items-center">
              <h3 className="font-bold text-[var(--text-1)] text-[15px] mb-4 self-start w-full">{lang === 'id' ? 'Ringkasan Birahi' : 'Estrus Summary'}</h3>
              <p className="text-xs text-gray-500 self-start -mt-3 mb-3">{lang === 'id' ? '7 hari terakhir' : 'Last 7 days'}</p>
              <div className="flex w-full items-center gap-4">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bg-surface)" strokeWidth="12" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#16A34A" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - (stats.estrus || 1) / Math.max(herd.length, 1))} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black leading-none text-gray-900">{stats.estrus || 0}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-[#16A34A] rounded-sm"></div>{lang === 'id' ? ' Birahi' : ' In Estrus'}</div>
                    <span className="font-medium">{stats.estrus || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-300 rounded-sm"></div>{lang === 'id' ? ' Tidak Birahi' : ' Not in Estrus'}</div>
                    <span className="font-medium">{Math.max((herd.length || 0) - (stats.estrus || 0), 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-gray-300 rounded-sm"></div>{lang === 'id' ? ' Tidak Terdeteksi' : ' Undetected'}</div>
                    <span className="font-medium">0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Prediksi Birahi */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-bold text-[var(--text-1)] text-[15px]">{lang === 'id' ? 'Prediksi Birahi' : 'Estrus Prediction'}</h3>
              </div>
              <p className="text-[11px] text-gray-500 mb-4">{lang === 'id' ? '(3 Hari ke Depan)' : '(Next 3 Days)'}</p>
              
              <div className="flex flex-col gap-3">
                {activeEstrusPredictions.length > 0 ? activeEstrusPredictions.slice(0, 3).map((pred, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-gray-100 pb-2.5 last:border-0 last:pb-0">
                    <span className="text-[13px] font-bold text-gray-900">{pred.cow_name || pred.cow_id || 'SAPI-000'}</span>
                    <span className="text-[12px] text-gray-600">Hari ke-{i + 1}</span>
                    <span className="text-[12px] font-medium text-gray-900">{Math.round((pred.confidence_final || 0.8) * 100)}%</span>
                  </div>
                )) : (
                  <div className="text-[12px] text-gray-500 text-center py-2">{lang === 'id' ? 'Tidak ada prediksi terdekat.' : 'No upcoming predictions.'}</div>
                )}
              </div>
              <button onClick={() => navigate('/prediksi-estrus')} className="text-[11px] font-bold text-gray-500 hover:text-gray-900 text-left mt-3 flex items-center gap-1 w-max">
                Lihat semua <ChevronRight size={12} />
              </button>
            </div>

            {/* Status Populasi */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col items-center">
              <h3 className="font-bold text-[var(--text-1)] text-[15px] self-start w-full">{lang === 'id' ? 'Status Populasi' : 'Population Status'}</h3>
              <div className="relative w-32 h-32 flex items-center justify-center mt-2">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bg-surface)" strokeWidth="14" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-primary)" strokeWidth="14" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (herd.length > 0 ? (herd.filter(c => c.status === 'normal' || !c.status).length / herd.length) : 0))} strokeLinecap="round" className="opacity-90 transition-all duration-1000" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--amber)" strokeWidth="14" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (herd.length > 0 ? (herd.filter(c => c.status !== 'normal' && c.status).length / herd.length) : 0))} strokeLinecap="round" className="transition-all duration-1000" style={{ strokeDashoffset: 251.2 - (251.2 * (herd.length > 0 ? (herd.filter(c => c.status !== 'normal' && c.status).length / herd.length) : 0)), transformOrigin: 'center', transform: `rotate(${360 * (herd.length > 0 ? (herd.filter(c => c.status === 'normal' || !c.status).length / herd.length) : 0)}deg)` }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
                  <span className="text-2xl font-black leading-none text-[var(--text-1)]">{herd.length > 0 ? Math.round((herd.filter(c => c.status === 'normal' || !c.status).length / herd.length) * 100) + '%' : '0%'}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-3)] mt-1">{lang === 'id' ? 'Sehat' : 'Healthy'}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-4 w-full justify-center">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-2)]"><div className="w-2 h-2 rounded-full bg-[var(--color-primary)]"></div> Sehat</div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-2)]"><div className="w-2 h-2 rounded-full bg-[var(--amber)]"></div> Monitor</div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-2)]"><div className="w-2 h-2 rounded-full bg-[var(--border)]"></div> Sakit</div>
              </div>
            </div>

            {/* Kondisi Kandang (IoT) */}
            <div className="rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col min-h-[220px]" style={{ background: 'linear-gradient(145deg, #022C22 0%, #064E3B 100%)' }}>
              <div className="absolute top-0 right-0 p-4">
                <ThermometerSun size={24} className="text-emerald-400 opacity-80" />
              </div>
              <h3 className="font-semibold text-emerald-100 mb-0.5 text-[13px] z-10 opacity-90">{lang === 'id' ? 'Kondisi Kandang (IoT)' : 'Farm Condition (IoT)'}</h3>
              <p className="text-[11px] text-emerald-200/70 mb-auto z-10 font-medium">{lang === 'id' ? 'Terakhir diperbarui:' : 'Last updated:'} {stats.lastSync}</p>

              <div className="mt-6 z-10 relative">
                <div className="text-[40px] font-black text-white leading-none tracking-tight flex items-start gap-1">
                  {stats.avgTemp || '--'}<span className="text-xl mt-1 text-emerald-200">°C</span>
                </div>
              </div>

              <svg className="absolute bottom-0 left-0 right-0 w-full opacity-40 text-emerald-500 pointer-events-none" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ height: '50%' }}>
                <path fill="currentColor" d="M0 40 C 20 20, 40 40, 60 20 C 80 0, 100 20, 100 40 Z" />
                <path fill="currentColor" d="M0 40 C 30 10, 60 30, 100 10 L 100 40 Z" className="opacity-50" />
              </svg>
            </div>

            {/* Aktivitas Terbaru */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col">
              <h3 className="font-bold text-[var(--text-1)] text-[15px] mb-4">{lang === 'id' ? 'Aktivitas Terbaru' : 'Recent Activities'}</h3>
              <div className="flex flex-col gap-4">
                <div className="text-[12px] text-gray-500 text-center py-2">{lang === 'id' ? 'Belum ada aktivitas hari ini.' : 'No activities today.'}</div>
              </div>
              <button onClick={() => navigate('/ternak')} className="text-[11px] font-bold text-gray-500 hover:text-gray-900 text-left mt-4 flex items-center gap-1 w-max">
                {lang === 'id' ? 'Lihat semua aktivitas' : 'View all activities'} <ChevronRight size={12} />
              </button>
            </div>

            {/* Grafik Tren Aktivitas Kawanan */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col overflow-hidden">
              <div className="relative overflow-hidden -mx-4 -my-4 sm:-mx-5 sm:-my-5" style={{ minHeight: '220px' }}>
                <TrenAktivitasChart lang={lang} />
              </div>
            </div>
          </div>

        </div>

        {/* ─── DESKTOP BENTO GRID DASHBOARD ─── */}
        <div className="hidden md:flex md:flex-col md:gap-0">

          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 mt-2 md:mt-4">
            <div>
              <h1 className="text-[32px] md:text-[36px] font-black tracking-tight leading-none text-[var(--text-1)]">
                Dashboard
              </h1>
              <p className="text-[13px] font-medium text-[var(--text-2)] mt-2">
                {lang === 'id' ? 'Ringkasan kondisi peternakanmu hari ini' : 'Here is your herd condition summary today'}
              </p>
            </div>
          </div>

          {/* ROW 1: 3 STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1: Total */}
            <div className="bg-[var(--color-primary)] text-white p-5 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden h-[140px]">
              <div className="flex justify-between items-start relative z-10">
                <span className="font-semibold text-sm">{lang === 'id' ? 'Total Ternak' : 'Total Cattle'}</span>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Database size={16} />
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-[40px] font-black leading-none mb-1">{herd.length}</div>
                <div className="text-xs text-emerald-100 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {lang === 'id' ? 'Kondisi terpantau' : 'Conditions monitored'}
                </div>
              </div>
              <Sun size={140} strokeWidth={1} className="absolute -bottom-10 -right-10 text-white opacity-10 rotate-12" />
            </div>

            {/* Card 3: Estrus */}
            <div className="bg-white border border-[var(--border)] p-5 rounded-2xl flex flex-col justify-between shadow-sm h-[140px]">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-sm text-[var(--text-2)]">{lang === 'id' ? 'Sedang Birahi' : 'In Estrus'}</span>
                <div className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--bg-surface)] cursor-pointer" onClick={() => setIsEstrusModalOpen(true)}>
                  <ChevronRight size={16} />
                </div>
              </div>
              <div>
                <div className="text-[32px] font-black leading-none mb-1 text-[var(--text-1)]">
                  {intel.filter(card => card.title.toLowerCase().includes('estrus') || card.title.toLowerCase().includes('birahi')).length}
                </div>
                <div className="text-xs text-amber-600 flex items-center gap-1 font-semibold bg-amber-50 w-fit px-2 py-0.5 rounded-md">
                  <Zap size={12} /> {lang === 'id' ? 'Siap IB' : 'Ready AI'}
                </div>
              </div>
            </div>

            {/* Card 4: Butuh Perhatian */}
            <div className="bg-white border border-[var(--border)] p-5 rounded-2xl flex flex-col justify-between shadow-sm h-[140px]">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-sm text-[var(--text-2)]">{lang === 'id' ? 'Perlu Tindakan' : 'Needs Action'}</span>
                <div className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--bg-surface)] cursor-pointer">
                  <ChevronRight size={16} />
                </div>
              </div>
              <div>
                <div className="text-[32px] font-black leading-none mb-1 text-[var(--text-1)]">
                  {intel.filter(i => i.urgency === 'critical' || i.urgency === 'monitor').length}
                </div>
                <div className="text-xs text-red-600 flex items-center gap-1 font-semibold bg-red-50 w-fit px-2 py-0.5 rounded-md">
                  <ShieldAlert size={12} /> {lang === 'id' ? 'Cek Sekarang' : 'Check Now'}
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: PERHATIAN + REKOMENDASI side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* PERHATIAN HARI INI */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                <span className="font-bold text-[var(--text-1)] text-[14px]">{lang === 'id' ? 'Perhatian yang harus dilakukan hari ini' : 'Attention required today'}</span>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar" style={{ maxHeight: '200px' }}>
                {intel.filter(card => card.urgency === 'critical' || card.urgency === 'monitor').length > 0 ? (
                  intel.filter(card => card.urgency === 'critical' || card.urgency === 'monitor').map((card, i) => (
                    <IntelCard key={i} {...card} t={t} />
                  ))
                ) : (
                  <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-[13px] text-[var(--text-2)] text-center">
                    Kondisi semua ternak terpantau aman.
                  </div>
                )}
              </div>
            </div>

            {/* REKOMENDASI LAINNYA */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
              <span className="font-bold text-[var(--text-1)] text-[14px]">{lang === 'id' ? 'Rekomendasi Lainnya' : 'Other Recommendations'}</span>
              <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar" style={{ maxHeight: '200px' }}>
                {intel.filter(card => card.urgency === 'scheduled').length > 0 ? (
                  intel.filter(card => card.urgency === 'scheduled').map((card, i) => {
                    let cowName = card.cow_name || "Sapi";
                    let friendlyMsg = card.title.toLowerCase().includes('vaksin')
                      ? (card.recommendation || `Jadwal vaksinasi rutin untuk ${cowName} akan segera tiba.`)
                      : (card.sub || card.recommendation || `Ada hal yang perlu ditindak lanjuti untuk ${cowName}.`);
                    return (
                      <RecommendationCard
                        key={i}
                        title={card.title}
                        badgeText="SEDANG"
                        id={card.cow_id ? `C${card.cow_id.slice(0, 4).toUpperCase()}A` : `C${Math.floor(Math.random() * 9000) + 1000}A`}
                        name={cowName}
                        daysLeft={Math.floor(Math.random() * 10) + 1}
                        icon={card.icon}
                        message={friendlyMsg}
                        cow_id={card.cow_id}
                      />
                    );
                  })
                ) : (
                  <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-[13px] text-[var(--text-2)] text-center">
                    Tidak ada rekomendasi tambahan untuk saat ini.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROW 3: ESTRUS SUMMARY & PREDICTION & POPULATION */}
          <div className="grid grid-cols-1 lg:grid-cols-[4fr_3fr_3fr] gap-4 mt-4">
            {/* Ringkasan Birahi (Donut) */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col items-center">
              <h3 className="font-bold text-[var(--text-1)] text-lg mb-6 self-start w-full">{lang === 'id' ? 'Ringkasan Birahi' : 'Estrus Summary'}</h3>
              <p className="text-xs text-gray-500 self-start -mt-5 mb-4">{lang === 'id' ? '7 hari terakhir' : 'Last 7 days'}</p>
              <div className="flex w-full items-center gap-6">
                <div className="relative w-32 h-32 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bg-surface)" strokeWidth="12" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#16A34A" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - (stats.estrus || 1) / Math.max(herd.length, 1))} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black leading-none text-gray-900">{stats.estrus || 0}</span>
                    <span className="text-[9px] font-bold text-gray-500 mt-1">{lang === 'id' ? 'Sapi Birahi' : 'Cows in Estrus'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-[#16A34A] rounded-sm"></div>{lang === 'id' ? ' Birahi' : ' In Estrus'}</div>
                    <span className="font-medium">{stats.estrus || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-300 rounded-sm"></div>{lang === 'id' ? ' Tidak Birahi' : ' Not in Estrus'}</div>
                    <span className="font-medium">{Math.max((herd.length || 0) - (stats.estrus || 0), 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-gray-300 rounded-sm"></div>{lang === 'id' ? ' Tidak Terdeteksi' : ' Undetected'}</div>
                    <span className="font-medium">0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Prediksi Birahi */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-bold text-[var(--text-1)] text-lg">{lang === 'id' ? 'Prediksi Birahi' : 'Estrus Prediction'}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-6">{lang === 'id' ? '(3 Hari ke Depan)' : '(Next 3 Days)'}</p>
              
              <div className="flex flex-col gap-4 flex-1">
                {activeEstrusPredictions.length > 0 ? activeEstrusPredictions.slice(0, 3).map((pred, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm font-bold text-gray-900">{pred.cow_name || pred.cow_id || 'SAPI-000'}</span>
                    <span className="text-sm text-gray-600">Hari ke-{i + 1}</span>
                    <span className="text-sm font-medium text-gray-900">{Math.round((pred.confidence_final || 0.8) * 100)}%</span>
                  </div>
                )) : (
                  <div className="text-sm text-gray-500 text-center py-4">{lang === 'id' ? 'Tidak ada prediksi terdekat.' : 'No upcoming predictions.'}</div>
                )}
              </div>
              <button onClick={() => navigate('/prediksi-estrus')} className="text-xs font-bold text-gray-500 hover:text-gray-900 text-left mt-auto flex items-center gap-1 transition-colors w-max">
                Lihat semua <ChevronRight size={14} />
              </button>
            </div>

            {/* Status Populasi */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col items-center justify-between">
              <h3 className="font-bold text-[var(--text-1)] text-lg self-start w-full">{lang === 'id' ? 'Status Populasi' : 'Population Status'}</h3>
              <div className="relative w-40 h-40 flex items-center justify-center mt-2">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bg-surface)" strokeWidth="14" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-primary)" strokeWidth="14" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (herd.length > 0 ? (herd.filter(c => c.status === 'normal' || !c.status).length / herd.length) : 0))} strokeLinecap="round" className="opacity-90 transition-all duration-1000" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--amber)" strokeWidth="14" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (herd.length > 0 ? (herd.filter(c => c.status !== 'normal' && c.status).length / herd.length) : 0))} strokeLinecap="round" className="transition-all duration-1000" style={{ strokeDashoffset: 251.2 - (251.2 * (herd.length > 0 ? (herd.filter(c => c.status !== 'normal' && c.status).length / herd.length) : 0)), transformOrigin: 'center', transform: `rotate(${360 * (herd.length > 0 ? (herd.filter(c => c.status === 'normal' || !c.status).length / herd.length) : 0)}deg)` }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center mt-2">
                  <span className="text-3xl font-black leading-none text-[var(--text-1)]">{herd.length > 0 ? Math.round((herd.filter(c => c.status === 'normal' || !c.status).length / herd.length) * 100) + '%' : '0%'}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mt-1">{lang === 'id' ? 'Sehat' : 'Healthy'}</span>
                </div>
              </div>
              <div className="flex gap-4 mt-6 w-full justify-center pb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-2)]"><div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]"></div> Sehat</div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-2)]"><div className="w-2.5 h-2.5 rounded-full bg-[var(--amber)]"></div> Monitor</div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-2)]"><div className="w-2.5 h-2.5 rounded-full bg-[var(--border)]"></div> Sakit</div>
              </div>
            </div>
          </div>

          {/* ROW 4: KONDISI KANDANG & AKTIVITAS & GRAFIK */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_3fr_4fr] gap-4 mt-4 mb-8">
            {/* Kondisi Kandang (IoT) */}
            <div className="rounded-2xl p-6 shadow-lg relative overflow-hidden flex flex-col min-h-[260px]" style={{ background: 'linear-gradient(145deg, #022C22 0%, #064E3B 100%)' }}>
              <div className="absolute top-0 right-0 p-5">
                <ThermometerSun size={28} className="text-emerald-400 opacity-80" />
              </div>
              <h3 className="font-semibold text-emerald-100 mb-1 text-sm z-10 opacity-90">{lang === 'id' ? 'Kondisi Kandang (IoT)' : 'Farm Condition (IoT)'}</h3>
              <p className="text-xs text-emerald-200/70 mb-auto z-10 font-medium">{lang === 'id' ? 'Terakhir diperbarui:' : 'Last updated:'} {stats.lastSync}</p>

              <div className="mt-8 z-10 relative">
                <div className="text-[48px] font-black text-white leading-none tracking-tight flex items-start gap-1">
                  {stats.avgTemp || '--'}<span className="text-2xl mt-1 text-emerald-200">°C</span>
                </div>
              </div>

              <svg className="absolute bottom-0 left-0 right-0 w-full opacity-40 text-emerald-500 pointer-events-none" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ height: '60%' }}>
                <path fill="currentColor" d="M0 40 C 20 20, 40 40, 60 20 C 80 0, 100 20, 100 40 Z" />
                <path fill="currentColor" d="M0 40 C 30 10, 60 30, 100 10 L 100 40 Z" className="opacity-50" />
              </svg>
            </div>

            {/* Aktivitas Terbaru */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-[var(--text-1)] text-lg">{lang === 'id' ? 'Aktivitas Terbaru' : 'Recent Activities'}</h3>
              </div>
              <div className="flex flex-col gap-5 flex-1">
                <div className="text-sm text-gray-500 text-center py-4">{lang === 'id' ? 'Belum ada aktivitas hari ini.' : 'No activities today.'}</div>
              </div>
              <button onClick={() => navigate('/ternak')} className="text-xs font-bold text-gray-500 hover:text-gray-900 text-left mt-4 flex items-center gap-1 transition-colors w-max">
                {lang === 'id' ? 'Lihat semua aktivitas' : 'View all activities'} <ChevronRight size={14} />
              </button>
            </div>

            {/* Grafik Tren Aktivitas Kawanan */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col overflow-hidden h-full">
              <div className="h-full relative overflow-hidden -mx-4 -my-4 sm:-mx-6 sm:-my-6" style={{ minHeight: '250px' }}>
                <TrenAktivitasChart lang={lang} />
              </div>
            </div>
          </div>

        </div> {/* End of Desktop Bento Grid */}

      </div>

      {/* MODALS PORTAL */}
      {createPortal(
        <>
          {/* MODAL: Tambah Reproduksi */}
          <ReproModal isOpen={isReproModalOpen} onClose={() => setIsReproModalOpen(false)} />

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
            <>
            <div className="fixed inset-0 z-[999] flex justify-center items-center md:justify-end md:items-end bg-black/60 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none p-4 md:p-4 md:pt-[100px] animate-in fade-in pointer-events-none">
              <div className="absolute inset-0 z-0 pointer-events-auto md:pointer-events-auto" onClick={() => setIsInsightModalOpen(false)} />
              <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="relative z-10 p-6 w-full max-w-md md:max-w-[400px] rounded-[24px] md:h-full overflow-y-auto animate-in zoom-in-95 md:zoom-in-100 md:slide-in-from-right-1/2 duration-300 pointer-events-auto">
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
            </>
          )}

          {isEstrusModalOpen && (
            <>
            <div className="fixed inset-0 z-[999] flex justify-center items-center md:justify-end md:items-end bg-black/60 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none p-4 md:p-4 md:pt-[100px] animate-in fade-in pointer-events-none">
              <div className="absolute inset-0 z-0 pointer-events-auto md:pointer-events-auto" onClick={() => setIsEstrusModalOpen(false)} />
              <div className="relative z-10 bg-[var(--bg-card)] w-full max-w-md md:max-w-[400px] rounded-[24px] md:h-full overflow-y-auto shadow-xl overflow-hidden animate-in zoom-in-95 md:zoom-in-100 md:slide-in-from-right-1/2 duration-300 pointer-events-auto">
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
                            navigate('/ternak', { state: { selectedCowId: pred.cow_id, fromDashboard: true } });
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
                    <button type="button" onClick={() => setIsEstrusModalOpen(false)} style={{ padding: '12px 24px', color: 'var(--color-primary)', fontWeight: 700, borderRadius: '12px', background: 'var(--color-primary-dim)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flex: 1 }}>{lang === 'id' ? 'Tutup' : 'Close'}</button>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}
          {/* Widget Settings Modal for Dashboard */}
          {showWidgetModal && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-gray-900">Atur Widget Beranda</h3>
                  <button
                    onClick={() => setShowWidgetModal(false)}
                    className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto">
                  <p className="text-xs text-gray-500 mb-4">Pilih 2 metrik utama untuk ditampilkan di beranda. Anda telah memilih <span className="font-bold text-[var(--accent)]">{selectedWidgets.length}/2</span>.</p>

                  <div className="space-y-2">
                    {[
                      { id: 'total', label: 'Total Ternak', icon: Database, value: herd.length, unit: '' },
                      { id: 'sehat', label: 'Kondisi Sehat', icon: CheckCircle2, value: herd.length, unit: '' },
                      { id: 'estrus', label: 'Sedang Estrus', icon: Zap, value: stats.estrus ?? 0, unit: '' },
                      { id: 'tindakan', label: 'Perlu Tindakan', icon: ShieldAlert, value: intel.filter(i => i.urgency === 'critical' || i.urgency === 'monitor').length, unit: '' }
                    ].map(w => {
                      const isSelected = selectedWidgets.includes(w.id);
                      const Icon = w.icon;
                      return (
                        <label
                          key={w.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)]"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (selectedWidgets.length >= 2) {
                                  setSelectedWidgets([selectedWidgets[1], w.id]);
                                } else {
                                  setSelectedWidgets([...selectedWidgets, w.id]);
                                }
                              } else {
                                if (selectedWidgets.length <= 1) {
                                  toast.error('Minimal 1 widget harus dipilih');
                                  return;
                                }
                                setSelectedWidgets(selectedWidgets.filter(id => id !== w.id));
                              }
                            }}
                          />
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-gray-100 text-gray-500'}`}>
                            <Icon size={16} />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{w.label}</p>
                            <p className="text-xs text-gray-500">{w.value} {w.unit}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowWidgetModal(false)}
                    className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-bold hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    Simpan Pengaturan
                  </button>
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
        </>,
        document.body
      )}
    </>
  );
}
