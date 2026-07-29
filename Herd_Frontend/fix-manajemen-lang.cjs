const fs = require('fs');
let c = fs.readFileSync('src/pages/ManajemenTernak.jsx', 'utf8');

c = c.replace(/>7 Hari Terakhir</g, ">{lang === 'id' ? '7 Hari Terakhir' : 'Last 7 Days'}<");
c = c.replace(/>30 Hari Terakhir</g, ">{lang === 'id' ? '30 Hari Terakhir' : 'Last 30 Days'}<");
c = c.replace(/'45 hari lalu'/g, "lang === 'id' ? '45 hari lalu' : '45 days ago'");

fs.writeFileSync('src/pages/ManajemenTernak.jsx', c);
