// src/lib/i18n.js
// Dual Language System — Hectra (MP-3 Final)

const translations = {
  en: {
    // Navigation
    nav_dashboard:      'Dashboard',
    nav_live_signals:   'Live Signals',
    nav_estrus_intel:   'Estrus Intelligence',
    nav_herd_analytics: 'Herd Analytics',
    nav_livestock:      'Livestock Registry',
    nav_recommendations:'Recommendations',
    nav_alerts:         'Live Alerts',
    nav_settings:       'Settings',
    nav_gendhis_eye:    "Gendhis's Eye",
    nav_iot_manager:    'IoT Manager',
    nav_data_mgmt:      'Data Management',
    nav_repro_records:  'Reproduction Records',

    // Hero
    hero_eyebrow:       'Herd Intelligence — Active Monitoring',
    hero_status_stable: 'Herd Status: ',
    hero_status_word:   'Stable',
    hero_sub:           '2 reproductive anomalies detected today. AI confidence improved 4% this week.',
    hero_last_sync:     'Last sync',
    hero_collars_online:'collars online',
    hero_ai_conf:       'AI Conf.',
    hero_gendhis_active:'Gendhis Active',
    hero_model:         'Hybrid AI v2',

    // Stats
    stat_active_collars:   'Active Collars',
    stat_estrus_signals:   'Estrus Signals',
    stat_avg_temp:         'Avg. Temperature',
    stat_breeding_windows: 'Breeding Windows',
    stat_all_online:       'All online',
    stat_normal_range:     'Normal range',
    stat_trend_up:         '+1 from yesterday',
    stat_next_window:      'Next: 6h',

    // Sections
    section_quick_actions:  'Quick Actions',
    section_herd_status:    'Herd Status',
    section_repro_intel:    'Live Alerts & Recommendations',
    section_view_all:       'View all',
    section_see_all:        'See all',

    // Quick actions
    qa_scan_rfid:       'Scan RFID',
    qa_add_ib:          'Add IB Record',
    qa_run_prediction:  'Run Prediction',
    qa_export:          'Export Report',

    // Status labels
    status_normal:    'Normal',
    status_estrus:    'Estrus',
    status_pre_estrus:'Pre-Estrus',
    status_pregnant:  'Pregnant',
    status_critical:  'Critical',
    status_monitor:   'Monitor',
    status_scheduled: 'Scheduled',

    // Herd status
    herd_normal:  'Normal',
    herd_estrus:  'Estrus',
    herd_monitor: 'Monitor',

    // Intel cards
    intel_critical_badge: 'CRITICAL',
    intel_monitor_badge:  'MONITOR',
    intel_sched_badge:    'SCHEDULED',

    // System
    sys_operational: 'All Systems Operational',
    sys_dark_mode:   'Dark Mode',
    sys_light_mode:  'Light Mode',
  },

  id: {
    // Navigation
    nav_dashboard:      'Dashboard',
    nav_live_signals:   'Sinyal Langsung',
    nav_estrus_intel:   'Intelijen Estrus',
    nav_herd_analytics: 'Analitik Ternak',
    nav_livestock:      'Registri Ternak',
    nav_recommendations:'Rekomendasi',
    nav_alerts:         'Peringatan Live',
    nav_settings:       'Pengaturan',
    nav_gendhis_eye:    "Mata Gendhis",
    nav_iot_manager:    'Manajer IoT',
    nav_data_mgmt:      'Manajemen Data',
    nav_repro_records:  'Riwayat Reproduksi',

    // Hero
    hero_eyebrow:       'Intelijen Ternak — Pemantauan Aktif',
    hero_status_stable: 'Status Kandang: ',
    hero_status_word:   'Stabil',
    hero_sub:           '2 anomali reproduksi terdeteksi hari ini. Akurasi AI meningkat 4% minggu ini.',
    hero_last_sync:     'Sinkronisasi',
    hero_collars_online:'kalung aktif',
    hero_ai_conf:       'Akurasi AI',
    hero_gendhis_active:'Gendhis Aktif',
    hero_model:         '1.0.0',

    // Stats
    stat_active_collars:   'Kalung Aktif',
    stat_estrus_signals:   'Sinyal Estrus',
    stat_avg_temp:         'Suhu Rata-rata',
    stat_breeding_windows: 'Jendela IB',
    stat_all_online:       'Semua online',
    stat_normal_range:     'Rentang normal',
    stat_trend_up:         '+1 dari kemarin',
    stat_next_window:      'Berikut: 6j',

    // Sections
    section_quick_actions:  'Aksi Cepat',
    section_herd_status:    'Status Ternak',
    section_repro_intel:    'Peringatan & Rekomendasi Live',
    section_view_all:       'Lihat semua',
    section_see_all:        'Lihat semua',

    // Quick actions
    qa_scan_rfid:       'Scan RFID',
    qa_add_ib:          'Tambah Data IB',
    qa_run_prediction:  'Jalankan Prediksi',
    qa_export:          'Ekspor Laporan',

    // Status labels
    status_normal:    'Normal',
    status_estrus:    'Estrus',
    status_pre_estrus:'Pre-Estrus',
    status_pregnant:  'Hamil',
    status_critical:  'Kritis',
    status_monitor:   'Pantau',
    status_scheduled: 'Terjadwal',

    // Herd status
    herd_normal:  'Normal',
    herd_estrus:  'Estrus',
    herd_monitor: 'Pantau',

    // Intel cards
    intel_critical_badge: 'KRITIS',
    intel_monitor_badge:  'PANTAU',
    intel_sched_badge:    'TERJADWAL',

    // System
    sys_operational: 'Semua Sistem Aktif',
    sys_dark_mode:   'Mode Gelap',
    sys_light_mode:  'Mode Terang',
  }
};

export default translations;
