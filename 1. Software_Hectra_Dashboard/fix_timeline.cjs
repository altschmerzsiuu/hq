const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add timelineFilter state
if (!content.includes('const [timelineFilter, setTimelineFilter]')) {
    content = content.replace(
        "const [reproFilter, setReproFilter] = useState('siklus_saat_ini');",
        "const [reproFilter, setReproFilter] = useState('siklus_saat_ini');\n  const [timelineFilter, setTimelineFilter] = useState('hari_ini');"
    );
}

// 2. Extract the timeline rendering logic into a function just above the return statement.
const renderTimelineFunction = `
  const renderTimeline = () => {
      if (!sortedReproHistory || sortedReproHistory.length === 0) {
          return (
              <div className="w-full text-center py-10 bg-white border border-[#E8F0EA] rounded-[16px] shadow-sm">
                  <p className="text-[13px] text-gray-500">Belum ada data aktivitas untuk ternak ini.</p>
              </div>
          );
      }
      
      const formatTglStr = (ts) => new Date(ts).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {day: 'numeric', month: 'short', year: 'numeric'});
      let timelineEvents = [];
      
      sortedReproHistory.forEach(item => {
          const isPregnant    = item.results === true || item.results === 'true' || item.is_pregnant === true;
          const isFailed      = item.results === false || item.results === 'failed' || item.is_pregnant === false;
          const rawDate       = item.tanggal_ib || item.service_date;
          if (!rawDate) return;
          
          const baseTime = new Date(rawDate).getTime();
          const eventId = item.id || Math.random().toString();
          
          // Add Inseminasi Buatan event
          timelineEvents.push({
              id: eventId + '-ib',
              title: \`Inseminasi Buatan (Ke-\${item.jumlah_ib || 1})\`,
              dateRaw: baseTime,
              dateFmt: formatTglStr(baseTime),
              desc: \`Metode: \${(item.metode || 'IB').toUpperCase()}\${item.pemberi_ib ? \`. Inseminator: \${item.pemberi_ib}\` : ''}\`,
              status: isPregnant ? 'completed' : (isFailed ? 'failed' : 'active')
          });
          
          // If pregnant, extrapolate future events
          if (isPregnant) {
              const pkbTime = baseTime + 60 * 24 * 60 * 60 * 1000;
              const isPkbPast = pkbTime < Date.now();
              timelineEvents.push({
                  id: eventId + '-pkb',
                  title: \`Pemeriksaan Kebuntingan\`,
                  dateRaw: pkbTime,
                  dateFmt: formatTglStr(pkbTime),
                  desc: \`Dinyatakan Bunting (PKB positif).\`,
                  status: 'completed'
              });
              
              const masaKeringTime = baseTime + 223 * 24 * 60 * 60 * 1000;
              const isMasaKeringPast = masaKeringTime < Date.now();
              timelineEvents.push({
                  id: eventId + '-kering',
                  title: \`Masa Kering\`,
                  dateRaw: masaKeringTime,
                  dateFmt: formatTglStr(masaKeringTime),
                  desc: \`Persiapan menjelang kelahiran.\`,
                  status: isMasaKeringPast ? 'completed' : 'future_active'
              });
              
              const calvingTime = baseTime + 283 * 24 * 60 * 60 * 1000;
              const isCalvingPast = calvingTime < Date.now();
              timelineEvents.push({
                  id: eventId + '-calving',
                  title: \`Perkiraan Kelahiran\`,
                  dateRaw: calvingTime,
                  dateFmt: \`Est. \` + formatTglStr(calvingTime),
                  desc: \`Pindahkan ke kandang isolasi.\`,
                  status: isCalvingPast ? 'completed' : 'future'
              });
          }
      });
      
      // Filter based on timelineFilter
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;
      
      const weekStart = todayStart - now.getDay() * 24 * 60 * 60 * 1000;
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      
      if (timelineFilter === 'hari_ini') {
          timelineEvents = timelineEvents.filter(e => e.dateRaw >= todayStart && e.dateRaw < todayEnd);
      } else if (timelineFilter === 'minggu_ini') {
          timelineEvents = timelineEvents.filter(e => e.dateRaw >= weekStart && e.dateRaw < todayEnd);
      } else if (timelineFilter === 'bulan_ini') {
          timelineEvents = timelineEvents.filter(e => e.dateRaw >= monthStart && e.dateRaw < todayEnd);
      }
      
      if (timelineEvents.length === 0) {
          return (
              <div className="w-full text-center py-10 bg-white border border-[#E8F0EA] rounded-[16px] shadow-sm">
                  <p className="text-[13px] text-gray-500">Belum ada catatan aktivitas untuk rentang waktu ini.</p>
              </div>
          );
      }

      // Sort descending by default for timelines
      timelineEvents.sort((a, b) => b.dateRaw - a.dateRaw);
      
      return (
        <Stepper orientation="vertical" defaultValue={2} className="w-full">
          <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[17px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#2E7D32]/20 before:to-transparent">
            {timelineEvents.map((evt, idx) => {
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
                     <div key={evt.id} className={\`relative z-10 flex gap-6 md:justify-center \${opacityClass}\`}>
                         {/* Circle Indicator */}
                         <div className={\`absolute left-[17px] md:left-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-8 rounded-full border-2 \${circleClass} z-20 shadow-sm\`}>
                             {iconEl}
                         </div>
                         
                         {/* Content Card (Left or Right on Desktop, Right on Mobile) */}
                         <div className={\`w-full pl-12 md:pl-0 md:w-1/2 \${idx % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12 md:ml-auto md:text-left'}\`}>
                             <div className={\`relative p-4 rounded-2xl \${cardClass} overflow-hidden transition-all duration-300 hover:shadow-lg\`}>
                                 {badge}
                                 <div className={\`flex flex-col gap-1.5 \${idx % 2 === 0 ? 'md:items-end' : 'md:items-start'}\`}>
                                     <span className="text-[11px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-md w-fit border border-gray-100">{evt.dateFmt}</span>
                                     <h4 className="text-[15px] font-extrabold text-gray-900 leading-tight mt-1">{evt.title}</h4>
                                     <p className="text-[13px] text-gray-600 font-medium leading-snug">{evt.desc}</p>
                                 </div>
                             </div>
                         </div>
                     </div>
                 );
            })}
          </div>
        </Stepper>
      );
  };
`;

