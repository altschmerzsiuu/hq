const fs = require('fs');
const path = require('path');

// ── 1. CowEstrusView: Monitoring → Pantau ─────────────────────────────────
const estrusPath = path.join(__dirname, 'src/components/shared/CowEstrusView.jsx');
let estrus = fs.readFileSync(estrusPath, 'utf8');
estrus = estrus.replace(
  'Monitoring Siklus Birahi',
  'Pantau Siklus Birahi'
);
fs.writeFileSync(estrusPath, estrus, 'utf8');
console.log('[1] CowEstrusView title updated.');

// ── 2. DetailTernak: fix desktop Catatan Harian section ───────────────────
const detailPath = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let detail = fs.readFileSync(detailPath, 'utf8');

// Replace the old desktop linimasa block (old title + old empty state) with 
// proper title + dropdown + ActivityTimeline
const oldLinimasa = `              {activeTab === 'linimasa' && (
                 <div className="animate-in fade-in duration-300">
                   <h3 className="text-lg font-bold text-gray-900 mb-6">Linimasa Aktivitas</h3>
                   <div className="text-center text-sm text-gray-400 py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                     Tidak ada aktivitas terbaru di linimasa.
                   </div>
                 </div>
               )}`;

const newLinimasa = `              {activeTab === 'linimasa' && (
                 <div className="animate-in fade-in duration-300">
                   <div className="flex items-center justify-between mb-6">
                     <h3 className="text-lg font-bold text-gray-900">Catatan Aktivitas Ternak</h3>
                     <div className="relative">
                       <select
                         value={activityFilter}
                         onChange={(e) => setActivityFilter(e.target.value)}
                         className="appearance-none outline-none text-xs font-semibold border border-gray-200 rounded-lg shadow-sm py-2 pl-3 pr-8 bg-white text-gray-800 cursor-pointer"
                       >
                         <option value="hari_ini">Hari Ini</option>
                         <option value="minggu_ini">Minggu Ini</option>
                         <option value="bulan_ini">Bulan Ini</option>
                         <option value="semua">Semua</option>
                       </select>
                       <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                     </div>
                   </div>
                   <ActivityTimeline cowId={selectedSapi?.id} filter={activityFilter} />
                 </div>
               )}`;

if (detail.includes(oldLinimasa)) {
  detail = detail.replace(oldLinimasa, newLinimasa);
  console.log('[2] Desktop Linimasa section updated.');
} else {
  console.log('[2] WARN: old Linimasa block not found. Trying fallback...');
  // fallback: replace just the title
  detail = detail.replace(
    '<h3 className="text-lg font-bold text-gray-900 mb-6">Linimasa Aktivitas</h3>',
    '<h3 className="text-lg font-bold text-gray-900">Catatan Aktivitas Ternak</h3>'
  );
}

// Also fix mobile title
detail = detail.replace(
  '<h3 className="text-[20px] font-extrabold text-[#111]">Catatan Harian</h3>',
  '<h3 className="text-[20px] font-extrabold text-[#111]">Catatan Aktivitas Ternak</h3>'
);

fs.writeFileSync(detailPath, detail, 'utf8');
console.log('[2] DetailTernak updated.');

// ── 3. CowAnalyticsView: Ringkasan Sensor → Ringkasan Aktivitas Ternak ────
const analyticsPath = path.join(__dirname, 'src/components/shared/CowAnalyticsView.jsx');
let analytics = fs.readFileSync(analyticsPath, 'utf8');
analytics = analytics.replace(
  "lang === 'id' ? 'Ringkasan Sensor' : 'Sensor Summary'",
  "lang === 'id' ? 'Ringkasan Aktivitas Ternak' : 'Livestock Activity Summary'"
);
fs.writeFileSync(analyticsPath, analytics, 'utf8');
console.log('[3] CowAnalyticsView title updated.');
