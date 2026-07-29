const fs = require('fs');
let c = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

c = c.replace(/function TrenAktivitasChart\(\) {/g, "function TrenAktivitasChart({ lang }) {");
c = c.replace(/<TrenAktivitasChart \/>/g, "<TrenAktivitasChart lang={lang} />");

fs.writeFileSync('src/pages/Dashboard.jsx', c);
