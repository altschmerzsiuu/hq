"""
test_prediction_engine.py
=========================
Test script untuk validasi semua komponen sistem prediksi HERD.

Cara pakai:
  python test_prediction_engine.py              # semua test
  python test_prediction_engine.py --test model # test model saja
  python test_prediction_engine.py --test layer1
  python test_prediction_engine.py --test layer2
  python test_prediction_engine.py --test layer3
  python test_prediction_engine.py --test db --rfid SIM0001
  python test_prediction_engine.py --test full --rfid SIM0001 --owner-id 1
"""

import asyncio
import asyncpg
import joblib
import numpy as np
import os
import argparse
import json
import logging
from datetime import date, timedelta

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgre@localhost:5432/Collar_to_Gateway")
MODEL_DIR    = os.getenv("MODEL_DIR", "models")


# ──────────────────────────────────────────────
# Test 1: Model Load & Shape Check
# ──────────────────────────────────────────────

def test_model_load():
    """Pastikan model .joblib bisa di-load dan feature shape-nya benar."""
    print("\n" + "="*60)
    print("TEST 1: Model Load & Feature Shape")
    print("="*60)

    errors = []

    # SVM
    svm_path = os.path.join(MODEL_DIR, "svm_estrus_sensor.joblib")
    if not os.path.exists(svm_path):
        print(f"  ❌ SVM model tidak ditemukan: {svm_path}")
        errors.append("svm_not_found")
    else:
        try:
            svm = joblib.load(svm_path)
            # Test dengan feature shape (1x4)
            test_input = np.array([[0.5, 0.7, 1.2, 38.5]])
            proba = svm.predict_proba(test_input)
            print(f"  ✅ SVM loaded OK")
            print(f"     Input shape : (1, 4) → [mean_z, rms_z, max_z, temperature]")
            print(f"     Output shape: {proba.shape} → [P(non-estrus), P(estrus)]")
            print(f"     Test output : P(estrus)={proba[0,1]:.4f} untuk sapi istirahat normal")
        except Exception as e:
            print(f"  ❌ SVM error: {e}")
            errors.append(f"svm_error: {e}")

    print()

    # XGBoost
    xgb_path = os.path.join(MODEL_DIR, "xgb_estrus_historical.joblib")
    if not os.path.exists(xgb_path):
        print(f"  ❌ XGBoost model tidak ditemukan: {xgb_path}")
        errors.append("xgb_not_found")
    else:
        try:
            xgb = joblib.load(xgb_path)
            # Test dengan feature shape (1x5)
            test_input = np.array([[10, 21.0, 2, 5.0, 0.5]])
            proba = xgb.predict_proba(test_input)
            print(f"  ✅ XGBoost loaded OK")
            print(f"     Input shape : (1, 5) → [days_since_estrus, cycle_avg, parity, 5.0, abs(mean_z)]")
            print(f"     Output shape: {proba.shape} → [P(non-estrus), P(estrus)]")
            print(f"     Test output : P(estrus)={proba[0,1]:.4f} untuk sapi 10 hari setelah birahi")
        except Exception as e:
            print(f"  ❌ XGBoost error: {e}")
            errors.append(f"xgb_error: {e}")

    # Test run_hybrid_prediction
    print()
    if not errors:
        try:
            from prediction_engine import ModelRegistry, run_hybrid_prediction
            svm_m = joblib.load(svm_path)
            xgb_m = joblib.load(xgb_path)
            ModelRegistry.set_models(xgb_m, svm_m)

            svm_p, xgb_p, hybrid = run_hybrid_prediction(
                mean_z=1.8, rms_z=2.2, max_z=4.0, temperature=39.8,
                days_since_estrus=21, cycle_avg=21.0, parity=2
            )
            print(f"  ✅ run_hybrid_prediction OK")
            print(f"     Skenario: Sapi dengan aktivitas tinggi + suhu naik (estrus)")
            print(f"     SVM prob  : {svm_p:.4f}")
            print(f"     XGBoost   : {xgb_p:.4f}")
            print(f"     Hybrid    : {hybrid:.4f} {'✅ ESTRUS' if hybrid >= 0.75 else '⚠️ Below threshold'}")

            svm_p2, xgb_p2, hybrid2 = run_hybrid_prediction(
                mean_z=0.3, rms_z=0.4, max_z=0.8, temperature=38.3,
                days_since_estrus=5, cycle_avg=21.0, parity=2
            )
            print(f"\n     Skenario: Sapi istirahat normal (bukan estrus)")
            print(f"     SVM prob  : {svm_p2:.4f}")
            print(f"     XGBoost   : {xgb_p2:.4f}")
            print(f"     Hybrid    : {hybrid2:.4f} {'⚠️ False positive!' if hybrid2 >= 0.75 else '✅ Correctly non-estrus'}")

        except Exception as e:
            print(f"  ❌ run_hybrid_prediction error: {e}")
            errors.append(f"hybrid_error: {e}")

    status = "✅ PASSED" if not errors else f"❌ FAILED ({len(errors)} errors)"
    print(f"\n  Hasil: {status}")
    return len(errors) == 0


