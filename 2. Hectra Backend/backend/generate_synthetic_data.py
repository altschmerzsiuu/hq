"""
generate_synthetic_data.py
==========================
Generate data sintetis untuk training SVM (sensor) dan XGBoost (historis reproduksi).

Cara pakai:
  python generate_synthetic_data.py --mode all --owner-id 1
  python generate_synthetic_data.py --mode sensor --owner-id 1
  python generate_synthetic_data.py --mode historis --owner-id 1
  python generate_synthetic_data.py --mode retrain --owner-id 1

Requirements:
  pip install asyncpg numpy scikit-learn xgboost joblib pandas
"""

import asyncio
import asyncpg
import numpy as np
import os
import json
import argparse
import logging
from datetime import date, datetime, timedelta
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgre@localhost:5432/Collar_to_Gateway")
MODEL_DIR    = os.getenv("MODEL_DIR", "models")
OWNER_ID     = 1  # Override via --owner-id

# ──────────────────────────────────────────────
# Profil Biologis per Jenis Sapi (riset lapangan Indonesia)
# ──────────────────────────────────────────────
BREED_PROFILES = {
    "Sapi Bali": {
        "cycle_mean": 20.5, "cycle_std": 1.5,
        "offset_ib": 0.0,   "conception_rate": 0.65,
        "silent_heat_rate": 0.15,
        "temp_baseline": 38.5, "temp_std": 0.3,
        "activity_baseline": 0.6, "activity_std": 0.2,
        "weight": 0.25,  # Proporsi di populasi sintetis
    },
    "Limousin": {
        "cycle_mean": 21.0, "cycle_std": 1.8,
        "offset_ib": 1.0,   "conception_rate": 0.55,
        "silent_heat_rate": 0.20,
        "temp_baseline": 38.3, "temp_std": 0.3,
        "activity_baseline": 0.7, "activity_std": 0.25,
        "weight": 0.25,
    },
    "Simmental": {
        "cycle_mean": 21.0, "cycle_std": 2.0,
        "offset_ib": 1.0,   "conception_rate": 0.52,
        "silent_heat_rate": 0.22,
        "temp_baseline": 38.4, "temp_std": 0.35,
        "activity_baseline": 0.65, "activity_std": 0.2,
        "weight": 0.20,
    },
    "Brahman": {
        "cycle_mean": 21.5, "cycle_std": 2.5,
        "offset_ib": 0.5,   "conception_rate": 0.50,
        "silent_heat_rate": 0.25,
        "temp_baseline": 38.8, "temp_std": 0.4,  # Lebih tahan panas
        "activity_baseline": 0.55, "activity_std": 0.2,
        "weight": 0.15,
    },
    "Angus": {
        "cycle_mean": 21.0, "cycle_std": 1.5,
        "offset_ib": 0.0,   "conception_rate": 0.58,
        "silent_heat_rate": 0.18,
        "temp_baseline": 38.2, "temp_std": 0.3,
        "activity_baseline": 0.6, "activity_std": 0.2,
        "weight": 0.05,
    },
    "Friesian Holstein": {
        "cycle_mean": 21.0, "cycle_std": 2.2,
        "offset_ib": 0.5,   "conception_rate": 0.45,
        "silent_heat_rate": 0.25,
        "temp_baseline": 38.1, "temp_std": 0.35,
        "activity_baseline": 0.75, "activity_std": 0.25,
        "weight": 0.10,
    },
}

BREEDS     = list(BREED_PROFILES.keys())
BREED_W    = [BREED_PROFILES[b]["weight"] for b in BREEDS]

