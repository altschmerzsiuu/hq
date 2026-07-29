const fs = require('fs');
let dash = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

const dashReplacements = [
  ['Kondisi semua ternak terpantau aman. Tidak ada tindakan mendesak yang perlu dilakukan sekarang.', "{lang === 'id' ? 'Kondisi semua ternak terpantau aman. Tidak ada tindakan mendesak yang perlu dilakukan sekarang.' : 'All cattle conditions are monitored safe. No urgent action needed now.'}"],
  ['Semua kondisi ternak hari ini dalam keadaan baik. Tidak ada rekomendasi tambahan untuk saat ini.', "{lang === 'id' ? 'Semua kondisi ternak hari ini dalam keadaan baik. Tidak ada rekomendasi tambahan untuk saat ini.' : 'All cattle conditions today are good. No additional recommendations at this time.'}"],
  ['Lihat semua aktivitas <ChevronRight', "{lang === 'id' ? 'Lihat semua aktivitas' : 'View all activities'} <ChevronRight"],
  ['<Zap size={12} /> Siap IB', "<Zap size={12} /> {lang === 'id' ? 'Siap IB' : 'Ready AI'}"],
  ['<ShieldAlert size={12} /> Cek Sekarang', "<ShieldAlert size={12} /> {lang === 'id' ? 'Cek Sekarang' : 'Check Now'}"],
  ['Kondisi semua ternak terpantau aman.</p>', "{lang === 'id' ? 'Kondisi semua ternak terpantau aman.' : 'All cattle conditions are monitored safe.'}</p>"],
  ['Tidak ada rekomendasi tambahan untuk saat ini.</p>', "{lang === 'id' ? 'Tidak ada rekomendasi tambahan untuk saat ini.' : 'No additional recommendations at this time.'}</p>"],
  ['label="Tambah Ternak"', "label={lang === 'id' ? 'Tambah Ternak' : 'Add Cattle'}"],
  ['label="Pasang Kalung"', "label={lang === 'id' ? 'Pasang Kalung' : 'Pair Collar'}"],
  ['label="Tanya Gendhis"', "label={lang === 'id' ? 'Tanya Gendhis' : 'Ask Gendhis'}"],
  ['Waduh, belum ada ternak yang dipantau nih! Yuk pasang kalungnya dulu', "lang === 'id' ? 'Waduh, belum ada ternak yang dipantau nih! Yuk pasang kalungnya dulu' : 'Oops, no cattle are being monitored yet! Let\\'s pair the collar first'"]
];

dashReplacements.forEach(([from, to]) => {
  dash = dash.split(from).join(to);
});
fs.writeFileSync('src/pages/Dashboard.jsx', dash);

let topbar = fs.readFileSync('src/components/layout/Topbar.jsx', 'utf8');
const topbarReplacements = [
  ['Opsi Akun', "{lang === 'id' ? 'OPSI AKUN' : 'ACCOUNT OPTIONS'}"],
  ['Pengaturan', "{lang === 'id' ? 'Pengaturan' : 'Settings'}"],
  ['Akun', "{lang === 'id' ? 'Akun' : 'Account'}"]
];

topbarReplacements.forEach(([from, to]) => {
  if (from === 'Opsi Akun') {
    topbar = topbar.replace(/Opsi Akun/g, to);
  } else if (from === 'Pengaturan') {
    topbar = topbar.replace(/>\s*Pengaturan\s*</g, `>${to}<`);
  } else if (from === 'Akun') {
    topbar = topbar.replace(/>\s*Akun\s*</g, `>${to}<`);
  }
});
fs.writeFileSync('src/components/layout/Topbar.jsx', topbar);
