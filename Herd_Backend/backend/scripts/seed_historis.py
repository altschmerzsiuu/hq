"""
seed_historis.py
================
Script untuk bulk import data historis sapi dari papan tulis ke database.

Cara pakai:
1. Isi CSV sesuai template di bawah
2. Jalankan: python seed_historis.py --file data_sapi.csv --owner-id 1

Format CSV yang diharapkan (lihat template di bawah):
- Satu baris = satu SIKLUS reproduksi sapi
- Kolom yang kosong bisa dikosongkan (akan jadi NULL)
"""

import asyncio
import asyncpg
import csv
import json
import argparse
import os
import sys
from datetime import date, datetime, timedelta
from typing import Optional


# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/iot_peternakan")

# Mapping jenis sapi ke prior siklus dari literatur ilmiah
PRIOR_SIKLUS = {
    "limousin":   {"rata": 21.0, "std": 1.8, "offset": 0.0},
    "simental":   {"rata": 21.0, "std": 2.0, "offset": 0.0},
    "simmental":  {"rata": 21.0, "std": 2.0, "offset": 0.0},
    "fh":         {"rata": 21.0, "std": 2.2, "offset": 0.5},
    "brahman":    {"rata": 21.0, "std": 2.5, "offset": 0.0},
    "bali":       {"rata": 20.5, "std": 1.5, "offset": 0.0},
    "default":    {"rata": 21.0, "std": 2.5, "offset": 0.0},
}


# ──────────────────────────────────────────────
# Date parsing helper
# ──────────────────────────────────────────────

def parse_date(val: str) -> Optional[date]:
    """Parse tanggal dari berbagai format: dd/mm/yyyy, yyyy-mm-dd, atau kosong."""
    if not val or val.strip() in ("-", "", "?", "unknown"):
        return None
    val = val.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    print(f"  ⚠️  Tidak bisa parse tanggal: '{val}' — diisi NULL")
    return None


def parse_int(val: str) -> Optional[int]:
    try:
        return int(val.strip())
    except (ValueError, AttributeError):
        return None


def parse_float(val: str) -> Optional[float]:
    try:
        return float(val.strip())
    except (ValueError, AttributeError):
        return None


def parse_jam(val: str) -> Optional[int]:
    """Parse jam birahi dari string seperti '02.00', '14:30', '9', '21.30'."""
    if not val or val.strip() in ("-", "", "?"):
        return None
    val = val.strip().replace(".", ":").replace(",", ":")
    try:
        if ":" in val:
            hour = int(val.split(":")[0])
        else:
            hour = int(val)
        return hour if 0 <= hour <= 23 else None
    except ValueError:
        return None


# ──────────────────────────────────────────────
# Kalkulasi derived fields
# ──────────────────────────────────────────────

def hitung_bunting_hpl(tanggal_birahi: Optional[date]) -> tuple[Optional[date], Optional[date]]:
    """Hitung bunting (birahi + 3 bulan) dan HPL (bunting + 9 bulan 10 hari)."""
    if not tanggal_birahi:
        return None, None
    # Gunakan relativedelta kalau ada, fallback ke timedelta
    try:
        from dateutil.relativedelta import relativedelta
        bunting = tanggal_birahi + relativedelta(months=3)
        hpl     = bunting + relativedelta(months=9) + timedelta(days=10)
    except ImportError:
        bunting = tanggal_birahi + timedelta(days=90)
        hpl     = bunting + timedelta(days=280)
    return bunting, hpl


def hitung_siklus(riwayat_birahi: list[date]) -> dict:
    """
    Hitung rata-rata dan std panjang siklus dari daftar tanggal birahi.
    Butuh minimal 2 data untuk hitung siklus.
    """
    if len(riwayat_birahi) < 2:
        return {"rata": None, "std": None, "n": len(riwayat_birahi)}

    riwayat_sorted = sorted(riwayat_birahi)
    intervals = [
        (riwayat_sorted[i+1] - riwayat_sorted[i]).days
        for i in range(len(riwayat_sorted) - 1)
        if 15 <= (riwayat_sorted[i+1] - riwayat_sorted[i]).days <= 35  # Filter outlier
    ]

    if not intervals:
        return {"rata": None, "std": None, "n": 0}

    rata = sum(intervals) / len(intervals)
    if len(intervals) > 1:
        variance = sum((x - rata) ** 2 for x in intervals) / (len(intervals) - 1)
        std = variance ** 0.5
    else:
        std = 2.5  # Default std kalau cuma 1 interval

    return {"rata": round(rata, 2), "std": round(std, 2), "n": len(intervals)}


