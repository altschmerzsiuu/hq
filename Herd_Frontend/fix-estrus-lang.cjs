const fs = require('fs');
let c = fs.readFileSync('src/pages/EstrusPrediction.jsx', 'utf8');

c = c.replace(/Berdasarkan konfirmasi/g, "{lang === 'id' ? 'Berdasarkan konfirmasi' : 'Based on confirmation'}");
c = c.replace(/{ value: 'estrus',     label: 'Birahi', dot: 'var\(--red\)' },/g, "{ value: 'estrus',     label: lang === 'id' ? 'Birahi' : 'Estrus', dot: 'var(--red)' },");
c = c.replace(/{ value: 'pre-estrus', label: 'Dekat',  dot: 'var\(--amber\)' },/g, "{ value: 'pre-estrus', label: lang === 'id' ? 'Dekat' : 'Near',  dot: 'var(--amber)' },");
c = c.replace(/{ value: 'normal',     label: 'Normal', dot: 'var\(--green\)' },/g, "{ value: 'normal',     label: lang === 'id' ? 'Normal' : 'Normal', dot: 'var(--green)' },");

fs.writeFileSync('src/pages/EstrusPrediction.jsx', c);
