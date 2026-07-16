import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Plus, Filter, Link, Unlink, ChevronRight, Edit2, Trash2, Activity, MapPin, X, Calendar, ClipboardList, Beef, Loader2, CheckCircle, XCircle, Baby, Pencil, Save, Tractor, PawPrint, SlidersHorizontal, ChevronLeft, Camera, ImagePlus, LineChart, Sparkles, Edit3 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTernakStore } from '../store/useTernakStore';
import axiosInstance from '../lib/axios';
import { toast } from '@/store/toastStore';
import ScanModal from '@/components/scan/ScanModal';
import PairCollarModal from '@/components/shared/PairCollarModal';
import CowAnalyticsView from '@/components/shared/CowAnalyticsView';
import CowEstrusView from '@/components/shared/CowEstrusView';
import useConfirmStore from '@/store/confirmStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

// --- Helper Date ---
const hitungUsia = (lahir, lang) => {
  if(!lahir) return '';
  const today = new Date();
  let birthDate;
  if (typeof lahir === 'string' && lahir.includes('/')) {
    const parts = lahir.split('/');
    if (parts.length === 3) {
      birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      birthDate = new Date(lahir);
    }
  } else {
    birthDate = new Date(lahir);
  }
  
  if (isNaN(birthDate.getTime())) return '';
  
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  if (lang === 'id') {
    return years > 0 ? `${years} tahun ${months} bulan` : `${months} bulan`;
  } else {
    return years > 0 ? `${years} years ${months} months` : `${months} months`;
  }
};

