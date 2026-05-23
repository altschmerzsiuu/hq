# Migration Scripts

Scripts untuk migrasi data dari Supabase ke PostgreSQL lokal.

## Prerequisites

1. Pastikan `.env` sudah dikonfigurasi dengan:
   - `SUPABASE_URL` dan `SUPABASE_KEY` (untuk export)
   - `DATABASE_URL` (untuk import ke PostgreSQL)

2. Install dependencies:
   ```bash
   npm install
   ```

## Step 1: Export Data dari Supabase

```bash
node migration/export-supabase.js
```

Script ini akan:
- Connect ke Supabase
- Export semua data dari 4 tabel:
  - `hewan`
  - `reproduksi_ternak`
  - `riwayat_reproduksi`
  - `feed_ai`
- Simpan ke folder `migration/data/` dalam format JSON
- Buat summary file `_export_summary.json`

## Step 2: Import Data ke PostgreSQL

```bash
node migration/import-postgres.js
```

Script ini akan:
- Read JSON files dari folder `data/`
- Connect ke PostgreSQL (local atau Docker)
- Import data ke masing-masing tabel
- Verify data integrity
- Tampilkan summary import

## Struktur Folder

```
migration/
├── export-supabase.js       # Script export dari Supabase
├── import-postgres.js       # Script import ke PostgreSQL
├── README.md               # Documentation (this file)
└── data/                   # Data export (created automatically)
    ├── hewan.json
    ├── reproduksi_ternak.json
    ├── riwayat_reproduksi.json
    ├── feed_ai.json
    └── _export_summary.json
```

## Troubleshooting

### Error: SUPABASE_URL not found
- Pastikan file `.env` ada di root folder scanner-app
- Tambahkan `SUPABASE_URL` dan `SUPABASE_KEY`

### Error: Database connection failed
- Pastikan PostgreSQL sudah running
- Check `DATABASE_URL` di `.env`
- Untuk Docker: gunakan `db` sebagai hostname
- Untuk local: gunakan `localhost`

### Error: Table not found
- Pastikan database schema sudah dibuat
- Run: `docker-compose up -d db` untuk init database
- Check: `init-historical.sql` sudah di-execute

## Data Verification

Setelah import, verify data dengan:

```bash
# Masuk ke PostgreSQL container
docker-compose exec db psql -U postgres -d Collar_to_Gateway

# Check row counts
SELECT 'hewan' as table_name, COUNT(*) FROM hewan
UNION ALL
SELECT 'reproduksi_ternak', COUNT(*) FROM reproduksi_ternak
UNION ALL
SELECT 'riwayat_reproduksi', COUNT(*) FROM riwayat_reproduksi
UNION ALL
SELECT 'feed_ai', COUNT(*) FROM feed_ai;
```

## Clean Up (Optional)

Setelah migrasi berhasil, kamu bisa:

1. Hapus `SUPABASE_URL` dan `SUPABASE_KEY` dari `.env`
2. Hapus folder `migration/data/` (backup dulu!)
3. Remove `@supabase/supabase-js` dari dependencies

## Notes

- Migration script menggunakan `ON CONFLICT DO NOTHING` untuk menghindari duplicate data
- Jika import gagal di tengah jalan, bisa re-run script lagi (idempotent)
- Data di Supabase tidak akan terhapus (read-only operation)
