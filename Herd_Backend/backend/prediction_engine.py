"""
prediction_engine.py
====================
3-Layer Hybrid Prediction Engine untuk deteksi & prediksi estrus sapi.

Kompatibel dengan model .joblib yang sudah ada di sistem:
  - SVM  : input shape (1x4) → [mean_z, rms_z, max_z, temperature]
  - XGBoost: input shape (1x5) → [days_since_estrus, cycle_avg, parity, 5.0, abs(mean_z)]

Layer 1 — Rule-Based Calendar  : Selalu aktif, semua sapi (tidak butuh collar/ML)
Layer 2 — Sensor + SVM         : Aktif kalau sapi punya collar
Layer 3 — Calendar + XGBoost   : Aktif kalau data estrus_label >= ML_MIN_SAMPLES

Integrasi:
  - Dipanggil dari routers/scanner.py saat GET /api/scanner/profil/{rfid}
  - Dipanggil dari app.py batch endpoint /api/predict/batch/run
  - Dipanggil dari mqtt_bridge.py sebagai layer tambahan di atas estrus_code
"""

import asyncpg
import joblib
import numpy as np
import os
import logging
from datetime import date, datetime, timedelta
from typing import Optional, List

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Config — sinkron dengan konstanta di app.py
# ──────────────────────────────────────────────

DATABASE_URL    = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/iot_peternakan")
MODEL_DIR       = os.getenv("MODEL_DIR", "/models")
THRESHOLD       = float(os.getenv("ESTRUS_THRESHOLD", "0.75"))   # sama dengan THRESHOLD di app.py
ML_MIN_SAMPLES  = int(os.getenv("ML_MIN_SAMPLES", "50"))

# ── Bobot ML (dibalik dari versi lama setelah riset lapangan) ──
# Versi lama : XGB=0.35, SVM=0.65  → sensor dominan
# Versi baru : XGB=0.65, SVM=0.35  → historis dominan
# CATATAN: Ubah juga XGB_WEIGHT & SVM_WEIGHT di app.py agar konsisten!
XGB_WEIGHT_NEW = float(os.getenv("XGB_WEIGHT", "0.65"))
SVM_WEIGHT_NEW = float(os.getenv("SVM_WEIGHT", "0.35"))

# ── Bobot antar layer ──
WEIGHT_L1_ONLY = 1.00
WEIGHT_L1_L2   = {"l1": 0.55, "l2": 0.45}
WEIGHT_L1_L3   = {"l1": 0.70, "l3": 0.30}
WEIGHT_FULL    = {"l1": 0.50, "l2": 0.25, "l3": 0.25}


# ──────────────────────────────────────────────
# Model Registry — singleton, load sekali saat startup
# ──────────────────────────────────────────────

class ModelRegistry:
    """
    Wrapper singleton untuk model .joblib yang sudah ada.
    Kompatibel dengan cara load yang sudah ada di app.py.
    Kalau app.py sudah load model ke variabel global,
    inject langsung pakai ModelRegistry.set_models().
    """
    _xgb = None
    _svm = None

    @classmethod
    def load_from_disk(cls):
        """Load dari disk — pakai ini kalau prediction_engine dipakai standalone."""
        xgb_path = os.path.join(MODEL_DIR, "xgb_estrus_historical.joblib")
        svm_path  = os.path.join(MODEL_DIR, "svm_estrus_sensor.joblib")
        try:
            cls._xgb = joblib.load(xgb_path)
            logger.info(f"✅ XGBoost loaded: {xgb_path}")
        except Exception as e:
            logger.warning(f"⚠️  XGBoost gagal load: {e}")
        try:
            cls._svm = joblib.load(svm_path)
            logger.info(f"✅ SVM loaded: {svm_path}")
        except Exception as e:
            logger.warning(f"⚠️  SVM gagal load: {e}")

    @classmethod
    def set_models(cls, xgb_model, svm_model):
        """
        Inject model dari app.py yang sudah load duluan.
        Panggil ini di app.py startup setelah load model:

            from prediction_engine import ModelRegistry
            ModelRegistry.set_models(xgb_model, svm_model)
        """
        cls._xgb = xgb_model
        cls._svm = svm_model
        logger.info("✅ ModelRegistry: model di-inject dari app.py")

    @classmethod
    def xgb(cls):
        return cls._xgb

    @classmethod
    def svm(cls):
        return cls._svm

    @classmethod
    def is_ready(cls):
        return cls._xgb is not None and cls._svm is not None


