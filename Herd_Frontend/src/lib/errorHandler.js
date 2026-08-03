/**
 * HERD Dashboard — Centralized Error Handler
 * 
 * All errors across the app pass through here.
 * Users see friendly Bahasa Indonesia messages.
 * Developers see full technical details in the console.
 */

import { toast } from '@/store/toastStore';

/**
 * Map an HTTP status code or error type to a user-friendly message.
 */
function mapErrorToMessage(err) {
  const status = err?.response?.status;
  const isNetwork =
    err?.message?.includes('Network Error') ||
    err?.code === 'ERR_NETWORK' ||
    err?.code === 'ECONNABORTED' ||
    !err?.response;

  // ── Network / Timeout ──────────────────────────────────────────────
  if (isNetwork || err?.code === 'ERR_CANCELED') {
    return {
      title: 'Tidak ada koneksi internet',
      description: 'Gagal terhubung ke server. Mohon periksa jaringan WiFi atau Data Seluler Anda, lalu coba lagi.',
    };
  }

  // ── HTTP Status Codes ──────────────────────────────────────────────
  switch (status) {
    case 400:
      return {
        title: 'Permintaan tidak valid',
        description: 'Format data yang Anda kirim salah atau tidak lengkap. Cek kembali isian formulir Anda.',
      };

    case 401:
      return {
        title: 'Sesi Anda telah berakhir',
        description: 'Sistem membutuhkan otorisasi ulang. Silakan login kembali untuk melanjutkan.',
      };

    case 403:
      return {
        title: 'Akses ditolak',
        description: 'Anda tidak memiliki hak akses (admin) untuk melakukan tindakan ini.',
      };

    case 404:
      return {
        title: 'Data tidak ditemukan',
        description: 'Informasi atau halaman yang Anda cari tidak tersedia. Mungkin sudah dihapus atau dipindahkan.',
      };

    case 409:
      return {
        title: 'Email sudah terdaftar',
        description: 'Email yang Anda masukkan sudah digunakan. Silakan langsung Login atau gunakan email lain.',
      };

    case 422:
      return {
        title: 'Beberapa data belum lengkap',
        description: 'Sistem menolak penyimpanan karena ada isian (seperti foto atau teks) yang belum lengkap atau formatnya salah.',
      };

    case 429:
      return {
        title: 'Terlalu banyak percobaan',
        description: 'Anda melakukan tindakan ini terlalu sering. Mohon tunggu sekitar 1-2 menit sebelum mencoba lagi.',
      };

    case 500:
      return {
        title: 'Sistem sedang sibuk',
        description: 'Server kami sedang mengalami gangguan internal. Tim teknisi kami akan segera memperbaikinya. Coba lagi dalam beberapa menit.',
      };

    case 502:
    case 503:
    case 504:
      return {
        title: 'Server tidak merespon (Offline)',
        description: 'Layanan sedang dalam perbaikan rutin atau down sementara. Coba buka kembali aplikasi beberapa saat lagi.',
      };

    default:
      return {
        title: 'Terjadi kendala tak terduga',
        description: 'Sistem mengalami error yang tidak dikenali. Silakan coba kembali, atau lapor ke Admin jika terus berulang.',
      };
  }
}

/**
 * PIN-specific error mapper (override generic handler for PIN flows)
 */
export function handlePinError(err) {
  const status = err?.response?.status;

  if (status === 401) {
    toast.error('PIN tidak sesuai. Pastikan PIN yang Anda masukkan benar, lalu coba kembali.');
  } else if (status === 423) {
    toast.error('PIN dikunci. Terlalu banyak percobaan salah. Hubungi administrator untuk membuka kunci.');
  } else if (status === 403) {
    toast.error('Perangkat tidak dikenal. Anda perlu verifikasi ulang di perangkat ini.');
  } else {
    handleError(err, 'PIN');
  }

  // Always log for devs
  if (import.meta.env.DEV) {
    console.error(`[HERD PIN Error]`, err);
  }
}

/**
 * Main error handler — call this in every catch block.
 * 
 * @param {Error} err - The raw error object
 * @param {string} context - Human-readable label for dev logging (e.g. 'fetch cows', 'save record')
 * @param {string} [customMessage] - Override the friendly message entirely
 */
export function handleError(err, context = 'operation', customMessage = null) {
  // Dev console: full technical details
  if (import.meta.env.DEV) {
    console.error(
      `[HERD Error] Context: ${context}`,
      '\nStatus:', err?.response?.status ?? 'N/A',
      '\nEndpoint:', err?.config?.url ?? 'N/A',
      '\nMessage:', err?.message,
      '\nResponse:', err?.response?.data ?? 'N/A',
    );
  }

  if (customMessage) {
    toast.error(customMessage);
    return;
  }

  const { title, description } = mapErrorToMessage(err, context);
  toast.error(`${title}. ${description}`);
}

export default handleError;
