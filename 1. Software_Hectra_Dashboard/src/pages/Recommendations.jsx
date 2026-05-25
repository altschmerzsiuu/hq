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
        }))
        .filter(alert => !ignoredHealthAlerts.includes(alert.id));

      setRecs([...activeEstrus, ...healthAlerts]);
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
    } else {
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)]">{t.recs_title}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">{t.recs_sub}</p>
        </div>
        <div className="bg-[var(--color-forest)]/10 text-[var(--color-forest)] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          {recs.length} {t.recs_pending}
        </div>
      </div>

      {processedRecs.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '0.5px dashed var(--border)', borderRadius: '16px' }} className="text-center py-20">
          <Check className="w-12 h-12 text-[var(--color-sage)] mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] font-display">{t.recs_empty_title}</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{t.recs_empty_sub}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {processedRecs.map((recDetails) => (
            <RecommendationRow key={recDetails.id} recDetails={recDetails} onMarkDone={() => handleMarkDone(recDetails)} />
          ))}
        </div>
      )}

    </div>
  );
}

function RecommendationRow({ recDetails, onMarkDone }) {
  const isHighUrgency = recDetails.urgencyVal === 'high';
  
  const IconProps = { className: cn("w-5 h-5", isHighUrgency ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]") };
  
  const Icon = recDetails.iconType === 'inseminate' ? <Syringe {...IconProps} /> : 
               recDetails.iconType === 'health' ? <Stethoscope {...IconProps} /> : 
               <ShieldAlert {...IconProps} />;

  const { lang } = useSettingsStore();
  const t = translations[lang];

  return (
    <div 
      style={{ background: 'var(--bg-surface)', border: isHighUrgency ? '0.5px solid var(--red-border)' : '0.5px solid var(--border)' }}
      className="rounded-2xl p-4 md:p-5 shadow-sm transition-all hover:shadow-md"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Info Left */}
        <div className="flex items-center gap-4 flex-1">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
            isHighUrgency ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]" : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
          )}>
            {Icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-[var(--color-text-primary)] truncate">{recDetails.action}</h3>
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0",
                isHighUrgency ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]" : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]"
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
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Check size={14} /> {t.btn_done}
          </button>
          <button style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', color: 'var(--text-2)' }} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
