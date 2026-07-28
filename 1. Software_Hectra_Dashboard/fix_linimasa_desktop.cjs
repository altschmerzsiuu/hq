const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let c = fs.readFileSync(targetPath, 'utf8');

// Find the exact block and replace it
const marker = `{activeTab === 'linimasa' && (`;
const idx = c.indexOf(marker);
if (idx === -1) { console.log('Block not found!'); process.exit(1); }

// Find the closing )} for this block
const blockStart = idx;
let depth = 0;
let i = blockStart;
let inBlock = false;
let endIdx = -1;

// Walk forward: find the matching close of the entire {activeTab === ...}
for (; i < c.length; i++) {
  if (c[i] === '{') {
    depth++;
    inBlock = true;
  } else if (c[i] === '}') {
    depth--;
    if (inBlock && depth === 0) {
      endIdx = i + 1;
      break;
    }
  }
}

if (endIdx === -1) { console.log('Could not find end!'); process.exit(1); }

const newBlock = `{activeTab === 'linimasa' && (
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

c = c.slice(0, blockStart) + newBlock + c.slice(endIdx);
fs.writeFileSync(targetPath, c, 'utf8');
console.log('Desktop linimasa block replaced successfully.');
