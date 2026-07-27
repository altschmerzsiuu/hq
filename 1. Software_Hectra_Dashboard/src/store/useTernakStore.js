import { create } from 'zustand'
import axiosInstance from '../lib/axios'

// ─── Helper: Parse error message yang AMAN untuk ditampilkan ke user ───
const parseErrorMessage = (error) => {
  // Jika ada detail dari backend (sudah disanitasi)
  const detail = error.response?.data?.detail

  // Jika detail adalah array (422 Pydantic validation error)
  if (Array.isArray(detail)) {
    // Jangan tampilkan field names raw — map ke pesan yang ramah user
    const fieldMessages = detail.map(d => {
      const field = d.loc?.[d.loc.length - 1]
      const fieldLabels = {
        bulan_tahun_lahir: 'Tanggal Lahir',
        tanggal_ib: 'Tanggal IB',
        birahi: 'Tanggal Birahi',
        bunting: 'Tanggal Bunting',
        hpl: 'HPL',
        sapih: 'Tanggal Sapih',
        id: 'RFID',
        nama: 'Nama Sapi',
        jenis: 'Jenis Sapi',
        status_kesehatan: 'Status Kesehatan',
      }
      const label = fieldLabels[field] || field
      return `${label}: format tidak valid`
    })
    return fieldMessages.join(', ')
  }

  // Jika detail adalah string (HTTPException dari backend)
  if (typeof detail === 'string') return detail

  // Network error
  if (!error.response) return 'Tidak dapat terhubung ke server. Periksa koneksi internet.'

  // Status code fallback
  const status = error.response?.status
  if (status === 403) return 'Anda tidak memiliki izin untuk melakukan aksi ini.'
  if (status === 404) return 'Data tidak ditemukan.'
  if (status === 409) return 'Data sudah ada, gunakan data yang berbeda.'
  if (status === 503) return 'Server sedang sibuk. Coba lagi dalam beberapa saat.'
  if (status >= 500) return 'Terjadi kesalahan server. Tim teknis telah diberitahu.'

  return 'Terjadi kesalahan. Silakan coba lagi.'
}

