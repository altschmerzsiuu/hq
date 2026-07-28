const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/shared/CowEstrusView.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// The replacement logic for the SVG part
const newSvgBlock = `            <div className="relative w-72 h-72 flex items-center justify-center my-6">
              <svg width="100%" height="100%" viewBox="0 0 200 200" className="overflow-visible">
                {/* Background Track */}
                <circle cx="100" cy="100" r="80" fill="none" stroke="#F1F5F9" strokeWidth="16" />
                
                {/* Highlight Masa Subur (Fertile Window) - last 3 days (top left arc) */}
                <circle 
                  cx="100" cy="100" r="80" fill="none" 
                  stroke="url(#greenGradient)" 
                  strokeWidth="16" 
                  strokeLinecap="round"
                  strokeDasharray="72 502" 
                  transform="rotate(218 100 100)"
                  style={{ filter: 'drop-shadow(0px 4px 12px rgba(34, 197, 94, 0.4))' }}
                />

                {/* Definitions for gradients */}
                <defs>
                  <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4ADE80" />
                    <stop offset="100%" stopColor="#22C55E" />
                  </linearGradient>
                </defs>

                {/* Countdown Labels on the ring */}
                <text x="100" y="8" textAnchor="middle" fill="#22C55E" fontSize="10" fontWeight="900">0 Hari (Estrus)</text>
                <text x="190" y="103" textAnchor="start" fill="#64748B" fontSize="9" fontWeight="bold">15 Hari Lagi</text>
                <text x="100" y="195" textAnchor="middle" fill="#64748B" fontSize="9" fontWeight="bold">10 Hari Lagi</text>
                <text x="10" y="103" textAnchor="end" fill="#64748B" fontSize="9" fontWeight="bold">5 Hari Lagi</text>

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
            </div>`;

// regex to replace the old div
const regex = /<div className="relative w-72 h-72 flex items-center justify-center my-6">[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* Badges pointing to the ring \*\/\}/m;

content = content.replace(regex, newSvgBlock + '\n\n            {/* Badges pointing to the ring */}');

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Fixed SVG Ring.");