# Parameter sensor per kelas aktivitas
# Format: (mean_z_mean, mean_z_std, rms_z_mean, rms_z_std, max_z_mean, max_z_std, temp_delta_mean, temp_delta_std)
ACTIVITY_PARAMS = {
    "RESTING":    (0.30, 0.15, 0.40, 0.15, 0.80, 0.25,  0.0,  0.15),
    "EATING":     (0.65, 0.20, 0.85, 0.20, 1.50, 0.40,  0.1,  0.15),
    "RUMINATING": (0.45, 0.15, 0.60, 0.15, 1.10, 0.30,  0.05, 0.10),
    "ESTRUS":     (1.80, 0.40, 2.20, 0.45, 4.00, 0.80,  0.9,  0.25),
    "SICK":       (0.20, 0.10, 0.25, 0.10, 0.50, 0.20,  0.8,  0.30),
}

# Distribusi aktivitas harian (jam 0-23)
# Estrus lebih banyak malam-dinihari (peternak konfirmasi ini di papan tulis)
HOURLY_ESTRUS_WEIGHT = [
    0.3, 0.5, 0.8, 1.0, 0.9, 0.7,   # 00-05 (dinihari - tinggi)
    0.4, 0.3, 0.3, 0.4, 0.5, 0.6,   # 06-11
    0.5, 0.5, 0.4, 0.4, 0.5, 0.6,   # 12-17
    0.7, 0.8, 0.9, 0.8, 0.6, 0.4,   # 18-23 (malam - tinggi)
]


# ──────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────

def clip_positive(val: float, min_val: float = 0.01) -> float:
    return max(min_val, val)


def generate_sensor_row(activity: str, breed: str, base_ts: datetime) -> dict:
    """Generate satu baris data sensor realistis untuk aktivitas dan jenis sapi tertentu."""
    bp = BREED_PROFILES[breed]
    ap = ACTIVITY_PARAMS[activity]

    mean_z = clip_positive(np.random.normal(ap[0], ap[1]))
    rms_z  = clip_positive(np.random.normal(ap[2], ap[3]))
    max_z  = clip_positive(np.random.normal(ap[4], ap[5]))

    # Suhu = baseline jenis sapi + delta aktivitas + noise
    temp_delta = np.random.normal(ap[6], ap[7])
    temperature = round(np.random.normal(bp["temp_baseline"], bp["temp_std"]) + temp_delta, 2)
    temperature = max(37.0, min(41.5, temperature))  # Clamp ke range biologis

    estrus_detected = 1 if activity == "ESTRUS" else 0

    return {
        "mean_z":          round(mean_z, 4),
        "rms_z":           round(rms_z, 4),
        "max_z":           round(max_z, 4),
        "temperature":     temperature,
        "activity_state":  activity,
        "estrus_detected": estrus_detected,
        "batch_ts":        base_ts,
    }


# ──────────────────────────────────────────────
# 1. Generate Data Sensor (untuk SVM)
# ──────────────────────────────────────────────

