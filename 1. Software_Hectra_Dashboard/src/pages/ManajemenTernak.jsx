import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, Link, Unlink, ChevronRight, Edit2, Trash2, Activity, MapPin, X, Calendar, ClipboardList, Beef, Loader2, CheckCircle, XCircle, Baby, Pencil, Save, Tractor, PawPrint, SlidersHorizontal, ChevronLeft, Camera, ImagePlus, LineChart, Sparkles, Edit3, Dna } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useTernakStore } from '../store/useTernakStore';
import axiosInstance from '../lib/axios';
import { toast } from '@/store/toastStore';
import { handleError } from '@/lib/errorHandler';
import { Stepper, StepperItem, StepperTrigger, StepperIndicator, StepperTitle, StepperDescription, StepperSeparator } from "../components/ui/stepper";
import ScanModal from '@/components/scan/ScanModal';
import PairCollarModal from '@/components/shared/PairCollarModal';
import CowAnalyticsView from '@/components/shared/CowAnalyticsView';
import CowEstrusView from '@/components/shared/CowEstrusView';
import AddCowModal from '@/components/shared/AddCowModal';
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
  const navigate = useNavigate();

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else if (location.state?.fromDashboard) {
      navigate('/');
    } else {
      setSelectedSapi(null);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ kesehatan: 'all', jenis: 'all' });
  const [scanOpen, setScanOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState([]);
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

  const [editForm, setEditForm] = useState({
    nama: '', jenis: 'Simmental', lahir: '', kesehatan: 'Sehat'
  });
  const [reproForm, setReproForm] = useState({
    tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
    birahi: '', bunting: '', hpl: '', sapih: '', catatan: ''
  });

  const handleBulkDelete = async () => {
    if (selectedForDelete.length === 0) return;
    const confirmed = await ask({
      title: "Hapus Banyak Ternak",
      message: `Apakah Anda yakin ingin menghapus ${selectedForDelete.length} sapi? Data yang dihapus tidak bisa dikembalikan.`,
      confirmText: 'Hapus Semua',
      cancelText: 'Batal',
      isDanger: true
    });
    if (!confirmed) return;
    
    try {
      await Promise.all(selectedForDelete.map(id => axiosInstance.delete(`/scanner/hewan/${id}`)));
      toast.success(`${selectedForDelete.length} sapi berhasil dihapus`);
      setIsSelectMode(false);
      setSelectedForDelete([]);
      fetchSapiList();
    } catch(err) {
      handleError(err, 'hapus banyak sapi');
    }
  };

  // Handle redirect from scan bottom sheet
  useEffect(() => {
    if (location.state?.registerUid) {
      // The state injection is now slightly complicated because AddCowModal manages its own form state.
      // But we just open it. The AddCowModal handles its own form. 
      // If we need to pass initial rfid, we could pass it as a prop.
      // For now we just open it.
      setIsTambahModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state?.selectedCowId) {
      // Find the cow in the herd and select it
      // We will do it in another useEffect after data is loaded
    }
    
    // Support URL param trigger for add action
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add') {
      setIsTambahModalOpen(true);
      // Clean up URL so it doesn't pop up again on manual refresh
      navigate(location.pathname, { replace: true, state: location.state });
    } else if (params.get('filter')) {
      setFilters(prev => ({ ...prev, kesehatan: params.get('filter') }));
      // Clean up URL
      navigate(location.pathname, { replace: true, state: location.state });
    }
  }, [location.state, location.search]);

  // Handle auto-selecting cow after data is loaded
  useEffect(() => {
    if (location.state?.selectedCowId && sapiList.length > 0) {
      const cow = sapiList.find(h => h.id === location.state.selectedCowId || h.cow_id === location.state.selectedCowId);
      if (cow) {
        setSelectedSapi(cow);
        // Clear selectedCowId from state but keep 'from' so back button works
        navigate(location.pathname, { 
          replace: true, 
          state: { ...location.state, selectedCowId: undefined } 
        });
      }
    }
  }, [location.state, sapiList]);

  // Reset tab to riwayat every time a new cow is opened
  useEffect(() => {
    if (selectedSapi?.id) {
      setActiveDetailTab('riwayat');
    }
  }, [selectedSapi?.id]);

  // Intercept hardware back button to close drawer instead of going back
  useEffect(() => {
    if (selectedSapi) {
      window.history.pushState({ drawerOpen: true }, '');
    }
  }, [selectedSapi]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (selectedSapi) {
        handleBack();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedSapi]);

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
      // Reset form when opening a cow to avoid lingering template data
      setReproForm({
        tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
        birahi: '', bunting: '', hpl: '', sapih: '', catatan: ''
      });
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
      const matchKesehatan = 
        filters.kesehatan === 'all' ? true :
        filters.kesehatan === 'pantau' ? !!s.collar_id :
        filters.kesehatan === 'action' ? (s.status_kesehatan === 'Sakit' || s.status_kesehatan === 'Butuh Perawatan' || s.status_kesehatan === 'Perlu IB') :
        s.status_kesehatan === filters.kesehatan;
      const matchJenis = filters.jenis === 'all' || s.jenis === filters.jenis;
      return matchSearch && matchKesehatan && matchJenis;
    });
  }, [searchQuery, sapiList, filters]);

  const handleTanggalIbChange = (e) => {
    const val = e.target.value;
    setReproForm(prev => ({ 
      ...prev, 
      tanggal_ib: val
    }));
  };

  // The onTambahSapi function has been moved to AddCowModal

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
    let formattedName = editForm.nama
      ? editForm.nama
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      : '';

    const res = await editSapi(selectedSapi.id, {
      new_rfid: editForm.rfid,
      nama: formattedName,
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

    if (editReproItem) {
      await saveEditRepro(editReproItem);
      return;
    }

    const formattedInseminator = reproForm.pemberi_ib
      ? reproForm.pemberi_ib
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      : '';

    const payload = { ...reproForm, pemberi_ib: formattedInseminator, rfid: selectedSapi.id };
    const res = await tambahReproduksi(payload);
    if (res.success) {
      setEditReproItem(null);
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

  // --- Edit reproduksi record ---
  const startEditRepro = (item) => {
    setEditReproItem(item);
    const tgl = item.tanggal_ib || item.service_date ? new Date(item.tanggal_ib || item.service_date).toISOString().split('T')[0] : '';
    const hpl = item.hpl ? new Date(item.hpl).toISOString().split('T')[0] : '';
    setReproForm({
      tanggal_ib: tgl,
      pemberi_ib: item.pemberi_ib || item.petugas || item.technician || '',
      jumlah_ib: item.jumlah_ib || 1,
      catatan: item.catatan || item.notes || '',
      hpl: hpl,
    });
    setIsReproModalOpen(true);
  };

  const cancelEditRepro = () => {
    setEditReproItem(null);
    setReproForm({});
    setIsReproModalOpen(false);
  };

  const saveEditRepro = async (item) => {
    setSavingRepro(true);
    try {
      const formattedInseminator = reproForm.pemberi_ib
        ? reproForm.pemberi_ib
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        : '';

      const payload = {
        rfid: selectedSapi.id,
        service_date: reproForm.tanggal_ib,
        technician: formattedInseminator,
        notes: reproForm.catatan,
        jumlah_ib: parseInt(reproForm.jumlah_ib) || 1,
        is_pregnant: item.results === true || item.is_pregnant === true || item.results === 'true' ? 'true' : item.results === false || item.is_pregnant === false || item.results === 'failed' ? 'false' : 'pending',
      };
      await axiosInstance.put(`/reproduction/${item.id}`, payload);
      toast.success(t.repro_toast_update_success);
      setEditReproItem(null);
      setIsReproModalOpen(false);
      setReproForm({
        tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
        birahi: '', bunting: '', hpl: '', sapih: '', catatan: ''
      });
      reloadReproHistory(selectedSapi.id);
    } catch (err) {
      handleError(err, 'update data reproduksi');
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
      
      // Update cow status automatically
      await editSapi(selectedSapi.id, { status_kesehatan: isPregnant ? 'Hamil' : 'Sehat' });
      
      toast.success(lang === 'id' ? `Status IB dikonfirmasi: ${label}` : `AI status confirmed: ${label}`);
      reloadReproHistory(selectedSapi.id);
      fetchSapiList(); // refresh status kesehatan
    } catch (err) {
      handleError(err, 'konfirmasi status bunting');
    } finally {
      setConfirmingPregnancy(null);
    }
  };

  return (
    <>
      {isSelectMode && (
        <div className="fixed top-0 left-0 w-full h-[60px] bg-white z-[9999] flex items-center justify-between px-4 border-b border-gray-200 shadow-sm animate-in fade-in duration-200">
          <button 
            onClick={() => { setIsSelectMode(false); setSelectedForDelete([]); }}
            className="text-[var(--text-2)] font-bold text-sm px-2 py-2"
          >
            Batal
          </button>
          
          <div className="text-[15px] font-bold text-[var(--text-1)]">
            {selectedForDelete.length > 0 ? `${selectedForDelete.length} Dipilih` : 'Pilih Ternak'}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (selectedForDelete.length === filteredSapi.length) {
                  setSelectedForDelete([]);
                } else {
                  setSelectedForDelete(filteredSapi.map(s => s.id));
                }
              }}
              className="text-[var(--accent)] font-bold text-sm"
            >
              {selectedForDelete.length === filteredSapi.length ? 'Batal Semua' : 'Semua'}
            </button>
            <button 
              onClick={handleBulkDelete}
              disabled={selectedForDelete.length === 0}
              className={`flex items-center justify-center p-2 rounded-full ${selectedForDelete.length > 0 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-400'}`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}

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

      {/* ── MOBILE HEADER (Brand Orange with DNA accent) ── */}
      <div 
        className="md:hidden -mx-4 md:-mx-[22px] px-6 pt-[76px] pb-[68px] shadow-lg relative overflow-hidden mb-0 text-white flex flex-col justify-between rounded-t-none"
        style={{ 
          background: 'linear-gradient(135deg, #FF7B1C 0%, #E65C00 100%)',
          borderBottomLeftRadius: '32px',
          borderBottomRightRadius: '32px'
        }}
      >
        {/* Subtle DNA / Fingerprint Accent */}
        <Dna 
          size={240} 
          strokeWidth={0.8} 
          className="absolute -top-12 -right-12 text-white opacity-[0.12] rotate-12 pointer-events-none" 
        />

        <div className="flex justify-between items-start relative z-10">
          <div className="w-full">
            <p className="text-[10px] font-black opacity-90 mb-1 uppercase tracking-widest text-[#FFD8B5]">KELOLA DATA PROFIL DAN RIWAYAT REPRODUKSI SAPI.</p>
            <h1 className="text-[32px] font-black tracking-tight leading-none mb-6">Ternak Anda</h1>
            
            <div className="flex items-center gap-3 w-full">
              {/* Cards (Sapi, Bunting, Sehat) */}
              <button 
                onClick={() => setFilters(prev => ({...prev, kesehatan: 'all'}))}
                className="bg-white/20 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl p-3 flex flex-col items-center justify-center flex-1 aspect-square relative overflow-hidden group transition-all duration-300 border border-white/30 hover:bg-white/25 active:scale-95"
              >
                <Beef size={28} className="text-white mb-1.5 opacity-90" strokeWidth={1.5} />
                <span className="text-[22px] font-black leading-none mb-1">{sapiList.length}</span>
                <span className="text-[10px] font-medium opacity-90 text-center leading-tight tracking-wide">Total<br/>Sapi</span>
              </button>
              
              <button 
                onClick={() => setFilters(prev => ({...prev, kesehatan: 'Hamil'}))}
                className="bg-white/20 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl p-3 flex flex-col items-center justify-center flex-1 aspect-square relative overflow-hidden group transition-all duration-300 border border-white/30 hover:bg-white/25 active:scale-95"
              >
                <Baby size={28} className="text-white mb-1.5 opacity-90" strokeWidth={1.5} />
                <span className="text-[22px] font-black leading-none mb-1">{sapiList.filter(s => s.status_kesehatan === 'Hamil').length}</span>
                <span className="text-[10px] font-medium opacity-90 text-center leading-tight tracking-wide">Bunting</span>
              </button>
              
              <button 
                onClick={() => setFilters(prev => ({...prev, kesehatan: 'Sehat'}))}
                className="bg-white/20 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl p-3 flex flex-col items-center justify-center flex-1 aspect-square relative overflow-hidden group transition-all duration-300 border border-white/30 hover:bg-white/25 active:scale-95"
              >
                <CheckCircle size={28} className="text-white mb-1.5 opacity-90" strokeWidth={1.5} />
                <span className="text-[22px] font-black leading-none mb-1">{sapiList.filter(s => s.status_kesehatan === 'Sehat').length}</span>
                <span className="text-[10px] font-medium opacity-90 text-center leading-tight tracking-wide">Sehat</span>
              </button>
            </div>
          </div>
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
          <button 
            onClick={() => setIsSelectMode(!isSelectMode)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: `0.5px solid ${isSelectMode ? 'var(--accent)' : 'var(--border)'}`, color: isSelectMode ? 'var(--accent)' : 'var(--text-2)', borderRadius: '10px', background: isSelectMode ? 'var(--accent-dim)' : 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s' }}
          >
            <ClipboardList size={16} />
            Pilih
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
                {isSelectMode && <th className="py-3 px-4 font-medium w-10"></th>}
                <th className="py-3 px-4 font-medium">{t.livestock_table_name}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_rfid}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_breed}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_age}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_health}</th>
                <th className="py-3 px-4 font-medium">{t.livestock_table_collar}</th>
                {!isSelectMode && <th className="py-3 px-4 font-medium text-right">{t.livestock_table_action}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredSapi.map((sapi) => (
                <tr 
                  key={sapi.id} 
                  className="hover:bg-[var(--color-bg-surface)] transition-colors cursor-pointer"
                  onClick={() => {
                    if (isSelectMode) {
                      setSelectedForDelete(prev => 
                        prev.includes(sapi.id) ? prev.filter(id => id !== sapi.id) : [...prev, sapi.id]
                      );
                    } else {
                      setSelectedSapi(sapi);
                    }
                  }}
                >
                  {isSelectMode && (
                    <td className="py-3 px-4">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded-md text-[var(--accent)] border-gray-300 focus:ring-[var(--accent)]"
                        checked={selectedForDelete.includes(sapi.id)}
                        readOnly
                      />
                    </td>
                  )}
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
                  {!isSelectMode && (
                    <td className="py-3 px-4 text-right">
                      <button 
                        className="p-1 text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors pointer-events-none"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  )}
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
      <div className="md:hidden flex flex-col gap-4 -mt-[32px] relative z-20 px-4">
        {/* Search and Filter Row (Floating) */}
        <div className="flex items-center gap-2 w-full">
          <div style={{ flex: 1, position: 'relative', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
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
          <button 
            onClick={() => setIsSelectMode(!isSelectMode)}
            style={{ width: '50px', height: '50px', borderRadius: '16px', background: isSelectMode ? 'var(--accent-dim)' : 'var(--bg-surface)', border: `1px solid ${isSelectMode ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelectMode ? 'var(--accent)' : 'var(--text-2)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', transition: 'all 0.2s' }}
          >
            <ClipboardList size={20} />
          </button>
        </div>

        {/* Filter Chips Row */}
        <div className="py-2 -mx-4 px-4 bg-[var(--bg-base)] flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide items-center justify-center relative">
          {['Semua', 'Perlu IB', 'Bunting', 'Sehat'].map((f) => {
            const mappedVal = f === 'Semua' ? 'all' : (f === 'Bunting' ? 'Hamil' : f);
            const isActive = filters.kesehatan === mappedVal;
            return (
              <button 
                key={f}
                onClick={() => setFilters(prev => ({...prev, kesehatan: mappedVal}))}
                className={cn(
                  "shrink-0 transition-colors font-bold px-4 py-2 rounded-full text-[13px] relative z-10",
                  isActive ? "text-[#FF7B1C]" : "text-[var(--text-3)] hover:text-[var(--text-2)]"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeFilterBgCattle"
                    className="absolute inset-0 bg-[#FF7B1C]/10 border border-[#FF7B1C]/20 rounded-full -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{f}</span>
              </button>
            );
          })}
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
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: isSelectMode && selectedForDelete.includes(sapi.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer',
                transform: isSelectMode && selectedForDelete.includes(sapi.id) ? 'scale(0.98)' : 'scale(1)',
                transition: 'all 0.15s ease'
              }}
              onClick={() => {
                if (isSelectMode) {
                  setSelectedForDelete(prev => 
                    prev.includes(sapi.id) ? prev.filter(id => id !== sapi.id) : [...prev, sapi.id]
                  );
                } else {
                  setSelectedSapi(sapi);
                }
              }}
            >
              {isSelectMode && (
                <div className="flex-shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${selectedForDelete.includes(sapi.id) ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-gray-300'}`}>
                    {selectedForDelete.includes(sapi.id) && <CheckCircle size={14} color="white" />}
                  </div>
                </div>
              )}
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
      {/* MODAL: TAMBAH SAPI (Extracted to AddCowModal)                  */}
      {/* ────────────────────────────────────────────────────────────── */}
      <AddCowModal 
        isOpen={isTambahModalOpen} 
        onClose={() => setIsTambahModalOpen(false)} 
      />

      {/* ────────────────────────────────────────────────────────────── */}
      {/* MODAL: EDIT SAPI — z-[1100] supaya di atas drawer (z-[900])  */}
      {/* ────────────────────────────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[1100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in overflow-hidden touch-none">
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 w-full max-w-2xl animate-in zoom-in-95 duration-200 overflow-x-hidden no-scrollbar max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">{t.livestock_edit_title}</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)]">
                <X size={20} />
              </button>
            </div>
            <form className="space-y-5" onSubmit={onEditSapi}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">
                    {t.livestock_add_name.replace('*', '')} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 h-[48px] rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" placeholder={t.livestock_add_name_placeholder} value={editForm.nama} onChange={e => setEditForm({...editForm, nama: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">
                    {t.livestock_add_rfid.replace('*', '')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} 
                      className="w-full px-4 h-[48px] rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" 
                      placeholder={t.livestock_add_rfid_placeholder}
                      value={editForm.rfid || ''} 
                      onChange={e => setEditForm({...editForm, rfid: e.target.value})} 
                      required
                    />
                    <button 
                      type="button" 
                      className="px-4 h-[48px] bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] font-bold shadow-sm flex items-center justify-center shrink-0" 
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
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">
                    {t.livestock_add_breed.replace('*', '')} <span className="text-red-500">*</span>
                  </label>
                  <select required style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 h-[48px] rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none appearance-none cursor-pointer" value={editForm.jenis} onChange={e => setEditForm({...editForm, jenis: e.target.value})}>
                    <option value="" disabled hidden>-- Pilih --</option>
                    <option value="Simmental">{t.breed_simmental}</option>
                    <option value="Brahman">{t.breed_brahman}</option>
                    <option value="Limosin">{t.breed_limousin}</option>
                    <option value="Bali">{t.breed_bali}</option>
                    <option value="Angus">{t.breed_angus}</option>
                    <option value="Friesian Holstein">{t.breed_friesholstein}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">
                    {t.livestock_add_health.replace('*', '')} <span className="text-red-500">*</span>
                  </label>
                  <select required style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 h-[48px] rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none appearance-none cursor-pointer" value={editForm.kesehatan} onChange={e => setEditForm({...editForm, kesehatan: e.target.value})}>
                    <option value="" disabled hidden>-- Pilih --</option>
                    <option value="Sehat">{t.livestock_filter_sehat}</option>
                    <option value="Sakit">{t.livestock_filter_sakit}</option>
                    <option value="Butuh Perawatan">{t.livestock_filter_care}</option>
                    <option value="Hamil">{t.livestock_filter_hamil}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">
                  {t.livestock_add_birthdate.replace('*', '')} <span className="text-red-500">*</span>
                </label>
                <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }} className="w-full px-4 h-[48px] rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none appearance-none min-w-0" value={editForm.lahir} onChange={e => setEditForm({...editForm, lahir: e.target.value})} required />
                {editForm.lahir && (
                  <p className="text-xs text-[var(--color-primary)] mt-2 font-medium flex items-center gap-1">
                    <Activity size={12}/> {t.livestock_add_current_age} {hitungUsia(editForm.lahir, lang)}
                  </p>
                )}
              </div>

              <div className="pt-6 border-t border-[var(--color-border)] flex gap-3 w-full">
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }} className="w-1/2 py-2.5 text-center">{t.btn_cancel}</button>
                <button type="submit" className="w-1/2 py-2.5 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-md text-center" disabled={loading}>
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
        <div className="hidden md:flex fixed inset-0 z-[900] justify-end bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={handleBack}>
          <div style={{ background: 'var(--bg-surface)', borderLeft: '0.5px solid var(--border)' }} className="w-full max-w-md h-full shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
            <div style={{ background: 'var(--bg-surface)', borderBottom: '0.5px solid var(--border)' }} className="px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">{t.livestock_detail_title}</h2>
              <button onClick={handleBack} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
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
                            handleBack();
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
                    {(!sortedReproHistory.some(item => item.results === true || item.results === 'true' || item.is_pregnant === true)) && (
                      <button 
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                        const countIB = sortedReproHistory.filter(h => !h.metode || h.metode?.toLowerCase() === 'ib' || h.method?.toLowerCase() === 'ib').length + 1;
                        setReproForm(f => ({ ...f, tanggal_ib: today, jumlah_ib: countIB }));
                          setIsReproModalOpen(true);
                        }}
                        className="text-xs font-bold text-white bg-[var(--color-primary)] px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-[var(--color-primary-hover)] transition-colors"
                      >
                        <Plus size={14} /> <span>{t.btn_add}</span>
                      </button>
                    )}
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
                                {(item.metode || item.method || 'ib').toUpperCase()} {item.jumlah_ib ? <span className="text-[var(--color-text-secondary)] font-medium ml-1">(Ke-{item.jumlah_ib})</span> : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isPregnant && (
                                <span className="px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[#ECFDF5] text-[#10B981] border border-[#10B981]/20">
                                  {t.livestock_repro_pregnant}
                                </span>
                              )}
                              {isFailed && (
                                <span className="px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[#FEF2F2] text-[#EF4444] border border-[#EF4444]/20">
                                  {t.livestock_repro_failed}
                                </span>
                              )}
                              {isPending && (
                                <span className="px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[#FFF8E1] text-[#F59E0B] border border-[#F59E0B]/20">
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
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="w-full min-w-0">
                                  <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">{t.repro_ib_date}</label>
                                  <input type="date"
                                    style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }}
                                    className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                                    value={editReproForm.tanggal_ib}
                                    onChange={e => setEditReproForm(f => ({...f, tanggal_ib: e.target.value}))}
                                  />
                                </div>
                                <div className="w-full min-w-0">
                                  <label className="block text-[10px] font-bold text-[var(--color-text-muted)] mb-1">{t.repro_ib_count}</label>
                                  <input type="number" min="1" max="10"
                                    style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }}
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
        <div className="md:hidden fixed inset-0 z-[900] bg-[#F3F4F6] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-20">
          {/* Header Photo */}
          <div className="sticky top-0 w-full h-[60vh] min-h-[450px] z-0">
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
              <button onClick={handleBack} className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-800 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-white/50 active:scale-95 transition-transform">
                <ChevronLeft size={24} />
              </button>
              {/* Top Right Action Buttons */}
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
                  className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-800 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-white/50 active:scale-95 transition-transform"
                >
                  <Edit2 size={24} />
                </button>
                <button 
                  onClick={async () => {
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
                          handleBack();
                          toast.success(t.livestock_toast_delete_success);
                        } else {
                          toast.error(res.message || t.livestock_toast_delete_failed);
                        }
                      });
                    }
                  }}
                  className="p-2 bg-white/80 backdrop-blur-md rounded-full text-red-600 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-red-500/30 active:scale-95 transition-transform"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            </div>

            {/* Text Content at Bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-6 pb-12 text-white">
               <div className="flex gap-2 mb-2 -ml-0.5">
                  <span className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white border border-white/10 uppercase tracking-wider">
                    ID: #{selectedSapi.id}
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

          {/* Scrollable Bottom Sheet Content */}
          <div className="relative z-10 bg-[#F3F4F6] min-h-[calc(100vh-200px)] -mt-6 rounded-t-[32px] shadow-[0_-12px_30px_rgba(0,0,0,0.1)] overflow-hidden">
            {/* Action Buttons — Tab Switchers */}
            <div className="px-4 py-5 grid grid-cols-4 gap-2 bg-white">
              {/* Tab 1: Riwayat Ternak */}
            <button 
              onClick={() => setActiveDetailTab('riwayat')}
              className={`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'riwayat'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }`}
            >
               <ClipboardList size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Riwayat</span>
            </button>
            {/* Tab 2: Prediksi Estrus */}
            <button 
              onClick={() => setActiveDetailTab('estrus')}
              className={`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'estrus'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }`}
            >
               <Sparkles size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Prediksi</span>
            </button>
            {/* Tab 3: Linimasa */}
            <button 
              onClick={() => setActiveDetailTab('linimasa')}
              className={`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'linimasa'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }`}
            >
               <Activity size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Linimasa</span>
            </button>
            {/* Tab 4: Analitik */}
            <button 
              onClick={() => setActiveDetailTab('analitik')}
              className={`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'analitik'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }`}
            >
               <LineChart size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Analitik</span>
            </button>
          </div>

          {/* Bottom Display Area */}
          {activeDetailTab === 'riwayat' ? (
            <>
              {/* Riwayat Ternak - Card Style */}
              <div className="px-5 pb-6 bg-white">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-[17px] font-extrabold text-[#111]">Riwayat Ternak</h3>
                   {(!sortedReproHistory.some(item => item.results === true || item.results === 'true' || item.is_pregnant === true)) && (
                     <button
                       onClick={() => {
                         const today = new Date().toISOString().split('T')[0];
                         const countIB = sortedReproHistory.filter(h => !h.metode || h.metode?.toLowerCase() === 'ib' || h.method?.toLowerCase() === 'ib').length + 1;
                         setReproForm(f => ({ ...f, tanggal_ib: today, jumlah_ib: countIB }));
                         setIsReproModalOpen(true);
                       }}
                       className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] transition-colors"
                     >
                       Catat IB
                     </button>
                   )}
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
                                {(item.metode || 'IB').toUpperCase()} {item.jumlah_ib ? <span className="font-bold text-[12px] text-gray-500 ml-1.5">(Ke-{item.jumlah_ib})</span> : ''}
                              </p>
                              {item.catatan && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{item.catatan}</p>}
                            </div>
                            {isPregnant && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#ECFDF5] text-[#10B981] shrink-0 border border-[#10B981]/20">Bunting</span>}
                            {isFailed   && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#FEF2F2] text-[#EF4444] shrink-0 border border-[#EF4444]/20">Gagal</span>}
                            {isPending  && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#FFF8E1] text-[#F59E0B] shrink-0 border border-[#F59E0B]/20">Menunggu</span>}
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
                                  className="flex-1 py-2.5 text-[13px] font-extrabold rounded-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-green-900/10 border border-green-500/30 backdrop-blur-md"
                                  style={{ background: 'rgba(46, 125, 50, 0.15)', color: '#2E7D32' }}
                                >
                                  {confirmingPregnancy === item.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={15} strokeWidth={2.5} />} Bunting
                                </button>
                                <button
                                  onClick={() => confirmPregnancy(item, false)}
                                  disabled={confirmingPregnancy === item.id}
                                  className="flex-1 py-2.5 text-[13px] font-extrabold rounded-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-red-900/10 border border-red-500/30 backdrop-blur-md"
                                  style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#DC2626' }}
                                >
                                  {confirmingPregnancy === item.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={15} strokeWidth={2.5} />} Gagal
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => startEditRepro(item)}
                              className="p-2 rounded-lg ml-auto text-gray-500 hover:bg-gray-100"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => deleteReproRecord(item)}
                              className="p-2 rounded-lg"
                              style={{ color: 'var(--red, #EF4444)', background: 'var(--bg-hover)' }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

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
            <div className="px-5 pb-12 pt-2 bg-[#F3F4F6] min-h-[500px]">
              <CowAnalyticsView selectedCow={selectedSapi} />
            </div>
          ) : activeDetailTab === 'linimasa' ? (
            <div className="px-5 pb-12 pt-6 bg-[#F8FBF9] min-h-[500px]">
              <div className="mb-8">
                <h3 className="text-[20px] font-extrabold text-[#111]">Linimasa Aktivitas</h3>
                <p className="text-[13px] text-gray-500 mt-1">Jejak rekaman aktivitas personal untuk <strong className="text-[#2E7D32]">{selectedSapi.nama}</strong></p>
              </div>
              
              <Stepper orientation="vertical" defaultValue={2} className="w-full">
                <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[17px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#2E7D32]/20 before:to-transparent">
                  
                  {(() => {
                      if (!sortedReproHistory || sortedReproHistory.length === 0) {
                          return (
                              <div className="w-full text-center py-10 bg-white border border-[#E8F0EA] rounded-[16px] shadow-sm">
                                  <p className="text-[13px] text-gray-500">Belum ada data aktivitas untuk ternak ini.</p>
                              </div>
                          );
                      }
                      
                      const formatTglStr = (ts) => new Date(ts).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {day: 'numeric', month: 'short', year: 'numeric'});
                      const timelineEvents = [];
                      
                      sortedReproHistory.forEach(item => {
                          const isPregnant    = item.results === true || item.results === 'true' || item.is_pregnant === true;
                          const isFailed      = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                          const rawDate       = item.tanggal_ib || item.service_date;
                          if (!rawDate) return;
                          
                          const baseTime = new Date(rawDate).getTime();
                          const eventId = item.id || Math.random().toString();
                          
                          // Add Inseminasi Buatan event
                          timelineEvents.push({
                              id: eventId + '-ib',
                              title: `Inseminasi Buatan (Ke-${item.jumlah_ib || 1})`,
                              dateRaw: baseTime,
                              dateFmt: formatTglStr(baseTime),
                              desc: `Metode: ${(item.metode || 'IB').toUpperCase()}${item.pemberi_ib ? `. Inseminator: ${item.pemberi_ib}` : ''}`,
                              status: isPregnant ? 'completed' : (isFailed ? 'failed' : 'active')
                          });
                          
                          // If pregnant, extrapolate future events
                          if (isPregnant) {
                              const pkbTime = baseTime + 60 * 24 * 60 * 60 * 1000;
                              const isPkbPast = pkbTime < Date.now();
                              timelineEvents.push({
                                  id: eventId + '-pkb',
                                  title: `Pemeriksaan Kebuntingan`,
                                  dateRaw: pkbTime,
                                  dateFmt: formatTglStr(pkbTime),
                                  desc: `Dinyatakan Bunting (PKB positif).`,
                                  status: 'completed'
                              });
                              
                              const masaKeringTime = baseTime + 223 * 24 * 60 * 60 * 1000;
                              const isMasaKeringPast = masaKeringTime < Date.now();
                              timelineEvents.push({
                                  id: eventId + '-kering',
                                  title: `Masa Kering`,
                                  dateRaw: masaKeringTime,
                                  dateFmt: formatTglStr(masaKeringTime),
                                  desc: `Persiapan menjelang kelahiran.`,
                                  status: isMasaKeringPast ? 'completed' : 'future_active'
                              });
                              
                              const calvingTime = baseTime + 283 * 24 * 60 * 60 * 1000;
                              const isCalvingPast = calvingTime < Date.now();
                              timelineEvents.push({
                                  id: eventId + '-calving',
                                  title: `Perkiraan Kelahiran`,
                                  dateRaw: calvingTime,
                                  dateFmt: `Est. ` + formatTglStr(calvingTime),
                                  desc: `Pindahkan ke kandang isolasi.`,
                                  status: isCalvingPast ? 'completed' : 'future'
                              });
                          }
                      });
                      
                      // Sort descending by default for timelines (newest at top) or ascending (oldest at top). 
                      // For this vertical stepper, oldest at top makes sense chronologically.
                      timelineEvents.sort((a, b) => b.dateRaw - a.dateRaw);
                      
                      return timelineEvents.map((evt, idx) => {
                           let iconEl = <CheckCircle size={18} className="text-[#2E7D32]" />;
                           let circleClass = "bg-[#E8F5E9] border-[#2E7D32]";
                           let cardClass = "bg-white border border-[#E8F0EA]";
                           let opacityClass = "";
                           let badge = null;
                           let isCompleted = evt.status === 'completed';
                           
                           if (evt.status === 'failed') {
                               iconEl = <XCircle size={18} className="text-red-500" />;
                               circleClass = "bg-red-50 border-red-500 ring-4 ring-red-50";
                               cardClass = "bg-white border-2 border-red-500/30";
                               badge = <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Gagal</div>;
                               isCompleted = true;
                           } else if (evt.status === 'active') {
                               iconEl = <Activity size={18} className="text-[#2E7D32]" />;
                               circleClass = "bg-[#E8F5E9] border-[#2E7D32] ring-4 ring-[#E8F5E9]";
                               cardClass = "bg-white border-2 border-[#2E7D32]/30 shadow-md";
                               badge = <div className="absolute top-0 right-0 bg-[#2E7D32] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Menunggu PKB</div>;
                               isCompleted = false;
                           } else if (evt.status === 'future_active') {
                               iconEl = <Activity size={18} className="text-amber-600" />;
                               circleClass = "bg-amber-100 border-amber-500 ring-4 ring-amber-50";
                               cardClass = "bg-white border-2 border-amber-500/30 shadow-md";
                               badge = <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Mendatang</div>;
                               isCompleted = false;
                           } else if (evt.status === 'future') {
                               iconEl = <div className="size-2.5 rounded-full bg-gray-400" />;
                               circleClass = "bg-gray-100 border-gray-300 opacity-60";
                               cardClass = "bg-white border border-gray-200";
                               opacityClass = "opacity-60";
                               isCompleted = false;
                           }
                           
                           return (
                              <StepperItem key={evt.id} step={idx + 1} completed={isCompleted} className="relative flex items-start gap-4">
                                <div className={`relative z-10 flex size-9 items-center justify-center rounded-full border-2 shadow-sm shrink-0 ${circleClass}`}>
                                  {iconEl}
                                </div>
                                <div className={`flex-1 min-w-0 pb-2 ${opacityClass}`}>
                                  <div className={`${cardClass} rounded-[16px] p-4 w-full relative overflow-hidden`}>
                                    {badge}
                                    <StepperTitle className="text-[14px] font-bold text-[#111] mb-1">{evt.title}</StepperTitle>
                                    <StepperDescription className="text-[12px] text-gray-500 leading-relaxed">
                                      <span className="font-semibold text-gray-700">{evt.dateFmt}</span> - {evt.desc}
                                    </StepperDescription>
                                  </div>
                                </div>
                              </StepperItem>
                           );
                      });
                  })()}

                </div>
              </Stepper>
            </div>
          ) : (
            <div className="px-5 pb-12 pt-2 bg-[#F3F4F6] min-h-[500px]">
              <CowEstrusView selectedCow={selectedSapi} reproHistory={sortedReproHistory} />
            </div>
          )}
          </div>
        </div>
        </>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* MODAL: Tambah Reproduksi — z-[1100] di atas drawer            */}
      {/* ────────────────────────────────────────────────────────────── */}
      {isReproModalOpen && (
        <div className="fixed inset-0 z-[1100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in overflow-hidden touch-none">
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 w-full max-w-lg animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto overflow-x-hidden no-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">{editReproItem ? "Edit Data IB" : t.repro_record_new}</h2>
              <button onClick={() => setIsReproModalOpen(false)} className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)]">
                <X size={20} />
              </button>
            </div>

            <form className="space-y-4" onSubmit={onTambahReproduksi}>
              <div className="grid grid-cols-1 gap-4">
                <div className="w-full min-w-0">
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
                    {t.repro_ib_date} <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="date" 
                    style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }}
                    className="w-full px-4 h-[48px] rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" 
                    required
                    value={reproForm.tanggal_ib}
                    onChange={handleTanggalIbChange}
                  />
                </div>
                {/* jumlah_ib is automatically calculated, hidden from user */}
                <input type="hidden" value={reproForm.jumlah_ib} />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
                  {t.repro_inseminator} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder={t.repro_inseminator_placeholder} 
                  style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }}
                  className="w-full min-w-0 px-4 h-[48px] rounded-xl text-sm outline-none focus:border-[var(--color-primary)]" 
                  required
                  value={reproForm.pemberi_ib}
                  onChange={e => setReproForm({...reproForm, pemberi_ib: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_notes}</label>
                <textarea rows="2" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }} className="w-full min-w-0 px-4 py-3 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] resize-none" placeholder={t.repro_notes_placeholder} value={reproForm.catatan} onChange={e => setReproForm({...reproForm, catatan: e.target.value})} />
              </div>

              <div className="pt-4 flex gap-3 w-full">
                <button type="button" onClick={() => setIsReproModalOpen(false)} style={{ border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }} className="w-1/2 py-3 text-center">{t.btn_cancel}</button>
                <button type="submit" className="w-1/2 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-lg text-center">{t.repro_save}</button>
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
        }
        // For 'tambah', AddCowModal handles its own scan state.
        setScanOpen(false);
        toast.success((lang === 'id' ? 'RFID ditemukan: ' : 'RFID found: ') + scannedRfid);
      }}
    />


    </>
  );
}
