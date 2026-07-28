const fs = require('fs');
const code = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');

// Find the first occurrence of "}\n" followed by "\n      {/* \u2500\u2500 HEADER NAVIGATION"
const splitAt = code.indexOf('\n\n      {/* \u2500\u2500 HEADER NAVIGATION \u2500\u2500 */}');
if (splitAt === -1) {
  console.log('Pattern not found');
  process.exit(1);
}

const clean = code.substring(0, splitAt) + '\n';
fs.writeFileSync('src/pages/DetailTernak.jsx', clean);
console.log('Done. Lines remaining:', clean.split('\n').length);