async def generate_sensor_data(conn: asyncpg.Connection, owner_id: int, n_rows: int = 8000):
    """
    Generate n_rows baris sensor data sintetis ke tabel sensor_data.
    Distribusi kelas:
      RESTING    : 45% (aktivitas dominan sapi)
      EATING     : 25%
      RUMINATING : 20%
      ESTRUS     : 8%  (langka tapi kritis)
      SICK       : 2%  (sangat langka)
    """
    logger.info(f"🐄 Generate {n_rows} baris sensor data...")

    # Distribusi kelas (imbalanced, sesuai realita)
    CLASS_DIST = {
        "RESTING":    0.45,
        "EATING":     0.25,
        "RUMINATING": 0.20,
        "ESTRUS":     0.08,
        "SICK":       0.02,
    }

    classes  = list(CLASS_DIST.keys())
    weights  = list(CLASS_DIST.values())

    # Buat collar sintetis — 1 collar per breed
    collars = {
        breed: f"SIM_{breed.upper().replace(' ', '_')[:8]}_001"
        for breed in BREEDS
    }

    # Register collar ke collar_registry kalau belum ada
    for breed, collar_id in collars.items():
        await conn.execute("""
            INSERT INTO collar_registry (collar_id, device_secret_hash, status, kandang_id)
            VALUES ($1, $2, 'ACTIVE', 'KANDANG_SIM')
            ON CONFLICT (collar_id) DO NOTHING
        """, collar_id, "$2b$12$simulatedhashforsyntheticcollar000000000000000000000000")

    # Siapkan batch insert
    rows_to_insert = []
    base_date = datetime.now() - timedelta(days=180)  # 6 bulan ke belakang

    for i in range(n_rows):
        breed    = np.random.choice(BREEDS, p=BREED_W)
        activity = np.random.choice(classes, p=weights)
        collar   = collars[breed]

        # Timestamp — distribusi merata selama 6 bulan, estrus lebih banyak malam
        day_offset = int(np.random.randint(0, 180))
        if activity == "ESTRUS":
            hour = int(np.random.choice(range(24), p=[w/sum(HOURLY_ESTRUS_WEIGHT) for w in HOURLY_ESTRUS_WEIGHT]))
        else:
            hour = int(np.random.randint(0, 24))
        minute  = int(np.random.randint(0, 60))
        base_ts = base_date + timedelta(days=day_offset, hours=hour, minutes=minute)

        row = generate_sensor_row(activity, breed, base_ts)
        row["collar_id"]  = collar
        row["kandang_id"] = "KANDANG_SIM"
        row["battery_voltage"] = round(np.random.uniform(3.5, 4.2), 2)
        row["battery_percent"] = np.random.randint(20, 100)

        rows_to_insert.append(row)

    # Bulk insert
    logger.info(f"  📥 Inserting {len(rows_to_insert)} rows ke sensor_data...")
    await conn.executemany("""
        INSERT INTO sensor_data
            (collar_id, kandang_id, mean_z, rms_z, max_z, temperature,
             activity_state, estrus_detected, battery_voltage, battery_percent, batch_ts)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    """, [
        (
            r["collar_id"], r["kandang_id"],
            r["mean_z"], r["rms_z"], r["max_z"], r["temperature"],
            r["activity_state"], r["estrus_detected"],
            r["battery_voltage"], r["battery_percent"],
            r["batch_ts"],
        )
        for r in rows_to_insert
    ])

    # Hitung distribusi aktual
    from collections import Counter
    dist = Counter(r["activity_state"] for r in rows_to_insert)
    logger.info("  ✅ Distribusi kelas aktual:")
    for cls, cnt in sorted(dist.items()):
        logger.info(f"     {cls:12s}: {cnt:5d} ({cnt/n_rows*100:.1f}%)")

    return collars


# ──────────────────────────────────────────────
# 2. Generate Data Historis Reproduksi (untuk XGBoost)
# ──────────────────────────────────────────────