# ──────────────────────────────────────────────
# Test 2: Layer 1 — Calendar Rule
# ──────────────────────────────────────────────

def test_layer1():
    """Test prediksi kalender dengan berbagai skenario."""
    print("\n" + "="*60)
    print("TEST 2: Layer 1 — Rule-Based Calendar")
    print("="*60)

    from prediction_engine import layer1_calendar

    errors = []
    today = date.today()

    # Skenario A: Sapi dengan data individu lengkap (5 siklus)
    siklus_lengkap = {
        "rata_siklus_hari":    21.0,
        "std_siklus_hari":     1.5,
        "offset_ib_optimal":   1.0,
        "jumlah_siklus_valid": 5,
        "last_birahi_date":    today - timedelta(days=18),
    }
    result_a = layer1_calendar(siklus_lengkap, {}, today)
    print(f"\n  Skenario A: Sapi dengan 5 siklus terverifikasi")
    print(f"  Birahi terakhir  : {today - timedelta(days=18)} (18 hari lalu)")
    print(f"  Prediksi birahi  : {result_a['prediksi_tanggal']}")
    print(f"  Prediksi IB opt. : {result_a['prediksi_ib_optimal']}")
    print(f"  Window           : {result_a['window_awal']} → {result_a['window_akhir']}")
    print(f"  Confidence       : {result_a['confidence']:.3f}")
    print(f"  Metode           : {result_a['metode_detail']}")

    expected_days = (result_a['prediksi_tanggal'] - today).days
    if not (0 <= expected_days <= 5):
        print(f"  ⚠️  Prediksi {expected_days} hari lagi — harusnya sekitar 3 hari")
    else:
        print(f"  ✅ Prediksi {expected_days} hari lagi — masuk akal!")

    # Skenario B: Sapi virgin (belum pernah bunting)
    siklus_virgin = {
        "rata_siklus_hari":    None,
        "std_siklus_hari":     None,
        "offset_ib_optimal":   None,
        "jumlah_siklus_valid": 0,
        "last_birahi_date":    today - timedelta(days=10),
    }
    baseline_limosin = {
        "rata_siklus_hari": 21.0,
        "std_siklus_hari":  1.8,
        "rata_offset_ib":   1.0,
    }
    result_b = layer1_calendar(siklus_virgin, baseline_limosin, today)
    print(f"\n  Skenario B: Sapi virgin — pakai baseline populasi Limousin")
    print(f"  Confidence       : {result_b['confidence']:.3f} (harusnya ~0.35)")
    print(f"  Metode           : {result_b['metode_detail']}")
    if result_b['confidence'] <= 0.40:
        print(f"  ✅ Confidence rendah untuk virgin — benar!")
    else:
        print(f"  ⚠️  Confidence terlalu tinggi untuk virgin")
        errors.append("virgin_confidence_too_high")

    # Skenario C: Tidak ada histori sama sekali
    result_c = layer1_calendar({}, {}, today)
    print(f"\n  Skenario C: Tidak ada histori sama sekali")
    print(f"  Prediksi         : {result_c['prediksi_tanggal']}")
    print(f"  Confidence       : {result_c['confidence']}")
    if result_c['prediksi_tanggal'] is None:
        print(f"  ✅ Return None — benar, tidak bisa prediksi tanpa data")
    else:
        print(f"  ❌ Harusnya return None!")
        errors.append("no_history_should_return_none")

    status = "✅ PASSED" if not errors else f"❌ FAILED ({len(errors)} errors)"
    print(f"\n  Hasil: {status}")
    return len(errors) == 0