# ──────────────────────────────────────────────
# run_hybrid_prediction — kompatibel dengan versi lama di app.py
# ──────────────────────────────────────────────

def run_hybrid_prediction(
    mean_z: float,
    rms_z: float,
    max_z: float,
    temperature: float,
    days_since_estrus: float,
    cycle_avg: float,
    parity: int,
    xgb_weight: Optional[float] = None,
    svm_weight: Optional[float] = None,
) -> tuple[float, float, float]:
    """
    Drop-in replacement untuk run_hybrid_prediction() di app.py.

    Feature shape — SAMA PERSIS dengan model yang sudah ada:
      SVM   (1x4): [mean_z, rms_z, max_z, temperature]
      XGBoost(1x5): [days_since_estrus, cycle_avg, parity, 5.0, abs(mean_z)]
      Konstanta 5.0 dan abs(mean_z) di-hardcode sesuai model lama.

    Args:
        xgb_weight, svm_weight: Override bobot. Default pakai XGB_WEIGHT_NEW/SVM_WEIGHT_NEW.

    Returns:
        (svm_prob, xgb_prob, hybrid_score)
    """
    w_xgb = xgb_weight if xgb_weight is not None else XGB_WEIGHT_NEW
    w_svm = svm_weight if svm_weight is not None else SVM_WEIGHT_NEW

    if not ModelRegistry.is_ready():
        raise RuntimeError("Model belum di-load. Panggil ModelRegistry.set_models() atau load_from_disk() dulu.")

    _svm = ModelRegistry.svm()
    _xgb = ModelRegistry.xgb()
    assert _svm is not None, "SVM model is None despite is_ready() check"
    assert _xgb is not None, "XGBoost model is None despite is_ready() check"

    # SVM: (1x4)
    svm_prob = float(
        _svm.predict_proba(
            [[mean_z, rms_z, max_z, temperature]]
        )[0, 1]
    )

    # XGBoost: (1x5) — konstanta 5.0 dan abs(mean_z) wajib dipertahankan
    xgb_prob = float(
        _xgb.predict_proba(
            [[days_since_estrus, cycle_avg, parity, 5.0, abs(mean_z)]]
        )[0, 1]
    )

    hybrid = (w_xgb * xgb_prob) + (w_svm * svm_prob)
    return svm_prob, xgb_prob, hybrid


# ──────────────────────────────────────────────
# Layer 1: Rule-Based Calendar
# ──────────────────────────────────────────────

