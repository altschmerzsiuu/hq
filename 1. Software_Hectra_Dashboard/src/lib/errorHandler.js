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
      title: 'Tidak ada koneksi',
      description: 'Periksa koneksi internet Anda, kemudian coba lagi.',
    };
  }

  // ── HTTP Status Codes ──────────────────────────────────────────────
  switch (status) {
    case 400:
      return {
        title: 'Permintaan tidak valid',
        description: 'Periksa kembali data yang Anda kirim.',
      };

    case 401:
      return {
        title: 'Sesi Anda telah berakhir',
        description: 'Silakan masuk kembali untuk melanjutkan.',
      };

    case 403:
      return {
        title: 'Akses ditolak',
        description: 'Anda tidak memiliki izin untuk melakukan tindakan ini.',
      };

    case 404:
      return {
        title: 'Data tidak ditemukan',
        description: 'Informasi yang Anda cari tidak tersedia di sistem.',
      };

    case 409:
      return {
        title: 'Data sudah ada',
        description: 'Data serupa sudah tercatat. Periksa kembali isian Anda.',
      };

    case 422:
      return {
        title: 'Beberapa data belum lengkap',
        description: 'Periksa kembali kolom isian yang masih kosong atau belum sesuai.',
      };

    case 429:
      return {
        title: 'Terlalu banyak percobaan',
        description: 'Tunggu beberapa saat sebelum mencoba lagi.',
      };

    case 500:
      return {
        title: 'Terjadi gangguan pada sistem',
        description: 'Tim kami sedang berusaha mengatasinya. Silakan coba lagi nanti.',
      };

    case 502:
    case 503:
    case 504:
      return {
        title: 'Server tidak dapat dijangkau',
        description: 'Layanan sedang tidak tersedia. Silakan coba beberapa saat lagi.',
      };

    default:
      return {
        title: 'Terjadi kesalahan',
        description: 'Silakan coba kembali atau hubungi administrator jika masalah berlanjut.',
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
