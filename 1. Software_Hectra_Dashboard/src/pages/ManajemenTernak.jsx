import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Plus, Filter, Link, Unlink, ChevronRight, Edit2, Trash2, Activity, MapPin, X, Calendar, ClipboardList, Beef, Loader2, CheckCircle, XCircle, Baby, Pencil, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTernakStore } from '../store/useTernakStore';
import axiosInstance from '../lib/axios';
import { toast } from '@/store/toastStore';
import ScanModal from '@/components/scan/ScanModal';
import PairCollarModal from '@/components/shared/PairCollarModal';
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
  const [isTambahModalOpen, setIsTambahModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);

  // Edit Reproduksi states
  const [editReproItem, setEditReproItem] = useState(null); // which repro record is being edited inline
  const [editReproForm, setEditReproForm] = useState({});
  const [savingRepro, setSavingRepro] = useState(false);
  const [confirmingPregnancy, setConfirmingPregnancy] = useState(null); // record_id being confirmed

  // Form states
  const [tambahForm, setTambahForm] = useState({
    nama: '', rfid: '', jenis: 'Simental', lahir: '', kesehatan: 'Sehat'
  });
  const [editForm, setEditForm] = useState({
    nama: '', jenis: 'Simental', lahir: '', kesehatan: 'Sehat'
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

  // History states
  const [reproHistory, setReproHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  const handleBirahiChange = (e) => {
    const val = e.target.value;
    setReproForm(prev => {
      let b = prev.bunting;
      let h = prev.hpl;
      if (val) {
        const bDate = new Date(val);
        bDate.setMonth(bDate.getMonth() + 3);
        b = bDate.toISOString().split('T')[0];
        
        const hDate = new Date(val);
        hDate.setMonth(hDate.getMonth() + 9);
        hDate.setDate(hDate.getDate() + 10);
        h = hDate.toISOString().split('T')[0];
      }
      return { ...prev, birahi: val, bunting: b, hpl: h };
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
      nama: editForm.nama,
      jenis: editForm.jenis,
      bulan_tahun_lahir: editForm.lahir,
      kesehatan: editForm.kesehatan
    });
    if (res.success) {
      setSelectedSapi({
        ...selectedSapi,
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

  // --- Konfirmasi hasil IB (hamil / tidak) ---
  const confirmPregnancy = async (item, isPregnant) => {
    const label = isPregnant 
      ? (lang === 'id' ? 'Bunting (Berhasil)' : 'Pregnant (Success)') 
      : (lang === 'id' ? 'Gagal (Kembali Birahi)' : 'Failed (Return to Estrus)');
    const confirmed = await ask({
      title: t.livestock_repro_confirm_title,
      message: (lang === 'id'
        ? `Tandai hasil inseminasi sapi ${selectedSapi?.nama} sebagai "${label}"? Status ini akan tersimpan ke database dan memperbarui notifikasi.`
        : `Mark artificial insemination result for cow ${selectedSapi?.nama} as "${label}"? This status will be saved to the database and update notifications.`),
      confirmText: isPregnant ? t.livestock_repro_confirm_pregnant : t.livestock_repro_confirm_failed,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

      <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '16px 24px', boxShadow: 'var(--shadow-card)', border: '0.5px solid var(--border)' }} className="animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
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
              <option value="Simental">{t.breed_simental}</option>
              <option value="Bali">{t.breed_bali}</option>
              <option value="Brahman">{t.breed_brahman}</option>
              <option value="Limosin">{t.breed_limousin}</option>
            </select>
            <button onClick={() => setFilters({ kesehatan: 'all', jenis: 'all' })} style={{ fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'Inter, sans-serif' }}>{t.btn_reset}</button>
          </div>
        )}

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
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

        {/* Mobile View: List Items */}
        <div className="md:hidden space-y-3">
          {filteredSapi.map(sapi => (
            <div 
              key={sapi.id} 
              style={{ padding: '14px', border: '0.5px solid var(--border)', borderRadius: '16px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
              className="space-y-3 cursor-pointer"
              onClick={() => setSelectedSapi(sapi)}
            >
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--color-bg-surface)] rounded-full flex items-center justify-center shrink-0">
                    <Beef size={20} className="text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--color-primary)]">{sapi.nama}</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">{sapi.id}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] px-2.5 py-0.5 rounded-full font-bold",
                  sapi.status_kesehatan === 'Sehat' ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" :
                  sapi.status_kesehatan === 'Hamil' ? "bg-[var(--color-info-bg)] text-[var(--color-info)]" :
                  "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                )}>
                  {sapi.status_kesehatan === 'Sehat' ? t.livestock_filter_sehat :
                   sapi.status_kesehatan === 'Hamil' ? t.livestock_filter_hamil :
                   sapi.status_kesehatan === 'Sakit' ? t.livestock_filter_sakit :
                   t.livestock_filter_care}
                </span>
              </div>
              {/* Detail rows */}
              <div className="space-y-1.5 text-xs pt-2 border-t border-[var(--border)]" style={{ color: 'var(--text-2)' }}>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">{t.livestock_table_breed}</span>
                  <span className="font-semibold">{sapi.jenis}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">{t.livestock_table_age}</span>
                  <span className="font-semibold">{hitungUsia(sapi.bulan_tahun_lahir, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">{t.livestock_table_collar}</span>
                  <span className="font-semibold">{sapi.collar_id || '-'}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredSapi.length === 0 && (
            <p className="text-center text-xs italic text-[var(--color-text-muted)] py-8">{t.livestock_no_data}</p>
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
                    <option value="Simental">{t.breed_simental}</option>
                    <option value="Brahman">{t.breed_brahman}</option>
                    <option value="Limosin">{t.breed_limousin}</option>
                    <option value="Bali">{t.breed_bali}</option>
                    <option value="PO">{t.breed_po}</option>
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
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_edit_rfid_disabled}</label>
                  <input type="text" style={{ background: 'var(--bg-card)', color: 'var(--text-3)', border: '0.5px solid var(--border)' }} className="w-full px-4 py-2.5 rounded-xl outline-none opacity-60 cursor-not-allowed" value={selectedSapi?.id || ''} disabled />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_breed}</label>
                  <select style={{ width: '100%', padding: '10px 14px', border: '0.5px solid var(--border)', borderRadius: '10px', background: 'var(--bg-surface)', color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' }} value={editForm.jenis} onChange={e => setEditForm({...editForm, jenis: e.target.value})}>
                    <option value="Simental">{t.breed_simental}</option>
                    <option value="Brahman">{t.breed_brahman}</option>
                    <option value="Limosin">{t.breed_limousin}</option>
                    <option value="Bali">{t.breed_bali}</option>
                    <option value="PO">{t.breed_po}</option>
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
        <div className="fixed inset-0 z-[900] flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedSapi(null)}>
          <div style={{ background: 'var(--bg-surface)', borderLeft: '0.5px solid var(--border)' }} className="w-full max-w-md h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
            <div style={{ background: 'var(--bg-surface)', borderBottom: '0.5px solid var(--border)' }} className="sticky top-0 backdrop-blur z-10 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">{t.livestock_detail_title}</h2>
              <button onClick={() => setSelectedSapi(null)} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
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
                          nama: selectedSapi.nama || '',
                          jenis: selectedSapi.jenis || 'Simental',
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
                  <button 
                    onClick={() => setIsReproModalOpen(true)}
                    className="text-sm font-bold text-[var(--color-primary)] bg-[var(--color-bg-surface)] px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                  >
                    <Plus size={16} /> {t.btn_add}
                  </button>
                </div>
                
                <div style={{ background: 'var(--bg-card)' }} className="border border-[var(--color-border)] rounded-2xl divide-y divide-[var(--color-border)] overflow-hidden">
                  {loadingHistory ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                      {t.livestock_repro_loading}
                    </div>
                  ) : reproHistory.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic">
                      {t.livestock_repro_empty}
                    </div>
                  ) : (
                    reproHistory.map((item, idx) => {
                      const isPregnant = item.results === true || item.results === 'true' || item.is_pregnant === true;
                      const isFailed = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                      const isPending = !isPregnant && !isFailed;
                      const isEditingThis = editReproItem === item.id;
                      const isConfirming = confirmingPregnancy === item.id;

                      const hplDate = item.hpl || (item.tanggal_ib ? new Date(new Date(item.tanggal_ib).getTime() + 283 * 24 * 60 * 60 * 1000) : null);
                      
                      return (
                        <div key={item.id || idx} className="p-4 space-y-3">
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
                                  🐮 {t.livestock_repro_pregnant}
                                </span>
                              )}
                              {isFailed && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
                                  ❌ {t.livestock_repro_failed}
                                </span>
                              )}
                              {isPending && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
                                  ⏳ {t.livestock_repro_pending}
                                </span>
                              )}
                              {/* Tombol edit inline */}
                              {!isEditingThis && (
                                <button
                                  onClick={() => startEditRepro(item)}
                                  className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-surface)] transition-colors"
                                  title={t.repro_edit_record}
                                >
                                  <Pencil size={13} />
                                </button>
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
                                    {isConfirming ? (lang === 'id' ? '⏳ Memproses...' : '⏳ Processing...') : `↩ ${t.livestock_repro_change_to} ${isPregnant ? t.livestock_repro_failed : t.livestock_repro_pregnant}`}
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
                    onChange={e => setReproForm({...reproForm, tanggal_ib: e.target.value})}
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

              <div className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl space-y-4">
                <h4 className="text-sm font-bold text-[var(--color-primary)] flex items-center gap-2">
                  <Calendar size={16}/> {t.repro_auto_calculator}
                </h4>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_estrus_date}</label>
                  <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" value={reproForm.birahi} onChange={handleBirahiChange}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_pregnancy_pred}</label>
                    <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm" value={reproForm.bunting} onChange={e => setReproForm({...reproForm, bunting: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_estimated_hpl}</label>
                    <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm font-bold" value={reproForm.hpl} onChange={e => setReproForm({...reproForm, hpl: e.target.value})} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_weaning_date}</label>
                <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" value={reproForm.sapih} onChange={e => setReproForm({...reproForm, sapih: e.target.value})} />
              </div>
              
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
        setTambahForm(f => ({ ...f, rfid: data.id || data.rfid || '' }));
        setScanOpen(false);
        toast.success((lang === 'id' ? 'RFID ditemukan: ' : 'RFID found: ') + (data.nama || data.name));
      }}
    />
    </>
  );
}