# ──────────────────────────────────────────────
# Test 3: Layer 2 — Sensor Booster
# ──────────────────────────────────────────────

def test_layer2():
    """Test sensor booster dengan berbagai kondisi sensor."""
    print("\n" + "="*60)
    print("TEST 3: Layer 2 — Sensor Booster")
    print("="*60)

    from prediction_engine import layer2_sensor, ModelRegistry
    errors = []

    # Load model kalau ada
    svm_path = os.path.join(MODEL_DIR, "svm_estrus_sensor.joblib")
    if os.path.exists(svm_path):
        xgb_path = os.path.join(MODEL_DIR, "xgb_estrus_historical.joblib")
        svm_m = joblib.load(svm_path)
        xgb_m = joblib.load(xgb_path)
        ModelRegistry.set_models(xgb_m, svm_m)
        print(f"  ℹ️  Menggunakan model SVM + XGBoost (loaded)")
    else:
        print(f"  ℹ️  Model belum ada — menggunakan rule-based fallback")

    # Skenario A: Estrus nyata (aktivitas tinggi + suhu naik)
    sensor_estrus = [
        {"mean_z": 1.9, "rms_z": 2.3, "max_z": 4.2, "temperature": 39.8},
        {"mean_z": 2.1, "rms_z": 2.5, "max_z": 4.5, "temperature": 40.1},
        {"mean_z": 1.7, "rms_z": 2.0, "max_z": 3.8, "temperature": 39.6},
    ]
    result_a = layer2_sensor(sensor_estrus, days_since_estrus=21, cycle_avg=21.0, parity=2)
    print(f"\n  Skenario A: Sapi birahi (aktivitas tinggi + suhu naik)")
    print(f"  mean_z avg: {np.mean([r['mean_z'] for r in sensor_estrus]):.2f}")
    print(f"  temp avg  : {np.mean([r['temperature'] for r in sensor_estrus]):.2f}°C")
    print(f"  Confidence: {result_a['confidence']:.3f}")
    print(f"  Flags     : {result_a['anomali_flags']}")
    if result_a['confidence'] >= 0.60:
        print(f"  ✅ Confidence tinggi — estrus terdeteksi!")
    else:
        print(f"  ⚠️  Confidence rendah untuk skenario estrus jelas")
        errors.append("estrus_low_confidence")

    # Skenario B: Sapi sakit (suhu tinggi tapi aktivitas RENDAH)
    sensor_sakit = [
        {"mean_z": 0.2, "rms_z": 0.3, "max_z": 0.5, "temperature": 40.2},
        {"mean_z": 0.1, "rms_z": 0.2, "max_z": 0.4, "temperature": 40.4},
        {"mean_z": 0.3, "rms_z": 0.3, "max_z": 0.6, "temperature": 40.0},
    ]
    result_b = layer2_sensor(sensor_sakit, days_since_estrus=5, cycle_avg=21.0, parity=2)
    print(f"\n  Skenario B: Sapi sakit (suhu tinggi + aktivitas RENDAH)")
    print(f"  mean_z avg: {np.mean([r['mean_z'] for r in sensor_sakit]):.2f} ← sangat rendah")
    print(f"  temp avg  : {np.mean([r['temperature'] for r in sensor_sakit]):.2f}°C ← demam")
    print(f"  Confidence: {result_b['confidence']:.3f}")
    # Kalau model bagus, bisa bedain sakit vs estrus
    print(f"  Flags     : {result_b['anomali_flags']}")
    print(f"  {'✅ Model bisa bedain sakit vs estrus!' if result_b['confidence'] < result_a['confidence'] else '⚠️  Confidence sama/lebih tinggi dari estrus — model perlu lebih banyak data SICK'}")

    # Skenario C: Istirahat normal
    sensor_normal = [
        {"mean_z": 0.3, "rms_z": 0.4, "max_z": 0.8, "temperature": 38.4},
        {"mean_z": 0.4, "rms_z": 0.5, "max_z": 0.9, "temperature": 38.3},
    ]
    result_c = layer2_sensor(sensor_normal, days_since_estrus=5, cycle_avg=21.0, parity=2)
    print(f"\n  Skenario C: Sapi istirahat normal")
    print(f"  Confidence: {result_c['confidence']:.3f}")
    if result_c['confidence'] < 0.40:
        print(f"  ✅ Confidence rendah — non-estrus terdeteksi benar")
    else:
        print(f"  ⚠️  Confidence terlalu tinggi untuk sapi istirahat")
        errors.append("normal_high_confidence")

    # Skenario D: Tidak ada sensor data (no collar)
    result_d = layer2_sensor([])
    print(f"\n  Skenario D: Tidak ada data sensor (no collar)")
    if result_d is None:
        print(f"  ✅ Return None — benar untuk sapi tanpa collar")
    else:
        print(f"  ❌ Harusnya return None!")
        errors.append("no_sensor_should_return_none")

    status = "✅ PASSED" if not errors else f"❌ FAILED ({len(errors)} errors)"
    print(f"\n  Hasil: {status}")
    return len(errors) == 0


