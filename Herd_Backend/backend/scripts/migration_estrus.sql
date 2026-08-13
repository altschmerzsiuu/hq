-- =============================================================
-- MIGRATION: Sistem Prediksi Estrus Sapi (3-Layer Hybrid)
-- Compatible dengan skema existing (users, hewan, reproduksi_ternak)
-- Jalankan sekali saat deploy production
-- =============================================================

-- Aktifkan trigger function (sudah ada di sistem, tapi aman dijalankan ulang)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================
-- TABEL 1: siklus_individu
-- Menyimpan "profil siklus unik" per sapi — ini adalah
-- knowledge paling berharga dari peternak yang selama ini
-- cuma ada di kepala mereka / papan tulis.
-- =============================================================
CREATE TABLE IF NOT EXISTS siklus_individu (
    id              SERIAL PRIMARY KEY,
    rfid            VARCHAR(50) NOT NULL,           -- Sapi yang bersangkutan
    owner_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Pola siklus individu (dihitung otomatis dari riwayat)
    rata_siklus_hari    FLOAT DEFAULT 21.0,         -- Rata-rata panjang siklus (hari)
    std_siklus_hari     FLOAT DEFAULT 2.0,          -- Standar deviasi siklus (makin kecil makin konsisten)
    jumlah_siklus_valid INTEGER DEFAULT 0,          -- Berapa siklus yang sudah terverifikasi (bunting berhasil)

    -- Offset IB optimal — ini yang trial-error peternak selama bertahun-tahun
    -- Positif = IB dilakukan X hari SETELAH tanda birahi muncul
    -- Negatif = IB dilakukan X hari SEBELUM tanda birahi (anticipate)
    offset_ib_optimal   FLOAT DEFAULT 0.0,          -- Dalam hari (bisa desimal, misal 0.5 = 12 jam)
    offset_confidence   FLOAT DEFAULT 0.0,          -- 0.0 - 1.0, makin tinggi makin reliable

    -- Pola waktu birahi (dari catatan papan peternak "jam 2 malam", "jam 9 pagi")
    -- Disimpan sebagai hour of day (0-23), NULL kalau belum ada pola
    jam_birahi_dominan  INTEGER DEFAULT NULL,        -- Jam berapa sapi ini biasanya birahi
    jam_birahi_std      FLOAT   DEFAULT NULL,        -- Spread-nya (makin kecil makin konsisten)

    -- Status sapi
    -- 'virgin'    = belum pernah bunting (cold start, prediksi pakai populasi)
    -- 'active'    = punya riwayat, prediksi pakai individu
    -- 'pregnant'  = sedang bunting, skip prediksi birahi
    -- 'dry'       = masa kering/istirahat reproduksi
    status_reproduksi   VARCHAR(20) DEFAULT 'virgin',

    -- Metadata
    last_birahi_date    DATE DEFAULT NULL,           -- Tanggal birahi terakhir yang terverifikasi
    last_ib_date        DATE DEFAULT NULL,           -- Tanggal IB terakhir
    last_bunting_date   DATE DEFAULT NULL,           -- Tanggal bunting terakhir

    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(rfid)  -- Satu profil per sapi
);

CREATE TRIGGER trg_siklus_individu_updated_at
    BEFORE UPDATE ON siklus_individu
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_siklus_individu_rfid     ON siklus_individu(rfid);
CREATE INDEX IF NOT EXISTS idx_siklus_individu_owner    ON siklus_individu(owner_id);
CREATE INDEX IF NOT EXISTS idx_siklus_individu_status   ON siklus_individu(status_reproduksi);


