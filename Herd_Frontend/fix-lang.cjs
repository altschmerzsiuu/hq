const fs = require('fs');
let c = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');

c = c.replace(/Memuat data ternak\.\.\./g, "{lang === 'id' ? 'Memuat data ternak...' : 'Loading cattle data...'}");
c = c.replace(/>Edit Profil Ternak</g, ">{lang === 'id' ? 'Edit Profil Ternak' : 'Edit Cattle Profile'}<");
c = c.replace(/placeholder: 'Nama ternak'/g, "placeholder: lang === 'id' ? 'Nama ternak' : 'Cattle name'");
c = c.replace(/>Sakit</g, ">{lang === 'id' ? 'Sakit' : 'Sick'}<");
c = c.replace(/>Hapus Ternak\?</g, ">{lang === 'id' ? 'Hapus Ternak?' : 'Delete Cattle?'}<");
c = c.replace(/Data ternak <strong>\{selectedSapi.nama\}<\/strong> akan dihapus permanen dan tidak dapat dikembalikan\./g, "{lang === 'id' ? <>Data ternak <strong>{selectedSapi.nama}</strong> akan dihapus permanen dan tidak dapat dikembalikan.</> : <>Cattle data <strong>{selectedSapi.nama}</strong> will be permanently deleted and cannot be undone.</>}");
c = c.replace(/>Catatan Harian</g, ">{lang === 'id' ? 'Catatan Harian' : 'Daily Notes'}<");
c = c.replace(/>Riwayat Ternak</g, ">{lang === 'id' ? 'Riwayat Ternak' : 'Cattle History'}<");
c = c.replace(/>Catatan Aktivitas Ternak</g, ">{lang === 'id' ? 'Catatan Aktivitas Ternak' : 'Cattle Activity Notes'}<");
c = c.replace(/label="Lapor Sakit"/g, "label={lang === 'id' ? 'Lapor Sakit' : 'Report Sick'}");
c = c.replace(/>Belum ada data aktivitas untuk ternak ini\.</g, ">{lang === 'id' ? 'Belum ada data aktivitas untuk ternak ini.' : 'No activity data for this cattle yet.'}<");
c = c.replace(/>Hari Ini</g, ">{lang === 'id' ? 'Hari Ini' : 'Today'}<");

fs.writeFileSync('src/pages/DetailTernak.jsx', c);