# ──────────────────────────────────────────────
# Test 4: Layer 3 — XGBoost Validator
# ──────────────────────────────────────────────

def test_layer3():
    """Test XGBoost validator dengan feature shape yang benar."""
    print("\n" + "="*60)
    print("TEST 4: Layer 3 — XGBoost Calendar Validator")
    print("="*60)

    from prediction_engine import layer3_xgb, ModelRegistry
    errors = []

    xgb_path = os.path.join(MODEL_DIR, "xgb_estrus_historical.joblib")
    svm_path = os.path.join(MODEL_DIR, "svm_estrus_sensor.joblib")

    if not os.path.exists(xgb_path):
        print(f"  ⚠️  XGBoost model belum ada — Layer 3 akan return None (normal)")
        return True

    xgb_m = joblib.load(xgb_path)
    svm_m = joblib.load(svm_path) if os.path.exists(svm_path) else None
    ModelRegistry.set_models(xgb_m, svm_m)

    today = date.today()

    # Skenario A: Sapi di hari-H birahi (days_since = 21)
    siklus_siap = {
        "last_birahi_date":    today - timedelta(days=21),
        "rata_siklus_hari":    21.0,
        "jumlah_siklus_valid": 3,
    }
    result_a = layer3_xgb(siklus_siap, sensor_mean_z=0.5, today=today)
    print(f"\n  Skenario A: Sapi di hari ke-21 (tepat waktu birahi)")
    if result_a:
        print(f"  Confidence: {result_a['confidence']:.3f}")
        print(f"  Features  : {result_a['features']}")
        print(f"  {'✅ Confidence tinggi' if result_a['confidence'] >= 0.50 else '⚠️  Confidence rendah untuk hari tepat birahi'}")
    else:
        print(f"  ⚠️  Layer 3 return None — kemungkinan data belum cukup")

    # Skenario B: Sapi baru 5 hari setelah birahi (bukan waktunya)
    siklus_awal = {
        "last_birahi_date":    today - timedelta(days=5),
        "rata_siklus_hari":    21.0,
        "jumlah_siklus_valid": 3,
    }
    result_b = layer3_xgb(siklus_awal, sensor_mean_z=0.3, today=today)
    print(f"\n  Skenario B: Sapi baru 5 hari setelah birahi")
    if result_b:
        print(f"  Confidence: {result_b['confidence']:.3f}")
        if result_b['confidence'] < result_a['confidence'] if result_a else True:
            print(f"  ✅ Confidence lebih rendah dari skenario A — benar!")
        else:
            print(f"  ⚠️  Harusnya lebih rendah dari skenario A")
    else:
        print(f"  ⚠️  Layer 3 return None")

    status = "✅ PASSED" if not errors else f"❌ FAILED ({len(errors)} errors)"
    print(f"\n  Hasil: {status}")
    return len(errors) == 0