async def generate_historis_reproduksi(
    conn: asyncpg.Connection,
    owner_id: int,
    n_sapi: int = 30,
    n_siklus_per_sapi: int = 8,
):
    """
    Generate data historis reproduksi sintetis.
    Setiap sapi punya beberapa siklus dengan pola biologis yang realistis.
    Juga generate:
      - Profil hewan di tabel hewan
      - Siklus individu di tabel siklus_individu
      - Labeled data di tabel estrus_label
      - Populasi baseline di tabel populasi_baseline
    """
    logger.info(f"🐄 Generate historis reproduksi untuk {n_sapi} sapi x ~{n_siklus_per_sapi} siklus...")

    sapi_list = []

    for i in range(1, n_sapi + 1):
        breed = np.random.choice(BREEDS, p=BREED_W)
        bp    = BREED_PROFILES[breed]
        rfid  = f"SIM{i:04d}"
        nama  = f"Sapi Sim {i:03d}"

        # Umur sapi: 2-7 tahun (hanya betina produktif)
        usia_tahun    = np.random.randint(2, 8)
        tgl_lahir     = date.today() - timedelta(days=usia_tahun * 365 + np.random.randint(0, 180))

        # Parity awal (berapa kali sudah pernah bunting sebelum data ini)
        parity_awal = np.random.randint(0, 3)

        # Daftarkan ke tabel hewan
        await conn.execute("""
            INSERT INTO hewan (id, nama, jenis, bulan_tahun_lahir, status_kesehatan, owner_id)
            VALUES ($1,$2,$3,$4,'Sehat',$5)
            ON CONFLICT (id) DO NOTHING
        """, rfid, nama, breed, tgl_lahir.isoformat(), owner_id)

        # Generate siklus reproduksi
        # Panjang siklus individual (konsisten per sapi, dengan sedikit noise)
        siklus_personal = np.random.normal(bp["cycle_mean"], bp["cycle_std"] * 0.5)
        siklus_personal = max(17, min(25, siklus_personal))

        offset_personal = bp["offset_ib"] + np.random.normal(0, 0.5)
        offset_personal = round(max(-2, min(3, offset_personal)), 1)

        # Tanggal birahi pertama: 6-24 bulan yang lalu
        tgl_birahi = date.today() - timedelta(days=np.random.randint(180, 730))

        riwayat_siklus = []
        parity         = parity_awal

        for siklus_ke in range(n_siklus_per_sapi):
            # Apakah ini silent heat? (tidak terdeteksi visual)
            is_silent = np.random.random() < bp["silent_heat_rate"]

            # Apakah IB berhasil?
            berhasil = np.random.random() < bp["conception_rate"]

            # Jumlah IB dalam siklus ini
            if berhasil:
                jumlah_ib = np.random.choice([1, 2, 3], p=[0.55, 0.30, 0.15])
            else:
                jumlah_ib = np.random.choice([1, 2, 3], p=[0.30, 0.40, 0.30])

            # Tanggal IB = birahi + offset (dengan sedikit noise)
            ib_offset_days = offset_personal + np.random.normal(0, 0.3)
            tgl_ib = tgl_birahi + timedelta(days=round(ib_offset_days))

            tgl_bunting = None
            tgl_hpl     = None
            tgl_lahir_anak = None
            tgl_sapih   = None

            if berhasil:
                # Bunting = IB + 3 bulan (approx)
                tgl_bunting    = tgl_ib + timedelta(days=90 + np.random.randint(-5, 5))
                tgl_hpl        = tgl_bunting + timedelta(days=280 + np.random.randint(-10, 10))
                tgl_lahir_anak = tgl_hpl + timedelta(days=np.random.randint(-3, 4))
                tgl_sapih      = tgl_lahir_anak + timedelta(days=np.random.randint(180, 240))
                parity        += 1

            # Hanya insert kalau tanggal sudah lewat (tidak di masa depan)
            if tgl_ib > date.today():
                break

            pemberi = np.random.choice(["Dony", "Rudi", "Ahmad", "Petugas IB"])

            await conn.execute("""
                INSERT INTO reproduksi_ternak
                    (rfid, tanggal_ib, pemberi_ib, jumlah_ib, birahi, bunting, hpl, sapih, catatan)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT DO NOTHING
            """,
                rfid, tgl_ib, pemberi, int(jumlah_ib),
                tgl_birahi if not is_silent else None,
                tgl_bunting, tgl_hpl, tgl_sapih,
                f"Siklus {siklus_ke+1} | {'Berhasil' if berhasil else 'Gagal'} | {'Silent heat' if is_silent else 'Visible'}"
            )

            # Insert ke estrus_label (ground truth untuk training)
            if not is_silent:  # Silent heat tidak bisa jadi labeled data (tidak terobservasi)
                features_historis = {
                    "days_since_estrus": (tgl_birahi - (tgl_birahi - timedelta(days=siklus_personal))).days
                                         if siklus_ke > 0 else 0,
                    "cycle_avg":         round(siklus_personal, 2),
                    "parity":            parity_awal + siklus_ke,
                    "jenis_sapi":        breed,
                }
                repro_id = await conn.fetchval("""
                    SELECT id FROM reproduksi_ternak
                    WHERE rfid = $1 AND tanggal_ib = $2
                    LIMIT 1
                """, rfid, tgl_ib)

                if repro_id:
                    await conn.execute("""
                        INSERT INTO estrus_label
                            (rfid, owner_id, reproduksi_id, tanggal_birahi_aktual,
                             label_estrus, features_historis, sumber_label)
                        VALUES ($1,$2,$3,$4,$5,$6,'auto')
                        ON CONFLICT DO NOTHING
                    """,
                        rfid, owner_id, repro_id, tgl_birahi,
                        berhasil,  # Label: True kalau berhasil bunting
                        json.dumps(features_historis)
                    )

            riwayat_siklus.append({
                "tgl_birahi": tgl_birahi,
                "tgl_ib":     tgl_ib,
                "bunting":    tgl_bunting,
                "berhasil":   berhasil,
            })

            # Siklus berikutnya
            if berhasil and tgl_sapih:
                # Setelah sapih, birahi lagi dalam 30-90 hari
                tgl_birahi = tgl_sapih + timedelta(days=np.random.randint(30, 90))
            else:
                # Gagal → coba siklus berikutnya
                tgl_birahi = tgl_birahi + timedelta(days=round(siklus_personal + np.random.normal(0, 1)))

            if tgl_birahi > date.today():
                break

        # Hitung statistik siklus individu
        birahi_dates = [r["tgl_birahi"] for r in riwayat_siklus if r["tgl_birahi"]]
        if len(birahi_dates) >= 2:
            intervals = [
                (birahi_dates[k+1] - birahi_dates[k]).days
                for k in range(len(birahi_dates)-1)
                if 15 <= (birahi_dates[k+1] - birahi_dates[k]).days <= 35
            ]
            rata = sum(intervals)/len(intervals) if intervals else siklus_personal
            std  = float(np.std(intervals)) if len(intervals) > 1 else 2.0
        else:
            rata, std = siklus_personal, 2.0

        offsets = [
            (r["tgl_ib"] - r["tgl_birahi"]).days
            for r in riwayat_siklus
            if r["tgl_birahi"] and r["tgl_ib"] and r["bunting"]
            and -5 <= (r["tgl_ib"] - r["tgl_birahi"]).days <= 10
        ]
        offset_opt  = sum(offsets)/len(offsets) if offsets else offset_personal
        jumlah_valid = len([r for r in riwayat_siklus if r["bunting"]])
        status       = "active" if jumlah_valid > 0 else "virgin"

        await conn.execute("""
            INSERT INTO siklus_individu
                (rfid, owner_id, rata_siklus_hari, std_siklus_hari, jumlah_siklus_valid,
                 offset_ib_optimal, offset_confidence, status_reproduksi,
                 last_birahi_date, last_ib_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (rfid) DO UPDATE SET
                rata_siklus_hari    = EXCLUDED.rata_siklus_hari,
                std_siklus_hari     = EXCLUDED.std_siklus_hari,
                jumlah_siklus_valid = EXCLUDED.jumlah_siklus_valid,
                offset_ib_optimal   = EXCLUDED.offset_ib_optimal,
                offset_confidence   = EXCLUDED.offset_confidence,
                status_reproduksi   = EXCLUDED.status_reproduksi,
                last_birahi_date    = EXCLUDED.last_birahi_date,
                last_ib_date        = EXCLUDED.last_ib_date,
                updated_at          = CURRENT_TIMESTAMP
        """,
            rfid, owner_id,
            round(rata, 2), round(std, 2), jumlah_valid,
            round(offset_opt, 2), min(1.0, jumlah_valid / 5.0),
            status,
            max(birahi_dates) if birahi_dates else None,
            max([r["tgl_ib"] for r in riwayat_siklus if r["tgl_ib"]], default=None),
        )

        sapi_list.append({"rfid": rfid, "breed": breed, "siklus_personal": siklus_personal})
        if i % 10 == 0:
            logger.info(f"  ✅ {i}/{n_sapi} sapi diproses...")

    # Update populasi_baseline per jenis sapi
    logger.info("  📊 Update populasi_baseline...")
    await conn.execute("""
        INSERT INTO populasi_baseline (owner_id, jenis_sapi, rata_siklus_hari, std_siklus_hari, jumlah_sampel)
        SELECT
            si.owner_id,
            h.jenis,
            AVG(si.rata_siklus_hari),
            AVG(si.std_siklus_hari),
            COUNT(*)
        FROM siklus_individu si
        JOIN hewan h ON h.id = si.rfid
        WHERE si.owner_id = $1 AND si.jumlah_siklus_valid > 0
        GROUP BY si.owner_id, h.jenis
        ON CONFLICT (owner_id, jenis_sapi) DO UPDATE SET
            rata_siklus_hari = EXCLUDED.rata_siklus_hari,
            std_siklus_hari  = EXCLUDED.std_siklus_hari,
            jumlah_sampel    = EXCLUDED.jumlah_sampel,
            updated_at       = CURRENT_TIMESTAMP
    """, owner_id)

    total_repro = await conn.fetchval("SELECT COUNT(*) FROM reproduksi_ternak WHERE rfid LIKE 'SIM%'")
    total_label = await conn.fetchval("SELECT COUNT(*) FROM estrus_label WHERE owner_id = $1", owner_id)
    logger.info(f"  ✅ {n_sapi} sapi | {total_repro} records reproduksi | {total_label} estrus labels")

    return sapi_list


