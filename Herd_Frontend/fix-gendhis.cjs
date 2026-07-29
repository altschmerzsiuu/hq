const fs = require('fs');
let c = fs.readFileSync('src/components/gendhis/GendhisWidget.jsx', 'utf8');

c = c.replace(/>\s*Tambah Ternak\s*</g, ">{lang === 'id' ? 'Tambah Ternak' : 'Add Cattle'}<");
c = c.replace(/>\s*Tambah Data IB\s*</g, ">{lang === 'id' ? 'Tambah Data IB' : 'Add AI Data'}<");
c = c.replace(/>\s*Pasang Kalung\s*</g, ">{lang === 'id' ? 'Pasang Kalung' : 'Pair Collar'}<");
c = c.replace(/>\s*Tanya Gendhis\s*</g, ">{lang === 'id' ? 'Tanya Gendhis' : 'Ask Gendhis'}<");

fs.writeFileSync('src/components/gendhis/GendhisWidget.jsx', c);