def hitung_offset_ib(riwayat: list[dict]) -> Optional[float]:
    """
    Hitung offset IB optimal dari riwayat yang sudah ada hasilnya (bunting=berhasil).
    offset = tanggal_ib - tanggal_birahi (dalam hari)
    """
    offsets = []
    for r in riwayat:
        if r.get("tanggal_birahi") and r.get("tanggal_ib") and r.get("bunting"):
            delta = (r["tanggal_ib"] - r["tanggal_birahi"]).days
            if -5 <= delta <= 10:  # Sanity check range yang masuk akal
                offsets.append(delta)

    if not offsets:
        return None
    return round(sum(offsets) / len(offsets), 2)


# ──────────────────────────────────────────────
# Main seeder
# ──────────────────────────────────────────────

async def seed(csv_file: str, owner_id: int, dry_run: bool = False):
    conn = await asyncpg.connect(DATABASE_URL)
    print(f"\n{'[DRY RUN] ' if dry_run else ''}🚀 Mulai seeding dari: {csv_file}")
    print(f"   Owner ID: {owner_id}\n")

    # Baca CSV
    with open(csv_file, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows   = list(reader)

    print(f"📋 Total baris ditemukan: {len(rows)}\n")

    # Kelompokkan per RFID
    sapi_dict: dict[str, list[dict]] = {}
    for row in rows:
        rfid = row.get("rfid", "").strip().upper()
        if not rfid:
            print(f"  ⚠️  Skip baris tanpa RFID: {row}")
            continue
        if rfid not in sapi_dict:
            sapi_dict[rfid] = []
        sapi_dict[rfid].append(row)

    print(f"🐄 Ditemukan {len(sapi_dict)} sapi unik\n")
    print("=" * 60)

    hasil = {"berhasil": 0, "skip": 0, "error": 0}

    for rfid, riwayat_rows in sapi_dict.items():
        print(f"\n🔖 Processing sapi: {rfid} ({len(riwayat_rows)} siklus)")

        try:
            # ── 1. Cek / buat profil hewan ──────────────────────────
            existing_hewan = await conn.fetchrow(
                "SELECT id, nama, jenis FROM hewan WHERE UPPER(id) = $1 AND owner_id = $2",
                rfid, owner_id
            )

            sample_row = riwayat_rows[0]
            nama  = sample_row.get("nama", "").strip() or f"Sapi {rfid}"
            jenis = sample_row.get("jenis", "").strip() or "Unknown"
            tgl_lahir_raw = sample_row.get("tanggal_lahir", "").strip()
            tgl_lahir     = parse_date(tgl_lahir_raw)

            if not existing_hewan:
                if not tgl_lahir:
                    print(f"  ⚠️  Sapi {rfid} tidak ada di DB dan tanggal lahir kosong — skip")
                    hasil["skip"] += 1
                    continue

                if not dry_run:
                    await conn.execute("""
                        INSERT INTO hewan (id, nama, jenis, bulan_tahun_lahir, status_kesehatan, owner_id)
                        VALUES ($1, $2, $3, $4, 'Sehat', $5)
                        ON CONFLICT (id) DO NOTHING
                    """, rfid, nama, jenis, tgl_lahir_raw, owner_id)

                print(f"  ✅ Buat profil hewan baru: {nama} ({jenis})")
            else:
                print(f"  ℹ️  Hewan sudah ada: {existing_hewan['nama']}")

            # ── 2. Insert riwayat reproduksi ─────────────────────────
            riwayat_parsed = []
            for i, row in enumerate(riwayat_rows, 1):
                tgl_birahi  = parse_date(row.get("tanggal_birahi", ""))
                tgl_ib      = parse_date(row.get("tanggal_ib", ""))
                tgl_bunting = parse_date(row.get("tanggal_bunting", ""))
                tgl_lahir_anak = parse_date(row.get("tanggal_lahir_anak", ""))
                tgl_sapih   = parse_date(row.get("tanggal_sapih", ""))
                tgl_hpl     = parse_date(row.get("hpl", ""))
                pemberi_ib  = row.get("pemberi_ib", "").strip() or None
                jumlah_ib   = parse_int(row.get("jumlah_ib", ""))
                jam_birahi  = parse_jam(row.get("jam_birahi", ""))
                catatan     = row.get("catatan", "").strip() or None
                offset_manual = parse_float(row.get("offset_ib_hari", ""))

                # Auto-hitung bunting & HPL kalau kosong tapi ada birahi
                if tgl_birahi and not tgl_bunting and not tgl_hpl:
                    tgl_bunting, tgl_hpl = hitung_bunting_hpl(tgl_birahi)
                    print(f"    📐 Siklus {i}: Auto-hitung bunting={tgl_bunting}, HPL={tgl_hpl}")

                if not dry_run and (tgl_ib or tgl_birahi):
                    # Cek duplikat sebelum insert
                    dup = await conn.fetchrow("""
                        SELECT id FROM reproduksi_ternak
                        WHERE rfid = $1
                          AND (tanggal_ib = $2 OR (tanggal_ib IS NULL AND $2 IS NULL))
                          AND (birahi = $3 OR (birahi IS NULL AND $3 IS NULL))
                    """, rfid, tgl_ib, tgl_birahi)

                    if not dup:
                        row_id = await conn.fetchval("""
                            INSERT INTO reproduksi_ternak
                                (rfid, tanggal_ib, pemberi_ib, jumlah_ib, birahi, bunting, hpl, sapih, catatan)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            RETURNING id
                        """, rfid, tgl_ib, pemberi_ib, jumlah_ib,
                             tgl_birahi, tgl_bunting, tgl_hpl, tgl_sapih, catatan)
                        print(f"    ✅ Siklus {i}: INSERT reproduksi_ternak (id={row_id})")
                    else:
                        print(f"    ℹ️  Siklus {i}: Duplikat, skip")

                riwayat_parsed.append({
                    "tanggal_birahi": tgl_birahi,
                    "tanggal_ib":     tgl_ib,
                    "bunting":        tgl_bunting,
                    "jam_birahi":     jam_birahi,
                    "offset_manual":  offset_manual,
                })

            # ── 3. Hitung & upsert siklus_individu ──────────────────
            tanggal_birahi_list = [
                r["tanggal_birahi"] for r in riwayat_parsed if r["tanggal_birahi"]
            ]
            stat_siklus  = hitung_siklus(tanggal_birahi_list)
            offset_hitung = hitung_offset_ib(riwayat_parsed)

            # Offset: prioritaskan manual dari CSV, fallback ke hitung otomatis
            offsets_manual = [r["offset_manual"] for r in riwayat_parsed if r["offset_manual"] is not None]
            offset_final   = (sum(offsets_manual) / len(offsets_manual)) if offsets_manual else offset_hitung

            # Jam birahi dominan
            jam_list = [r["jam_birahi"] for r in riwayat_parsed if r["jam_birahi"] is not None]
            jam_dominan = round(sum(jam_list) / len(jam_list)) if jam_list else None

            # Status reproduksi
            jumlah_siklus_valid = len([r for r in riwayat_parsed if r.get("bunting")])
            status_repro = "active" if jumlah_siklus_valid > 0 else "virgin"

            # Prior dari jenis sapi (untuk sapi yang datanya belum cukup)
            jenis_key = jenis.lower().replace(" ", "")
            prior = PRIOR_SIKLUS.get(jenis_key, PRIOR_SIKLUS["default"])

            # Kalau data siklus cukup, pakai data aktual. Kalau tidak, pakai prior
            rata_siklus_final = stat_siklus["rata"] or prior["rata"]
            std_siklus_final  = stat_siklus["std"]  or prior["std"]
            offset_confidence = min(1.0, jumlah_siklus_valid / 5.0)  # Max confidence di 5 siklus

            last_birahi = max(tanggal_birahi_list) if tanggal_birahi_list else None
            last_ib_list = [r["tanggal_ib"] for r in riwayat_parsed if r["tanggal_ib"]]
            last_ib      = max(last_ib_list) if last_ib_list else None

            print(f"\n  📊 Profil siklus individu:")
            print(f"     Rata siklus  : {rata_siklus_final:.1f} hari (dari {stat_siklus['n']} interval)")
            print(f"     Std siklus   : {std_siklus_final:.1f} hari")
            print(f"     Offset IB    : {offset_final} hari")
            print(f"     Jam dominan  : {jam_dominan}:00")
            print(f"     Siklus valid : {jumlah_siklus_valid}")
            print(f"     Status       : {status_repro}")
            print(f"     Confidence   : {offset_confidence:.2f}")

            if not dry_run:
                await conn.execute("""
                    INSERT INTO siklus_individu (
                        rfid, owner_id,
                        rata_siklus_hari, std_siklus_hari, jumlah_siklus_valid,
                        offset_ib_optimal, offset_confidence,
                        jam_birahi_dominan,
                        status_reproduksi,
                        last_birahi_date, last_ib_date
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (rfid) DO UPDATE SET
                        rata_siklus_hari    = EXCLUDED.rata_siklus_hari,
                        std_siklus_hari     = EXCLUDED.std_siklus_hari,
                        jumlah_siklus_valid = EXCLUDED.jumlah_siklus_valid,
                        offset_ib_optimal   = EXCLUDED.offset_ib_optimal,
                        offset_confidence   = EXCLUDED.offset_confidence,
                        jam_birahi_dominan  = EXCLUDED.jam_birahi_dominan,
                        status_reproduksi   = EXCLUDED.status_reproduksi,
                        last_birahi_date    = EXCLUDED.last_birahi_date,
                        last_ib_date        = EXCLUDED.last_ib_date,
                        updated_at          = CURRENT_TIMESTAMP
                """,
                    rfid, owner_id,
                    rata_siklus_final, std_siklus_final, jumlah_siklus_valid,
                    offset_final or prior["offset"], offset_confidence,
                    jam_dominan,
                    status_repro,
                    last_birahi, last_ib
                )
                print(f"  ✅ siklus_individu upserted")

            # ── 4. Generate prediksi awal ────────────────────────────
            if last_birahi:
                prediksi_tgl = last_birahi + timedelta(days=rata_siklus_final)
                offset_days  = timedelta(days=abs(offset_final or 0))
                prediksi_ib  = prediksi_tgl + timedelta(days=(offset_final or 0))
                window_awal  = prediksi_tgl - timedelta(days=std_siklus_final * 1.5)
                window_akhir = prediksi_tgl + timedelta(days=std_siklus_final * 1.5)

                # Confidence Layer 1: makin banyak data, makin tinggi
                conf_l1 = min(0.85, 0.4 + (jumlah_siklus_valid * 0.1))

                if not dry_run and prediksi_tgl >= date.today():
                    await conn.execute("""
                        INSERT INTO prediksi_birahi (
                            rfid, owner_id,
                            prediksi_tanggal, prediksi_ib_optimal,
                            window_awal, window_akhir,
                            confidence_layer1, confidence_final,
                            metode, status
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'calendar_only', 'active')
                        ON CONFLICT DO NOTHING
                    """,
                        rfid, owner_id,
                        prediksi_tgl, prediksi_ib,
                        window_awal, window_akhir,
                        conf_l1, conf_l1
                    )
                    print(f"  🔮 Prediksi birahi: {prediksi_tgl} (IB optimal: {prediksi_ib})")
                elif prediksi_tgl < date.today():
                    print(f"  ℹ️  Prediksi {prediksi_tgl} sudah lewat, skip insert")

            # ── 5. Insert estrus_label untuk training data ───────────
            for row_parsed in riwayat_parsed:
                if row_parsed["tanggal_birahi"] and row_parsed["bunting"]:
                    features_historis = {
                        "jenis_sapi":    jenis,
                        "offset_ib":     (row_parsed["tanggal_ib"] - row_parsed["tanggal_birahi"]).days
                                         if row_parsed["tanggal_ib"] and row_parsed["tanggal_birahi"] else None,
                        "jam_birahi":    row_parsed["jam_birahi"],
                    }
                    if not dry_run:
                        await conn.execute("""
                            INSERT INTO estrus_label (
                                rfid, owner_id,
                                tanggal_birahi_aktual, jam_birahi_aktual,
                                label_estrus,
                                features_historis,
                                sumber_label, catatan
                            ) VALUES ($1, $2, $3, $4, TRUE, $5, 'auto', 'Import historis papan tulis')
                            ON CONFLICT DO NOTHING
                        """,
                            rfid, owner_id,
                            row_parsed["tanggal_birahi"],
                            row_parsed["jam_birahi"],
                            json.dumps(features_historis)
                        )
                        print(f"  🏷️  estrus_label inserted (birahi: {row_parsed['tanggal_birahi']})")

            hasil["berhasil"] += 1

        except Exception as e:
            print(f"  ❌ ERROR pada sapi {rfid}: {e}")
            hasil["error"] += 1
            import traceback
            traceback.print_exc()

    # ── 6. Update populasi_baseline per jenis sapi ──────────────
    print("\n\n📊 Update populasi_baseline per jenis sapi...")
    if not dry_run:
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
        print("  ✅ populasi_baseline updated")

    await conn.close()

    print("\n" + "=" * 60)
    print(f"✅ Selesai! Berhasil: {hasil['berhasil']} | Skip: {hasil['skip']} | Error: {hasil['error']}")
    if dry_run:
        print("ℹ️  [DRY RUN] Tidak ada data yang benar-benar diinsert.")


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed data historis sapi dari CSV ke database")
    parser.add_argument("--file",     required=True, help="Path ke file CSV")
    parser.add_argument("--owner-id", required=True, type=int, help="ID owner/peternak di tabel users")
    parser.add_argument("--dry-run",  action="store_true", help="Preview tanpa insert ke DB")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"❌ File tidak ditemukan: {args.file}")
        sys.exit(1)

    asyncio.run(seed(args.file, args.owner_id, args.dry_run))