# ──────────────────────────────────────────────
# 3. Retrain SVM dan XGBoost
# ──────────────────────────────────────────────

async def retrain_models(conn: asyncpg.Connection, owner_id: int):
    """
    Retrain SVM (sensor) dan XGBoost (historis) dari data yang ada di DB.
    Simpan model baru ke folder models/.
    """
    try:
        import sklearn
        from sklearn.svm import SVC
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
        from sklearn.model_selection import StratifiedKFold, cross_validate
        from sklearn.metrics import classification_report
        import xgboost as xgb
        import joblib
        import pandas as pd
    except ImportError as e:
        logger.error(f"❌ Missing dependency: {e}")
        logger.error("   Install: pip install scikit-learn xgboost joblib pandas")
        return

    os.makedirs(MODEL_DIR, exist_ok=True)

    # ── Retrain SVM ─────────────────────────────────────────────
    logger.info("\n🤖 Retrain SVM dari sensor_data...")

    sensor_rows = await conn.fetch("""
        SELECT mean_z, rms_z, max_z, temperature, estrus_detected
        FROM sensor_data
        WHERE mean_z IS NOT NULL
          AND temperature IS NOT NULL
          AND estrus_detected IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 10000
    """)

    if len(sensor_rows) < 100:
        logger.warning(f"⚠️  Data sensor terlalu sedikit ({len(sensor_rows)} rows). Minimal 100.")
    else:
        X_svm = np.array([[r["mean_z"], r["rms_z"], r["max_z"], r["temperature"]] for r in sensor_rows])
        y_svm = np.array([int(r["estrus_detected"]) for r in sensor_rows])

        # Cek distribusi kelas
        unique, counts = np.unique(y_svm, return_counts=True)
        logger.info(f"   Distribusi label SVM: {dict(zip(unique, counts))}")

        # Pipeline: StandardScaler + SVC dengan class_weight='balanced' (recall priority)
        svm_pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("svm", SVC(
                kernel="rbf",
                C=10.0,
                gamma="scale",
                probability=True,
                class_weight="balanced",   # Prioritaskan recall untuk estrus
                random_state=42,
            ))
        ])

        # Cross-validation
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_results = cross_validate(
            svm_pipeline, X_svm, y_svm, cv=cv,
            scoring=["accuracy", "recall", "precision", "f1"],
            return_train_score=False,
        )

        logger.info("   📊 SVM Cross-Validation Results (5-fold):")
        logger.info(f"      Accuracy  : {cv_results['test_accuracy'].mean():.3f} ± {cv_results['test_accuracy'].std():.3f}")
        logger.info(f"      Recall    : {cv_results['test_recall'].mean():.3f} ± {cv_results['test_recall'].std():.3f}")
        logger.info(f"      Precision : {cv_results['test_precision'].mean():.3f} ± {cv_results['test_precision'].std():.3f}")
        logger.info(f"      F1        : {cv_results['test_f1'].mean():.3f} ± {cv_results['test_f1'].std():.3f}")

        # Train final model dengan semua data
        svm_pipeline.fit(X_svm, y_svm)
        svm_path = os.path.join(MODEL_DIR, "svm_estrus_sensor.joblib")
        joblib.dump(svm_pipeline, svm_path)
        logger.info(f"   ✅ SVM disimpan ke: {svm_path}")

        # Log ke ml_training_log
        version = datetime.now().strftime("%Y%m%d_%H%M%S")
        await conn.execute("""
            UPDATE ml_training_log SET is_active = FALSE
            WHERE owner_id = $1 AND model_type = 'svm'
        """, owner_id)
        await conn.execute("""
            INSERT INTO ml_training_log
                (owner_id, model_type, model_version, model_path,
                 jumlah_sampel, jumlah_positif, jumlah_negatif,
                 recall_score, precision_score, f1_score, accuracy,
                 is_active, activation_threshold)
            VALUES ($1,'svm',$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,50)
        """,
            owner_id, version, svm_path,
            len(y_svm),
            int(np.sum(y_svm == 1)),
            int(np.sum(y_svm == 0)),
            float(cv_results["test_recall"].mean()),
            float(cv_results["test_precision"].mean()),
            float(cv_results["test_f1"].mean()),
            float(cv_results["test_accuracy"].mean()),
        )

    # ── Retrain XGBoost ─────────────────────────────────────────
    logger.info("\n🤖 Retrain XGBoost dari estrus_label + reproduksi_ternak...")

    label_rows = await conn.fetch("""
        SELECT
            el.rfid,
            el.label_estrus,
            el.features_historis,
            si.rata_siklus_hari,
            si.jumlah_siklus_valid,
            COALESCE(
                (CURRENT_DATE - el.tanggal_birahi_aktual),
                21
            ) AS days_since_estrus
        FROM estrus_label el
        LEFT JOIN siklus_individu si ON si.rfid = el.rfid
        WHERE el.owner_id = $1
          AND el.tanggal_birahi_aktual IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 5000
    """, owner_id)

    if len(label_rows) < 50:
        logger.warning(f"⚠️  Data estrus_label terlalu sedikit ({len(label_rows)} rows). Minimal 50 untuk Layer 3.")
        logger.info("   Layer 3 XGBoost tidak akan aktif sampai data cukup.")
    else:
        X_xgb_list = []
        y_xgb_list = []

        for r in label_rows:
            features = json.loads(r["features_historis"]) if r["features_historis"] else {}
            cycle_avg  = float(r["rata_siklus_hari"] or 21.0)
            parity     = int(r["jumlah_siklus_valid"] or 0)
            
            # Positive sample: days_since_estrus is around the cycle average (estrus day)
            days_since_positive = features.get("days_since_estrus") or cycle_avg or 21.0
            if days_since_positive == 0:
                days_since_positive = cycle_avg or 21.0
            
            X_xgb_list.append([days_since_positive, cycle_avg, parity, 5.0, 0.0])
            y_xgb_list.append(1)
            
            # Negative samples: non-estrus days (e.g. 2, 5, 10, 15 days since last estrus)
            for non_estrus_day in [2, 5, 10, 15]:
                X_xgb_list.append([non_estrus_day, cycle_avg, parity, 5.0, 0.0])
                y_xgb_list.append(0)

        X_xgb = np.array(X_xgb_list)
        y_xgb = np.array(y_xgb_list)

        unique, counts = np.unique(y_xgb, return_counts=True)
        logger.info(f"   Distribusi label XGBoost: {dict(zip(unique, counts))}")

        # Hitung scale_pos_weight untuk handle imbalanced data
        neg_count = int(np.sum(y_xgb == 0))
        pos_count = int(np.sum(y_xgb == 1))
        scale_pos_weight = neg_count / max(pos_count, 1)

        xgb_model = xgb.XGBClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,  # Handle imbalanced
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=42,
        )

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_results = cross_validate(
            xgb_model, X_xgb, y_xgb, cv=cv,
            scoring=["accuracy", "recall", "precision", "f1"],
            return_train_score=False,
        )

        logger.info("   📊 XGBoost Cross-Validation Results (5-fold):")
        logger.info(f"      Accuracy  : {cv_results['test_accuracy'].mean():.3f} ± {cv_results['test_accuracy'].std():.3f}")
        logger.info(f"      Recall    : {cv_results['test_recall'].mean():.3f} ± {cv_results['test_recall'].std():.3f}")
        logger.info(f"      Precision : {cv_results['test_precision'].mean():.3f} ± {cv_results['test_precision'].std():.3f}")
        logger.info(f"      F1        : {cv_results['test_f1'].mean():.3f} ± {cv_results['test_f1'].std():.3f}")

        xgb_model.fit(X_xgb, y_xgb)
        xgb_path = os.path.join(MODEL_DIR, "xgb_estrus_historical.joblib")
        joblib.dump(xgb_model, xgb_path)
        logger.info(f"   ✅ XGBoost disimpan ke: {xgb_path}")

        version = datetime.now().strftime("%Y%m%d_%H%M%S")
        await conn.execute("""
            UPDATE ml_training_log SET is_active = FALSE
            WHERE owner_id = $1 AND model_type = 'xgboost'
        """, owner_id)
        await conn.execute("""
            INSERT INTO ml_training_log
                (owner_id, model_type, model_version, model_path,
                 jumlah_sampel, jumlah_positif, jumlah_negatif,
                 recall_score, precision_score, f1_score, accuracy,
                 is_active, activation_threshold)
            VALUES ($1,'xgboost',$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,50)
        """,
            owner_id, version, xgb_path,
            len(y_xgb), pos_count, neg_count,
            float(cv_results["test_recall"].mean()),
            float(cv_results["test_precision"].mean()),
            float(cv_results["test_f1"].mean()),
            float(cv_results["test_accuracy"].mean()),
        )

    logger.info("\n✅ Retrain selesai! Restart backend untuk load model baru.")
    logger.info("   docker compose restart backend")


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