-- =============================================================
-- TABEL 2: prediksi_birahi
-- Hasil prediksi Layer 1 + 2 + 3 per sapi.
-- Di-generate ulang setiap ada event baru (IB, bunting, sapih)
-- atau oleh cron job harian.
-- =============================================================
CREATE TABLE IF NOT EXISTS prediksi_birahi (
    id              SERIAL PRIMARY KEY,
    rfid            VARCHAR(50) NOT NULL,
    owner_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Hasil prediksi
    prediksi_tanggal        DATE NOT NULL,          -- Kapan diprediksi birahi
    prediksi_ib_optimal     DATE NOT NULL,          -- Kapan waktu IB terbaik (pakai offset)
    window_awal             DATE NOT NULL,          -- Tanggal paling awal kemungkinan birahi
    window_akhir            DATE NOT NULL,          -- Tanggal paling akhir kemungkinan birahi

    -- Confidence score per layer (0.0 - 1.0)
    confidence_layer1       FLOAT DEFAULT 0.0,      -- Rule-based calendar
    confidence_layer2       FLOAT DEFAULT NULL,     -- Sensor booster (NULL kalau no collar)
    confidence_layer3       FLOAT DEFAULT NULL,     -- ML validator (NULL kalau data < threshold)
    confidence_final        FLOAT DEFAULT 0.0,      -- Weighted final score

    -- Sumber prediksi (untuk audit & debugging)
    -- 'calendar_only', 'calendar+sensor', 'calendar+ml', 'full_hybrid'
    metode                  VARCHAR(30) DEFAULT 'calendar_only',

    -- Apakah prediksi ini sudah terbukti benar?
    -- NULL = belum bisa diverifikasi, TRUE = benar, FALSE = meleset
    verified                BOOLEAN DEFAULT NULL,
    verified_at             TIMESTAMP DEFAULT NULL,
    verified_selisih_hari   FLOAT DEFAULT NULL,     -- Berapa hari meleset dari aktual

    -- Status prediksi
    -- 'active'   = prediksi aktif, belum terjadi
    -- 'notified' = notifikasi sudah dikirim
    -- 'expired'  = window sudah lewat tanpa konfirmasi
    -- 'verified' = sudah terbukti (benar/salah)
    status          VARCHAR(20) DEFAULT 'active',

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Hanya boleh ada 1 prediksi aktif per sapi
    UNIQUE(rfid, status)
);

CREATE TRIGGER trg_prediksi_birahi_updated_at
    BEFORE UPDATE ON prediksi_birahi
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_prediksi_rfid            ON prediksi_birahi(rfid);
CREATE INDEX IF NOT EXISTS idx_prediksi_owner           ON prediksi_birahi(owner_id);
CREATE INDEX IF NOT EXISTS idx_prediksi_tanggal         ON prediksi_birahi(prediksi_tanggal);
CREATE INDEX IF NOT EXISTS idx_prediksi_status          ON prediksi_birahi(status);