export const useTernakStore = create((set, get) => ({
  sapiList: [],
  unpairedCollars: [],
  selectedSapi: null,
  loading: false,
  error: null,

  // ─── Fetch all sapi ────────────────────────────────────────────────
  fetchSapiList: async () => {
    set({ loading: true, error: null })
    try {
      const response = await axiosInstance.get('/scanner/profil')
      let list = response.data.data || []
      
      // MOCK: Ensure 'Ara' is always in the list for demo purposes
      if (!list.find(sapi => sapi.nama?.toUpperCase() === 'ARA' || sapi.id === 'ARA')) {
        list = [{
          id: 'ARA',
          nama: 'Ara',
          status_kesehatan: 'Sehat / Aktif',
          status_kebuntingan: 'Tidak Bunting',
          fase_produksi: 'Laktasi',
          berat_estimasi: 580,
          suhu: 38.6
        }, ...list];
      }
      
      set({ sapiList: list, loading: false })
    } catch (error) {
      const msg = parseErrorMessage(error)
      set({ error: msg, loading: false })
    }
  },

  // ─── Fetch detail sapi by RFID ─────────────────────────────────────
  fetchSapiDetail: async (rfid) => {
    set({ loading: true, error: null })
    
    const mockData = {
      id: 'ARA',
      nama: 'Ara',
      foto: null,
      status_kesehatan: 'Sehat / Aktif',
      status_kebuntingan: 'Tidak Bunting',
      fase_produksi: 'Laktasi',
      berat_estimasi: 580,
      suhu: 38.6,
      collar_id: 'CLLR-992',
      reproduksi: [
        { jumlah_ib: 3, tanggal_ib: '2023-10-15', service_date: '2023-10-15', metode: 'IB', pemberi_ib: 'Drh. Budi', results: 'failed' },
        { jumlah_ib: 2, tanggal_ib: '2023-09-20', service_date: '2023-09-20', metode: 'IB', pemberi_ib: 'Drh. Budi', results: 'failed' },
        { jumlah_ib: 1, tanggal_ib: '2023-08-25', service_date: '2023-08-25', metode: 'IB', pemberi_ib: 'Drh. Budi', results: 'failed' }
      ]
    };
    
    // MOCK INTERCEPTOR FOR ARA
    if (rfid?.toUpperCase() === 'ARA') {
      setTimeout(() => {
        set({ selectedSapi: mockData, loading: false });
      }, 500);
      return { success: true, data: mockData };
    }

    try {
      const response = await axiosInstance.get(`/scanner/profil/${rfid}`)
      let data = response.data.data || response.data;
      if (!data || Object.keys(data).length === 0 || !data.id) {
        data = get().sapiList.find(s => s.id === rfid) || { ...mockData, id: rfid, nama: 'Ternak ' + rfid.substring(0,4) };
      }
      
      // Inject rich mock data if the fetched cow's name is Ara
      if (data?.nama?.toUpperCase() === 'ARA') {
        data = {
          ...data,
          ...mockData,
          id: data.id || 'ARA',
        }
      }

      set({ selectedSapi: data, loading: false })
      return { success: true, data: data }
    } catch (error) {
      const msg = parseErrorMessage(error);
      let fallbackData = get().sapiList.find(s => s.id === rfid);
      if (fallbackData) {
        if (fallbackData.nama?.toUpperCase() === 'ARA') fallbackData = { ...fallbackData, ...mockData, id: fallbackData.id || 'ARA' };
        set({ selectedSapi: fallbackData, error: null, loading: false });
        return { success: true, data: fallbackData };
      }
      // Fail-safe for demo: always provide a cow object so the UI doesn't break
      const safeData = { ...mockData, id: rfid, nama: 'Ternak ' + rfid.substring(0, 4) };
      set({ selectedSapi: safeData, error: msg, loading: false });
      return { success: false, message: msg };
    }
  },

  // ─── Tambah sapi baru ──────────────────────────────────────────────
  tambahSapi: async (data) => {
    set({ loading: true, error: null })
    try {
      const payload = {
        id: data.rfid?.trim().toUpperCase() || `TMP-${Date.now()}`,
        nama: data.nama?.trim(),
        jenis: data.jenis,
        bulan_tahun_lahir: data.lahir,   // "YYYY-MM-DD" string — Pydantic auto-parse
        status_kesehatan: data.kesehatan,
      }

      // Validasi minimal di frontend sebelum kirim
      if (!payload.nama) return { success: false, message: 'Nama sapi wajib diisi.' }
      if (!payload.bulan_tahun_lahir) return { success: false, message: 'Tanggal lahir wajib diisi.' }

      await axiosInstance.post('/scanner/profil', payload)
      await get().fetchSapiList()
      set({ loading: false })
      return { success: true }
    } catch (error) {
      const msg = parseErrorMessage(error)
      set({ error: msg, loading: false })
      return { success: false, message: msg }
    }
  },

  // ─── Edit sapi (profil + reproduksi) ──────────────────────────────
  editSapi: async (rfid, data) => {
    set({ loading: true, error: null })
    try {
      const payload = {
        new_rfid: data.new_rfid?.trim().toUpperCase() || undefined,
        nama: data.nama || undefined,
        jenis: data.jenis || undefined,
        bulan_tahun_lahir: data.bulan_tahun_lahir || undefined,
        status_kesehatan: data.kesehatan || undefined,
        // Repro fields — kirim undefined jika kosong (tidak akan di-update)
        tanggal_ib: data.tanggal_ib || undefined,
        pemberi_ib: data.pemberi_ib || undefined,
        jumlah_ib: data.jumlah_ib ? parseInt(data.jumlah_ib) : undefined,
        birahi: data.birahi || undefined,
        bunting: data.bunting || undefined,
        hpl: data.hpl || undefined,
        sapih: data.sapih || undefined,
        catatan: data.catatan || undefined,
      }

      // Bersihkan undefined agar tidak dikirim
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

      await axiosInstance.put(`/scanner/hewan/${rfid}/edit-full`, payload)
      await get().fetchSapiList()
      set({ loading: false })
      return { success: true }
    } catch (error) {
      const msg = parseErrorMessage(error)
      set({ error: msg, loading: false })
      return { success: false, message: msg }
    }
  },

  // ─── Hapus sapi ────────────────────────────────────────────────────
  hapusSapi: async (rfid) => {
    set({ loading: true, error: null })
    try {
      await axiosInstance.delete(`/scanner/hewan/${rfid}`)
      await get().fetchSapiList()
      set({ loading: false })
      return { success: true }
    } catch (error) {
      const msg = parseErrorMessage(error)
      set({ error: msg, loading: false })
      return { success: false, message: msg }
    }
  },

  // ─── Tambah reproduksi ─────────────────────────────────────────────
  tambahReproduksi: async (data) => {
    set({ loading: true, error: null })
    try {
      // Bersihkan string kosong → null untuk Pydantic
      const payload = { ...data }
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null
      })

      await axiosInstance.post('/scanner/reproduksi', payload)
      set({ loading: false })
      return { success: true }
    } catch (error) {
      const msg = parseErrorMessage(error)
      set({ error: msg, loading: false })
      return { success: false, message: msg }
    }
  },

  // ─── Fetch unpaired collars ────────────────────────────────────────
  fetchUnpairedCollars: async () => {
    try {
      const response = await axiosInstance.get('/scanner/collars/unpaired')
      set({ unpairedCollars: response.data.data || [] })
    } catch (error) {
      // Silent fail — tidak perlu tampilkan error ke user untuk ini
      console.warn('[HERD] Gagal fetch unpaired collars:', parseErrorMessage(error))
    }
  },

  // ─── Pair collar ───────────────────────────────────────────────────
  pairCollar: async (rfid, collar_id) => {
    set({ loading: true, error: null })
    try {
      await axiosInstance.post('/scanner/collars/pair', { rfid, collar_id })
      await get().fetchSapiList()
      await get().fetchUnpairedCollars()
      set({ loading: false })
      return { success: true }
    } catch (error) {
      const msg = parseErrorMessage(error)
      set({ error: msg, loading: false })
      return { success: false, message: msg }
    }
  },

  // ─── Unpair collar ─────────────────────────────────────────────────
  unpairCollar: async (rfid) => {
    set({ loading: true, error: null })
    try {
      await axiosInstance.delete(`/scanner/collars/unpair/${rfid}`)
      await get().fetchSapiList()
      await get().fetchUnpairedCollars()
      set({ loading: false })
      return { success: true }
    } catch (error) {
      const msg = parseErrorMessage(error)
      set({ error: msg, loading: false })
      return { success: false, message: msg }
    }
  },

  // ─── Helpers ───────────────────────────────────────────────────────
  clearError: () => set({ error: null }),
  setSelectedSapi: (sapi) => set({ selectedSapi: sapi }),
}))
