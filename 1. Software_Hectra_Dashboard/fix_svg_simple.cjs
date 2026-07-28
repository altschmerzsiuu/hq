const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/shared/CowEstrusView.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

const newSvgBlock = `            <div className="relative w-64 h-64 flex items-center justify-center my-6">
              <svg width="100%" height="100%" viewBox="0 0 200 200" className="overflow-visible transform -rotate-90">
                {/* Background Track */}
                <circle cx="100" cy="100" r="80" fill="none" stroke="#F1F5F9" strokeWidth="14" />
                
                {/* Dynamic Progress Ring */}
                <circle 
                  cx="100" cy="100" r="80" fill="none" 
                  stroke={prediction?.days_until <= 3 ? "url(#greenGradient)" : "url(#blueGradient)"} 
                  strokeWidth="14" 
                  strokeLinecap="round"
                  strokeDasharray="502.65" 
                  strokeDashoffset={502.65 - ((Math.max(0, 21 - (prediction?.days_until || 0)) / 21) * 502.65)}
                  style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease' }}
                />

                {/* Definitions for gradients */}
                <defs>
                  <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4ADE80" />
                    <stop offset="100%" stopColor="#22C55E" />
                  </linearGradient>
                  <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#60A5FA" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Center Text content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-5xl font-black text-gray-900 tracking-tighter">
                  {prediction.days_until}
                </span>
                <span className="text-sm font-bold text-gray-800 tracking-tight uppercase mt-1">Hari Lagi</span>
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mt-1 mb-2">Masa Subur Berikutnya</span>
                <span className={\`text-lg font-black px-3 py-1 rounded-full \${prediction.days_until <= 3 ? 'text-green-700 bg-green-50' : 'text-blue-700 bg-blue-50'}\`}>
                  {fmtDate(prediction.prediksi_ib_optimal, lang)}
                </span>
              </div>
            </div>`;

// regex to replace the old div
const regex = /<div className="relative w-72 h-72 flex items-center justify-center my-6">[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* Badges pointing to the ring \*\/\}/m;

content = content.replace(regex, newSvgBlock + '\n\n            {/* Optional badge based on status */}');

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Simplified SVG Ring.");
