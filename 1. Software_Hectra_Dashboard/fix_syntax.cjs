const fs = require('fs');
let code = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');

// Find `</>\n\n      {/* ── DESKTOP VIEW ── */}` and replace with `\n      {/* ── DESKTOP VIEW ── */}`
code = code.replace(
  '        </>\n\n      {/* ── DESKTOP VIEW ── */}',
  '\n      {/* ── DESKTOP VIEW ── */}'
);

fs.writeFileSync('src/pages/DetailTernak.jsx', code);
console.log("Syntax fixed.");
