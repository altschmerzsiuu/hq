const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/shared/CowEstrusView.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// The text content:
/*
              {/* Center Text content *\/}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-5xl font-black text-gray-900 tracking-tighter">
                  {prediction.days_until}
                </span>
                <span className="text-sm font-bold text-gray-800 tracking-tight uppercase mt-1">Hari Lagi</span>
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mt-1 mb-2">Masa Subur Berikutnya</span>
                <span className={`text-lg font-black px-3 py-1 rounded-full ${prediction.days_until <= 3 ? 'text-green-700 bg-green-50' : 'text-blue-700 bg-blue-50'}`}>
                  {fmtDate(prediction.prediksi_ib_optimal, lang)}
                </span>
              </div>
*/

content = content.replace(
  'className="text-5xl font-black text-gray-900 tracking-tighter"',
  'className="text-4xl font-black text-gray-900 tracking-tighter"'
);

content = content.replace(
  'className="text-sm font-bold text-gray-800 tracking-tight uppercase mt-1"',
  'className="text-xs font-bold text-gray-800 tracking-tight uppercase mt-1"'
);

content = content.replace(
  'className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mt-1 mb-2"',
  'className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1.5 mb-1.5"'
);

content = content.replace(
  'text-lg font-black px-3 py-1',
  'text-sm font-black px-2.5 py-1'
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Reduced text sizes.");
