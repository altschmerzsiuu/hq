const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let c = fs.readFileSync(p, 'utf8');

// Find the desktop linimasa block and replace with stepper
const oldBlock = `              {activeTab === 'linimasa' && (
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
                   <ActivityTimeline cowId={selectedSapi?.id} filter={activityFilter} embedded={true} />
                 </div>
               )}`;

const newBlock = `              {activeTab === 'linimasa' && (
                 <div className="animate-in fade-in duration-300">
                   <div className="flex items-center justify-between mb-6">
                     <div>
                       <h3 className="text-lg font-bold text-gray-900">Catatan Aktivitas Ternak</h3>
                       <p className="text-sm text-gray-500 mt-0.5">Rekaman aktivitas untuk <strong className="text-[#2E7D32]">{selectedSapi?.nama}</strong></p>
                     </div>
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
                   <Stepper orientation="vertical" defaultValue={2} className="w-full">
                     <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[17px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#2E7D32]/20 before:to-transparent">
                       {(() => {
                           if (!sortedReproHistory || sortedReproHistory.length === 0) {
                               return (
                                   <div className="w-full text-center py-10 bg-white border border-[#E8F0EA] rounded-[16px] shadow-sm">
                                       <p className="text-[13px] text-gray-500">Belum ada data aktivitas untuk ternak ini.</p>
                                   </div>
                               );
                           }
                           const formatTglStr = (ts) => new Date(ts).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {day: 'numeric', month: 'short', year: 'numeric'});
                           const timelineEvents = [];
                           sortedReproHistory.forEach(item => {
                               const isPregnant = item.results === true || item.results === 'true' || item.is_pregnant === true;
                               const isFailed   = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                               const rawDate    = item.tanggal_ib || item.service_date;
                               if (!rawDate) return;
                               const baseTime = new Date(rawDate).getTime();
                               const eventId = item.id || Math.random().toString();
                               timelineEvents.push({
                                   id: eventId + '-ib',
                                   title: \`Inseminasi Buatan (Ke-\${item.jumlah_ib || 1})\`,
                                   dateRaw: baseTime,
                                   dateFmt: formatTglStr(baseTime),
                                   desc: \`Metode: \${(item.metode || 'IB').toUpperCase()}\${item.pemberi_ib ? \`. Inseminator: \${item.pemberi_ib}\` : ''}\`,
                                   status: isPregnant ? 'completed' : (isFailed ? 'failed' : 'active')
                               });
                               if (isPregnant) {
                                   const pkbTime = baseTime + 60 * 24 * 60 * 60 * 1000;
                                   timelineEvents.push({ id: eventId + '-pkb', title: 'Pemeriksaan Kebuntingan', dateRaw: pkbTime, dateFmt: formatTglStr(pkbTime), desc: 'Dinyatakan Bunting (PKB positif).', status: 'completed' });
                                   const masaKeringTime = baseTime + 223 * 24 * 60 * 60 * 1000;
                                   timelineEvents.push({ id: eventId + '-kering', title: 'Masa Kering', dateRaw: masaKeringTime, dateFmt: formatTglStr(masaKeringTime), desc: 'Persiapan menjelang kelahiran.', status: masaKeringTime < Date.now() ? 'completed' : 'future_active' });
                                   const calvingTime = baseTime + 283 * 24 * 60 * 60 * 1000;
                                   timelineEvents.push({ id: eventId + '-calving', title: 'Perkiraan Kelahiran', dateRaw: calvingTime, dateFmt: 'Est. ' + formatTglStr(calvingTime), desc: 'Pindahkan ke kandang isolasi.', status: calvingTime < Date.now() ? 'completed' : 'future' });
                               }
                           });
                           timelineEvents.sort((a, b) => b.dateRaw - a.dateRaw);
                           return timelineEvents.map((evt, idx) => {
                               let iconEl = <CheckCircle size={18} className="text-[#2E7D32]" />;
                               let circleClass = "bg-[#E8F5E9] border-[#2E7D32]";
                               let cardClass = "bg-white border border-[#E8F0EA]";
                               let opacityClass = "";
                               let badge = null;
                               let isCompleted = evt.status === 'completed';
                               if (evt.status === 'failed') {
                                   iconEl = <XCircle size={18} className="text-red-500" />;
                                   circleClass = "bg-red-50 border-red-500 ring-4 ring-red-50";
                                   cardClass = "bg-white border-2 border-red-500/30";
                                   badge = <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Gagal</div>;
                                   isCompleted = true;
                               } else if (evt.status === 'active') {
                                   iconEl = <Activity size={18} className="text-[#2E7D32]" />;
                                   circleClass = "bg-[#E8F5E9] border-[#2E7D32] ring-4 ring-[#E8F5E9]";
                                   cardClass = "bg-white border-2 border-[#2E7D32]/30 shadow-md";
                                   badge = <div className="absolute top-0 right-0 bg-[#2E7D32] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Menunggu PKB</div>;
                                   isCompleted = false;
                               } else if (evt.status === 'future_active') {
                                   iconEl = <Activity size={18} className="text-amber-600" />;
                                   circleClass = "bg-amber-100 border-amber-500 ring-4 ring-amber-50";
                                   cardClass = "bg-white border-2 border-amber-500/30 shadow-md";
                                   badge = <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Mendatang</div>;
                                   isCompleted = false;
                               } else if (evt.status === 'future') {
                                   iconEl = <div className="size-2.5 rounded-full bg-gray-400" />;
                                   circleClass = "bg-gray-100 border-gray-300 opacity-60";
                                   cardClass = "bg-white border border-gray-200";
                                   opacityClass = "opacity-60";
                                   isCompleted = false;
                               }
                               return (
                                   <StepperItem key={evt.id} step={idx + 1} completed={isCompleted} className="relative flex items-start gap-4">
                                     <div className={\`relative z-10 flex size-9 items-center justify-center rounded-full border-2 shadow-sm shrink-0 \${circleClass}\`}>
                                       {iconEl}
                                     </div>
                                     <div className={\`flex-1 min-w-0 pb-2 \${opacityClass}\`}>
                                       <div className={\`\${cardClass} rounded-[16px] p-4 w-full relative overflow-hidden\`}>
                                         {badge}
                                         <StepperTitle className="text-[14px] font-bold text-[#111] mb-1">{evt.title}</StepperTitle>
                                         <StepperDescription className="text-[12px] text-gray-500 leading-relaxed">
                                           <span className="font-semibold text-gray-700">{evt.dateFmt}</span> - {evt.desc}
                                         </StepperDescription>
                                       </div>
                                     </div>
                                   </StepperItem>
                               );
                           });
                       })()}
                     </div>
                   </Stepper>
                 </div>
               )}`;

if (c.includes(oldBlock)) {
  c = c.replace(oldBlock, newBlock);
  console.log('Desktop linimasa block replaced with Stepper.');
} else {
  console.log('ERROR: Old block not found!');
  process.exit(1);
}

fs.writeFileSync(p, c, 'utf8');
