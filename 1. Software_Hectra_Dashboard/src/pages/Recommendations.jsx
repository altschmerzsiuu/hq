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

export default function Recommendations() {
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

      const activeEstrus = (estrusRes.data || []).map(pred => {
        const isHigh = pred.confidence_final > 0.7;
        return {
          id: `estrus-${pred.id}`,
          rawId: pred.id,
          cowId: pred.cow_id,
          cowName: pred.cow_name || 'Sapi',
          action: isHigh ? 'Inseminasi Buatan (IB)' : 'Observasi Lanjutan',
          urgency: pred.in_window_now ? 'Tinggi' : 'Sedang',
          timeframe: pred.in_window_now ? 'Segera (0-12 jam)' : `Dalam ${pred.days_until} hari`,
          reason: `Model AI mendeteksi estrus (${Math.round(pred.confidence_final * 100)}% confidence). Tanggal prediksi birahi: ${pred.prediksi_tanggal}. Waktu IB optimal: ${pred.prediksi_ib_optimal}.`,
          iconType: isHigh ? 'inseminate' : 'observe',
          isHealth: false
        };
      });

      const healthAlerts = (cattleRes.data || [])
        .filter(cow => cow.temp !== null && cow.temp >= 39.0)
        .map(cow => ({
          id: `health-${cow.id}`,
          cowId: cow.id,
          cowName: cow.nama || 'Sapi',
          action: 'Pemeriksaan Kesehatan',
          urgency: 'Tinggi',
          timeframe: 'Segera',
          reason: `Suhu tubuh sapi abnormal (${cow.temp}°C). Kemungkinan indikasi penyakit atau infeksi.`,
          iconType: 'health',
          isHealth: true
        }))
        .filter(alert => !ignoredHealthAlerts.includes(alert.id));

      setRecs([...activeEstrus, ...healthAlerts]);
    } catch (err) {
      console.error('Gagal mengambil rekomendasi:', err);
      toast.error('Gagal mengambil rekomendasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(true);
  }, [ignoredHealthAlerts]);

  const handleMarkDone = async (rec) => {
    if (rec.isHealth) {
      setIgnoredHealthAlerts(prev => [...prev, rec.id]);
      toast.success('Rekomendasi diselesaikan!');
    } else {
      try {
        await axiosInstance.post(`/estrus-predictions/${rec.rawId}/feedback`, { verified: true });
        toast.success('Rekomendasi diselesaikan!');
        fetchRecommendations();
      } catch (err) {
        console.error('Gagal menyelesaikan rekomendasi:', err);
        toast.error('Gagal menyelesaikan rekomendasi.');
      }
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)]">Tindakan & Rekomendasi</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Saran tindakan operasional berdasarkan analisis Machine Learning dan Telemetri.</p>
        </div>
        <div className="bg-[var(--color-forest)]/10 text-[var(--color-forest)] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          {recs.length} Tindakan Pending
        </div>
      </div>

      {recs.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '0.5px dashed var(--border)', borderRadius: '16px' }} className="text-center py-20">
          <Check className="w-12 h-12 text-[var(--color-sage)] mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] font-display">Semua Bersih!</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">Tidak ada rekomendasi tindakan untuk saat ini.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {recs.map((rec) => (
            <RecommendationRow key={rec.id} rec={rec} onMarkDone={() => handleMarkDone(rec)} />
          ))}
        </div>
      )}

    </div>
  );
}

function RecommendationRow({ rec, onMarkDone }) {
  const isHighUrgency = rec.urgency === 'Tinggi';
  
  const IconProps = { className: cn("w-5 h-5", isHighUrgency ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]") };
  
  const Icon = rec.iconType === 'inseminate' ? <Syringe {...IconProps} /> : 
               rec.iconType === 'health' ? <Stethoscope {...IconProps} /> : 
               <ShieldAlert {...IconProps} />;

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
              <h3 className="font-bold text-[var(--color-text-primary)] truncate">{rec.action}</h3>
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0",
                isHighUrgency ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]" : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]"
              )}>
                {rec.urgency}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] font-medium truncate">
              ID: {rec.cowId} • <span className="font-bold">{rec.cowName}</span> • {rec.timeframe}
            </p>
          </div>
        </div>

        {/* Reason Middle */}
        <div className="flex-[2] hidden xl:block border-l border-[var(--border)] pl-4">
           <p className="text-xs text-[var(--color-text-primary)] leading-relaxed italic line-clamp-2">
            "{rec.reason}"
          </p>
        </div>

        {/* Actions Right */}
        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
          <button 
            onClick={onMarkDone}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Check size={14} /> Selesai
          </button>
          <button style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', color: 'var(--text-2)' }} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
