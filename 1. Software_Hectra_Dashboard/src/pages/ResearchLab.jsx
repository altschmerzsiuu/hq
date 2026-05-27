import { useState, useEffect } from 'react';
import { 
  Beaker, 
  Settings, 
  FileText, 
  Clock, 
  Send, 
  Play, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  X,
  User,
  Activity,
  Heart,
  Wheat,
  Beef,
  Moon,
  Flame,
  Rocket,
  PenLine
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';

export default function ResearchLab() {
  const [cows, setCows] = useState([]);
  const [selectedCow, setSelectedCow] = useState('');
  const [activityType, setActivityType] = useState('RESTING');
  const [notes, setNotes] = useState('');
  const [loadingCows, setLoadingCows] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [otaLoading, setOtaLoading] = useState(false);
  
  // Recent observation state
  const [observations, setObservations] = useState([]);
  const [loadingObs, setLoadingObs] = useState(true);

  // OTA state
  const [showOtaOverlay, setShowOtaOverlay] = useState(false);
  const [countdown, setCountdown] = useState(180);
  const [otaTimerId, setOtaTimerId] = useState(null);

  // Fetch cows & observations
  const fetchCows = async () => {
    try {
      const res = await axiosInstance.get('/hewan');
      const data = res.data || [];
      setCows(data);
      if (data.length > 0) {
        setSelectedCow(data[0].cow_id || data[0].id);
      }
    } catch (err) {
      console.error('Gagal mengambil data sapi:', err);
      toast.error('Gagal mengambil data sapi.');
    } finally {
      setLoadingCows(false);
    }
  };

  const fetchObservations = async () => {
    setLoadingObs(true);
    try {
      const res = await axiosInstance.get('/research/observe');
      setObservations(res.data || []);
    } catch (err) {
      console.error('Gagal mengambil log observasi:', err);
    } finally {
      setLoadingObs(false);
    }
  };

  useEffect(() => {
    fetchCows();
    fetchObservations();
  }, []);

  // Countdown timer for OTA
  useEffect(() => {
    if (showOtaOverlay && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      closeOta();
    }
  }, [showOtaOverlay, countdown]);

  const handleLogObservation = async (e) => {
    e.preventDefault();
    if (!selectedCow) {
      toast.error('Silakan pilih sapi terlebih dahulu!');
      return;
    }
    setSubmitting(true);
    try {
      await axiosInstance.post('/research/observe', {
        cow_id: selectedCow,
        activity_type: activityType,
        notes: notes
      });
      toast.success(`Observasi ${activityType} berhasil disimpan!`);
      setNotes('');
      fetchObservations();
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Gagal menyimpan observasi.';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerOta = async () => {
    if (!selectedCow) {
      toast.error('Silakan pilih sapi terlebih dahulu!');
      return;
    }
    const cowObj = cows.find(c => (c.cow_id || c.id) === selectedCow);
    const targetId = cowObj?.collar_id || selectedCow;
    
    setOtaLoading(true);
    try {
      await axiosInstance.post(`/maintenance/${targetId}`, {
        command: 'START_OTA',
        duration: 180
      });
      toast.success('Perintah OTA berhasil dikirim ke Collar!');
      setCountdown(180);
      setShowOtaOverlay(true);
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Gagal mengirim perintah OTA.';
      toast.error(errMsg);
    } finally {
      setOtaLoading(false);
    }
  };

  const closeOta = () => {
    setShowOtaOverlay(false);
    setCountdown(180);
  };

  // Helper to get Indonesian activity labels & icons
  const getActivityMeta = (type) => {
    switch (type.toUpperCase()) {
      case 'EATING':
        return { label: 'Makan / Merumput', icon: <Wheat className="w-4 h-4" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'RUMINATING':
        return { label: 'Mamah Biak (Ruminasi)', icon: <Beef className="w-4 h-4" />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
      case 'RESTING':
        return { label: 'Istirahat / Tidur', icon: <Moon className="w-4 h-4" />, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
      case 'ESTRUS':
        return { label: 'Birahi Aktif (Estrus)', icon: <Flame className="w-4 h-4" />, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
      default:
        return { label: type, icon: <Beaker className="w-4 h-4" />, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' };
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Beaker className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)]">Research Lab</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Manual Observation Log for FYP Validation & System Maintenance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LOG OBSERVATION FORM (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleLogObservation} className="bg-[var(--bg-surface)] rounded-3xl p-6 md:p-8 shadow-card border border-[var(--border)] space-y-6">
            <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)] flex items-center gap-2">
              <PenLine className="w-5 h-5 text-indigo-400" /> Catat Observasi Manual
            </h2>

            {/* Select Sapi */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-2">Pilih Sapi (RFID / Nama)</label>
              {loadingCows ? (
                <div className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl h-14 animate-pulse flex items-center px-4">
                  <span className="text-xs text-[var(--text-3)]">Memuat daftar sapi...</span>
                </div>
              ) : (
                <select
                  value={selectedCow}
                  onChange={(e) => setSelectedCow(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-5 py-4 text-[var(--color-text-primary)] focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                >
                  {cows.map((c) => {
                    const cowKey = c.cow_id || c.id;
                    return (
                      <option key={cowKey} value={cowKey} className="bg-[var(--bg-surface)] text-[var(--color-text-primary)]">
                        {cowKey} - {c.nama || 'Sapi Tanpa Nama'} ({c.jenis})
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Grid Activity Options */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">Jenis Aktivitas Teramati</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { id: 'EATING', label: 'Makan / Merumput', icon: <Wheat className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />, activeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500' },
                  { id: 'RUMINATING', label: 'Mamah Biak (Ruminasi)', icon: <Beef className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />, activeColor: 'bg-blue-500/20 text-blue-400 border-blue-500' },
                  { id: 'RESTING', label: 'Istirahat / Tidur', icon: <Moon className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />, activeColor: 'bg-slate-500/20 text-slate-400 border-slate-500' },
                  { id: 'ESTRUS', label: 'Birahi Aktif (Estrus)', icon: <Flame className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />, activeColor: 'bg-rose-500/20 text-rose-400 border-rose-500' }
                ].map((act) => {
                  const isActive = activityType === act.id;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActivityType(act.id)}
                      className={`h-24 rounded-3xl flex flex-col items-center justify-center border transition-all duration-200 active:scale-95 group ${
                        isActive 
                          ? act.activeColor 
                          : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--border)]/20 text-[var(--text-2)]'
                      }`}
                    >
                      {act.icon}
                      <span className="font-bold text-[11px] uppercase tracking-wider">{act.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Notes */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-2">Tambahkan Catatan Khusus</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Contoh: Sapi terlihat gelisah, sering melenguh, nafsu makan berkurang..."
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-5 py-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--text-3)]/60 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || loadingCows}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-indigo-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Log Observasi'} <Send className="w-4 h-4" />
            </button>
          </form>

          {/* RECENT OBSERVATIONS LIST */}
          <div className="bg-[var(--bg-surface)] rounded-3xl p-6 md:p-8 shadow-card border border-[var(--border)] space-y-6">
            <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)] flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" /> Log Observasi Terbaru
            </h2>

            {loadingObs ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-[var(--border)]/30 rounded-2xl"></div>
                ))}
              </div>
            ) : observations.length === 0 ? (
              <p className="text-center py-6 text-sm text-[var(--text-3)]">Belum ada observasi yang dicatat.</p>
            ) : (
              <div className="space-y-4">
                {observations.map((obs) => {
                  const meta = getActivityMeta(obs.activity_type);
                  return (
                    <div key={obs.id} className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`px-3 py-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 shrink-0 ${meta.color}`}>
                          {meta.icon}
                          <span>{meta.label}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--color-text-primary)] text-sm">
                            {obs.cow_name || obs.cow_id}
                            <span className="text-[var(--text-3)] text-xs ml-2 font-mono">({obs.cow_id})</span>
                          </p>
                          {obs.notes && <p className="text-xs text-[var(--text-2)] mt-1">{obs.notes}</p>}
                        </div>
                      </div>
                      <div className="text-[11px] text-[var(--text-3)] sm:text-right">
                        {new Date(obs.created_at).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* SYSTEM MAINTENANCE CONTROL (Right 1 col) */}
        <div className="space-y-6">
          <div className="bg-[var(--bg-surface)] rounded-3xl p-6 md:p-8 shadow-card border border-blue-500/20 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-md font-bold text-blue-400 uppercase tracking-widest font-display">Maintenance</h3>
                <p className="text-xs text-[var(--text-3)] mt-1">Aktifkan OTA Update</p>
              </div>
              <Settings className="w-6 h-6 text-blue-400" />
            </div>

            <p className="text-xs text-[var(--text-2)] leading-relaxed">
              Kirim perintah standby Over-the-Air (OTA) ke collar sensor sapi yang sedang terpilih agar collar tetap terjaga (tidak tidur) untuk menerima upload program baru.
            </p>

            <button
              onClick={handleTriggerOta}
              disabled={otaLoading || loadingCows}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4" /> {otaLoading ? 'Mengaktifkan...' : 'Aktifkan OTA Mode'}
            </button>

            <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 text-[11px] text-blue-300/80 leading-relaxed italic">
              * Collar akan dipaksa menyala terus selama 3 menit (180 detik) sejak menerima perintah ini.
            </div>
          </div>
        </div>
      </div>

      {/* OTA COUNTDOWN OVERLAY */}
      {showOtaOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl bg-slate-950/80 transition-all duration-500">
          <div className="max-w-sm w-full bg-slate-900 border border-blue-500/30 rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 blur-[80px] rounded-full"></div>
            
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500/20 rounded-full animate-pulse">
                <Rocket className="w-10 h-10 text-blue-400 animate-pulse" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">OTA Mode Aktif!</h2>
                <p className="text-blue-400 font-mono text-sm uppercase tracking-widest">{selectedCow}</p>
              </div>

              <div className="py-6">
                <div className={`text-6xl font-black tabular-nums tracking-tighter ${countdown < 30 ? 'text-rose-500' : 'text-white'}`}>
                  {Math.floor(countdown / 60).toString().padStart(2, '0')}:
                  {(countdown % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-[var(--text-3)] text-xs mt-2 uppercase tracking-widest">Waktu Standby Tersisa</p>
              </div>

              <div className="bg-slate-950/50 rounded-2xl p-4 text-left border border-slate-800">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <span className="text-blue-400 font-bold">Langkah Selanjutnya:</span><br />
                  1. Buka Arduino IDE di Laptop Anda.<br />
                  2. Pilih Port: <span className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">Network Port ({selectedCow})</span>.<br />
                  3. Klik <span className="text-white font-bold">Upload</span> sekarang sebelum waktu habis!
                </p>
              </div>

              <button
                onClick={closeOta}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-sm transition-all active:scale-95 border border-slate-700/50"
              >
                Batal / Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
