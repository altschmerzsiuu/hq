const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/shared/CowAnalyticsView.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

const newBlock = `        {/* Left Side: Summary and Filters */}
        <div className="flex flex-col gap-4 flex-1">
          
          {/* Health Summary */}
          <div className="flex items-start gap-3">
            <div style={{
              background: healthStatus === 'warning' ? '#FEE2E2' : 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '8px',
              flexShrink: 0
            }}>
              {healthStatus === 'warning'
                ? <AlertCircle className="w-5 h-5" style={{ color: 'var(--red, #EF4444)' }} />
                : <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--color-forest)' }} />
              }
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                {healthStatus === null
                  ? (lang === 'id' ? 'Ringkasan Kesehatan' : 'Health Summary')
                  : healthStatus === 'warning'
                    ? (lang === 'id' ? 'Indikasi Butuh Perhatian' : 'Attention Needed')
                    : (lang === 'id' ? 'Kondisi Normal' : 'Normal Condition')}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {healthStatus === null
                  ? (lang === 'id' ? 'Belum cukup data sensor untuk disimpulkan.' : 'Not enough sensor data to conclude.')
                  : healthStatus === 'warning'
                    ? (lang === 'id' ? \`Aktivitas \${selectedCow?.nama || 'sapi'} terdeteksi menurun drastis atau suhu tinggi. Disarankan pemeriksaan.\` : \`\${selectedCow?.nama || 'Cow'}'s activity dropped significantly or temperature is high. Inspection recommended.\`)
                    : (lang === 'id' ? \`Aktivitas dan suhu \${selectedCow?.nama || 'sapi'} dalam rentang normal.\` : \`\${selectedCow?.nama || 'Cow'}'s activity and temperature are within normal range.\`)}
              </p>
            </div>
          </div>

          {/* Time Filter Pill Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { key: '1hr',  label: '1 Hr'  },
              { key: '1wk',  label: '1 Mg'  },
              { key: '1bln', label: '1 Bln' },
              { key: '3bln', label: '3 Bln' },
              { key: '6bln', label: '6 Bln' },
              { key: '1th',  label: '1 Th'  },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setTimeFilter(opt.key)}
                disabled={loading}
                className={\`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all \${loading ? 'opacity-50 cursor-not-allowed' : ''}\`}
                style={{
                  background: timeFilter === opt.key ? 'var(--color-primary)' : 'var(--bg-surface)',
                  color: timeFilter === opt.key ? '#fff' : 'var(--text-2)',
                  border: timeFilter === opt.key ? 'none' : '0.5px solid var(--border)',
                }}
              >
                {opt.label}
                {loading && timeFilter === opt.key && <Loader2 size={12} className="inline ml-1 animate-spin" />}
              </button>
            ))}
          </div>

        </div>`;

// We want to replace the block starting at `        {/* Left Side: Filters and Summary */}` or similar.
const oldBlockRegex = /        \{\/\* Left Side: Filters and Summary \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* Right Side: Action Button \*\/\}/;

content = content.replace(oldBlockRegex, newBlock + '\n\n        {/* Right Side: Action Button */}');

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Swapped elements.");