-- =============================================================
-- TABEL 3: notification_log
-- Log semua notifikasi yang pernah dikirim.
-- Untuk audit, retry, dan tampilan riwayat di dashboard.
-- =============================================================
CREATE TABLE IF NOT EXISTS notification_log (
    id              SERIAL PRIMARY KEY,
    owner_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rfid            VARCHAR(50),                    -- Sapi yang bersangkutan
    prediksi_id     INTEGER REFERENCES prediksi_birahi(id) ON DELETE SET NULL,

    -- Jenis notifikasi
    -- 'birahi_reminder'  = H-3 sebelum prediksi birahi
    -- 'birahi_alert'     = Hari H birahi
    -- 'ib_optimal_now'   = Waktu IB optimal sekarang
    -- 'sensor_spike'     = Sensor detect aktivitas anomali
    -- 'ib_due'           = Belum IB padahal udah waktunya
    tipe            VARCHAR(30) NOT NULL,

    -- Konten
    judul           TEXT NOT NULL,
    pesan           TEXT NOT NULL,

    -- Channel
    -- 'telegram', 'email', 'push', 'in_app'
    channel         VARCHAR(20) DEFAULT 'telegram',
    channel_target  TEXT,                           -- Chat ID Telegram / email address

    -- Status pengiriman
    -- 'pending', 'sent', 'failed', 'read'
    status          VARCHAR(20) DEFAULT 'pending',
    sent_at         TIMESTAMP DEFAULT NULL,
    error_message   TEXT DEFAULT NULL,
    retry_count     INTEGER DEFAULT 0,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_owner      ON notification_log(owner_id);
CREATE INDEX IF NOT EXISTS idx_notif_rfid       ON notification_log(rfid);
CREATE INDEX IF NOT EXISTS idx_notif_status     ON notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notif_tipe       ON notification_log(tipe);


-- =============================================================
-- TABEL 4: populasi_baseline
-- Statistik populasi per jenis sapi & owner.
-- Dipakai untuk prediksi sapi virgin (cold start problem).
-- Di-update oleh cron job mingguan.
-- =============================================================
CREATE TABLE IF NOT EXISTS populasi_baseline (
    id              SERIAL PRIMARY KEY,
    owner_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
    jenis_sapi      VARCHAR(100) NOT NULL,          -- 'Limousin', 'Simmental', dll

    -- Statistik populasi untuk jenis ini
    rata_siklus_hari    FLOAT DEFAULT 21.0,
    std_siklus_hari     FLOAT DEFAULT 2.5,
    rata_offset_ib      FLOAT DEFAULT 0.0,          -- Rata-rata offset IB optimal untuk jenis ini
    jumlah_sampel       INTEGER DEFAULT 0,          -- Berapa sapi yang jadi dasar kalkulasi

    -- Rata-rata per jenis dari literatur (scientific prior)
    -- Dipakai kalau jumlah_sampel < 3 (belum cukup data lokal)
    prior_siklus_hari   FLOAT DEFAULT 21.0,
    prior_offset_ib     FLOAT DEFAULT 0.0,

    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(owner_id, jenis_sapi)
);

CREATE TRIGGER trg_populasi_baseline_updated_at
    BEFORE UPDATE ON populasi_baseline
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================
-- TABEL 5: ml_training_log
-- Catat kapan model di-retrain, dengan berapa data, dan hasilnya.
-- Untuk audit MLOps dan nentuin kapan Layer 3 aktif.
-- =============================================================
CREATE TABLE IF NOT EXISTS ml_training_log (
    id              SERIAL PRIMARY KEY,
    owner_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,

    model_type      VARCHAR(20) NOT NULL,           -- 'xgboost' atau 'svm'
    model_version   VARCHAR(50) NOT NULL,           -- Timestamp-based version, misal '20250601_143022'
    model_path      TEXT NOT NULL,                  -- Path ke file .joblib di server

    -- Data yang dipakai training
    jumlah_sampel       INTEGER NOT NULL,
    jumlah_positif      INTEGER NOT NULL,           -- Berapa yang labeled estrus=True
    jumlah_negatif      INTEGER NOT NULL,

    -- Hasil evaluasi (dari cross-validation)
    accuracy        FLOAT,
    precision_score FLOAT,
    recall_score    FLOAT,
    f1_score        FLOAT,
    auc_roc         FLOAT,

    -- Apakah model ini aktif dipakai sekarang?
    is_active       BOOLEAN DEFAULT FALSE,

    -- Threshold data sebelum model ini diaktifkan di Layer 3
    -- System akan set is_active=TRUE otomatis kalau jumlah_sampel >= threshold ini
    activation_threshold INTEGER DEFAULT 50,

    trained_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trained_by      VARCHAR(50) DEFAULT 'system'    -- 'system' (otomatis) atau email user
);

CREATE INDEX IF NOT EXISTS idx_ml_log_owner     ON ml_training_log(owner_id);
CREATE INDEX IF NOT EXISTS idx_ml_log_type      ON ml_training_log(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_log_active    ON ml_training_log(is_active);


-- =============================================================
-- TABEL 6: estrus_label
-- Ground truth untuk training ML.
-- Setiap event birahi yang TERKONFIRMASI (bunting berhasil)
-- otomatis jadi labeled data untuk retrain model.
-- =============================================================
CREATE TABLE IF NOT EXISTS estrus_label (
    id              SERIAL PRIMARY KEY,
    rfid            VARCHAR(50) NOT NULL,
    owner_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reproduksi_id   INTEGER REFERENCES reproduksi_ternak(id) ON DELETE CASCADE,

    -- Waktu event
    tanggal_birahi_aktual   DATE NOT NULL,
    jam_birahi_aktual       INTEGER DEFAULT NULL,   -- 0-23, kalau dicatat

    -- Label
    -- TRUE  = ini birahi asli (bunting berhasil setelahnya)
    -- FALSE = false alarm / silent heat yang kelewat
    label_estrus    BOOLEAN NOT NULL,

    -- Feature snapshot saat event ini terjadi (untuk training)
    -- Disimpan sebagai JSON biar fleksibel kalau feature bertambah
    features_historis   JSONB DEFAULT NULL,         -- Snapshot XGBoost features
    features_sensor     JSONB DEFAULT NULL,         -- Snapshot SVM features (kalau ada collar)

    -- Sumber label
    -- 'auto'   = otomatis dari sistem (bunting terdeteksi setelah IB)
    -- 'manual' = dikonfirmasi manual oleh peternak
    sumber_label    VARCHAR(10) DEFAULT 'auto',
    catatan         TEXT DEFAULT NULL,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estrus_label_rfid    ON estrus_label(rfid);
CREATE INDEX IF NOT EXISTS idx_estrus_label_owner   ON estrus_label(owner_id);
CREATE INDEX IF NOT EXISTS idx_estrus_label_tanggal ON estrus_label(tanggal_birahi_aktual);
CREATE INDEX IF NOT EXISTS idx_estrus_label_label   ON estrus_label(label_estrus);


-- =============================================================
-- VIEW: dashboard_sapi
-- Gabungan semua info yang dibutuhkan dashboard peternak
-- dalam satu query. Dipakai di endpoint GET /api/dashboard
-- =============================================================
CREATE OR REPLACE VIEW dashboard_sapi AS
SELECT
    h.id                        AS rfid,
    h.nama,
    h.jenis,
    h.bulan_tahun_lahir,
    h.status_kesehatan,
    h.owner_id,
    h.collar_id,

    -- Profil siklus individu
    si.status_reproduksi,
    si.rata_siklus_hari,
    si.offset_ib_optimal,
    si.offset_confidence,
    si.jumlah_siklus_valid,
    si.last_birahi_date,

    -- Prediksi birahi aktif
    pb.prediksi_tanggal,
    pb.prediksi_ib_optimal,
    pb.window_awal,
    pb.window_akhir,
    pb.confidence_final,
    pb.metode,
    pb.status                   AS prediksi_status,

    -- Hari menuju prediksi birahi
    (pb.prediksi_tanggal - CURRENT_DATE) AS hari_menuju_birahi,

    -- Kategori urgency untuk UI (warna di dashboard)
    CASE
        WHEN pb.prediksi_tanggal IS NULL                        THEN 'no_prediction'
        WHEN si.status_reproduksi = 'pregnant'                  THEN 'pregnant'
        WHEN (pb.prediksi_tanggal - CURRENT_DATE) <= 0          THEN 'birahi_sekarang'   -- Merah
        WHEN (pb.prediksi_tanggal - CURRENT_DATE) <= 3          THEN 'segera'            -- Oranye
        WHEN (pb.prediksi_tanggal - CURRENT_DATE) <= 7          THEN 'perhatian'         -- Kuning
        ELSE                                                         'aman'              -- Hijau
    END AS urgency_level,

    -- Reproduksi terbaru
    rt.tanggal_ib               AS last_tanggal_ib,
    rt.jumlah_ib                AS last_jumlah_ib,
    rt.bunting                  AS last_bunting,
    rt.hpl                      AS last_hpl

FROM hewan h
LEFT JOIN siklus_individu si
    ON h.id = si.rfid
LEFT JOIN prediksi_birahi pb
    ON h.id = pb.rfid AND pb.status = 'active'
LEFT JOIN LATERAL (
    SELECT * FROM reproduksi_ternak
    WHERE rfid = h.id
    ORDER BY tanggal_ib DESC NULLS LAST
    LIMIT 1
) rt ON TRUE;