def layer1_calendar(siklus: dict, baseline: dict, today: Optional[date] = None) -> dict:
    """
    Prediksi berbasis kalender individu sapi.
    Prioritas: data individu ≥ 2 siklus → populasi jenis → prior literatur.
    Selalu return hasil — tidak pernah None.
    """
    today = today or date.today()

    if siklus and siklus.get("jumlah_siklus_valid", 0) >= 2:
        rata_siklus = siklus["rata_siklus_hari"]
        std_siklus  = siklus["std_siklus_hari"] or 2.5
        offset_ib   = siklus["offset_ib_optimal"] or 0.0
        last_birahi = siklus["last_birahi_date"]
        confidence  = min(0.85, 0.40 + siklus["jumlah_siklus_valid"] * 0.10)
        sumber      = "individu"

    elif siklus and siklus.get("jumlah_siklus_valid", 0) == 1:
        rata_siklus = siklus["rata_siklus_hari"]
        std_siklus  = siklus["std_siklus_hari"] or 2.5
        offset_ib   = siklus["offset_ib_optimal"] or 0.0
        last_birahi = siklus["last_birahi_date"]
        confidence  = 0.50
        sumber      = "individu_terbatas"

    elif baseline:
        rata_siklus = baseline.get("rata_siklus_hari", 21.0)
        std_siklus  = baseline.get("std_siklus_hari", 2.5)
        offset_ib   = baseline.get("rata_offset_ib", 0.0)
        last_birahi = siklus.get("last_birahi_date") if siklus else None
        confidence  = 0.35
        sumber      = "populasi_jenis"

    else:
        rata_siklus = 21.0
        std_siklus  = 3.0
        offset_ib   = 0.0
        last_birahi = siklus.get("last_birahi_date") if siklus else None
        confidence  = 0.20
        sumber      = "prior_literatur"

    if not last_birahi:
        return {
            "prediksi_tanggal":    None,
            "prediksi_ib_optimal": None,
            "window_awal":         None,
            "window_akhir":        None,
            "confidence":          0.0,
            "metode_detail":       "no_history",
        }

    # Project predicted date into the future cycle relative to today
    cycle_days = rata_siklus if rata_siklus else 21.0
    days_since = (today - last_birahi).days
    if days_since >= 0:
        cycles_needed = int(days_since // cycle_days) + 1
        prediksi_tgl = last_birahi + timedelta(days=cycles_needed * cycle_days)
    else:
        prediksi_tgl = last_birahi + timedelta(days=cycle_days)

    prediksi_ib  = prediksi_tgl + timedelta(days=offset_ib)
    window_awal  = prediksi_tgl - timedelta(days=std_siklus * 1.5)
    window_akhir = prediksi_tgl + timedelta(days=std_siklus * 1.5)

    hari_ke = (prediksi_tgl - today).days
    if hari_ke > 14: confidence *= 0.85
    if hari_ke > 21: confidence *= 0.80

    return {
        "prediksi_tanggal":    prediksi_tgl,
        "prediksi_ib_optimal": prediksi_ib,
        "window_awal":         window_awal,
        "window_akhir":        window_akhir,
        "confidence":          round(confidence, 3),
        "metode_detail":       f"calendar_{sumber}",
    }


# ──────────────────────────────────────────────
# Layer 2: Sensor + SVM Booster
# ──────────────────────────────────────────────

def layer2_sensor(
    sensor_window: List[dict],
    days_since_estrus: float = 0.0,
    cycle_avg: float = 21.0,
    parity: int = 0,
    today: Optional[date] = None,
) -> Optional[dict]:
    """
    Boost confidence dari data sensor kalung.
    Kalau model SVM sudah ready → pakai run_hybrid_prediction (model asli).
    Kalau belum → rule-based fallback.
    Return None kalau tidak ada data sensor.
    """
    if not sensor_window:
        return None

    mean_z_vals = [r["mean_z"]      for r in sensor_window if r.get("mean_z")      is not None]
    rms_z_vals  = [r["rms_z"]       for r in sensor_window if r.get("rms_z")       is not None]
    max_z_vals  = [r["max_z"]       for r in sensor_window if r.get("max_z")       is not None]
    temp_vals   = [r["temperature"]  for r in sensor_window if r.get("temperature") is not None]

    if not mean_z_vals:
        return None

    mean_z  = float(np.mean(mean_z_vals))
    rms_z   = float(np.mean(rms_z_vals))  if rms_z_vals  else mean_z
    max_z   = float(np.mean(max_z_vals))  if max_z_vals  else mean_z * 1.5
    temp    = float(np.mean(temp_vals))   if temp_vals   else 38.5

    anomali_flags = []
    confidence    = 0.0

    if ModelRegistry.is_ready():
        # Pakai model asli — feature shape sama persis dengan app.py
        try:
            svm_prob, xgb_prob, hybrid = run_hybrid_prediction(
                mean_z, rms_z, max_z, temp,
                days_since_estrus, cycle_avg, parity,
            )
            confidence = hybrid
            anomali_flags.append(f"hybrid(svm={svm_prob:.3f},xgb={xgb_prob:.3f})")
        except Exception as e:
            logger.warning(f"run_hybrid_prediction error di layer2: {e}, fallback rule-based")
            ModelRegistry._svm = None  # Force fallback

    if not ModelRegistry.is_ready():
        # Rule-based fallback — kalau model belum siap
        score = 0.0
        if mean_z > 1.5:
            score += 0.30
            anomali_flags.append(f"aktivitas_tinggi(mean_z={mean_z:.2f})")
        if rms_z > 2.0:
            score += 0.20
            anomali_flags.append(f"rms_tinggi={rms_z:.2f}")
        if max_z > 3.5:
            score += 0.10
            anomali_flags.append(f"max_z_spike={max_z:.2f}")
        if temp > 39.5:
            score += 0.25
            anomali_flags.append(f"suhu_tinggi={temp:.1f}°C")
        elif temp > 39.0:
            score += 0.15
            anomali_flags.append(f"suhu_agak_tinggi={temp:.1f}°C")
        confidence = min(0.90, score)

    return {
        "confidence":     round(confidence, 3),
        "anomali_flags":  anomali_flags,
        "mean_z":         round(mean_z, 3),
        "temp":           round(temp, 2),
        "n_readings":     len(sensor_window),
    }


# ──────────────────────────────────────────────
# Layer 3: XGBoost Calendar Validator
# ──────────────────────────────────────────────

def layer3_xgb(
    siklus: dict,
    sensor_mean_z: float = 0.0,
    today: Optional[date] = None,
) -> Optional[dict]:
    """
    Validasi prediksi kalender menggunakan XGBoost.
    Aktif hanya kalau estrus_label >= ML_MIN_SAMPLES.
    Pakai feature shape yang sama dengan model di app.py: (1x5).
    """
    today = today or date.today()

    if not ModelRegistry.xgb() or not siklus:
        return None
    if not siklus.get("last_birahi_date"):
        return None

    try:
        last_birahi       = siklus["last_birahi_date"]
        days_since_estrus = (today - last_birahi).days
        cycle_avg         = siklus.get("rata_siklus_hari", 21.0)
        parity            = siklus.get("jumlah_siklus_valid", 0)

        # Feature shape (1x5) — SAMA dengan model XGBoost di app.py
        # [days_since_estrus, cycle_avg, parity, 5.0, abs(mean_z)]
        _xgb_model = ModelRegistry.xgb()
        assert _xgb_model is not None, "XGBoost model is None in layer3_xgb"
        xgb_prob = float(
            _xgb_model.predict_proba(
                [[days_since_estrus, cycle_avg, parity, 5.0, abs(sensor_mean_z)]]
            )[0, 1]
        )

        return {
            "confidence": round(xgb_prob, 3),
            "features": {
                "days_since_estrus": days_since_estrus,
                "cycle_avg":         cycle_avg,
                "parity":            parity,
                "const_5":           5.0,
                "abs_mean_z":        round(abs(sensor_mean_z), 3),
            }
        }
    except Exception as e:
        logger.warning(f"Layer 3 XGBoost error: {e}")
        return None


# ──────────────────────────────────────────────
# Gabungkan semua layer
# ──────────────────────────────────────────────

def gabungkan_confidence(
    l1: dict,
    l2: Optional[dict],
    l3: Optional[dict],
) -> tuple[float, str]:
    has_l2 = l2 is not None
    has_l3 = l3 is not None

    if not has_l2 and not has_l3:
        return l1["confidence"], "calendar_only"
    elif has_l2 and not has_l3:
        assert l2 is not None
        w = WEIGHT_L1_L2
        return round(l1["confidence"] * w["l1"] + l2["confidence"] * w["l2"], 3), "calendar+sensor"
    elif not has_l2 and has_l3:
        assert l3 is not None
        w = WEIGHT_L1_L3
        return round(l1["confidence"] * w["l1"] + l3["confidence"] * w["l3"], 3), "calendar+ml"
    else:
        assert l2 is not None
        assert l3 is not None
        w = WEIGHT_FULL
        return round(
            l1["confidence"] * w["l1"] +
            l2["confidence"] * w["l2"] +
            l3["confidence"] * w["l3"], 3
        ), "full_hybrid"


# ──────────────────────────────────────────────
# Main entry point
# ──────────────────────────────────────────────

async def predict_estrus(
    conn: asyncpg.Connection,
    rfid: str,
    owner_id: int,
    sensor_window: Optional[List[dict]] = None,
    today: Optional[date] = None,
) -> dict:
    """
    Entry point utama. Dipanggil dari:
      - routers/scanner.py  : GET /api/scanner/profil/{rfid}
      - app.py batch        : /api/predict/batch/run
      - mqtt_bridge.py      : sebagai layer tambahan setelah estrus_code

    Returns dict lengkap dengan prediksi, confidence, dan flag notifikasi.
    """
    today = today or date.today()

    # ── Ambil data dari DB ────────────────────────────────────────
    siklus = await conn.fetchrow("""
        SELECT si.*
        FROM siklus_individu si
        WHERE si.rfid = $1 AND si.owner_id = $2
    """, rfid, owner_id)

    # Fallback to direct reproduksi_ternak query if no siklus exists or last_birahi_date is missing
    if not siklus or not siklus.get("last_birahi_date"):
        last_event_date = await conn.fetchval("""
            SELECT COALESCE(birahi, tanggal_ib) 
            FROM reproduksi_ternak 
            WHERE rfid = $1 
            ORDER BY COALESCE(birahi, tanggal_ib) DESC LIMIT 1
        """, rfid)
        if last_event_date:
            siklus = {
                "last_birahi_date": last_event_date,
                "rata_siklus_hari": 21.0,
                "std_siklus_hari": 2.5,
                "offset_ib_optimal": 0.0,
                "jumlah_siklus_valid": 0
            }

    hewan = await conn.fetchrow("SELECT jenis FROM hewan WHERE id = $1", rfid)
    jenis = hewan["jenis"] if hewan else None

    baseline = None
    if jenis:
        baseline = await conn.fetchrow("""
            SELECT * FROM populasi_baseline
            WHERE owner_id = $1 AND LOWER(jenis_sapi) = LOWER($2)
        """, owner_id, jenis)

    # Cek apakah ML layer 3 boleh aktif
    ml_ready = await conn.fetchval("""
        SELECT COUNT(*) >= $1 FROM estrus_label WHERE owner_id = $2
    """, ML_MIN_SAMPLES, owner_id)

    # ── Layer 1 ───────────────────────────────────────────────────
    result_l1 = layer1_calendar(
        siklus   = dict(siklus)   if siklus   else {},
        baseline = dict(baseline) if baseline else {},
        today    = today,
    )

    # ── Layer 2 (sensor) ─────────────────────────────────────────
    result_l2 = None
    sensor_mean_z_avg = 0.0
    if sensor_window:
        # Hitung feature tambahan untuk XGBoost dari siklus
        days_since = (today - siklus["last_birahi_date"]).days if siklus and siklus.get("last_birahi_date") else 0
        cycle_avg  = siklus["rata_siklus_hari"] if siklus else 21.0
        parity     = siklus["jumlah_siklus_valid"] if siklus else 0

        result_l2 = layer2_sensor(
            sensor_window, days_since, cycle_avg, parity, today
        )
        mean_z_vals   = [r["mean_z"] for r in sensor_window if r.get("mean_z") is not None]
        sensor_mean_z_avg = float(np.mean(mean_z_vals)) if mean_z_vals else 0.0

    # ── Layer 3 (XGBoost) ─────────────────────────────────────────
    result_l3 = None
    if ml_ready and siklus:
        result_l3 = layer3_xgb(dict(siklus), sensor_mean_z_avg, today)

    # ── Gabungkan ─────────────────────────────────────────────────
    confidence_final, metode = gabungkan_confidence(result_l1, result_l2, result_l3)

    prediksi_tgl = result_l1["prediksi_tanggal"]
    prediksi_ib  = result_l1["prediksi_ib_optimal"]
    window_awal  = result_l1["window_awal"]
    window_akhir = result_l1["window_akhir"]

    # Deteksi birahi sekarang
    is_estrus_now = (
        window_awal is not None and
        window_awal <= today <= (window_akhir or today) and
        confidence_final >= THRESHOLD
    )

    # Tentukan tipe notifikasi
    should_notify = False
    notif_tipe    = None
    if prediksi_tgl:
        hari_ke = (prediksi_tgl - today).days
        if is_estrus_now:
            should_notify = True
            notif_tipe    = "birahi_alert"
        elif hari_ke == 0 and confidence_final >= THRESHOLD:
            should_notify = True
            notif_tipe    = "ib_optimal_now"
        elif hari_ke <= 3 and confidence_final >= 0.60:
            should_notify = True
            notif_tipe    = "birahi_reminder"

    # ── Simpan ke prediksi_birahi ─────────────────────────────────
    if prediksi_tgl:
        # Expire prediksi lama yang sudah lewat
        await conn.execute("""
            UPDATE prediksi_birahi
            SET status = 'expired', updated_at = CURRENT_TIMESTAMP
            WHERE rfid = $1 AND status = 'active' AND prediksi_tanggal < CURRENT_DATE
        """, rfid)

        await conn.execute("""
            INSERT INTO prediksi_birahi (
                rfid, owner_id,
                prediksi_tanggal, prediksi_ib_optimal,
                window_awal, window_akhir,
                confidence_layer1, confidence_layer2, confidence_layer3,
                confidence_final, metode,
                status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                CASE WHEN $12 THEN 'notified' ELSE 'active' END)
            ON CONFLICT (rfid, status) DO UPDATE SET
                prediksi_tanggal    = EXCLUDED.prediksi_tanggal,
                prediksi_ib_optimal = EXCLUDED.prediksi_ib_optimal,
                window_awal         = EXCLUDED.window_awal,
                window_akhir        = EXCLUDED.window_akhir,
                confidence_layer1   = EXCLUDED.confidence_layer1,
                confidence_layer2   = EXCLUDED.confidence_layer2,
                confidence_layer3   = EXCLUDED.confidence_layer3,
                confidence_final    = EXCLUDED.confidence_final,
                metode              = EXCLUDED.metode,
                updated_at          = CURRENT_TIMESTAMP
        """,
            rfid, owner_id,
            prediksi_tgl, prediksi_ib,
            window_awal, window_akhir,
            result_l1["confidence"],
            result_l2["confidence"] if result_l2 else None,
            result_l3["confidence"] if result_l3 else None,
            confidence_final, metode,
            should_notify,
        )

    return {
        "rfid":                rfid,
        "prediksi_tanggal":    prediksi_tgl,
        "prediksi_ib_optimal": prediksi_ib,
        "window_awal":         window_awal,
        "window_akhir":        window_akhir,
        "confidence_final":    confidence_final,
        "metode":              metode,
        "is_estrus_now":       is_estrus_now,
        "should_notify":       should_notify,
        "notif_tipe":          notif_tipe,
        "layer_details": {
            "layer1": result_l1,
            "layer2": result_l2,
            "layer3": result_l3,
        },
    }


# ──────────────────────────────────────────────
# Auto-update siklus_individu setelah event baru
# (dipanggil dari POST /api/scanner/reproduksi)
# ──────────────────────────────────────────────

async def update_siklus_setelah_event(
    conn: asyncpg.Connection,
    rfid: str,
    owner_id: int,
    event_type: str,  # 'birahi' | 'ib' | 'bunting' | 'lahir' | 'sapih'
    event_date: date,
):
    """
    Recalculate profil siklus individu setiap ada event reproduksi baru.
    Dipanggil dari routers/scanner.py setelah INSERT ke reproduksi_ternak.
    """
    riwayat = await conn.fetch("""
        SELECT COALESCE(birahi, tanggal_ib) as birahi, tanggal_ib, bunting
        FROM reproduksi_ternak
        WHERE rfid = $1 AND (birahi IS NOT NULL OR tanggal_ib IS NOT NULL)
        ORDER BY COALESCE(birahi, tanggal_ib) ASC
    """, rfid)

    if not riwayat:
        return

    birahi_dates = [r["birahi"] for r in riwayat]

    # Hitung rata-rata siklus
    if len(birahi_dates) >= 2:
        intervals = [
            (birahi_dates[i+1] - birahi_dates[i]).days
            for i in range(len(birahi_dates) - 1)
            if 15 <= (birahi_dates[i+1] - birahi_dates[i]).days <= 35
        ]
        rata = sum(intervals) / len(intervals) if intervals else 21.0
        std  = (
            sum((x - rata) ** 2 for x in intervals) / max(len(intervals) - 1, 1)
        ) ** 0.5 if len(intervals) > 1 else 2.5
    else:
        rata, std = 21.0, 2.5

    # Hitung offset IB optimal (hanya dari siklus yang berhasil bunting)
    offsets = [
        (r["tanggal_ib"] - r["birahi"]).days
        for r in riwayat
        if r["birahi"] and r["tanggal_ib"] and r["bunting"]
        and -5 <= (r["tanggal_ib"] - r["birahi"]).days <= 10
    ]
    offset_optimal = sum(offsets) / len(offsets) if offsets else 0.0
    offset_conf    = min(1.0, len(offsets) / 5.0)

    jumlah_valid = len([r for r in riwayat if r.get("bunting")])
    status = (
        "pregnant" if event_type == "bunting"
        else "active" if jumlah_valid > 0
        else "virgin"
    )

    await conn.execute("""
        INSERT INTO siklus_individu (
            rfid, owner_id,
            rata_siklus_hari, std_siklus_hari, jumlah_siklus_valid,
            offset_ib_optimal, offset_confidence,
            status_reproduksi,
            last_birahi_date, last_ib_date, last_bunting_date
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (rfid) DO UPDATE SET
            rata_siklus_hari    = EXCLUDED.rata_siklus_hari,
            std_siklus_hari     = EXCLUDED.std_siklus_hari,
            jumlah_siklus_valid = EXCLUDED.jumlah_siklus_valid,
            offset_ib_optimal   = EXCLUDED.offset_ib_optimal,
            offset_confidence   = EXCLUDED.offset_confidence,
            status_reproduksi   = EXCLUDED.status_reproduksi,
            last_birahi_date    = EXCLUDED.last_birahi_date,
            last_ib_date        = EXCLUDED.last_ib_date,
            last_bunting_date   = EXCLUDED.last_bunting_date,
            updated_at          = CURRENT_TIMESTAMP
    """,
        rfid, owner_id,
        round(rata, 2), round(std, 2), jumlah_valid,
        round(offset_optimal, 2), round(offset_conf, 2),
        status,
        max(birahi_dates),
        max([r["tanggal_ib"] for r in riwayat if r["tanggal_ib"]], default=None),
        max([r["bunting"]    for r in riwayat if r["bunting"]],    default=None),
    )
    logger.info(f"✅ siklus_individu updated: {rfid} | siklus={rata:.1f}d | offset={offset_optimal:+.1f}d | status={status}")
