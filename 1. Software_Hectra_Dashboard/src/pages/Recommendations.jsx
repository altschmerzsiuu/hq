import { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  Check, 
  Clock, 
  ChevronRight,
  ShieldAlert,
  Syringe,
  Stethoscope
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

function fmtDate(dateStr, lang) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Recommendations() {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState([]);
  const [ignoredHealthAlerts, setIgnoredHealthAlerts] = useState([]);
  const [filterUrgency, setFilterUrgency] = useState(null);

  const fetchRecommendations = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [estrusRes, cattleRes] = await Promise.all([
        axiosInstance.get('/estrus-predictions?status=active'),
        axiosInstance.get('/hewan')
      ]);

      const activeEstrus = (estrusRes.data || []).map(pred => ({
        id: `estrus-${pred.id}`,
        type: 'estrus',
        raw: pred
      }));

      const healthAlerts = (cattleRes.data || [])
        .filter(cow => cow.temp !== null && cow.temp >= 39.0)
        .map(cow => ({
          id: `health-${cow.id}`,
          type: 'health',
          raw: cow
        }));

      // [USER REQUEST] Injecting mock data to preview Recommendations UI
      const mockRecs = [
        {
          id: 'estrus-mock-1',
          type: 'estrus',
          raw: {
            id: 'mock-1',
            cow_id: 'SAPI_A01',
            cow_name: 'Gendhis',
            confidence_final: 0.92,
            in_window_now: true,
            prediksi_tanggal: new Date().toISOString(),
            prediksi_ib_optimal: new Date().toISOString()
          }
        }
      ];

      const allRecs = [...activeEstrus, ...healthAlerts, ...mockRecs];
      setRecs(allRecs.filter(alert => !ignoredHealthAlerts.includes(alert.id)));
    } catch (err) {
      console.error('Gagal mengambil rekomendasi:', err);
      toast.error(lang === 'id' ? 'Gagal mengambil rekomendasi.' : 'Failed to fetch recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(true);
  }, [ignoredHealthAlerts]);

  const handleMarkDone = async (recDetails) => {
    if (recDetails.isHealth) {
      setIgnoredHealthAlerts(prev => [...prev, recDetails.id]);
      toast.success(lang === 'id' ? 'Rekomendasi diselesaikan!' : 'Recommendation completed!');
    } else {
      try {
        await axiosInstance.post(`/estrus-predictions/${recDetails.rawId}/feedback`, { verified: true });
        toast.success(lang === 'id' ? 'Rekomendasi diselesaikan!' : 'Recommendation completed!');
        fetchRecommendations();
      } catch (err) {
        console.error('Gagal menyelesaikan rekomendasi:', err);
        toast.error(lang === 'id' ? 'Gagal menyelesaikan rekomendasi.' : 'Failed to complete recommendation.');
      }
    }
  };

  const getRecDetails = (rec) => {
    if (rec.type === 'estrus') {
      const pred = rec.raw;
      const isHigh = pred.confidence_final > 0.7;
      const urgencyVal = pred.in_window_now ? 'high' : 'medium';
      const urgencyText = pred.in_window_now ? t.recs_urgency_high : t.recs_urgency_medium;
      const actionText = isHigh ? t.recs_action_ib : t.recs_action_obs;
      const timeframeText = pred.in_window_now 
        ? t.recs_time_immediate_window 
        : t.recs_time_in_days.replace('{days}', pred.days_until);
      const reasonText = lang === 'id'
        ? `Model AI mendeteksi estrus (${Math.round(pred.confidence_final * 100)}% confidence). Tanggal prediksi birahi: ${fmtDate(pred.prediksi_tanggal, lang)}. Waktu IB optimal: ${fmtDate(pred.prediksi_ib_optimal, lang)}.`
        : `AI Model detected estrus (${Math.round(pred.confidence_final * 100)}% confidence). Predicted estrus date: ${fmtDate(pred.prediksi_tanggal, lang)}. Optimal AI window: ${fmtDate(pred.prediksi_ib_optimal, lang)}.`;
      
      return {
        id: rec.id,
        cowId: pred.cow_id,
        cowName: pred.cow_name || (lang === 'id' ? 'Sapi' : 'Cattle'),
        action: actionText,
        urgency: urgencyText,
        urgencyVal,
        timeframe: timeframeText,
        reason: reasonText,
        iconType: isHigh ? 'inseminate' : 'observe',
        isHealth: false,
        rawId: pred.id
      };
    } else if (rec.type === 'health') {
      const cow = rec.raw;
      return {
        id: rec.id,
        cowId: cow.id,
        cowName: cow.nama || (lang === 'id' ? 'Sapi' : 'Cattle'),
        action: t.recs_action_health,
        urgency: t.recs_urgency_high,
        urgencyVal: 'high',
        timeframe: t.recs_time_immediate,
        reason: lang === 'id'
          ? `Suhu tubuh sapi abnormal (${cow.temp}°C). Kemungkinan indikasi penyakit atau infeksi.`
          : `Abnormal body temperature detected (${cow.temp}°C). Potential indication of illness or infection.`,
        iconType: 'health',
        isHealth: true
      };
    } else {
      return {
        id: rec.id,
        cowId: rec.raw.cow_id,
        cowName: rec.raw.cow_name || (lang === 'id' ? 'Sapi' : 'Cattle'),
        action: lang === 'id' ? 'Perawatan Baterai' : 'Battery Maintenance',
        urgency: lang === 'id' ? 'Rendah' : 'Low',
        urgencyVal: 'low',
        timeframe: lang === 'id' ? 'Dalam 7 Hari' : 'Within 7 Days',
        reason: lang === 'id'
          ? `Tegangan baterai collar rendah (${rec.raw.battery}V). Harap jadwalkan penggantian minggu ini.`
          : `Collar battery voltage is low (${rec.raw.battery}V). Please schedule replacement this week.`,
        iconType: 'maintenance',
        isHealth: false
      };
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-[var(--color-sage-light)]/20 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2].map(i => <div key={i} className="h-48 bg-[var(--color-sage-light)]/20 rounded-2xl"></div>)}
        </div>
      </div>
    );
  }

  const processedRecs = recs.map(getRecDetails);
  
  const counts = { high: 0, medium: 0, low: 0 };
  processedRecs.forEach(r => {
    if (counts[r.urgencyVal] !== undefined) counts[r.urgencyVal]++;
  });

  const displayRecs = filterUrgency ? processedRecs.filter(r => r.urgencyVal === filterUrgency) : processedRecs;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 min-h-screen" onClick={() => setFilterUrgency(null)}>
      
      {/* ── HEADER ── */}
      <div 
        className="rounded-t-none rounded-b-[40px] md:rounded-[40px] md:mt-4 shadow-lg relative overflow-hidden mb-6 text-white flex flex-col sm:flex-row justify-between -mx-4 md:mx-0 transition-all"
        style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)' }}
      >
        {/* Subtle Background Accent */}
        <Lightbulb 
          size={240} 
          strokeWidth={1} 
          className="absolute -top-10 -right-10 text-white opacity-[0.08] rotate-12 pointer-events-none" 
        />

        <div className="p-6 pt-[86px] md:p-8 relative z-10 flex-1 flex flex-col justify-center">
          <p className="text-[10px] md:text-[12px] font-black opacity-90 mb-1 uppercase tracking-widest text-amber-200">
            OPTIMASI KESEHATAN & PRODUKSI
          </p>
          <h1 className="text-[32px] md:text-[36px] font-black tracking-tight leading-none">
            {t.recs_title}
          </h1>
          <p className="text-amber-100 mt-2 font-medium">{t.recs_sub}</p>
        </div>

        <div className="flex flex-row items-stretch relative z-10 sm:min-w-[320px] p-2 sm:pr-4">
          {['high', 'medium', 'low'].map(urgency => {
            if (counts[urgency] === 0) return null;
            const isActive = filterUrgency === urgency;
            const label = urgency === 'high' ? (lang === 'id' ? 'Tinggi' : 'High') :
                          urgency === 'medium' ? (lang === 'id' ? 'Sedang' : 'Medium') :
                          (lang === 'id' ? 'Rendah' : 'Low');
            const bgColorClass = urgency === 'high' ? 'bg-[var(--color-danger)]' :
                                 urgency === 'medium' ? 'bg-yellow-400' : 'bg-[var(--color-info)]';
            
            return (
              <button
                key={urgency}
                onClick={(e) => { e.stopPropagation(); setFilterUrgency(isActive ? null : urgency); }}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1.5 p-4 sm:px-6 transition-all m-2 sm:my-3 sm:mx-1 rounded-xl",
                  isActive ? "bg-white shadow-xl scale-105 z-20" : "opacity-90 hover:opacity-100 hover:bg-white/10"
                )}
              >
                <span className={cn(
                  "text-3xl font-black leading-none",
                  isActive ? "text-amber-600" : "text-white drop-shadow-sm"
                )}>{counts[urgency]}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full shadow-sm", bgColorClass)}></span>
                  <span className={cn(
                    "text-[10px] sm:text-xs font-bold uppercase tracking-widest",
                    isActive ? "text-amber-700" : "text-white opacity-90"
                  )}>{label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {displayRecs.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '0.5px dashed var(--border)', borderRadius: '16px' }} className="text-center py-20">
          <Check className="w-12 h-12 text-[var(--color-sage)] mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] font-display">{t.recs_empty_title}</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{t.recs_empty_sub}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayRecs.map((recDetails) => (
            <RecommendationRow key={recDetails.id} recDetails={recDetails} onMarkDone={() => handleMarkDone(recDetails)} />
          ))}
        </div>
      )}

    </div>
  );
}