if (!content.includes('const renderTimeline = () => {')) {
    content = content.replace('  return (', renderTimelineFunction + '\n  return (');
}

// 3. Replace the Mobile view rendering
const mobileTimelineRegex = /<Stepper orientation="vertical" defaultValue=\{2\} className="w-full">[\s\S]*?<\/Stepper>/;
content = content.replace(mobileTimelineRegex, '{renderTimeline()}');

// 4. Update Desktop view rendering to use `renderTimeline()` and add the filter Dropdown
const desktopEmptyStateRegex = /<h3 className="text-lg font-bold text-gray-900 mb-6">Catatan Harian Aktivitas<\/h3>\s*<div className="text-center text-sm text-gray-400 py-12 border-2 border-dashed border-gray-100 rounded-2xl">\s*Belum ada catatan harian terbaru\.\s*<\/div>/;

const desktopTimelineWithFilter = `<div className="flex items-center justify-between mb-6">
                     <h3 className="text-lg font-bold text-gray-900">Catatan Harian Aktivitas</h3>
                     
                     <div className="relative inline-flex items-center group">
                       <select 
                         value={timelineFilter}
                         onChange={(e) => setTimelineFilter(e.target.value)}
                         className="appearance-none outline-none text-[13px] font-bold border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32] py-2 pl-3 pr-8 bg-white text-gray-700 hover:text-gray-900 hover:border-gray-300 transition-colors cursor-pointer"
                       >
                         <option value="hari_ini">Hari Ini</option>
                         <option value="minggu_ini">Minggu Ini</option>
                         <option value="bulan_ini">Bulan Ini</option>
                         <option value="semua">Semua</option>
                       </select>
                       <ChevronDown className="absolute right-2.5 w-4 h-4 text-gray-400 group-hover:text-gray-600 pointer-events-none" />
                     </div>
                   </div>
                   
                   {renderTimeline()}`;

content = content.replace(desktopEmptyStateRegex, desktopTimelineWithFilter);

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Timeline logic refactored and desktop filter added.");
