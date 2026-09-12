# HERD - Laporan Modul Sapi (Cow Modules Blueprint)

Dokumen ini berisi daftar modul yang relevan untuk dikembangkan khusus untuk spesies Sapi (Cattle). Pembagian ini memastikan bahwa sistem HERD tetap modular dan peternak hanya membayar/mengaktifkan fitur yang benar-benar mereka butuhkan sesuai jenis sapi yang mereka pelihara (Sapi Perah vs Sapi Potong).

## 1. Modul Wajib / Universal (Untuk Semua Sapi)
Modul-modul ini sangat direkomendasikan untuk **semua jenis sapi** karena memberikan fundamental pencatatan yang baik.

### A. Modul Silsilah & Genetika (Pedigree Tracker)
*   **Target Sapi:** Semua (Perah, Potong, Breeding).
*   **Fungsi Utama:** Melacak pohon keluarga (Bapak/Induk), mencegah *inbreeding* (kawin sedarah), dan meningkatkan nilai jual sapi bersertifikat keturunan.
*   **Hardware:** Murni Software.

### B. Modul Kesehatan Preventif (Checklist & Vaksinasi)
*   **Target Sapi:** Semua.
*   **Fungsi Utama:** Pengingat jadwal vaksin (PMK, LSD, Brucellosis), pemberian obat cacing rutin, dan pencatatan riwayat medis/dokter hewan.
*   **Hardware:** Murni Software.

---

## 2. Modul Spesifik Sapi Betina / Breeding (Sapi Perah & Indukan)

### A. Modul Deteksi Birahi & Reproduksi (Estrus Hybrid AI)
*   **Target Sapi:** Sapi Betina (Indukan Sapi Potong & Sapi Perah).
*   **Fungsi Utama:** Mendeteksi waktu optimal Inseminasi Buatan (IB), mencatat siklus 21 hari, mencatat riwayat kawin, kebuntingan, dan Hari Perkiraan Lahir (HPL).
*   **Hardware:** Opsional. Software Only (Kalender) atau dipadukan dengan IoT Collar (Akurasi Tinggi).
*   *Catatan:* Ini adalah modul unggulan HERD saat ini!

### B. Modul Produksi Susu (Lactation Tracker)
*   **Target Sapi:** Sapi Perah (Dairy Cows).
*   **Fungsi Utama:** Mencatat volume perahan susu (liter/hari), melacak tren laktasi per siklus, dan memprediksi masa kering (dry period).
*   **Hardware:** Murni Software (Input manual atau integrasi sensor tangki perah).

---

## 3. Modul Spesifik Sapi Potong (Feedlot)

### A. Modul Pertumbuhan & Pakan (Growth & Feed Tracker)
*   **Target Sapi:** Sapi Potong/Pedaging (Brahman, Limousin, dll).
*   **Fungsi Utama:** Melacak kenaikan Bobot Badan Harian (ADG - Average Daily Gain), mencatat komposisi ransum pakan, dan menghitung estimasi biaya pakan vs harga jual (Margin Profit).
*   **Hardware:** Murni Software (Input hasil timbangan).

### B. Modul Perencanaan Panen (Harvest / Qurban Planner)
*   **Target Sapi:** Sapi Potong (Terutama pasar lokal Indonesia).
*   **Fungsi Utama:** Menghitung mundur (countdown) target bobot sapi untuk event tertentu seperti Hari Raya Idul Adha agar sapi mencapai harga jual maksimal.

---

## Kesimpulan
Untuk pengembangan HERD ke depan (v2.0), prioritas modul yang harus dipertahankan dan disempurnakan adalah **Modul Reproduksi & Deteksi Birahi**, disusul dengan **Modul Silsilah (Pedigree)** karena ini memberikan nilai tambah finansial (ROI) yang paling cepat dan terlihat bagi peternak lokal.
