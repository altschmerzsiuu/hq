const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/shared/CowEstrusView.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Remove the Run button card
const runButtonCardRegex = /      \{\/\* Run button card \*\/\}[\s\S]*?<\/div>\s*\)\}\s*\{!prediction \? \(/;
content = content.replace(runButtonCardRegex, '      {!prediction ? (');

// 2. Replace the Header in the Monitoring card
const oldHeader = `            {/* Header */}
            <div className="w-full flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Activity className="text-blue-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg tracking-tight">Monitoring Siklus Estrus</h3>
                <p className="text-sm text-gray-500 font-medium">ID Sapi: {selectedCow?.id || selectedCow?.cow_id} - {selectedCow?.nama}</p>
              </div>
            </div>`;

const newHeader = `            {/* Header */}
            <div className="w-full flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Activity className="text-blue-600 w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg tracking-tight">Monitoring Siklus Birahi</h3>
                  <p className="text-sm text-gray-500 font-medium">ID Sapi: {selectedCow?.id || selectedCow?.cow_id} - {selectedCow?.nama}</p>
                </div>
              </div>
              <button
                onClick={handleRunPredict}
                disabled={isPredicting}
                title={lang === 'id' ? 'Refresh Prediksi' : 'Refresh Prediction'}
                className="p-3 rounded-xl border transition-all duration-300 shadow-sm flex items-center justify-center shrink-0 bg-white hover:bg-gray-50 border-gray-200 text-gray-700 hover:text-[#2E7D32] hover:border-[#2E7D32]/30 disabled:opacity-50"
              >
                <RefreshCw className={\`w-5 h-5 \${isPredicting ? 'animate-spin text-[#2E7D32]' : ''}\`} />
              </button>
            </div>`;

content = content.replace(oldHeader, newHeader);

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Updated CowEstrusView.");
