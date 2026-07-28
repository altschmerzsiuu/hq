const fs = require('fs');
const path = require('path');

// 1. Fix Tab Name in DetailTernak.jsx
const detailPath = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let detailContent = fs.readFileSync(detailPath, 'utf8');

detailContent = detailContent.replace(
  "{tab === 'riwayat' && 'Catatan Kawin'}",
  "{tab === 'riwayat' && 'Riwayat Reproduksi'}"
);

// 2. Fix inner title for Linimasa (now Catatan Harian)
detailContent = detailContent.replace(
  /<h3 className="text-lg font-bold text-gray-900 mb-6">Linimasa Aktivitas<\/h3>/g,
  '<h3 className="text-lg font-bold text-gray-900 mb-6">Catatan Harian Aktivitas</h3>'
);
detailContent = detailContent.replace(
  /<h3 className="text-\[20px\] font-extrabold text-\[#111\]">Linimasa Aktivitas<\/h3>/g,
  '<h3 className="text-[20px] font-extrabold text-[#111]">Catatan Harian Aktivitas</h3>'
);

// Also empty state text in Linimasa if any
detailContent = detailContent.replace(
  'Tidak ada aktivitas terbaru di linimasa.',
  'Belum ada catatan harian terbaru.'
);

fs.writeFileSync(detailPath, detailContent, 'utf8');


// 3. Fix Ringkasan Kesehatan in CowAnalyticsView.jsx
const analyticsPath = path.join(__dirname, 'src/components/shared/CowAnalyticsView.jsx');
let analyticsContent = fs.readFileSync(analyticsPath, 'utf8');

analyticsContent = analyticsContent.replace(
  "lang === 'id' ? 'Ringkasan Kesehatan' : 'Health Summary'",
  "lang === 'id' ? 'Ringkasan Sensor' : 'Sensor Summary'"
);

fs.writeFileSync(analyticsPath, analyticsContent, 'utf8');

console.log("Updated texts.");
