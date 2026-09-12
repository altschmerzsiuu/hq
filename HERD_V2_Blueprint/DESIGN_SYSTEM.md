# HERD - Design System & UI/UX Guidelines

Dokumen ini berisi panduan desain (Design System) untuk melakukan *revamp* (perombakan) layout UI/UX HERD versi berikutnya agar terlihat lebih bersih, rapi, dan modular layaknya aplikasi SaaS (Software as a Service) kelas enterprise.

## 1. Konsep Visual Utama (Aesthetic)
*   **Vibe:** Premium, Modern, *Clean*, Data-Driven.
*   **Tema Mode:** Mendukung **Dark Mode** (dominan) dan Light Mode yang bersih. Dark mode memberikan kesan eksklusif dan menonjolkan grafik/data sensor.
*   **Efek Visual:** Menggunakan sentuhan *Glassmorphism* (panel semi-transparan dengan *blur* di latar belakang) secara tipis untuk kesan modern tanpa membuat UI terasa berat.

## 2. Palet Warna (Color Palette)
*   **Primary (Brand):** **Forest Green** (`#1A2E26` atau gradasinya). Warna ini mewakili *agriculture*, alam, dan ketenangan.
*   **Accent/Highlight:** **Soft Gold** (`#C9963A`). Digunakan untuk tombol utama (Call to Action), *badges* (lencana premium), dan indikator peringatan penting. Emas melambangkan nilai tinggi dari ternak bersertifikat.
*   **Background (Dark Mode):** Hitam keabuan pekat (`#0D1117` atau `#121212`) agar mata peternak tidak sakit saat melihat data di malam hari.
*   **Danger/Alert:** Merah terang (`#EF4444`) khusus untuk peringatan darurat seperti sapi sakit atau estrus.

## 3. Tipografi (Typography)
Untuk kesan modern dan bersih, jangan gunakan font default browser.
*   **Primary Font:** **Inter** atau **Roboto**. Font *sans-serif* yang sangat mudah dibaca untuk angka dan tabel data.
*   **Heading Font:** **Outfit** atau **Plus Jakarta Sans** untuk judul halaman yang memberikan kesan *friendly* tapi tetap profesional.

## 4. Struktur Layout Modular (Information Architecture)
Alih-alih menggunakan satu halaman panjang yang penuh (*monolithic*), HERD v2.0 akan menggunakan arsitektur **Card/Widget Based**.

### A. Dashboard Utama (Home)
*   Bukan lagi menampilkan data spesifik satu jenis hewan.
*   Terdiri dari **Widget Grid**. Peternak bisa menyusun widget (misal: Widget Peringatan Birahi, Widget Kematian, Widget Sapi Siap Jual).

### B. Halaman Profil Ternak (Animal Detail)
*   **Header:** Foto bulat berkualitas tinggi, Nama, ID RFID, dan Label Status (Sehat/Sakit).
*   **Navigasi (Tabs):** Overview, Timeline (Riwayat Hidup), dan *Modules*.
*   **Konten (Grid Cards):** 
    *   Setiap Modul (contoh: Sensor IoT, Reproduksi, Silsilah) akan di-*render* ke dalam satu Kotak (Card) tersendiri. 
    *   Jika modul tidak di-install, kotak tersebut otomatis tidak muncul. Ruang akan tetap bersih.

## 5. Komponen Kunci
*   **Tombol SCAN (FAB):** Floating Action Button di tengah bawah layar harus tetap dipertahankan. Ini adalah nyawa interaksi cepat di lapangan.
*   **Empty States:** Jika sebuah kandang kosong atau tidak ada data, gunakan ilustrasi vektor yang cantik dan beri tombol *"Tambah Hewan Pertama Anda"*.
*   **Micro-interactions:** Beri animasi ringan saat grafik sensor dimuat atau saat menekan tombol "Benar, Sudah" agar aplikasi terasa *alive* dan responsif.
