const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

const oldTabs = `{tab === 'riwayat' && 'Riwayat Reproduksi'}
                    {tab === 'estrus' && 'Deteksi Birahi'}
                    {tab === 'linimasa' && 'Linimasa'}
                    {tab === 'analitik' && 'Analitik & Grafik'}`;

const newTabs = `{tab === 'riwayat' && 'Catatan Kawin'}
                    {tab === 'estrus' && 'Pantau Birahi'}
                    {tab === 'linimasa' && 'Catatan Harian'}
                    {tab === 'analitik' && 'Grafik Sensor'}`;

content = content.replace(oldTabs, newTabs);

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Updated tab labels to be farmer-friendly.");