# ──────────────────────────────────────────────
# Test 5: Database Integration
# ──────────────────────────────────────────────

async def test_db(rfid: str = "SIM0001", owner_id: int = 1):
    """Test koneksi DB dan cek data sintetis sudah masuk dengan benar."""
    print("\n" + "="*60)
    print("TEST 5: Database Integration")
    print("="*60)

    errors = []

    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print(f"  ✅ Koneksi DB berhasil")
    except Exception as e:
        print(f"  ❌ Koneksi DB gagal: {e}")
        return False

    try:
        # Cek tabel-tabel baru dari migration
        tables = ["siklus_individu", "prediksi_birahi", "notification_log",
                  "populasi_baseline", "ml_training_log", "estrus_label"]
        print(f"\n  📋 Cek tabel migration:")
        for tbl in tables:
            count = await conn.fetchval(f"SELECT COUNT(*) FROM {tbl}")
            print(f"     {tbl:25s}: {count:6d} rows")
            if tbl in ["siklus_individu", "estrus_label"] and count == 0:
                print(f"     ⚠️  {tbl} kosong — jalankan generate_synthetic_data.py dulu!")
                errors.append(f"{tbl}_empty")

        # Cek data sensor sintetis
        print(f"\n  📡 Cek data sensor sintetis:")
        sensor_count = await conn.fetchval(
            "SELECT COUNT(*) FROM sensor_data WHERE collar_id LIKE 'SIM_%'"
        )
        print(f"     sensor_data (sintetis): {sensor_count} rows")

        dist = await conn.fetch("""
            SELECT activity_state, COUNT(*) as cnt
            FROM sensor_data WHERE collar_id LIKE 'SIM_%'
            GROUP BY activity_state ORDER BY cnt DESC
        """)
        for r in dist:
            pct = r['cnt'] / sensor_count * 100 if sensor_count > 0 else 0
            print(f"       {r['activity_state']:12s}: {r['cnt']:5d} ({pct:.1f}%)")

        # Cek profil sapi RFID tertentu
        print(f"\n  🐄 Cek profil sapi {rfid}:")
        hewan = await conn.fetchrow("SELECT * FROM hewan WHERE id = $1", rfid)
        if hewan:
            print(f"     Nama  : {hewan['nama']}")
            print(f"     Jenis : {hewan['jenis']}")
            print(f"     Lahir : {hewan['bulan_tahun_lahir']}")
        else:
            print(f"     ⚠️  Sapi {rfid} tidak ditemukan")
            errors.append("sapi_not_found")

        siklus = await conn.fetchrow("SELECT * FROM siklus_individu WHERE rfid = $1", rfid)
        if siklus:
            print(f"     Rata siklus  : {siklus['rata_siklus_hari']:.1f} hari")
            print(f"     Offset IB    : {siklus['offset_ib_optimal']:+.1f} hari")
            print(f"     Siklus valid : {siklus['jumlah_siklus_valid']}")
            print(f"     Status       : {siklus['status_reproduksi']}")
            print(f"     Last birahi  : {siklus['last_birahi_date']}")
        else:
            print(f"     ⚠️  siklus_individu untuk {rfid} tidak ada")
            errors.append("siklus_not_found")

        # Cek estrus_label count
        label_count = await conn.fetchval(
            "SELECT COUNT(*) FROM estrus_label WHERE owner_id = $1", owner_id
        )
        ml_ready = label_count >= 50
        print(f"\n  🤖 Status ML Layer 3:")
        print(f"     estrus_label count : {label_count}")
        print(f"     Layer 3 aktif?     : {'✅ YA' if ml_ready else f'❌ BELUM (butuh {50-label_count} data lagi)'}")

        # Cek model training log
        ml_log = await conn.fetch("""
            SELECT model_type, model_version, recall_score, accuracy, jumlah_sampel, trained_at
            FROM ml_training_log WHERE is_active = TRUE ORDER BY trained_at DESC
        """)
        print(f"\n  📊 Model Training Log (aktif):")
        if ml_log:
            for r in ml_log:
                print(f"     {r['model_type']:8s} v{r['model_version']}: "
                      f"recall={r['recall_score']:.3f}, acc={r['accuracy']:.3f}, "
                      f"n={r['jumlah_sampel']}, trained={r['trained_at'].strftime('%Y-%m-%d %H:%M')}")
        else:
            print(f"     ⚠️  Belum ada model yang di-retrain")

    except Exception as e:
        print(f"  ❌ DB query error: {e}")
        errors.append(f"query_error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

    status = "✅ PASSED" if not errors else f"❌ FAILED ({len(errors)} errors)"
    print(f"\n  Hasil: {status}")
    return len(errors) == 0


# ──────────────────────────────────────────────
# Test 6: Full Prediction Pipeline (End-to-End)
# ──────────────────────────────────────────────

async def test_full_pipeline(rfid: str = "SIM0001", owner_id: int = 1):
    """Test end-to-end prediction pipeline untuk satu sapi."""
    print("\n" + "="*60)
    print("TEST 6: Full Prediction Pipeline (End-to-End)")
    print("="*60)

    errors = []

    # Load models
    svm_path = os.path.join(MODEL_DIR, "svm_estrus_sensor.joblib")
    xgb_path = os.path.join(MODEL_DIR, "xgb_estrus_historical.joblib")

    from prediction_engine import ModelRegistry, predict_estrus

    if os.path.exists(svm_path) and os.path.exists(xgb_path):
        ModelRegistry.set_models(joblib.load(xgb_path), joblib.load(svm_path))
        print(f"  ✅ Models loaded")
    else:
        print(f"  ⚠️  Model belum ada — test tanpa Layer 2 & 3")

    try:
        conn = await asyncpg.connect(DATABASE_URL)
    except Exception as e:
        print(f"  ❌ DB gagal: {e}")
        return False

    try:
        # Simulasikan sensor window (3 readings terakhir)
        sensor_window_estrus = [
            {"mean_z": 1.8, "rms_z": 2.2, "max_z": 4.0, "temperature": 39.8},
            {"mean_z": 2.0, "rms_z": 2.4, "max_z": 4.3, "temperature": 40.0},
            {"mean_z": 1.6, "rms_z": 2.0, "max_z": 3.7, "temperature": 39.6},
        ]

        sensor_window_normal = [
            {"mean_z": 0.3, "rms_z": 0.4, "max_z": 0.8, "temperature": 38.4},
            {"mean_z": 0.4, "rms_z": 0.5, "max_z": 0.9, "temperature": 38.3},
        ]

        print(f"\n  🐄 Prediksi untuk sapi: {rfid}")

        # Test 1: Dengan sensor estrus
        print(f"\n  --- Dengan sensor estrus aktif ---")
        result_estrus = await predict_estrus(
            conn, rfid, owner_id,
            sensor_window=sensor_window_estrus,
        )
        _print_prediction_result(result_estrus)

        # Test 2: Tanpa sensor (sapi tanpa collar)
        print(f"\n  --- Tanpa sensor (no collar) ---")
        result_no_sensor = await predict_estrus(
            conn, rfid, owner_id,
            sensor_window=None,
        )
        _print_prediction_result(result_no_sensor)

        # Validasi logika
        if result_estrus["prediksi_tanggal"] is None:
            print(f"\n  ⚠️  Tidak ada prediksi — pastikan sapi {rfid} punya data di siklus_individu")
            errors.append("no_prediction")
        else:
            print(f"\n  ✅ Prediksi berhasil digenerate!")

            # Confidence dengan sensor harus >= tanpa sensor
            if result_estrus["confidence_final"] >= result_no_sensor["confidence_final"]:
                print(f"  ✅ Confidence dengan sensor ({result_estrus['confidence_final']:.3f}) "
                      f">= tanpa sensor ({result_no_sensor['confidence_final']:.3f}) — benar!")
            else:
                print(f"  ⚠️  Confidence dengan sensor ({result_estrus['confidence_final']:.3f}) "
                      f"< tanpa sensor ({result_no_sensor['confidence_final']:.3f}) — periksa bobot layer")

    except Exception as e:
        print(f"  ❌ Error: {e}")
        errors.append(str(e))
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

    status = "✅ PASSED" if not errors else f"❌ FAILED ({len(errors)} errors)"
    print(f"\n  Hasil: {status}")
    return len(errors) == 0


def _print_prediction_result(result: dict):
    """Helper untuk print hasil prediksi dengan rapi."""
    if result.get("prediksi_tanggal"):
        hari_ke = (result["prediksi_tanggal"] - date.today()).days
        print(f"  Prediksi birahi  : {result['prediksi_tanggal']} ({'+' if hari_ke >= 0 else ''}{hari_ke} hari)")
        print(f"  IB optimal       : {result['prediksi_ib_optimal']}")
        print(f"  Window           : {result['window_awal']} → {result['window_akhir']}")
        print(f"  Confidence final : {result['confidence_final']:.3f} {'🔴 ESTRUS NOW' if result['is_estrus_now'] else ''}")
        print(f"  Metode           : {result['metode']}")
        print(f"  Notify?          : {'🔔 YA — ' + result['notif_tipe'] if result['should_notify'] else 'Tidak'}")

        layers = result.get("layer_details", {})
        l1 = layers.get("layer1", {})
        l2 = layers.get("layer2")
        l3 = layers.get("layer3")
        print(f"  Layer 1 (calendar): {l1.get('confidence', 0):.3f} [{l1.get('metode_detail', '-')}]")
        print(f"  Layer 2 (sensor)  : {l2['confidence']:.3f} {l2.get('anomali_flags',[])} " if l2 else "  Layer 2 (sensor)  : N/A (no collar)")
        print(f"  Layer 3 (xgboost) : {l3['confidence']:.3f}" if l3 else "  Layer 3 (xgboost) : N/A (data belum cukup)")
    else:
        print(f"  Prediksi         : Tidak tersedia (tidak ada histori birahi)")


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

async def run_all_tests(rfid: str, owner_id: int, test_filter: str):
    results = {}

    if test_filter in ("all", "model"):
        results["model"] = test_model_load()

    if test_filter in ("all", "layer1"):
        results["layer1"] = test_layer1()

    if test_filter in ("all", "layer2"):
        results["layer2"] = test_layer2()

    if test_filter in ("all", "layer3"):
        results["layer3"] = test_layer3()

    if test_filter in ("all", "db"):
        results["db"] = await test_db(rfid, owner_id)

    if test_filter in ("all", "full"):
        results["full"] = await test_full_pipeline(rfid, owner_id)

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    passed = sum(1 for v in results.values() if v)
    total  = len(results)
    for name, ok in results.items():
        print(f"  {'✅' if ok else '❌'} {name}")
    print(f"\n  {passed}/{total} tests passed")

    if passed == total:
        print("\n  🎉 Semua test lulus! Sistem siap deploy.")
    else:
        print("\n  ⚠️  Ada test yang gagal. Cek error di atas.")
        print("     Tips: Jalankan generate_synthetic_data.py dulu kalau data belum ada.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test prediction engine HERD")
    parser.add_argument("--test",     default="all",
                        choices=["all","model","layer1","layer2","layer3","db","full"])
    parser.add_argument("--rfid",     default="SIM0001", help="RFID sapi untuk test DB & full pipeline")
    parser.add_argument("--owner-id", type=int, default=1)
    args = parser.parse_args()

    asyncio.run(run_all_tests(args.rfid, args.owner_id, args.test))