function RecommendationRow({ recDetails, onMarkDone }) {
  const isHighUrgency = recDetails.urgencyVal === 'high';
  const isMediumUrgency = recDetails.urgencyVal === 'medium';
  
  let colorTheme = { text: 'text-[var(--color-info)]', bg: 'bg-[var(--color-info-bg)]', border: 'border-[var(--color-info)]/30', borderContainer: '0.5px solid var(--border)' };
  if (isHighUrgency) {
    colorTheme = { text: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger-bg)]', border: 'border-[var(--color-danger-border)]', borderContainer: '0.5px solid var(--red-border)' };
  } else if (isMediumUrgency) {
    colorTheme = { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', borderContainer: '0.5px solid var(--border)' };
  }
  
  const IconProps = { className: cn("w-5 h-5", colorTheme.text) };
  
  const Icon = recDetails.iconType === 'inseminate' ? <Syringe {...IconProps} /> : 
               recDetails.iconType === 'health' ? <Stethoscope {...IconProps} /> : 
               recDetails.iconType === 'maintenance' ? <Clock {...IconProps} /> : 
               <ShieldAlert {...IconProps} />;

  const { lang } = useSettingsStore();
  const t = translations[lang];

  return (
    <div 
      style={{ background: 'var(--bg-surface)', border: colorTheme.borderContainer }}
      className="rounded-2xl p-4 md:p-5 shadow-sm transition-all hover:shadow-md"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Info Left */}
        <div className="flex items-center gap-4 flex-1">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
            colorTheme.bg, colorTheme.text
          )}>
            {Icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-[var(--color-text-primary)] truncate">{recDetails.action}</h3>
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0",
                colorTheme.bg, colorTheme.text, colorTheme.border
              )}>
                {recDetails.urgency}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] font-medium truncate">
              ID: {recDetails.cowId} • <span className="font-bold">{recDetails.cowName}</span> • {recDetails.timeframe}
            </p>
          </div>
        </div>

        {/* Reason Middle */}
        <div className="flex-[2] hidden xl:block border-l border-[var(--border)] pl-4">
           <p className="text-xs text-[var(--color-text-primary)] leading-relaxed italic line-clamp-2">
            "{recDetails.reason}"
          </p>
        </div>

        {/* Actions Right */}
        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
          <button 
            onClick={onMarkDone}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Check size={16} strokeWidth={3} /> {t.btn_done}
          </button>
          <button style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', color: 'var(--text-2)' }} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
