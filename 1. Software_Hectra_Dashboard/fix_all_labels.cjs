const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let c = fs.readFileSync(targetPath, 'utf8');

// 1. Fix desktop tab labels
c = c.replace(
  "{tab === 'estrus' && 'Deteksi Estrus'}",
  "{tab === 'estrus' && 'Pantau Birahi'}"
);
c = c.replace(
  "{tab === 'linimasa' && 'Linimasa'}",
  "{tab === 'linimasa' && 'Catatan Harian'}"
);
c = c.replace(
  "{tab === 'analitik' && 'Analitik & Grafik'}",
  "{tab === 'analitik' && 'Grafik Sensor'}"
);

// 2. Fix mobile tab labels
c = c.replace(
  '<span className="font-bold text-[10px] tracking-wide text-center leading-tight">Linimasa</span>',
  '<span className="font-bold text-[10px] tracking-wide text-center leading-tight">Catatan Harian</span>'
);
c = c.replace(
  '<span className="font-bold text-[10px] tracking-wide text-center leading-tight">Analitik</span>',
  '<span className="font-bold text-[10px] tracking-wide text-center leading-tight">Grafik Sensor</span>'
);

// 3. Fix mobile Linimasa section - update title + add filter state + dropdown
// Add activityFilter state - we'll inject it into the return JSX area
// First rename titles
c = c.replace(
  '<h3 className="text-[20px] font-extrabold text-[#111]">Linimasa Aktivitas</h3>',
  '<h3 className="text-[20px] font-extrabold text-[#111]">Catatan Harian</h3>'
);
c = c.replace(
  '<p className="text-[13px] text-gray-500 mt-1">Jejak rekaman aktivitas personal untuk <strong className="text-[#2E7D32]">{selectedSapi.nama}</strong></p>',
  '<p className="text-[13px] text-gray-500 mt-1">Rekaman aktivitas untuk <strong className="text-[#2E7D32]">{selectedSapi.nama}</strong></p>'
);

// Add dropdown beside the title in mobile Linimasa section
c = c.replace(
  `              <div className="mb-8">
                <h3 className="text-[20px] font-extrabold text-[#111]">Catatan Harian</h3>
                <p className="text-[13px] text-gray-500 mt-1">Rekaman aktivitas untuk <strong className="text-[#2E7D32]">{selectedSapi.nama}</strong></p>
              </div>`,
  `              <div className="mb-8 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[20px] font-extrabold text-[#111]">Catatan Harian</h3>
                  <p className="text-[13px] text-gray-500 mt-1">Rekaman aktivitas untuk <strong className="text-[#2E7D32]">{selectedSapi.nama}</strong></p>
                </div>
                <div className="relative shrink-0">
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
              </div>`
);

// 4. Fix desktop Linimasa section - update title + add filter
c = c.replace(
  `               {activeTab === 'linimasa' && (
                 <div className="animate-in fade-in duration-300">
                   <h3 className="text-lg font-bold text-gray-900 mb-6">Catatan Harian Aktivitas</h3>
                   <div className="text-center text-sm text-gray-400 py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                     Belum ada catatan harian terbaru.
                   </div>
                 </div>
               )}`,
  `              {activeTab === 'linimasa' && (
                 <div className="animate-in fade-in duration-300">
                   <div className="flex items-center justify-between mb-6">
                     <h3 className="text-lg font-bold text-gray-900">Catatan Harian</h3>
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
                   <ActivityTimeline cowId={selectedSapi?.id} filter={activityFilter} lang={lang} />
                 </div>
               )}`
);

fs.writeFileSync(targetPath, c, 'utf8');
console.log("Updated DetailTernak labels and Catatan Harian section.");
