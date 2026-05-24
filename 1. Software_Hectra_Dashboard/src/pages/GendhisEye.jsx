import { useState, useEffect } from 'react';
import { 
  Tv, 
  Wifi, 
  ShieldAlert, 
  Cpu, 
  HelpCircle, 
  Play, 
  Pause,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GendhisEye() {
  const [hudDate, setHudDate] = useState('');
  const [hudTime, setHudTime] = useState('');
  const [recTime, setRecTime] = useState('00:00:00:00');
  const [isRecording, setIsRecording] = useState(true);

  // Rec Time Counter
  useEffect(() => {
    let start = Date.now();
    const interval = setInterval(() => {
      if (!isRecording) return;
      
      const elapsed = Date.now() - start;
      const hours = Math.floor(elapsed / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
      const ms = Math.floor((elapsed % 1000) / 10).toString().padStart(2, '0');
      
      setRecTime(`${hours}:${mins}:${secs}:${ms}`);
    }, 43);

    return () => clearInterval(interval);
  }, [isRecording]);

  // HUD Date/Time millisecond counter
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
      const ms = now.getMilliseconds().toString().padStart(3, '0');
      
      setHudDate(`DATE: ${dateStr}`);
      setHudTime(`TIME: ${timeStr}:${ms}`);
    }, 43);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)]">Gendhis&apos;s Eye</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Sistem visual kecerdasan buatan terintegrasi dengan pemantauan kamera kandang (CCTV AI).</p>
        </div>
      </div>

      {/* CCTV CONTAINER */}
      <div className="relative w-full aspect-video min-h-[400px] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-900 group">
        
        {/* SCANLINES ANIMATION */}
        <div className="absolute inset-0 z-20 pointer-events-none opacity-[0.07] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%]"></div>
        <div className="absolute inset-0 z-20 pointer-events-none opacity-20 bg-[linear-gradient(0deg,rgba(0,0,0,0)_0%,rgba(255,255,255,0.05)_50%,rgba(0,0,0,0)_100%)] animate-[scanline_6s_linear_infinite] h-[100px] -bottom-[100px]"></div>
        
        {/* GRID OVERLAY */}
        <div 
          className="absolute inset-0 z-10 opacity-[0.04] pointer-events-none" 
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        ></div>

        {/* HUD OVERLAY CONTAINER */}
        <div className="absolute inset-0 p-6 sm:p-8 z-30 flex flex-col justify-between pointer-events-none font-mono text-emerald-500/80 text-xs sm:text-sm">
          
          {/* Top HUD Row */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "inline-block w-2.5 h-2.5 rounded-full bg-red-500",
                  isRecording ? "animate-[pulse_1s_infinite]" : "opacity-50"
                )}></span>
                <span className="font-bold uppercase tracking-tight">
                  {isRecording ? 'REC' : 'PAUSED'} <span className="ml-1">{recTime}</span>
                </span>
              </div>
              <p className="opacity-60 uppercase text-[9px]">DEPT: KANDANG PRIMARY A</p>
            </div>
            
            <div className="text-right flex flex-col gap-1 text-[9px] uppercase tracking-widest">
              <p>{hudDate}</p>
              <p>{hudTime}</p>
            </div>
          </div>

          {/* Center Graphic Graphic */}
          <div className="flex flex-col items-center gap-4 py-8 pointer-events-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 border border-emerald-500/30 rounded-full flex items-center justify-center relative bg-black/40">
              <Tv className="w-8 h-8 text-emerald-500/60 animate-pulse" />
              <div className="absolute inset-0 border border-emerald-500/20 rounded-full animate-ping"></div>
            </div>
            
            <div className="text-center space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tighter text-white">Gendhis Is Preparing Her Eyes...</h2>
              <p className="text-emerald-400 font-bold uppercase tracking-[0.4em] text-[9px] opacity-70">AI Visual Core Integration In Progress</p>
            </div>

            {/* Interactive Control buttons */}
            <div className="flex items-center gap-3 mt-4 pointer-events-auto">
              <button
                onClick={() => setIsRecording(!isRecording)}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs transition-colors font-bold uppercase tracking-wider"
              >
                {isRecording ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isRecording ? 'Pause Feed' : 'Resume Feed'}
              </button>
            </div>
          </div>

          {/* Bottom HUD Row */}
          <div className="flex justify-between items-end opacity-70 text-[9px] uppercase tracking-widest">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5"><Wifi className="w-3 h-3" /> SIGNAL: STABLE [98.4%]</p>
              <p>RESOLUTION: 2160P [4K]</p>
            </div>
            <div className="space-y-1 text-right">
              <p>LATENCY: 12ms</p>
              <p className="flex items-center justify-end gap-1.5"><Cpu className="w-3 h-3" /> SECURE [AES-256]</p>
            </div>
          </div>

        </div>

        {/* Ambient Dark Green Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-transparent to-emerald-950/20 pointer-events-none opacity-60"></div>
      </div>

      {/* FOOTER METRICS INFO AREA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-card)' }} className="flex items-center gap-4 p-5">
          <div className="w-12 h-12 bg-[var(--color-sage-light)]/30 rounded-2xl flex items-center justify-center text-xl shrink-0">
            💡
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">Modul Pengenalan Aktivitas Sapi</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Cattle Behavior Core Engine v2.1 terintegrasi aktif.</p>
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-card)' }} className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">Beban Prosesor Grafis AI (GPU)</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Menggunakan model YOLOv8 Cattle Custom.</p>
          </div>
          <div style={{ background: 'var(--bg-hover)' }} className="h-2.5 w-32 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-forest)] animate-pulse w-[65%]"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
