const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

content = content.replace(
  "{tab === 'estrus' && 'Deteksi Estrus'}",
  "{tab === 'estrus' && 'Deteksi Birahi'}"
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Renamed Deteksi Estrus tab.");
