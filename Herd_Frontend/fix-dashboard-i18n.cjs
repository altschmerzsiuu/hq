const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

const replacements = [
  ['"Tren Aktivitas Kawanan"', "lang === 'id' ? 'Tren Aktivitas Kawanan' : 'Herd Activity Trend'"],
  ['"Hari"', "lang === 'id' ? 'Hari' : 'Day'"],
  ['"Minggu"', "lang === 'id' ? 'Minggu' : 'Week'"],
  ['"Bulan"', "lang === 'id' ? 'Bulan' : 'Month'"],
  [/>Ringkasan Birahi</g, ">{lang === 'id' ? 'Ringkasan Birahi' : 'Estrus Summary'}<"],
  [/>Sapi Birahi</g, ">{lang === 'id' ? 'Sapi Birahi' : 'Cows in Estrus'}<"],
  [/> Birahi</g, ">{lang === 'id' ? ' Birahi' : ' In Estrus'}<"],
  [/> Tidak Birahi</g, ">{lang === 'id' ? ' Tidak Birahi' : ' Not in Estrus'}<"],
  [/> Tidak Terdeteksi</g, ">{lang === 'id' ? ' Tidak Terdeteksi' : ' Undetected'}<"],
  [/>Prediksi Birahi</g, ">{lang === 'id' ? 'Prediksi Birahi' : 'Estrus Prediction'}<"],
  [/>Status Populasi</g, ">{lang === 'id' ? 'Status Populasi' : 'Population Status'}<"],
  [/>Kondisi Kandang \(IoT\)</g, ">{lang === 'id' ? 'Kondisi Kandang (IoT)' : 'Farm Condition (IoT)'}<"],
  [/>Aktivitas Terbaru</g, ">{lang === 'id' ? 'Aktivitas Terbaru' : 'Recent Activities'}<"],
  [/>Sedang Birahi</g, ">{lang === 'id' ? 'Sedang Birahi' : 'In Estrus'}<"],
  [/>Kondisi Sehat</g, ">{lang === 'id' ? 'Kondisi Sehat' : 'Healthy'}<"],
  [/>Tutup</g, ">{lang === 'id' ? 'Tutup' : 'Close'}<"],
  [/>Prediksi Estrus AI</g, ">{lang === 'id' ? 'Prediksi Estrus AI' : 'AI Estrus Prediction'}<"],
];

for (const [search, replace] of replacements) {
  content = content.replace(search, replace);
}

fs.writeFileSync('src/pages/Dashboard.jsx', content);