async def main(mode: str, owner_id: int, n_sensor: int, n_sapi: int, n_siklus: int):
    conn = await asyncpg.connect(DATABASE_URL)
    logger.info(f"✅ Connected ke DB | mode={mode} | owner_id={owner_id}")

    try:
        if mode in ("all", "sensor"):
            await generate_sensor_data(conn, owner_id, n_sensor)

        if mode in ("all", "historis"):
            await generate_historis_reproduksi(conn, owner_id, n_sapi, n_siklus)

        if mode in ("all", "retrain"):
            await retrain_models(conn, owner_id)

        logger.info("\n🎉 Semua selesai!")
        logger.info("   Langkah selanjutnya:")
        logger.info("   1. Restart backend: docker compose restart backend")
        logger.info("   2. Cek model baru di folder models/")
        logger.info("   3. Test prediksi via GET /api/scanner/profil/{rfid}")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate data sintetis + retrain model Hectra")
    parser.add_argument("--mode",      default="all",
                        choices=["all", "sensor", "historis", "retrain"],
                        help="Mode: all=semua, sensor=sensor saja, historis=reproduksi saja, retrain=retrain saja")
    parser.add_argument("--owner-id",  type=int, default=1, help="Owner ID di tabel users")
    parser.add_argument("--n-sensor",  type=int, default=8000, help="Jumlah baris sensor (default: 8000)")
    parser.add_argument("--n-sapi",    type=int, default=30,   help="Jumlah sapi sintetis (default: 30)")
    parser.add_argument("--n-siklus",  type=int, default=8,    help="Jumlah siklus per sapi (default: 8)")
    args = parser.parse_args()

    asyncio.run(main(args.mode, args.owner_id, args.n_sensor, args.n_sapi, args.n_siklus))
