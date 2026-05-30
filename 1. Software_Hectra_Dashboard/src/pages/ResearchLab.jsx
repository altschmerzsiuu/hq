import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Beaker, Settings, Clock, Send, Wheat, Beef, Moon, Flame,
  Rocket, PenLine, Terminal, Wifi, WifiOff, Sliders, ChevronDown,
  CheckCircle, AlertCircle, Loader, Clock3,
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';

/* ═══════════════════════════════════════════════════════════
 * HOOK: useDeviceMonitor
 * ═══════════════════════════════════════════════════════════ */
function useDeviceMonitor(collarId, isEnabled) {
  const [logs, setLogs] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const MAX_LOGS = 200;

  const connect = useCallback(() => {
    if (!isEnabled) {
      setWsStatus('disconnected');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus('connecting');
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (!token) { setWsStatus('disconnected'); return; }
    const base = import.meta.env.VITE_WS_URL;
    const url = collarId && collarId !== 'ALL'
      ? `${base}/ws/device-logs/${collarId}?token=${token}`
      : `${base}/ws/device-logs?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => { setWsStatus('connected'); clearTimeout(reconnectTimer.current); };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'ping') return;
        setLogs((prev) => [{ ...data, _id: `${Date.now()}-${Math.random()}` }, ...prev].slice(0, MAX_LOGS));
      } catch (_) {}
    };
    ws.onclose = (ev) => {
      setWsStatus('disconnected');
      wsRef.current = null;
      if (ev.code !== 4001 && isEnabled) reconnectTimer.current = setTimeout(connect, 5000);
    };
    ws.onerror = () => setWsStatus('disconnected');
  }, [collarId, isEnabled]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus('disconnected');
  }, []);

  useEffect(() => {
    if (isEnabled) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [connect, disconnect, isEnabled]);

  return { logs, wsStatus, clearLogs: () => setLogs([]), reconnect: connect };
}

/* ═══════════════════════════════════════════════════════════
 * HOOK: useConfigUpdate — dengan delivery status per key
 * Status: 'idle' | 'sending' | 'delivered' | 'applied' | 'error'
 * ═══════════════════════════════════════════════════════════ */
function useConfigUpdate(logs) {
  const CONFIG_KEYS = ['sleep_minutes', 'batch_count', 'window_size', 'max_offline_cycles', 'device_active'];
  const initialStatus = Object.fromEntries(CONFIG_KEYS.map(k => [k, 'idle']));
  const [statuses, setStatuses] = useState(initialStatus);
  const pendingRef = useRef({});

  // Watch logs untuk detect config applied di firmware
  useEffect(() => {
    if (!logs || logs.length === 0) return;
    const latest = logs[0];
    if (!latest?.message) return;
    const msg = latest.message;

    CONFIG_KEYS.forEach((key) => {
      if (pendingRef.current[key] === 'delivered') {
        // Firmware log "[CONFIG] Updated X to Y" berarti applied
        if (msg.includes(`Updated ${key}`) || msg.includes(`Device DISABLED`) && key === 'device_active') {
          pendingRef.current[key] = 'applied';
          setStatuses((prev) => ({ ...prev, [key]: 'applied' }));
          // Reset ke idle setelah 4 detik
          setTimeout(() => {
            pendingRef.current[key] = 'idle';
            setStatuses((prev) => ({ ...prev, [key]: 'idle' }));
          }, 4000);
        }
      }
    });
  }, [logs]);

  const updateConfig = async (collarId, key, value) => {
    if (!collarId) { toast.error('Pilih sapi dulu!'); return false; }
    setStatuses((prev) => ({ ...prev, [key]: 'sending' }));
    pendingRef.current[key] = 'sending';
    try {
      await axiosInstance.post('/device/config', { collar_id: collarId, key, value });
      setStatuses((prev) => ({ ...prev, [key]: 'delivered' }));
      pendingRef.current[key] = 'delivered';
      toast.success(`'${key}' terkirim. Akan aktif saat collar bangun.`);
      // Fallback timeout: kalau 60 detik belum ada log applied, reset ke idle
      setTimeout(() => {
        if (pendingRef.current[key] === 'delivered') {
          pendingRef.current[key] = 'idle';
          setStatuses((prev) => ({ ...prev, [key]: 'idle' }));
        }
      }, 60000);
      return true;
    } catch (err) {
      setStatuses((prev) => ({ ...prev, [key]: 'error' }));
      pendingRef.current[key] = 'error';
      toast.error(err.response?.data?.detail || `Gagal update ${key}`);
      setTimeout(() => {
        pendingRef.current[key] = 'idle';
        setStatuses((prev) => ({ ...prev, [key]: 'idle' }));
      }, 4000);
      return false;
    }
  };

  return { updateConfig, statuses };
}

/* ═══════════════════════════════════════════════════════════
 * HOOK: useOtaProgress — detect OTA stages dari log
 * ═══════════════════════════════════════════════════════════ */
function useOtaProgress(logs, isOtaActive) {
  // stage: 'waiting' | 'uploading' | 'done' | 'error'
  const [otaStage, setOtaStage] = useState('waiting');
  const [otaProgress, setOtaProgress] = useState(0);

  useEffect(() => {
    if (!isOtaActive || !logs || logs.length === 0) return;
    const msg = logs[0]?.message || '';
    if (msg.includes('OTA Start')) {
      setOtaStage('uploading');
      // Simulasi progress bar karena ArduinoOTA tidak emit % progress lewat MQTT
      // Progress naik pelan sampai 90%, sisanya tunggu OTA End
      setOtaProgress(10);
    }
    if (msg.includes('OTA End')) {
      setOtaStage('done');
      setOtaProgress(100);
      toast.success('Firmware berhasil diupload! Collar akan reboot.');
    }
    if (msg.includes('OTA Error')) {
      setOtaStage('error');
      toast.error('OTA gagal! Cek log untuk detail.');
    }
  }, [logs, isOtaActive]);

  // Naikkan progress bar pelan saat uploading
  useEffect(() => {
    if (otaStage !== 'uploading') return;
    if (otaProgress >= 90) return;
    const t = setTimeout(() => setOtaProgress((p) => Math.min(p + 3, 90)), 800);
    return () => clearTimeout(t);
  }, [otaStage, otaProgress]);

  const resetOta = () => { setOtaStage('waiting'); setOtaProgress(0); };
  return { otaStage, otaProgress, resetOta };
}

/* ═══════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════ */
function getLogStyle(level) {
  switch ((level || '').toUpperCase()) {
    case 'CRITICAL': return { badge: 'bg-red-900/60 text-red-300 border-red-700',       text: 'text-red-300' };
    case 'ERROR':    return { badge: 'bg-red-900/40 text-red-400 border-red-800',        text: 'text-red-400' };
    case 'WARN':     return { badge: 'bg-amber-900/40 text-amber-300 border-amber-700',  text: 'text-amber-300' };
    case 'INFO':     return { badge: 'bg-blue-900/40 text-blue-300 border-blue-700',     text: 'text-blue-300' };
    default:         return { badge: 'bg-slate-800 text-slate-400 border-slate-700',     text: 'text-slate-400' };
  }
}

function formatTs(ts) {
  if (!ts) return '--:--:--';
  return new Date(ts * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getActivityMeta(type) {
  switch ((type || '').toUpperCase()) {
    case 'EATING':     return { label: 'Makan / Merumput',     icon: <Wheat className="w-4 h-4" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    case 'RUMINATING': return { label: 'Mamah Biak (Ruminasi)',icon: <Beef  className="w-4 h-4" />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    case 'RESTING':    return { label: 'Istirahat / Tidur',    icon: <Moon  className="w-4 h-4" />, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
    case 'ESTRUS':     return { label: 'Birahi Aktif (Estrus)',icon: <Flame className="w-4 h-4" />, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    default:           return { label: type,                   icon: <Beaker className="w-4 h-4" />,color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' };
  }
}

/* ── Config status badge ── */
function ConfigStatusBadge({ status }) {
  const map = {
    idle:      null,
    sending:   <span className="flex items-center gap-1 text-[10px] text-amber-400"><Loader className="w-3 h-3 animate-spin" />Mengirim...</span>,
    delivered: <span className="flex items-center gap-1 text-[10px] text-blue-400"><Clock3 className="w-3 h-3" />Menunggu collar...</span>,
    applied:   <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle className="w-3 h-3" />Diterapkan!</span>,
    error:     <span className="flex items-center gap-1 text-[10px] text-red-400"><AlertCircle className="w-3 h-3" />Gagal</span>,
  };
  return map[status] || null;
}

/* ── Config input row ── */
function ConfigRow({ label, hint, value, onChange, min, max, onSend, status }) {
  const isBusy = status === 'sending' || status === 'delivered';
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/40 border border-[var(--border)] rounded-2xl hover:border-slate-800 transition-all">
      <div className="min-w-0 flex-1">
        <label className="block text-xs font-bold text-[var(--text-1)] uppercase tracking-wider">{label}</label>
        <span className="text-[10px] text-[var(--text-3)] block mt-1">{hint}</span>
        {status !== 'idle' && (
          <div className="mt-1.5">
            <ConfigStatusBadge status={status} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 sm:self-center self-stretch">
        <input
          type="number" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={isBusy}
          className="w-20 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-2.5 py-2 text-center text-sm font-semibold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 tabular-nums disabled:opacity-50"
        />
        <button
          onClick={onSend} disabled={isBusy}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5 shadow-sm"
        >
          {isBusy ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
          Kirim
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════ */
export default function ResearchLab() {
  const [cows, setCows] = useState([]);
  const [selectedCow, setSelectedCow] = useState('');
  const [activityType, setActivityType] = useState('RESTING');
  const [notes, setNotes] = useState('');
  const [loadingCows, setLoadingCows] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [otaLoading, setOtaLoading] = useState(false);
  const [observations, setObservations] = useState([]);
  const [loadingObs, setLoadingObs] = useState(true);
  const [showOtaOverlay, setShowOtaOverlay] = useState(false);
  const [countdown, setCountdown] = useState(180);
  const [isObsMinimized, setIsObsMinimized] = useState(false);
  const [logCollarId, setLogCollarId] = useState('ALL');
  const [isMonitoring, setIsMonitoring] = useState(true);

  const selectedCowObj = cows.find((c) => (c.cow_id || c.id) === selectedCow);
  const resolvedCollarId = selectedCowObj?.collar_id || selectedCow || 'ALL';

  const { logs, wsStatus, clearLogs, reconnect } = useDeviceMonitor(logCollarId, isMonitoring);
  const { updateConfig, statuses } = useConfigUpdate(logs);
  const { otaStage, otaProgress, resetOta } = useOtaProgress(logs, showOtaOverlay);

  const [filterLevel, setFilterLevel] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef(null);

  const [sleepMinutes, setSleepMinutes] = useState(20);
  const [batchCount, setBatchCount] = useState(10);
  const [windowSize, setWindowSize] = useState(20);
  const [maxOfflineCycles, setMaxOfflineCycles] = useState(25);
  const [deviceActive, setDeviceActive] = useState(true);

  useEffect(() => {
    if (autoScroll && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs, autoScroll]);

  const fetchCows = async () => {
    try {
      const res = await axiosInstance.get('/hewan');
      const data = res.data || [];
      setCows(data);
      if (data.length > 0) setSelectedCow(data[0].cow_id || data[0].id);
    } catch { toast.error('Gagal mengambil data sapi.'); }
    finally { setLoadingCows(false); }
  };

  const fetchObservations = async () => {
    setLoadingObs(true);
    try { const res = await axiosInstance.get('/research/observe'); setObservations(res.data || []); }
    catch { /* silent */ }
    finally { setLoadingObs(false); }
  };

  useEffect(() => { fetchCows(); fetchObservations(); }, []);

  useEffect(() => {
    if (!showOtaOverlay) return;
    if (countdown <= 0) { closeOta(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showOtaOverlay, countdown]);

  const handleLogObservation = async (e) => {
    e.preventDefault();
    if (!selectedCow) { toast.error('Silakan pilih sapi terlebih dahulu!'); return; }
    setSubmitting(true);
    try {
      await axiosInstance.post('/research/observe', { cow_id: selectedCow, activity_type: activityType, notes });
      toast.success(`Observasi ${activityType} berhasil disimpan!`);
      setNotes('');
      fetchObservations();
    } catch (err) { toast.error(err.response?.data?.detail || 'Gagal menyimpan observasi.'); }
    finally { setSubmitting(false); }
  };

  const handleTriggerOta = async () => {
    if (!selectedCow) { toast.error('Silakan pilih sapi terlebih dahulu!'); return; }
    const targetId = selectedCowObj?.collar_id || selectedCow;
    setOtaLoading(true);
    try {
      await axiosInstance.post(`/maintenance/${targetId}`, { command: 'START_OTA', duration: 180 });
      toast.success('Perintah OTA berhasil dikirim!');
      setCountdown(180);
      resetOta();
      setShowOtaOverlay(true);
    } catch (err) { toast.error(err.response?.data?.detail || 'Gagal mengirim perintah OTA.'); }
    finally { setOtaLoading(false); }
  };

  const closeOta = () => { setShowOtaOverlay(false); setCountdown(180); resetOta(); };

  const filteredLogs = filterLevel === 'ALL' ? logs : logs.filter((l) => (l.level || '').toUpperCase() === filterLevel);

  /* OTA stage labels */
  const otaStageInfo = {
    waiting:   { label: 'Menunggu upload dari Arduino IDE...', color: 'text-blue-400' },
    uploading: { label: 'Upload firmware berlangsung...', color: 'text-amber-400' },
    done:      { label: 'Firmware berhasil diupload! ✓', color: 'text-emerald-400' },
    error:     { label: 'OTA gagal — cek log terminal.', color: 'text-red-400' },
  }[otaStage];

  /* ═══════════════════════════════════════════════════════════
   * RENDER
   * ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-16">

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

      {/* SECTION 1: CATTLE OBSERVATION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <span className="w-1.5 h-5 rounded-full bg-indigo-500" />
          <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">Observasi Perilaku Sapi</h2>
          <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 ml-2 uppercase">Field Log</span>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Observation form */}
          <div className="lg:col-span-7">
            <form onSubmit={handleLogObservation} className="bg-[var(--bg-surface)] rounded-3xl p-6 md:p-8 shadow-card border border-[var(--border)] space-y-6">
              <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)] flex items-center gap-2">
                <PenLine className="w-5 h-5 text-indigo-400" /> Catat Observasi Manual
              </h2>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-2">Pilih Sapi (RFID / Nama)</label>
                {loadingCows ? (
                  <div className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl h-14 animate-pulse flex items-center px-4">
                    <span className="text-xs text-[var(--text-3)]">Memuat daftar sapi...</span>
                  </div>
                ) : (
                  <select value={selectedCow} onChange={(e) => setSelectedCow(e.target.value)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-5 py-4 text-[var(--color-text-primary)] focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer">
                    {cows.map((c) => { const k = c.cow_id || c.id; return (
                      <option key={k} value={k} className="bg-[var(--bg-surface)] text-[var(--color-text-primary)]">
                        {k} - {c.nama || 'Sapi Tanpa Nama'} ({c.jenis})
                      </option>
                    ); })}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">Jenis Aktivitas Teramati</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { id: 'EATING',     label: 'Makan / Merumput',      icon: <Wheat className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />, activeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500' },
                    { id: 'RUMINATING', label: 'Mamah Biak (Ruminasi)', icon: <Beef  className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />, activeColor: 'bg-blue-500/20 text-blue-400 border-blue-500' },
                    { id: 'RESTING',    label: 'Istirahat / Tidur',     icon: <Moon  className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />, activeColor: 'bg-slate-500/20 text-slate-400 border-slate-500' },
                    { id: 'ESTRUS',     label: 'Birahi Aktif (Estrus)', icon: <Flame className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />, activeColor: 'bg-rose-500/20 text-rose-400 border-rose-500' },
                  ].map((act) => (
                    <button key={act.id} type="button" onClick={() => setActivityType(act.id)}
                      className={`h-24 rounded-3xl flex flex-col items-center justify-center border transition-all duration-200 active:scale-95 group ${activityType === act.id ? act.activeColor : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--border)]/20 text-[var(--text-2)]'}`}>
                      {act.icon}
                      <span className="font-bold text-[11px] uppercase tracking-wider">{act.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-2">Tambahkan Catatan Khusus</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  placeholder="Contoh: Sapi terlihat gelisah, sering melenguh, nafsu makan berkurang..."
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-5 py-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--text-3)]/60 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all" />
              </div>
              <button type="submit" disabled={submitting || loadingCows}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-indigo-900/20 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {submitting ? 'Menyimpan...' : 'Simpan Log Observasi'} {!submitting && <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>

          {/* Recent observations */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-[var(--bg-surface)] rounded-3xl p-6 md:p-8 shadow-card border border-[var(--border)] flex-1 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-400" /> Log Observasi Terbaru
                </h2>
                <button
                  type="button"
                  onClick={() => setIsObsMinimized(!isObsMinimized)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] transition-all flex items-center gap-1.5"
                >
                  {isObsMinimized ? 'Tampilkan' : 'Sembunyikan'}
                </button>
              </div>
              {!isObsMinimized && (
                <>
                  {loadingObs ? (
                    <div className="space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-16 bg-[var(--border)]/30 rounded-2xl" />)}</div>
                  ) : observations.length === 0 ? (
                    <p className="text-center py-6 text-sm text-[var(--text-3)]">Belum ada observasi yang dicatat.</p>
                  ) : (
                    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                      {observations.map((obs) => {
                        const meta = getActivityMeta(obs.activity_type);
                        return (
                          <div key={obs.id} className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`px-3 py-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 shrink-0 ${meta.color}`}>
                                {meta.icon}<span>{meta.label}</span>
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
                              {new Date(obs.created_at).toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: DEVICE LOG MONITOR */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <span className="w-1.5 h-5 rounded-full bg-emerald-500" />
          <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">Log Monitor Perangkat</h2>
          <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 ml-2 uppercase">Real-Time Terminal</span>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-3xl overflow-hidden shadow-card border border-indigo-500/20 w-full">
          {/* Enhanced Terminal Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-4 border-b border-[var(--border)] bg-slate-950/40">
            {/* Left side controls */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-xs text-[var(--color-text-primary)] font-display uppercase tracking-wider">Device Logs</span>
                {wsStatus === 'connected' ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    LIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono font-bold bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700/50">
                    <WifiOff className="w-3 h-3" />
                    {wsStatus.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="h-4 w-px bg-slate-855 hidden sm:block" />

              {/* Toggle Switch ON/OFF for Monitoring */}
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monitor Stream</span>
                <button
                  type="button"
                  onClick={() => setIsMonitoring(!isMonitoring)}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${isMonitoring ? 'bg-emerald-500' : 'bg-slate-750'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isMonitoring ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Collar Selector Dropdown */}
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Device:</span>
                <div className="relative flex items-center">
                  <select
                    value={logCollarId}
                    onChange={(e) => setLogCollarId(e.target.value)}
                    className="bg-transparent border-none text-[11px] text-slate-200 font-bold focus:outline-none cursor-pointer pr-5 py-0.5 appearance-none"
                  >
                    <option value="ALL" className="bg-slate-900 text-slate-200">Semua Device (ALL)</option>
                    {Array.from(new Set(cows.map(c => c.collar_id).filter(Boolean))).map(collarId => {
                      const cow = cows.find(c => c.collar_id === collarId);
                      return (
                        <option key={collarId} value={collarId} className="bg-slate-900 text-slate-200">
                          {collarId} ({cow?.nama || cow?.cow_id || 'Sapi'})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}
                  className="appearance-none bg-slate-900/60 border border-slate-800 text-[10px] text-slate-300 rounded-xl px-3 py-1.5 pr-7 outline-none cursor-pointer focus:border-indigo-500 transition-colors">
                  {['ALL','CRITICAL','ERROR','WARN','INFO'].map(l => <option key={l} value={l} className="bg-slate-900 text-slate-300">{l}</option>)}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <button onClick={() => setAutoScroll(p => !p)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all ${autoScroll ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-900/60 text-slate-400 border-slate-800'}`}>
                Auto Scroll
              </button>
              <button onClick={clearLogs}
                className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 transition-all">
                Clear Logs
              </button>
              {wsStatus !== 'connected' && isMonitoring && (
                <button onClick={reconnect}
                  className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">
                  Reconnect
                </button>
              )}
            </div>
          </div>

          {/* Terminal Console (Expanded height for premium IDE feel) */}
          <div ref={logRef}
            className="h-96 overflow-y-auto font-mono text-[10px] bg-slate-950/80 p-4 space-y-1 custom-scrollbar border-t border-[var(--border)]"
            onScroll={(e) => { const el = e.currentTarget; setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40); }}>
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                <Terminal className="w-8 h-8 opacity-30 animate-pulse" />
                <p className="text-[11px]">
                  {!isMonitoring ? 'Monitoring dinonaktifkan. Aktifkan switch "Monitor Stream" di atas.' : 'Menunggu log masuk dari collar...'}
                </p>
              </div>
            ) : filteredLogs.map((log) => {
              const s = getLogStyle(log.level);
              return (
                <div key={log._id} className="flex items-baseline gap-2.5 hover:bg-slate-800/20 rounded px-1.5 py-0.5 transition-colors">
                  <span className="text-slate-600 shrink-0 w-16 font-semibold tabular-nums">{formatTs(log.timestamp)}</span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-bold w-16 text-center ${s.badge}`}>{(log.level || 'INFO').toUpperCase()}</span>
                  <span className="text-indigo-400 shrink-0 w-24 truncate font-semibold">{log.collar_id || '-'}</span>
                  <span className={`${s.text} break-all leading-relaxed`}>{log.message}</span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between px-6 py-2 border-t border-[var(--border)] bg-slate-950/20">
            <span className="text-[9px] text-slate-500 font-mono font-bold">{filteredLogs.length} entries</span>
            <span className="text-[9px] text-slate-500 font-mono font-bold">{wsStatus === 'connected' ? '● LIVE STREAMING' : '○ OFFLINE'}</span>
          </div>
        </div>
      </section>

      {/* SECTION 3: DEVICE REMOTE CONFIGURATION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <span className="w-1.5 h-5 rounded-full bg-amber-500" />
          <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">Konfigurasi Jarak Jauh</h2>
          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 ml-2 uppercase">MQTT Config</span>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-3xl p-6 md:p-8 shadow-card border border-amber-500/20 space-y-6 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sliders className="w-6 h-6 text-amber-400" />
              <div>
                <h3 className="text-lg font-bold text-amber-400 font-display">Remote Configuration Parameters</h3>
                <p className="text-xs text-[var(--text-3)]">Kirim nilai parameter operasional firmware tanpa flash ulang</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 text-xs text-amber-300/80 leading-relaxed max-w-3xl">
            Konfigurasi dikirimkan melalui broker MQTT sebagai pesan bertipe <span className="font-semibold underline">retained</span>. 
            Perangkat collar akan mengambil dan menerapkan konfigurasi ini segera saat terbangun dari siklus deep sleep berikutnya. 
            Target perangkat aktif: <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{resolvedCollarId}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ConfigRow label="Sleep interval" hint="5–60 menit"     value={sleepMinutes}     onChange={setSleepMinutes}     min={5}  max={60}  status={statuses.sleep_minutes}      onSend={() => updateConfig(resolvedCollarId, 'sleep_minutes', sleepMinutes)} />
            <ConfigRow label="Batch count"    hint="1–20 batch"     value={batchCount}       onChange={setBatchCount}       min={1}  max={20}  status={statuses.batch_count}        onSend={() => updateConfig(resolvedCollarId, 'batch_count', batchCount)} />
            <ConfigRow label="Window size"    hint="5–50 sampel"    value={windowSize}       onChange={setWindowSize}       min={5}  max={50}  status={statuses.window_size}        onSend={() => updateConfig(resolvedCollarId, 'window_size', windowSize)} />
            <ConfigRow label="Max offline"    hint="5–100 siklus"   value={maxOfflineCycles} onChange={setMaxOfflineCycles} min={5}  max={100} status={statuses.max_offline_cycles} onSend={() => updateConfig(resolvedCollarId, 'max_offline_cycles', maxOfflineCycles)} />
            
            {/* Device active toggle */}
            <div className="md:col-span-2 flex items-center justify-between p-5 bg-slate-900/40 border border-[var(--border)] rounded-2xl hover:border-slate-800 transition-all">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Collar Active Status</p>
                <div className="min-h-[16px] mt-1">
                  {statuses.device_active !== 'idle'
                    ? <ConfigStatusBadge status={statuses.device_active} />
                    : <p className="text-xs text-[var(--text-3)]">Gunakan sakelar ini untuk mengaktifkan atau menonaktifkan aktivitas perangkat dari jarak jauh</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold font-mono tracking-wider ${deviceActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {deviceActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
                <button
                  type="button"
                  onClick={() => { const next = !deviceActive; setDeviceActive(next); updateConfig(resolvedCollarId, 'device_active', next); }}
                  disabled={statuses.device_active === 'sending' || statuses.device_active === 'delivered'}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 ${deviceActive ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${deviceActive ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: DEVICE SYSTEM MAINTENANCE & OTA */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <span className="w-1.5 h-5 rounded-full bg-blue-500" />
          <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">Pemeliharaan & OTA Update</h2>
          <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 ml-2 uppercase">Firmware Flash</span>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-3xl p-6 md:p-8 shadow-card border border-blue-500/20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-blue-400" />
                <div>
                  <h3 className="text-lg font-bold text-blue-400 font-display">Over-the-Air (OTA) Standby Mode</h3>
                  <p className="text-xs text-[var(--text-3)]">Kirim sinyal bangun terus menerus ke collar sapi terpilih</p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-2)] leading-relaxed">
                Tombol di samping mengirimkan perintah khusus ke broker MQTT untuk memaksa collar sapi yang dipilih (<span className="font-mono text-blue-300 font-semibold">{resolvedCollarId}</span>) tetap menyala terus-menerus selama <span className="font-semibold text-white">3 menit (180 detik)</span>.
                Gunakan mode ini sebelum melakukan upload firmware secara nirkabel via Arduino IDE atau ESPOTA Tool agar perangkat tidak masuk ke mode deep sleep di tengah proses unggahan.
              </p>
              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-[11px] text-blue-300/80 leading-relaxed italic">
                * PENTING: Pastikan laptop Anda berada di jaringan Wi-Fi lokal yang sama dengan access point kandang agar port jaringan collar terdeteksi di Arduino IDE.
              </div>
            </div>
            <div className="flex flex-col justify-center h-full">
              <button onClick={handleTriggerOta} disabled={otaLoading || loadingCows}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center gap-2">
                {otaLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                {otaLoading ? 'Mengaktifkan...' : 'Aktifkan OTA Mode'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* OTA COUNTDOWN OVERLAY */}
      {showOtaOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl bg-slate-950/80">
          <div className="max-w-sm w-full bg-slate-900 border border-blue-500/30 rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 blur-[80px] rounded-full" />
            <div className="relative z-10 space-y-6">

              {/* Icon — berubah sesuai stage */}
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${
                otaStage === 'done' ? 'bg-emerald-500/20' :
                otaStage === 'error' ? 'bg-red-500/20' :
                otaStage === 'uploading' ? 'bg-amber-500/20' : 'bg-blue-500/20'}`}>
                {otaStage === 'done'
                  ? <CheckCircle className="w-10 h-10 text-emerald-400" />
                  : otaStage === 'error'
                  ? <AlertCircle className="w-10 h-10 text-red-400" />
                  : <Rocket className={`w-10 h-10 text-blue-400 ${otaStage === 'uploading' ? 'animate-bounce' : 'animate-pulse'}`} />}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {otaStage === 'done' ? 'Upload Selesai!' : otaStage === 'error' ? 'OTA Gagal' : 'OTA Mode Aktif!'}
                </h2>
                <p className="text-blue-400 font-mono text-sm uppercase tracking-widest">{resolvedCollarId}</p>
              </div>

              {/* Countdown */}
              <div className="py-2">
                <div className={`text-6xl font-black tabular-nums tracking-tighter ${countdown < 30 ? 'text-rose-500' : 'text-white'}`}>
                  {Math.floor(countdown / 60).toString().padStart(2, '0')}:{(countdown % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-[var(--text-3)] text-xs mt-2 uppercase tracking-widest">Waktu Standby Tersisa</p>
              </div>

              {/* OTA Progress bar */}
              <div className="space-y-2">
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${
                      otaStage === 'done' ? 'bg-emerald-500' :
                      otaStage === 'error' ? 'bg-red-500' :
                      otaStage === 'uploading' ? 'bg-amber-400' : 'bg-blue-600'}`}
                    style={{ width: `${otaStage === 'waiting' ? 0 : otaProgress}%` }}
                  />
                </div>
                <p className={`text-xs font-mono ${otaStageInfo.color}`}>{otaStageInfo.label}</p>
              </div>

              {/* Steps */}
              {otaStage === 'waiting' && (
                <div className="bg-slate-950/50 rounded-2xl p-4 text-left border border-slate-800">
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    <span className="text-blue-400 font-bold">Langkah Selanjutnya:</span><br />
                    1. Buka Arduino IDE di Laptop Anda.<br />
                    2. Pilih Port: <span className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">Network Port ({resolvedCollarId})</span>.<br />
                    3. Klik <span className="text-white font-bold">Upload</span> sekarang!
                  </p>
                </div>
              )}

              <button onClick={closeOta}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-sm transition-all active:scale-95 border border-slate-700/50">
                {otaStage === 'done' ? 'Tutup' : 'Batal / Selesai'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}