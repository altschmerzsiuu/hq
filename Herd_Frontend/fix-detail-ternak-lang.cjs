const fs = require('fs');
let content = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');

const replacements = [
  ["Memuat data ternak...", "lang === 'id' ? 'Memuat data ternak...' : 'Loading cattle data...'"],
  ["Edit Profil Ternak", "lang === 'id' ? 'Edit Profil Ternak' : 'Edit Cattle Profile'"],
  ["placeholder: 'Nama ternak'", "placeholder: lang === 'id' ? 'Nama ternak' : 'Cattle name'"],
  ["<option value=\"Sakit\">Sakit</option>", "<option value=\"Sakit\">{lang === 'id' ? 'Sakit' : 'Sick'}</option>"],
  ["Hapus Ternak?", "lang === 'id' ? 'Hapus Ternak?' : 'Delete Cattle?'"],
  ["Catatan Harian", "lang === 'id' ? 'Catatan Harian' : 'Daily Notes'"],
  ["Riwayat Ternak", "lang === 'id' ? 'Riwayat Ternak' : 'Cattle History'"],
  ["Catatan Aktivitas Ternak", "lang === 'id' ? 'Catatan Aktivitas Ternak' : 'Cattle Activity Notes'"],
  ["label=\"Lapor Sakit\"", "label={lang === 'id' ? 'Lapor Sakit' : 'Report Sick'}"],
  ["Belum ada data aktivitas untuk ternak ini.", "lang === 'id' ? 'Belum ada data aktivitas untuk ternak ini.' : 'No activity data for this cattle yet.'"],
  ["<option value=\"hari_ini\">Hari Ini</option>", "<option value=\"hari_ini\">{lang === 'id' ? 'Hari Ini' : 'Today'}</option>"]
];

replacements.forEach(([from, to]) => {
  // Be careful with simple replace, we only replace exactly if we can wrap with {} when in JSX text,
  // but let's do a simple string replace for now. It's safer to just let the script do basic replacements.
});
