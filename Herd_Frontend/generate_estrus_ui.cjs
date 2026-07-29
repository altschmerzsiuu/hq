const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/shared/CowEstrusView.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// The replacement logic
const newReturnBlock = `  // ── Calculation for SVG Ring ──────────────────────────────────────────────
  const currentDay = Math.max(0, 21 - (prediction?.days_until || 0));
  const angle = (currentDay / 21) * 360;
  const rad = (angle - 90) * (Math.PI / 180);
  const cx = 100, cy = 100, r = 80;
  const markerX = cx + r * Math.cos(rad);
  const markerY = cy + r * Math.sin(rad);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Run button card */}
      {prediction && (
        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '16px 18px', boxShadow: 'var(--shadow-card)' }} className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
              {lang === 'id' ? 'Analisis AI Estrus' : 'AI Estrus Analysis'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {lang === 'id' ? \`Siklus estrus \${selectedCow?.nama || 'sapi'}\` : \`\${selectedCow?.nama || 'Cow'}'s estrus cycle\`}
            </p>
          </div>
          <button
            onClick={handleRunPredict}
            disabled={isPredicting}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '10px',
              background: isPredicting ? 'var(--bg-hover)' : 'var(--color-primary)', color: isPredicting ? 'var(--text-2)' : 'white'}}
          >
            {isPredicting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {lang === 'id' ? 'Proses...' : 'Processing...'}</>
              : <><RefreshCw className="w-3.5 h-3.5" /> {lang === 'id' ? 'Prediksi Ulang' : 'Repredict'}</>
            }
          </button>
        </div>
      )}

      {!prediction ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-[24px] border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <BrainCircuit size={40} className="text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {lang === 'id' ? 'Belum Ada Prediksi Estrus' : 'No Estrus Prediction Yet'}
          </h3>
          <p className="text-gray-500 max-w-sm mb-8 leading-relaxed">
            {lang === 'id' ? 'Jalankan AI untuk menganalisis siklus estrus sapi ini berdasarkan data historis dan sensor.' : 'Run AI to analyze this cow\\'s estrus cycle based on historical and sensor data.'}
          </p>
          <button
            onClick={handleRunPredict}
            disabled={isPredicting}
            className="group relative flex items-center gap-4 bg-white pr-6 pl-2 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-500/30 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 relative z-10">
              {isPredicting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            </div>
            <span className="text-[15px] font-bold text-gray-700 group-hover:text-blue-600 transition-colors duration-300 relative z-10">
              {isPredicting ? (lang === 'id' ? 'Memproses AI...' : 'Processing AI...') : (lang === 'id' ? 'Jalankan Prediksi AI' : 'Run AI Prediction')}
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Ring Tracker */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col items-center relative overflow-hidden">
            {/* Header */}
            <div className="w-full flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Activity className="text-blue-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg tracking-tight">Monitoring Siklus Estrus</h3>
                <p className="text-sm text-gray-500 font-medium">ID Sapi: {selectedCow?.id || selectedCow?.cow_id} - {selectedCow?.nama}</p>
              </div>
            </div>

            {/* SVG Ring Area */}
            <div className="relative w-72 h-72 flex items-center justify-center my-6">
              <svg width="100%" height="100%" viewBox="0 0 200 200" className="overflow-visible">
                {/* Background Track */}
                <circle cx="100" cy="100" r="80" fill="none" stroke="#F1F5F9" strokeWidth="16" />
                
                {/* Highlight Masa Subur (Fertile Window) - roughly day 18-21 (top left arc) */}
                <circle 
                  cx="100" cy="100" r="80" fill="none" 
                  stroke="url(#greenGradient)" 
                  strokeWidth="16" 
                  strokeLinecap="round"
                  strokeDasharray="75 502" 
                  strokeDashoffset="10"
                  transform="rotate(-90 100 100)"
                  style={{ filter: 'drop-shadow(0px 4px 12px rgba(34, 197, 94, 0.4))' }}
                />

                {/* Definitions for gradients */}
                <defs>
                  <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4ADE80" />
                    <stop offset="100%" stopColor="#22C55E" />
                  </linearGradient>
                </defs>

                {/* Day Labels on the ring */}
                <text x="100" y="8" textAnchor="middle" fill="#64748B" fontSize="9" fontWeight="bold">Day 21</text>
                <text x="190" y="103" textAnchor="start" fill="#64748B" fontSize="9" fontWeight="bold">Day 5</text>
                <text x="100" y="195" textAnchor="middle" fill="#64748B" fontSize="9" fontWeight="bold">Day 11</text>
                <text x="10" y="103" textAnchor="end" fill="#64748B" fontSize="9" fontWeight="bold">Day 16</text>

                {/* Current Position Marker */}
                <circle cx={markerX} cy={markerY} r="6" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" style={{ transition: 'all 1s ease-out' }} />
                
                <polygon 
                  points="-4,-6 4,-6 0,2" 
                  fill="#0F172A"
                  transform={\`translate(\${markerX}, \${markerY}) rotate(\${angle}) translate(0, -10)\`}
                  style={{ transition: 'all 1s ease-out' }}
                />
              </svg>

              {/* Center Text content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-black text-gray-900 tracking-tighter">
                  {prediction.days_until}
                </span>
                <span className="text-sm font-bold text-gray-800 tracking-tight uppercase mt-1">Hari Lagi</span>
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mt-1 mb-2">Hingga Masa Subur</span>
                <span className="text-lg font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  {fmtDate(prediction.prediksi_ib_optimal, lang)}
                </span>
              </div>
            </div>

            {/* Badges pointing to the ring */}
            <div className="absolute top-28 left-6 bg-green-100 border border-green-200 px-3 py-1.5 rounded-xl shadow-sm z-10">
              <p className="text-xs font-bold text-green-800">Masa Subur</p>
              <p className="text-[10px] font-semibold text-green-600">Hari 18-21</p>
            </div>
          </div>

          {/* RIGHT COLUMN: Info Cards */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Masa Optimal Card */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-50"></div>
              <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                <CalendarClock className="w-5 h-5 text-blue-500" />
                Masa Optimal
              </h4>
              <div className="flex gap-4">
                <div className="w-1.5 h-auto bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Masa Subur Berikutnya:</p>
                  <p className="text-sm font-bold text-gray-900">{fmtDate(prediction.window_awal, lang)}</p>
                  <p className="text-xs font-semibold text-gray-400 my-0.5">sampai dengan</p>
                  <p className="text-sm font-bold text-gray-900">{fmtDate(prediction.window_akhir, lang)}</p>
                </div>
              </div>
            </div>

            {/* Status Terjadwal Card */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#2E7D32]" />
                  Status: {classification.label}
                </h4>
                <div className="bg-green-50 border border-green-200 px-3 py-1 rounded-full flex items-center gap-1.5 cursor-help" title="Tingkat akurasi prediksi AI">
                  <BrainCircuit className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-bold text-green-700">{conf}% Akurasi</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Siklus Berjalan (Aktif)</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Sapi dalam fase {prediction.in_window_now ? 'Estrus (Subur)' : 'Diestrus (Tidak Subur)'}.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Target className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">AI / Inseminasi</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Rekomendasi IB pada tanggal <strong className="text-blue-600">{fmtDate(prediction.prediksi_ib_optimal, lang)}</strong>.</p>
                  </div>
                </div>

                {/* Footnote about accuracy */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2">
                  <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-400 font-medium leading-relaxed">
                    Akurasi akan terus meningkat secara otomatis setiap kali data aktivitas atau kawin sapi terbaru ditambahkan ke sistem.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
`;

const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('// ── Prediction display'));

if (startIdx === -1) {
  console.log("Could not find start marker.");
  process.exit(1);
}

const beforeReturn = lines.slice(0, startIdx + 4).join('\n'); // keep lines up to 'const conf = ...'
const finalContent = beforeReturn + '\n\n' + newReturnBlock;

fs.writeFileSync(targetPath, finalContent, 'utf8');
console.log("Replaced CowEstrusView UI block.");