const formatTgl = (raw, lang) => {
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function ManajemenTernak() {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const ask = useConfirmStore((state) => state.ask);
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ kesehatan: 'all', jenis: 'all' });
  const [scanOpen, setScanOpen] = useState(false);
  
  // Zustand Store
  const { 
    sapiList, unpairedCollars, fetchSapiList, fetchUnpairedCollars, 
    tambahSapi, tambahReproduksi, pairCollar, unpairCollar, hapusSapi, editSapi, loading 
  } = useTernakStore();

  const [selectedSapi, setSelectedSapi] = useState(null);
  const [isReproModalOpen, setIsReproModalOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('riwayat'); // 'riwayat' | 'analitik' | 'estrus'
  const [isTambahModalOpen, setIsTambahModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);

  // Edit Reproduksi states
  const [editReproItem, setEditReproItem] = useState(null); // which repro record is being edited inline
  const [editReproForm, setEditReproForm] = useState({});
  const [savingRepro, setSavingRepro] = useState(false);
  const [confirmingPregnancy, setConfirmingPregnancy] = useState(null); // record_id being confirmed
  const [scanTarget, setScanTarget] = useState('tambah'); // 'tambah' or 'edit'
  const [reproSortOrder, setReproSortOrder] = useState('desc'); // 'desc' or 'asc'

  // History states — must be declared BEFORE sortedReproHistory useMemo to avoid TDZ
  const [reproHistory, setReproHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const sortedReproHistory = useMemo(() => {
    return [...reproHistory].sort((a, b) => {
      const dateA = new Date(a.tanggal_ib || a.service_date || 0);
      const dateB = new Date(b.tanggal_ib || b.service_date || 0);
      return reproSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [reproHistory, reproSortOrder]);

  // Form states
  const [tambahForm, setTambahForm] = useState({
    nama: '', rfid: '', jenis: 'Simmental', lahir: '', kesehatan: 'Sehat'
  });
  const [editForm, setEditForm] = useState({
    nama: '', jenis: 'Simmental', lahir: '', kesehatan: 'Sehat'
  });
  const [reproForm, setReproForm] = useState({
    tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
    birahi: '', bunting: '', hpl: '', sapih: '', catatan: ''
  });

  // Handle redirect from scan bottom sheet
  useEffect(() => {
    if (location.state?.registerUid) {
      setTambahForm(prev => ({ ...prev, rfid: location.state.registerUid }));
      setIsTambahModalOpen(true);
      window.history.replaceState({}, document.title);
    } else if (location.state?.selectedCowId) {
      // Find the cow in the herd and select it
      // We will do it in another useEffect after data is loaded
    }
  }, [location.state]);

  // Handle auto-selecting cow after data is loaded
  useEffect(() => {
    if (location.state?.selectedCowId && sapiList.length > 0) {
      const cow = sapiList.find(h => h.id === location.state.selectedCowId || h.cow_id === location.state.selectedCowId);
      if (cow) {
        setSelectedSapi(cow);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, sapiList]);

  // Pairing states
  const [pairSelectedSapi, setPairSelectedSapi] = useState(null);
  const [pairSelectedCollar, setPairSelectedCollar] = useState(null);


  const reloadReproHistory = (sapiId) => {
    setLoadingHistory(true);
    axiosInstance.get(`/reproduction/history/${sapiId}`)
      .then(res => setReproHistory(res.data || []))
      .catch(() => setReproHistory([]))
      .finally(() => setLoadingHistory(false));
  };

  // Fetch reproduction history when drawer opens
  useEffect(() => {
    if (selectedSapi) {
      reloadReproHistory(selectedSapi.id);
    } else {
      setReproHistory([]);
      setEditReproItem(null);
    }
  }, [selectedSapi]);

  // Initialize Data
  useEffect(() => {
    fetchSapiList();
    fetchUnpairedCollars();
  }, [fetchSapiList, fetchUnpairedCollars]);

  const filteredSapi = useMemo(() => {
    return sapiList.filter(s => {
      const matchSearch = s.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchKesehatan = filters.kesehatan === 'all' || s.status_kesehatan === filters.kesehatan;
      const matchJenis = filters.jenis === 'all' || s.jenis === filters.jenis;
      return matchSearch && matchKesehatan && matchJenis;
    });
  }, [searchQuery, sapiList, filters]);

  const handleTanggalIbChange = (e) => {
    const val = e.target.value;
    setReproForm(prev => {
      let birahi = '';
      let bunting = '';
      let hpl = '';
      let sapih = '';
      
      if (val) {
        const baseDate = new Date(val);
        
        // Next estrus (Birahi) = IB + 21 days
        const birahiDate = new Date(baseDate);
        birahiDate.setDate(birahiDate.getDate() + 21);
        birahi = birahiDate.toISOString().split('T')[0];
        
        // Pregnancy check (Bunting) = IB + 60 days
        const buntingDate = new Date(baseDate);
        buntingDate.setDate(buntingDate.getDate() + 60);
        bunting = buntingDate.toISOString().split('T')[0];
        
        // Expected Calving (HPL) = IB + 283 days
        const hplDate = new Date(baseDate);
        hplDate.setDate(hplDate.getDate() + 283);
        hpl = hplDate.toISOString().split('T')[0];
        
        // Weaning (Sapih) = HPL + 205 days
        const sapihDate = new Date(hplDate);
        sapihDate.setDate(sapihDate.getDate() + 205);
        sapih = sapihDate.toISOString().split('T')[0];
      }
      
      return { 
        ...prev, 
        tanggal_ib: val, 
        birahi, 
        bunting, 
        hpl, 
        sapih 
      };
    });
  };

  const onTambahSapi = async (e) => {
    e.preventDefault();
    const res = await tambahSapi(tambahForm);
    if (res.success) {
      setTambahForm({ nama: '', rfid: '', jenis: 'Simental', lahir: '', kesehatan: 'Sehat' });
      setIsTambahModalOpen(false);
      toast.success(t.livestock_toast_add_success);
    } else {
      toast.error(res.message || t.livestock_toast_add_failed);
    }
  };

  const onPairCollar = async () => {
    if (!pairSelectedSapi || !pairSelectedCollar) return;
    const res = await pairCollar(pairSelectedSapi, pairSelectedCollar);
    if (res.success) {
      setPairSelectedSapi(null);
      setPairSelectedCollar(null);
      setIsPairModalOpen(false);
      toast.success(t.livestock_toast_pair_success);
    } else {
      toast.error(res.message || t.livestock_toast_pair_failed);
    }
  };


  const onEditSapi = async (e) => {
    e.preventDefault();
    if (!selectedSapi) return;
    const res = await editSapi(selectedSapi.id, {
      new_rfid: editForm.rfid,
      nama: editForm.nama,
      jenis: editForm.jenis,
      bulan_tahun_lahir: editForm.lahir,
      kesehatan: editForm.kesehatan
    });
    if (res.success) {
      setSelectedSapi({
        ...selectedSapi,
        id: editForm.rfid,
        nama: editForm.nama,
        jenis: editForm.jenis,
        bulan_tahun_lahir: editForm.lahir,
        status_kesehatan: editForm.kesehatan
      });
      setIsEditModalOpen(false);
      toast.success(t.livestock_toast_edit_success);
    } else {
      toast.error(res.message || t.livestock_toast_edit_failed);
    }
  };

  const onTambahReproduksi = async (e) => {
    e.preventDefault();
    if (!selectedSapi) return;
    const payload = { ...reproForm, rfid: selectedSapi.id };
    const res = await tambahReproduksi(payload);
    if (res.success) {
      setIsReproModalOpen(false);
      setReproForm({
        tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
        birahi: '', bunting: '', hpl: '', sapih: '', catatan: ''
      });
      fetchSapiList();
      reloadReproHistory(selectedSapi.id);
      toast.success(t.repro_save_success);
    } else {
      toast.error(res.message || t.repro_save_failed);
    }
  };

  // --- Edit inline reproduksi record ---
  const startEditRepro = (item) => {
    setEditReproItem(item.id);
    const tgl = item.tanggal_ib ? new Date(item.tanggal_ib).toISOString().split('T')[0] : '';
    const hpl = item.hpl ? new Date(item.hpl).toISOString().split('T')[0] : '';
    setEditReproForm({
      tanggal_ib: tgl,
      pemberi_ib: item.pemberi_ib || item.petugas || item.technician || '',
      jumlah_ib: item.jumlah_ib || 1,
      catatan: item.catatan || item.notes || '',
      hpl: hpl,
    });
  };

  const cancelEditRepro = () => {
    setEditReproItem(null);
    setEditReproForm({});
  };

  const saveEditRepro = async (item) => {
    setSavingRepro(true);
    try {
      // Map to the API format used by PUT /api/reproduction/{id}
      const payload = {
        rfid: selectedSapi.id,
        service_date: editReproForm.tanggal_ib,
        technician: editReproForm.pemberi_ib,
        notes: editReproForm.catatan,
        jumlah_ib: parseInt(editReproForm.jumlah_ib) || 1,
        is_pregnant: item.results === true ? 'true' : item.results === false ? 'false' : 'pending',
      };
      await axiosInstance.put(`/reproduction/${item.id}`, payload);
      toast.success(t.repro_toast_update_success);
      setEditReproItem(null);
      reloadReproHistory(selectedSapi.id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t.repro_toast_update_failed);
    } finally {
      setSavingRepro(false);
    }
  };

  const deleteReproRecord = async (item) => {
    const confirmed = await ask({
      title: lang === 'id' ? "Hapus Catatan Reproduksi" : "Delete Reproduction Record",
      message: lang === 'id'
        ? "Apakah Anda yakin ingin menghapus data reproduksi ini? Tindakan ini tidak dapat dibatalkan."
        : "Are you sure you want to delete this reproduction record? This action cannot be undone.",
      confirmText: lang === 'id' ? 'Hapus' : 'Delete',
      cancelText: t.btn_cancel,
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await axiosInstance.delete(`/reproduction/${item.id}`);
      toast.success(lang === 'id' ? "Data reproduksi berhasil dihapus." : "Reproduction record deleted successfully.");
      reloadReproHistory(selectedSapi.id);
      fetchSapiList();
    } catch (err) {
      toast.error(lang === 'id' ? "Gagal menghapus data reproduksi." : "Failed to delete reproduction record.");
    }
  };

  // --- Konfirmasi hasil IB (hamil / tidak) ---
  const confirmPregnancy = async (item, isPregnant) => {
    const label = isPregnant 
      ? (lang === 'id' ? 'Bunting' : 'Pregnant') 
      : (lang === 'id' ? 'Gagal' : 'Failed');
    const confirmed = await ask({
      title: t.livestock_repro_confirm_title,
      message: (lang === 'id'
        ? `Tandai hasil inseminasi sapi ${selectedSapi?.nama} sebagai "${label}"? Status ini akan tersimpan ke database dan memperbarui notifikasi.`
        : `Mark artificial insemination result for cow ${selectedSapi?.nama} as "${label}"? This status will be saved to the database and update notifications.`),
      confirmText: label,
      cancelText: t.btn_cancel,
      isDanger: !isPregnant
    });
    if (!confirmed) return;

    setConfirmingPregnancy(item.id);
    try {
      const tgl = item.tanggal_ib ? new Date(item.tanggal_ib).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      await axiosInstance.put(`/reproduction/${item.id}`, {
        rfid: selectedSapi.id,
        service_date: tgl,
        technician: item.pemberi_ib || item.petugas || item.technician || '',
        notes: item.catatan || item.notes || '',
        is_pregnant: isPregnant ? 'true' : 'false',
      });
      toast.success(lang === 'id' ? `Status IB dikonfirmasi: ${label}` : `AI status confirmed: ${label}`);
      reloadReproHistory(selectedSapi.id);
      fetchSapiList(); // refresh status kesehatan
    } catch (err) {
      toast.error(err?.response?.data?.detail || (lang === 'id' ? "Gagal mengkonfirmasi status." : "Failed to confirm status."));
    } finally {
      setConfirmingPregnancy(null);
    }
  };

  return (
    <>
      <div className="space-y-6 pb-6">
        {/* Header */}
      {/* ── Header ── */}
      {/* Desktop Header */}
      <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[var(--color-text-primary)]">{t.livestock_title}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">{t.livestock_sub}</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => setIsPairModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--color-primary)] text-[var(--color-primary)] font-bold rounded-xl hover:bg-[var(--color-primary)] hover:text-white transition-all shadow-sm"
          >
            <Link size={18} />
            <span className="hidden sm:inline">{t.qa_pair_collar}</span>
          </button>
          <button 
            onClick={() => setIsTambahModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-md"
          >
            <Plus size={20} />
            <span>{t.livestock_btn_add}</span>
          </button>
        </div>
      </div>

      {/* Mobile Header (Like Screenshot) */}
      <div className="md:hidden flex items-center justify-between pt-2 pb-2">
        <div className="flex items-center gap-3">
          <div style={{ color: 'var(--accent)' }}>
            <Tractor size={32} strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-1)', lineHeight: 1.1, margin: 0, letterSpacing: '-0.5px' }}>
              Ternak
            </h1>
            <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Manajemen Populasi
            </p>
          </div>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent)', padding: '6px 12px', borderRadius: '100px', fontSize: '13px', fontWeight: 800 }}>
          {sapiList.length} Sapi
        </div>
      </div>

      {/* ── DESKTOP CONTENT ── */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '16px 24px', boxShadow: 'var(--shadow-card)', border: '0.5px solid var(--border)' }} className="hidden md:block animate-in fade-in duration-300">
        <div className="flex gap-4 justify-between mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--text-3)' }} />
            <input 
              type="text" 
              placeholder={t.livestock_search_placeholder} 
              style={{ width: '100%', paddingLeft: '36px', paddingRight: '14px', paddingTop: '8px', paddingBottom: '8px', border: '0.5px solid var(--border)', borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowFilter(f => !f)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: `0.5px solid ${showFilter ? 'var(--accent)' : 'var(--border)'}`, color: showFilter ? 'var(--accent)' : 'var(--text-2)', borderRadius: '10px', background: showFilter ? 'var(--accent-dim)' : 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s' }}
          >
            <Filter size={16} />
            {t.btn_filter}
          </button>
        </div>
 
        {/* Filter Panel */}
        {showFilter && (
          <div className="filter-panel" style={{ marginBottom: '16px' }}>
            <select className="filter-select" value={filters.kesehatan} onChange={e => setFilters(f => ({ ...f, kesehatan: e.target.value }))}>
              <option value="all">{t.livestock_filter_all_health}</option>
              <option value="Sehat">{t.livestock_filter_sehat}</option>
              <option value="Sakit">{t.livestock_filter_sakit}</option>
              <option value="Hamil">{t.livestock_filter_hamil}</option>
              <option value="Butuh Perawatan">{t.livestock_filter_care}</option>
            </select>
            <select className="filter-select" value={filters.jenis} onChange={e => setFilters(f => ({ ...f, jenis: e.target.value }))}>
              <option value="all">{t.status_all_types}</option>
              <option value="Simmental">{t.breed_simmental}</option>
              <option value="Bali">{t.breed_bali}</option>
              <option value="Brahman">{t.breed_brahman}</option>
              <option value="Limosin">{t.breed_limousin}</option>
              <option value="Angus">{t.breed_angus}</option>
              <option value="Friesian Holstein">{t.breed_friesholstein}</option>
            </select>
            <button onClick={() => setFilters({ kesehatan: 'all', jenis: 'all' })} style={{ fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'Inter, sans-serif' }}>{t.btn_reset}</button>
          </div>
        )}

        {/* Desktop View: Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                <th className="py-3 px-4 font-medium">{t.livestock_table_name}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_rfid}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_breed}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_age}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_health}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_collar}</th>
                <th className="py-3 px-4 font-medium text-right">{t.livestock_table_action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredSapi.map((sapi) => (
                <tr key={sapi.id} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                  <td className="py-3 px-4 font-bold text-[var(--color-primary)]">{sapi.nama}</td>
                  <td className="py-3 px-4 text-sm text-[var(--color-text-secondary)]">{sapi.id}</td>
                  <td className="py-3 px-4 text-sm">{sapi.jenis}</td>
                  <td className="py-3 px-4 text-sm text-[var(--color-text-muted)]">{hitungUsia(sapi.bulan_tahun_lahir, lang)}</td>
                  <td className="py-3 px-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold",
                      sapi.status_kesehatan === 'Sehat' ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" :
                      sapi.status_kesehatan === 'Hamil' ? "bg-[var(--color-info-bg)] text-[var(--color-info)]" :
                      "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                    )}>
                      {sapi.status_kesehatan === 'Sehat' ? t.livestock_filter_sehat :
                       sapi.status_kesehatan === 'Hamil' ? t.livestock_filter_hamil :
                       sapi.status_kesehatan === 'Sakit' ? t.livestock_filter_sakit :
                       t.livestock_filter_care}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--color-text-muted)]">{sapi.collar_id || '-'}</td>
                  <td className="py-3 px-4 text-right">
                    <button 
                      onClick={() => setSelectedSapi(sapi)}
                      className="p-1 text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSapi.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic', fontSize: '13px' }}>{t.livestock_no_data}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MOBILE CONTENT ── */}
      <div className="md:hidden flex flex-col gap-4 mt-2">
        {/* Search and Filter Row */}
        <div className="flex items-center gap-2 w-full">
          <div style={{ flex: 1, position: 'relative', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input 
              type="text" 
              placeholder="Cari nama sapi..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '14px 16px 14px 44px', background: 'transparent', border: 'none', outline: 'none', fontSize: '15px', color: 'var(--text-1)', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}
            />
          </div>
          <button 
            onClick={() => setShowFilter(f => !f)}
            style={{ width: '50px', height: '50px', borderRadius: '16px', background: showFilter ? 'var(--accent-dim)' : 'var(--bg-surface)', border: `1px solid ${showFilter ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: showFilter ? 'var(--accent)' : 'var(--text-2)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', transition: 'all 0.2s' }}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>

        {/* Filter Chips Row */}
        <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', alignItems: 'center', margin: '0 -16px', padding: '0 16px' }}>
          {['Semua', 'Perlu IB', 'Bunting', 'Sehat'].map((f, i) => (
            <React.Fragment key={f}>
              <button 
                onClick={() => setFilters(prev => ({...prev, kesehatan: f === 'Semua' ? 'all' : (f === 'Bunting' ? 'Hamil' : f)}))}
                style={{
                  padding: '8px 16px', borderRadius: '100px', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap',
                  background: (filters.kesehatan === (f === 'Semua' ? 'all' : (f === 'Bunting' ? 'Hamil' : f))) ? '#EAEAEA' : 'transparent',
                  color: (filters.kesehatan === (f === 'Semua' ? 'all' : (f === 'Bunting' ? 'Hamil' : f))) ? '#111' : 'var(--text-2)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif'
                }}
              >
                {f}
              </button>
              {i < 3 && <span style={{ color: 'var(--border)', fontSize: '16px', padding: '0 4px' }}>/</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Advanced Filter Panel Mobile (Bottom Sheet Modal) */}
        {showFilter && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {/* Backdrop */}
            <div 
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} 
              className="animate-in fade-in duration-200"
              onClick={() => setShowFilter(false)} 
            />
            
            {/* Modal Content */}
            <div 
              style={{ position: 'relative', width: '100%', background: 'var(--bg-surface)', padding: '24px 20px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', boxShadow: '0 -4px 24px rgba(0,0,0,0.1)' }} 
              className="animate-in slide-in-from-bottom-full duration-300"
            >
              {/* Drag Handle */}
              <div style={{ width: '48px', height: '5px', background: 'var(--border)', borderRadius: '10px', margin: '0 auto 24px auto' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Filter Lanjutan</h4>
                <button onClick={() => setShowFilter(false)} style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-2)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} />
                </button>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: '8px' }}>Jenis Sapi / Bangsa</label>
                <select 
                  value={filters.jenis} 
                  onChange={e => setFilters(f => ({ ...f, jenis: e.target.value }))}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-base)', outline: 'none', fontSize: '15px', color: 'var(--text-1)', fontWeight: 600, fontFamily: 'Inter, sans-serif', appearance: 'none' }}
                >
                  <option value="all">Semua Jenis</option>
                  <option value="Simmental">Simmental</option>
                  <option value="Bali">Bali</option>
                  <option value="Brahman">Brahman</option>
                  <option value="Limosin">Limosin</option>
                  <option value="Angus">Angus</option>
                  <option value="Friesian Holstein">Friesian Holstein</option>
                </select>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: '8px' }}>Terakhir IB</label>
                <select 
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-base)', outline: 'none', fontSize: '15px', color: 'var(--text-1)', fontWeight: 600, fontFamily: 'Inter, sans-serif', appearance: 'none' }}
                >
                  <option value="all">Kapan Saja</option>
                  <option value="7">7 Hari Terakhir</option>
                  <option value="30">30 Hari Terakhir</option>
                  <option value="older">Lebih dari 1 Bulan</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
                 <button 
                  onClick={() => { setFilters({ kesehatan: 'all', jenis: 'all' }); setShowFilter(false); }} 
                  style={{ flex: 1, padding: '14px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-2)', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                 >
                   Reset
                 </button>
                 <button 
                  onClick={() => setShowFilter(false)} 
                  style={{ flex: 1, padding: '14px', borderRadius: '16px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)', fontFamily: 'Inter, sans-serif' }}
                 >
                   Terapkan
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile View: List Items */}
        <div className="space-y-4 pb-20">
          {filteredSapi.map(sapi => (
            <div 
              key={sapi.id} 
              style={{ 
                padding: '16px', borderRadius: '24px', background: 'var(--bg-surface)', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' 
              }}
              onClick={() => setSelectedSapi(sapi)}
            >
              {/* Cow Icon / Image */}
              <div style={{ width: '72px', height: '72px', borderRadius: '16px', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {sapi.foto ? (
                  <img src={sapi.foto} alt={sapi.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <PawPrint size={32} color="var(--text-3)" />
                )}
              </div>
              
              {/* Info Column */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-1)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sapi.nama}
                  </h3>
                  <span style={{
                    padding: '4px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', flexShrink: 0,
                    background: sapi.status_kesehatan === 'Sehat' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: sapi.status_kesehatan === 'Sehat' ? 'var(--accent)' : '#f59e0b'
                  }}>
                    {sapi.status_kesehatan === 'Sehat' ? 'SEHAT' : sapi.status_kesehatan === 'Hamil' ? 'BUNTING' : 'PERHATIAN'}
                  </span>
                </div>
                
                <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 6px 0', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                  Terakhir IB: {sapi.terakhir_ib ? formatTgl(sapi.terakhir_ib, lang) : '45 hari lalu'}
                </p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-3)', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                  <span>Jenis: {sapi.jenis || '-'}</span>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border)' }} />
                  <span>Usia: {hitungUsia(sapi.bulan_tahun_lahir, lang) || '-'}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredSapi.length === 0 && (
            <p className="text-center text-sm italic text-[var(--color-text-muted)] py-12">{t.livestock_no_data}</p>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* MODAL: TAMBAH SAPI  — z-[1100] supaya di atas drawer (z-[900]) */}
      {/* ────────────────────────────────────────────────────────────── */}
      {isTambahModalOpen && (
        <div className="fixed inset-0 z-[1100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">{t.livestock_add_title}</h2>
              <button onClick={() => setIsTambahModalOpen(false)} className="p-2 bg-[var(--bg-surface)] rounded-full hover:bg-[var(--border)]">
                <X size={20} />
              </button>
            </div>
            <form className="space-y-5" onSubmit={onTambahSapi}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_name}</label>
                  <input type="text" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" placeholder={t.livestock_add_name_placeholder} value={tambahForm.nama} onChange={e => setTambahForm({...tambahForm, nama: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_rfid}</label>
                  <div className="flex gap-2">
                    <input type="text" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" placeholder={t.livestock_add_rfid_placeholder} value={tambahForm.rfid} onChange={e => setTambahForm({...tambahForm, rfid: e.target.value})} />
                    <button type="button" className="px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] font-bold shadow-sm" onClick={() => setScanOpen(true)}>{t.qa_scan_rfid || 'Scan'}</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_breed}</label>
                  <select style={{ width: '100%', padding: '10px 14px', border: '0.5px solid var(--border)', borderRadius: '10px', background: 'var(--bg-surface)', color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' }} value={tambahForm.jenis} onChange={e => setTambahForm({...tambahForm, jenis: e.target.value})}>
                    <option value="Simmental">{t.breed_simmental}</option>
                    <option value="Brahman">{t.breed_brahman}</option>
                    <option value="Limosin">{t.breed_limousin}</option>
                    <option value="Bali">{t.breed_bali}</option>
                    <option value="Angus">{t.breed_angus}</option>
                    <option value="Friesian Holstein">{t.breed_friesholstein}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_health}</label>
                  <select style={{ width: '100%', padding: '10px 14px', border: '0.5px solid var(--border)', borderRadius: '10px', background: 'var(--bg-surface)', color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' }} value={tambahForm.kesehatan} onChange={e => setTambahForm({...tambahForm, kesehatan: e.target.value})}>
                    <option value="Sehat">{t.livestock_filter_sehat}</option>
                    <option value="Sakit">{t.livestock_filter_sakit}</option>
                    <option value="Butuh Perawatan">{t.livestock_filter_care}</option>
                    <option value="Hamil">{t.livestock_filter_hamil}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_birthdate}</label>
                <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" value={tambahForm.lahir} onChange={e => setTambahForm({...tambahForm, lahir: e.target.value})} required />
                {tambahForm.lahir && (
                  <p className="text-xs text-[var(--color-primary)] mt-2 font-medium flex items-center gap-1">
                    <Activity size={12}/> {t.livestock_add_current_age} {hitungUsia(tambahForm.lahir, lang)}
                  </p>
                )}
              </div>

              <div className="pt-6 border-t border-[var(--color-border)] flex justify-end gap-3">
                <button type="button" onClick={() => setIsTambahModalOpen(false)} style={{ padding: '10px 24px', border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{t.btn_cancel}</button>
                <button type="submit" className="px-6 py-2.5 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-md" disabled={loading}>
                  {loading ? t.btn_saving : t.btn_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* MODAL: EDIT SAPI — z-[1100] supaya di atas drawer (z-[900])  */}
      {/* ────────────────────────────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[1100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">{t.livestock_edit_title}</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)]">
                <X size={20} />
              </button>
            </div>
            <form className="space-y-5" onSubmit={onEditSapi}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_name}</label>
                  <input type="text" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" placeholder={t.livestock_add_name_placeholder} value={editForm.nama} onChange={e => setEditForm({...editForm, nama: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_rfid}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} 
                      className="w-full px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" 
                      placeholder={t.livestock_add_rfid_placeholder}
                      value={editForm.rfid || ''} 
                      onChange={e => setEditForm({...editForm, rfid: e.target.value})} 
                      required
                    />
                    <button 
                      type="button" 
                      className="px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] font-bold shadow-sm flex items-center shrink-0" 
                      onClick={() => {
                        setScanTarget('edit');
                        setScanOpen(true);
                      }}
                    >
                      {t.qa_scan_rfid || 'Scan'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_breed}</label>
                  <select style={{ width: '100%', padding: '10px 14px', border: '0.5px solid var(--border)', borderRadius: '10px', background: 'var(--bg-surface)', color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' }} value={editForm.jenis} onChange={e => setEditForm({...editForm, jenis: e.target.value})}>
                    <option value="Simmental">{t.breed_simmental}</option>
                    <option value="Brahman">{t.breed_brahman}</option>
                    <option value="Limosin">{t.breed_limousin}</option>
                    <option value="Bali">{t.breed_bali}</option>
                    <option value="Angus">{t.breed_angus}</option>
                    <option value="Friesian Holstein">{t.breed_friesholstein}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_health}</label>
                  <select style={{ width: '100%', padding: '10px 14px', border: '0.5px solid var(--border)', borderRadius: '10px', background: 'var(--bg-surface)', color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' }} value={editForm.kesehatan} onChange={e => setEditForm({...editForm, kesehatan: e.target.value})}>
                    <option value="Sehat">{t.livestock_filter_sehat}</option>
                    <option value="Sakit">{t.livestock_filter_sakit}</option>
                    <option value="Butuh Perawatan">{t.livestock_filter_care}</option>
                    <option value="Hamil">{t.livestock_filter_hamil}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_birthdate}</label>
                <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" value={editForm.lahir} onChange={e => setEditForm({...editForm, lahir: e.target.value})} required />
                {editForm.lahir && (
                  <p className="text-xs text-[var(--color-primary)] mt-2 font-medium flex items-center gap-1">
                    <Activity size={12}/> {t.livestock_add_current_age} {hitungUsia(editForm.lahir, lang)}
                  </p>
                )}
              </div>

              <div className="pt-6 border-t border-[var(--color-border)] flex justify-end gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '10px 24px', border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{t.btn_cancel}</button>
                <button type="submit" className="px-6 py-2.5 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-md" disabled={loading}>
                  {loading ? t.btn_saving : t.btn_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PairCollarModal
        isOpen={isPairModalOpen}
        onClose={() => {
          setPairSelectedSapi(null);
          setPairSelectedCollar(null);
          setIsPairModalOpen(false);
        }}
        pairSelectedSapi={pairSelectedSapi}
        setPairSelectedSapi={setPairSelectedSapi}
        pairSelectedCollar={pairSelectedCollar}
        setPairSelectedCollar={setPairSelectedCollar}
      />

      {/* ────────────────────────────────────────────────────────────── */}
      {/* DRAWER: Detail Sapi — z-[900], di bawah modal edit (z-[1100]) */}
      {/* ────────────────────────────────────────────────────────────── */}
      {selectedSapi && (
        <>
        {/* ── DESKTOP MODAL ── */}
        <div className="hidden md:flex fixed inset-0 z-[900] justify-end bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedSapi(null)}>
          <div style={{ background: 'var(--bg-surface)', borderLeft: '0.5px solid var(--border)' }} className="w-full max-w-md h-full shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
            <div style={{ background: 'var(--bg-surface)', borderBottom: '0.5px solid var(--border)' }} className="px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">{t.livestock_detail_title}</h2>
              <button onClick={() => setSelectedSapi(null)} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Profil Card */}
              <div className="bg-[var(--color-bg-surface)] p-5 rounded-2xl border border-[var(--color-border)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Beef size={100} />
                </div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <h3 className="text-2xl font-bold text-[var(--color-primary)]">{selectedSapi.nama}</h3>
                    <p className="text-sm font-medium text-[var(--color-text-muted)] mt-1 tracking-wide">{selectedSapi.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        let formattedLahir = '';
                        const lahir = selectedSapi.bulan_tahun_lahir;
                        if (lahir) {
                          if (/^\d{4}-\d{2}-\d{2}$/.test(lahir)) {
                            formattedLahir = lahir;
                          } else if (lahir.includes('/')) {
                            const parts = lahir.split('/');
                            if (parts.length === 3) {
                              formattedLahir = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            }
                          } else {
                            const d = new Date(lahir);
                            if (!isNaN(d.getTime())) {
                              formattedLahir = d.toISOString().split('T')[0];
                            }
                          }
                        }
                        setEditForm({
                          rfid: selectedSapi.id || '',
                          nama: selectedSapi.nama || '',
                          jenis: selectedSapi.jenis || 'Simmental',
                          lahir: formattedLahir,
                          kesehatan: selectedSapi.status_kesehatan || 'Sehat'
                        });
                        setIsEditModalOpen(true);
                      }}
                      className="p-2 text-[var(--color-primary)] rounded-xl shadow-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-muted)]"
                      style={{ background: 'var(--bg-card)' }}
                      title={t.livestock_edit_title}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button onClick={async () => {
                      const confirmed = await ask({
                        title: t.livestock_confirm_delete_title,
                        message: t.livestock_confirm_delete_msg.replace('{name}', selectedSapi.nama || selectedSapi.id),
                        confirmText: t.btn_delete,
                        cancelText: t.btn_cancel,
                        isDanger: true
                      });
                      if (confirmed) {
                        hapusSapi(selectedSapi.id).then((res) => {
                          if (res.success) {
                            setSelectedSapi(null);
                            toast.success(t.livestock_toast_delete_success);
                          } else {
                            toast.error(res.message || t.livestock_toast_delete_failed);
                          }
                        });
                      }
                    }} className="p-2 text-[var(--color-danger)] rounded-xl shadow-sm border border-[var(--color-border)] hover:bg-[var(--color-danger-bg)]"
                    style={{ background: 'var(--bg-card)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm relative z-10">
                  <div>
                    <p className="text-[var(--color-text-muted)] mb-1">{t.livestock_table_breed}</p>
                    <p className="font-bold text-[var(--color-text-primary)]">{selectedSapi.jenis}</p>
                  </div>
                  <div>
                    <p className="text-[var(--color-text-muted)] mb-1">{t.livestock_table_age}</p>
                    <p className="font-bold text-[var(--color-text-primary)]">{hitungUsia(selectedSapi.bulan_tahun_lahir, lang)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--color-text-muted)] mb-1">{t.livestock_table_health}</p>
                    <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold",
                        selectedSapi.status_kesehatan === 'Sehat' ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" :
                        selectedSapi.status_kesehatan === 'Hamil' ? "bg-[var(--color-info-bg)] text-[var(--color-info)]" :
                        "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                      )}>
                        {selectedSapi.status_kesehatan === 'Sehat' ? t.livestock_filter_sehat :
                         selectedSapi.status_kesehatan === 'Hamil' ? t.livestock_filter_hamil :
                         selectedSapi.status_kesehatan === 'Sakit' ? t.livestock_filter_sakit :
                         t.livestock_filter_care}
                      </span>
                  </div>
                  <div>
                    <p className="text-[var(--color-text-muted)] mb-1">{t.livestock_table_collar}</p>
                    {selectedSapi.collar_id ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--color-primary)]">{selectedSapi.collar_id}</span>
                        <button onClick={async () => {
                          const confirmed = await ask({
                            title: t.livestock_confirm_unpair_title,
                            message: t.livestock_confirm_unpair_msg.replace('{name}', selectedSapi.nama || selectedSapi.id),
                            confirmText: t.btn_yes_unpair,
                            cancelText: t.btn_cancel,
                            isDanger: true
                          });
                          if (confirmed) {
                            unpairCollar(selectedSapi.id).then(() => {setSelectedSapi({...selectedSapi, collar_id: null})});
                          }
                        }} className="text-[10px] bg-[var(--color-danger-bg)] text-[var(--color-danger)] px-2 py-1 rounded font-bold hover:bg-red-100 cursor-pointer">{t.livestock_detail_collar_release}</button>
                      </div>
                    ) : (
                      <span className="font-medium text-[var(--color-warning)]">{t.livestock_detail_collar_unassigned}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Reproduksi History */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-heading font-bold text-lg text-[var(--color-text-primary)]">{t.livestock_repro_title}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReproSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className="text-xs font-semibold text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] flex items-center gap-1 hover:bg-[var(--color-bg-muted)] transition-colors shadow-sm"
                      title={lang === 'id' ? "Urutkan Tanggal" : "Sort Date"}
                    >
                      <ClipboardList size={14} className="text-[var(--color-primary)]" />
                      <span>{reproSortOrder === 'desc' ? (lang === 'id' ? 'Terbaru' : 'Newest') : (lang === 'id' ? 'Terlama' : 'Oldest')}</span>
                    </button>
                    <button 
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        const countIB = sortedReproHistory.filter(h => h.metode?.toLowerCase() === 'ib' || h.method?.toLowerCase() === 'ib').length + 1;
                        setReproForm(f => ({ ...f, tanggal_ib: today, jumlah_ib: countIB }));
                        setIsReproModalOpen(true);
                      }}
                      className="text-xs font-bold text-white bg-[var(--color-primary)] px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-[var(--color-primary-hover)] transition-colors"
                    >
                      <Plus size={14} /> <span>{t.btn_add}</span>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {loadingHistory ? (
                    <div style={{ background: 'var(--bg-card)' }} className="p-8 text-center text-gray-400 text-xs italic flex items-center justify-center gap-2 border border-[var(--color-border)] rounded-2xl">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                      {t.livestock_repro_loading}
                    </div>
                  ) : sortedReproHistory.length === 0 ? (
                    <div style={{ background: 'var(--bg-card)' }} className="p-8 text-center text-gray-400 text-xs italic border border-[var(--color-border)] rounded-2xl">
                      {t.livestock_repro_empty}
                    </div>
                  ) : (
                    sortedReproHistory.map((item, idx) => {
                      const isPregnant = item.results === true || item.results === 'true' || item.is_pregnant === true;
                      const isFailed = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                      const isPending = !isPregnant && !isFailed;
                      const isEditingThis = editReproItem === item.id;
                      const isConfirming = confirmingPregnancy === item.id;

                      const hplDate = item.hpl || (item.tanggal_ib ? new Date(new Date(item.tanggal_ib).getTime() + 283 * 24 * 60 * 60 * 1000) : null);
                      
                      return (
                        <div 
                          key={item.id || idx} 
                          style={{ 
                            background: 'var(--bg-card)', 
                            border: '0.5px solid var(--border)', 
                            borderRadius: '16px', 
                            boxShadow: 'var(--shadow-card)' 
                          }} 
                          className="p-4 space-y-3 transition-all hover:shadow-md"
                        >
                          {/* Header baris */}
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase">{t.livestock_repro_method_seq}</p>
                              <p className="text-xs font-bold text-[var(--color-text-primary)]">
                                {(item.metode || item.method || 'ib').toUpperCase()} {item.jumlah_ib ? (lang === 'id' ? `(Suntik ke-${item.jumlah_ib})` : `(Shot #${item.jumlah_ib})`) : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isPregnant && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-success-bg)] text-[var(--color-success)]">
                                  {t.livestock_repro_pregnant}
                                </span>
                              )}
                              {isFailed && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
                                  {t.livestock_repro_failed}
                                </span>
                              )}
                              {isPending && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
                                  {t.livestock_repro_pending}
                                </span>
                              )}
                              {/* Tombol edit & hapus inline */}
                              {!isEditingThis && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => startEditRepro(item)}
                                    className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-surface)] transition-colors"
                                    title={t.repro_edit_record}
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => deleteReproRecord(item)}
                                    className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                    title={lang === 'id' ? "Hapus Catatan" : "Delete Record"}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ── Mode Edit Inline ─────────────────────────── */}
                          {isEditingThis ? (
                            <div className="space-y-3 p-3 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] animate-in fade-in duration-200">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">{t.repro_ib_date}</label>
                                  <input type="date"
                                    style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                                    className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                                    value={editReproForm.tanggal_ib}
                                    onChange={e => setEditReproForm(f => ({...f, tanggal_ib: e.target.value}))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">{t.repro_ib_count}</label>
                                  <input type="number" min="1" max="10"
                                    style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                                    className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                                    value={editReproForm.jumlah_ib}
                                    onChange={e => setEditReproForm(f => ({...f, jumlah_ib: e.target.value}))}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">{t.repro_inseminator}</label>
                                <input type="text"
                                  style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                                  placeholder={t.repro_inseminator_placeholder}
                                  value={editReproForm.pemberi_ib}
                                  onChange={e => setEditReproForm(f => ({...f, pemberi_ib: e.target.value}))}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">{t.repro_notes}</label>
                                <textarea rows={2}
                                  style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none resize-none"
                                  placeholder={t.repro_notes_placeholder}
                                  value={editReproForm.catatan}
                                  onChange={e => setEditReproForm(f => ({...f, catatan: e.target.value}))}
                                />
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={cancelEditRepro}
                                  className="flex-1 py-1.5 text-xs font-bold rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] transition-colors"
                                  style={{ background: 'var(--bg-card)' }}
                                >
                                  {t.btn_cancel}
                                </button>
                                <button
                                  onClick={() => saveEditRepro(item)}
                                  disabled={savingRepro}
                                  className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] flex items-center justify-center gap-1 transition-colors"
                                >
                                  {savingRepro ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                  {savingRepro ? t.btn_saving : t.btn_save}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Mode Tampil Normal ──────────────────────── */
                            <>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-[var(--color-text-muted)]">{t.livestock_repro_mating_date}</p>
                                  <p className="font-semibold text-[var(--color-text-secondary)]">{formatTgl(item.tanggal_ib || item.service_date, lang)}</p>
                                </div>
                                <div>
                                  <p className="text-[var(--color-text-muted)]">{t.livestock_repro_calving}</p>
                                  <p className="font-bold text-[var(--color-forest)]">{isPregnant ? formatTgl(hplDate, lang) : '—'}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-[var(--color-text-muted)]">{t.livestock_repro_inseminator}</p>
                                  <p className="font-semibold text-[var(--color-text-secondary)]">{item.pemberi_ib || item.petugas || item.technician || '—'}</p>
                                </div>
                                {item.catatan && (
                                  <div>
                                    <p className="text-[var(--color-text-muted)]">{t.repro_notes}</p>
                                    <p className="text-[10px] text-[var(--color-text-secondary)] italic line-clamp-2" title={item.catatan}>{item.catatan}</p>
                                  </div>
                                )}
                              </div>

                              {/* ── Konfirmasi Kehamilan ─── */}
                              {isPending && (
                                <div className="pt-2 border-t border-[var(--color-border)]">
                                  <p className="text-[10px] text-[var(--color-text-muted)] font-semibold mb-2 uppercase">{t.livestock_repro_confirm_title}</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => confirmPregnancy(item, true)}
                                      disabled={isConfirming}
                                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-bold rounded-xl bg-[var(--color-success-bg)] text-[var(--color-success)] hover:opacity-80 transition-opacity disabled:opacity-50"
                                    >
                                      {isConfirming ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={13} />}
                                      {t.livestock_repro_confirm_pregnant}
                                    </button>
                                    <button
                                      onClick={() => confirmPregnancy(item, false)}
                                      disabled={isConfirming}
                                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-bold rounded-xl bg-[var(--color-danger-bg)] text-[var(--color-danger)] hover:opacity-80 transition-opacity disabled:opacity-50"
                                    >
                                      {isConfirming ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={13} />}
                                      {t.livestock_repro_confirm_failed}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Tombol ubah ulang jika sudah dikonfirmasi */}
                              {(isPregnant || isFailed) && (
                                <div className="pt-2 border-t border-[var(--color-border)]">
                                  <button
                                    onClick={() => confirmPregnancy(item, !isPregnant)}
                                    disabled={isConfirming}
                                    className="w-full text-[10px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors py-1"
                                  >
                                    {isConfirming ? (lang === 'id' ? 'Memproses...' : 'Processing...') : `↩ ${t.livestock_repro_change_to} ${isPregnant ? t.livestock_repro_failed : t.livestock_repro_pregnant}`}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── MOBILE FULLSCREEN DETAIL MODAL ── */}
        <div className="md:hidden fixed inset-0 z-[900] bg-white overflow-y-auto animate-in slide-in-from-bottom duration-300">
          {/* Header Photo */}
          <div className="relative w-full h-[60vh] min-h-[450px]">
            {selectedSapi.foto ? (
              <img 
                src={selectedSapi.foto} 
                alt={selectedSapi.nama} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full bg-gray-300 relative" />
            )}
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/40 to-transparent pointer-events-none" />
            
            {/* Photo Action Buttons if No Photo */}
            {!selectedSapi.foto && (
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                  <div className="flex flex-col items-center mb-6">
                     <div className="bg-white/10 backdrop-blur-md p-4 rounded-full mb-3 border border-white/20 shadow-lg">
                        <Beef size={40} className="text-white/80" />
                     </div>
                     <p className="text-[13px] font-medium text-white/90 tracking-wide" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Belum ada foto</p>
                  </div>
                  <div className="flex items-center bg-white/20 backdrop-blur-md p-1 rounded-2xl border border-white/30 shadow-xl pointer-events-auto">
                     <label className="px-4 py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer active:scale-95 transition-transform flex items-center gap-2 hover:bg-white/10">
                       <Camera size={14} /> Ambil Foto
                       <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                             const url = URL.createObjectURL(e.target.files[0]);
                             setSelectedSapi({...selectedSapi, foto: url});
                          }
                       }} />
                     </label>
                     <div className="w-[1px] h-4 bg-white/30 mx-1" />
                     <label className="px-4 py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer active:scale-95 transition-transform flex items-center gap-2 hover:bg-white/10">
                       <ImagePlus size={14} /> Unggah Foto
                       <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                             const url = URL.createObjectURL(e.target.files[0]);
                             setSelectedSapi({...selectedSapi, foto: url});
                          }
                       }} />
                     </label>
                  </div>
               </div>
            )}
            
            {/* Top Bar / Back Button */}
            <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex justify-between items-start z-30">
              <button onClick={() => setSelectedSapi(null)} className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-800 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-white/50 active:scale-95 transition-transform">
                <ChevronLeft size={24} />
              </button>
              {/* Optional top right buttons */}
            </div>

            {/* Text Content at Bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-6 pb-12 text-white">
               <div className="flex gap-2 mb-3">
                  <span className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white border border-white/10 uppercase tracking-wider">
                    ID: #{selectedSapi.id}
                  </span>
                  <span className="bg-[#2E7D32] px-3 py-1.5 rounded-full text-[10px] font-bold text-white shadow-sm flex items-center gap-1.5 tracking-wider uppercase">
                     <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                     {selectedSapi.status_kesehatan === 'Sehat' ? 'PRODUKTIF' : selectedSapi.status_kesehatan?.toUpperCase() || 'PRODUKTIF'}
                  </span>
               </div>
               <h2 className="text-[36px] font-extrabold mb-1 tracking-tight leading-none" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                 {selectedSapi.nama}
               </h2>
               <p className="text-[13px] text-white/90 font-medium" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                 {selectedSapi.jenis} • {hitungUsia(selectedSapi.bulan_tahun_lahir, lang)}
               </p>
            </div>
          </div>

          {/* Action Buttons — Tab Switchers */}
          <div className="px-5 py-6 grid grid-cols-3 gap-3 bg-white relative z-10 -mt-6 rounded-t-[32px] shadow-[0_-8px_20px_rgba(0,0,0,0.06)]">
            {/* Tab 1: Riwayat Ternak */}
            <button 
              onClick={() => setActiveDetailTab('riwayat')}
              className={`py-3.5 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'riwayat'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9]'
              }`}
            >
               <ClipboardList size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Riwayat{`\n`}Ternak</span>
            </button>
            {/* Tab 2: Analitik */}
            <button 
              onClick={() => setActiveDetailTab('analitik')}
              className={`py-3.5 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'analitik'
                  ? 'bg-[#FFF8E1] text-[#F57F17] shadow-lg shadow-yellow-900/10'
                  : 'bg-[#FFF8E1] text-[#F57F17] border border-[#FFECB3] opacity-70'
              }`}
            >
               <LineChart size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide">Analitik</span>
            </button>
            {/* Tab 3: Prediksi Estrus */}
            <button 
              onClick={() => setActiveDetailTab('estrus')}
              className={`py-3.5 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'estrus'
                  ? 'bg-[#EDE7F6] text-[#6200EA] shadow-lg shadow-purple-900/10'
                  : 'bg-[#EDE7F6] text-[#7C4DFF] border border-[#D1C4E9] opacity-70'
              }`}
            >
               <Sparkles size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Prediksi{`\n`}Estrus</span>
            </button>
          </div>

          {/* Bottom Display Area */}
          {activeDetailTab === 'riwayat' ? (
            <>
              {/* Riwayat Ternak - Card Style */}
              <div className="px-5 pb-6 bg-white">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-[17px] font-extrabold text-[#111]">Riwayat Ternak</h3>
                </div>

                {sortedReproHistory.length === 0 ? (
                  <div className="text-center text-sm text-[var(--text-3)] py-8">Belum ada riwayat.</div>
                ) : (
                  <div className="space-y-3">
                    {sortedReproHistory.map((item) => {
                      const isPregnant    = item.results === true || item.results === 'true' || item.is_pregnant === true;
                      const isFailed      = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                      const isNote        = item.catatan && !item.pemberi_ib && !item.metode;
                      const isPending     = !isPregnant && !isFailed && !isNote;
                      const rawDate       = item.tanggal_ib || item.service_date;
                      const estCalving    = rawDate && isPregnant
                        ? new Date(new Date(rawDate).getTime() + 283 * 24 * 60 * 60 * 1000)
                            .toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—';
                      const formattedDate = rawDate
                        ? new Date(rawDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—';
                      return (
                        <div key={item.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-extrabold text-[14px]" style={{ color: 'var(--text-1)' }}>
                                {(item.metode || 'IB').toUpperCase()}
                                {item.jumlah_ib ? <span className="font-normal text-[11px] ml-1.5" style={{ color: 'var(--text-3)' }}>(Ke-{item.jumlah_ib})</span> : ''}
                              </p>
                              {item.catatan && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{item.catatan}</p>}
                            </div>
                            {isPregnant && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] shrink-0">Bunting</span>}
                            {isFailed   && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#EF4444] shrink-0">Gagal</span>}
                            {isPending  && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFF8E1] text-[#F57F17] shrink-0">Menunggu</span>}
                          </div>
                          {/* Detail rows */}
                          <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                            <div className="flex justify-between">
                              <span>Tanggal Kawin</span>
                              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{formattedDate}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Metode</span>
                              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{(item.metode || 'IB').toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Perkiraan Calving</span>
                              <span style={{ color: isPregnant ? 'var(--color-forest)' : 'var(--text-1)', fontWeight: isPregnant ? 700 : 600 }}>{estCalving}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Inseminator</span>
                              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{item.pemberi_ib || item.petugas || item.technician || '—'}</span>
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '0.5px solid var(--border)' }}>
                            {isPending && (
                              <>
                                <button
                                  onClick={() => confirmPregnancy(item, true)}
                                  disabled={confirmingPregnancy === item.id}
                                  className="flex-1 py-1.5 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-transform"
                                  style={{ background: '#ECFDF5', color: '#10B981' }}
                                >
                                  {confirmingPregnancy === item.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Bunting
                                </button>
                                <button
                                  onClick={() => confirmPregnancy(item, false)}
                                  disabled={confirmingPregnancy === item.id}
                                  className="flex-1 py-1.5 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-transform"
                                  style={{ background: '#FEF2F2', color: '#EF4444' }}
                                >
                                  {confirmingPregnancy === item.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Gagal
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => deleteReproRecord(item)}
                              className="p-1.5 rounded-lg ml-auto"
                              style={{ color: 'var(--red, #EF4444)', background: 'var(--bg-hover)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Catat IB Button */}
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    const countIB = sortedReproHistory.filter(h => h.metode?.toLowerCase() === 'ib' || h.method?.toLowerCase() === 'ib').length + 1;
                    setReproForm(f => ({ ...f, tanggal_ib: today, jumlah_ib: countIB }));
                    setIsReproModalOpen(true);
                  }}
                  className="w-full mt-4 py-3 rounded-[14px] flex items-center justify-center gap-2 font-bold text-[13px] transition-all active:scale-95"
                  style={{ background: '#2E7D32', color: '#fff' }}
                >
                  <ClipboardList size={16} strokeWidth={2.5} />
                  + Catat IB
                </button>
              </div>

              {/* Promo Banner */}
              <div className="px-5 pb-12 bg-white">
                <div className="bg-[#F5F8F6] p-5 rounded-[20px] border border-[#E8F0EA] flex gap-4 overflow-hidden relative">
                   <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#E8F0EA] rounded-full opacity-50 pointer-events-none" />
                   <div className="bg-[#E8F0EA] w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
                      <Activity size={22} className="text-[#2E7D32]" />
                   </div>
                   <div className="relative z-10">
                      <h4 className="text-[14px] font-bold text-[#111] mb-1">Pantau {selectedSapi.nama} 24/7</h4>
                      <p className="text-[11px] text-[#555] leading-relaxed mb-3 pr-2">Gunakan Smart Collar HERD untuk deteksi estrus otomatis dan monitoring kesehatan.</p>
                      <button className="text-[11px] font-bold text-[#2E7D32] flex items-center gap-1">Lihat Produk Sensor <ChevronRight size={14} /></button>
                   </div>
                </div>
              </div>
            </>
          ) : activeDetailTab === 'analitik' ? (
            <div className="px-5 pb-12 pt-2 bg-[var(--bg-surface)] min-h-[500px]">
              <CowAnalyticsView selectedCow={selectedSapi} />
            </div>
          ) : (
            <div className="px-5 pb-12 pt-2 bg-[var(--bg-surface)] min-h-[500px]">
              <CowEstrusView selectedCow={selectedSapi} reproHistory={sortedReproHistory} />
            </div>
          )}
        </div>
        </>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* MODAL: Tambah Reproduksi — z-[1100] di atas drawer            */}
      {/* ────────────────────────────────────────────────────────────── */}
      {isReproModalOpen && (
        <div className="fixed inset-0 z-[1100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 w-full max-w-lg animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">{t.repro_record_new}</h2>
              <button onClick={() => setIsReproModalOpen(false)} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)]">
                <X size={20} />
              </button>
            </div>

            <form className="space-y-4" onSubmit={onTambahReproduksi}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_ib_date}</label>
                  <input 
                    type="date" 
                    style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" 
                    required
                    value={reproForm.tanggal_ib}
                    onChange={handleTanggalIbChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_ib_count}</label>
                  <input 
                    type="number" min="1" max="10"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]"
                    value={reproForm.jumlah_ib}
                    onChange={e => setReproForm({...reproForm, jumlah_ib: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_inseminator}</label>
                <input 
                  type="text" 
                  placeholder={t.repro_inseminator_placeholder} 
                  style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" 
                  value={reproForm.pemberi_ib}
                  onChange={e => setReproForm({...reproForm, pemberi_ib: e.target.value})}
                />
              </div>

              {reproForm.tanggal_ib && (
                <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)' }} className="p-4 rounded-2xl space-y-3 shadow-inner">
                  <h4 className="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                    <Calendar size={14}/> Estimasi Jadwal (Auto)
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <p className="text-[var(--color-text-muted)] font-medium">Deteksi Birahi Kembali</p>
                      <p className="font-semibold text-[var(--color-text-secondary)] mt-0.5">{formatTgl(reproForm.birahi, lang)}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-muted)] font-medium">Pemeriksaan Kebuntingan</p>
                      <p className="font-semibold text-[var(--color-text-secondary)] mt-0.5">{formatTgl(reproForm.bunting, lang)}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-muted)] font-medium">Perkiraan Melahirkan (HPL)</p>
                      <p className="font-bold text-[var(--color-primary)] mt-0.5">{formatTgl(reproForm.hpl, lang)}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-muted)] font-medium">Estimasi Lepas Sapih</p>
                      <p className="font-semibold text-[var(--color-text-secondary)] mt-0.5">{formatTgl(reproForm.sapih, lang)}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_notes}</label>
                <textarea rows="2" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] resize-none" placeholder={t.repro_notes_placeholder} value={reproForm.catatan} onChange={e => setReproForm({...reproForm, catatan: e.target.value})} />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsReproModalOpen(false)} style={{ padding: '10px 24px', border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flex: 1 }}>{t.btn_cancel}</button>
                <button type="submit" className="flex-1 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-lg">{t.repro_save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

    {/* SCAN MODAL */}
    <ScanModal
      isOpen={scanOpen}
      onClose={() => setScanOpen(false)}
      onResult={(data) => {
        const scannedRfid = data.id || data.rfid || '';
        if (scanTarget === 'edit') {
          setEditForm(f => ({ ...f, rfid: scannedRfid }));
        } else {
          setTambahForm(f => ({ ...f, rfid: scannedRfid }));
        }
        setScanOpen(false);
        toast.success((lang === 'id' ? 'RFID ditemukan: ' : 'RFID found: ') + scannedRfid);
      }}
    />


    </>
  );
}
