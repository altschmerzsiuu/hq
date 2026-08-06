import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, Link, Unlink, ChevronRight, Edit2, Trash2, Activity, MapPin, X, Calendar, ClipboardList, Beef, Loader2, CheckCircle, XCircle, Baby, Pencil, Save, Tractor, PawPrint, SlidersHorizontal, ChevronLeft, Camera, ImagePlus, LineChart, Sparkles, Edit3, Dna } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useTernakStore } from '../store/useTernakStore';
import axiosInstance from '../lib/axios';
import { toast } from '@/store/toastStore';
import { handleError } from '@/lib/errorHandler';
import ScanModal from '@/components/scan/ScanModal';
import PairCollarModal from '@/components/shared/PairCollarModal';
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

// ── ANIMATED QUICK ACTION BUTTON ──
function AnimatedHeroButton({ icon: Icon, label, onClick, colorClass = "bg-white text-gray-700" }) {
  const spanRef = React.useRef(null);
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center rounded-full border border-gray-200 shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md hover:bg-white/10 ${colorClass}`}
      style={{ padding: '11px', gap: 0 }}
      onMouseEnter={e => {
        e.currentTarget.style.paddingLeft = '18px';
        e.currentTarget.style.paddingRight = '18px';
        e.currentTarget.style.gap = '8px';
        if (spanRef.current) { spanRef.current.style.fontSize = '13px'; spanRef.current.style.color = 'inherit'; }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.paddingLeft = '11px';
        e.currentTarget.style.paddingRight = '11px';
        e.currentTarget.style.gap = '0';
        if (spanRef.current) { spanRef.current.style.fontSize = '0'; spanRef.current.style.color = 'inherit'; }
      }}
    >
      <Icon size={20} className="flex-shrink-0 transition-colors duration-200" />
      <span
        ref={spanRef}
        className="font-bold whitespace-nowrap overflow-hidden transition-all duration-300"
        style={{ fontSize: 0 }}
      >
        {label}
      </span>
    </button>
  );
}

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

  // Hide bottom nav when filter is open
  useEffect(() => {
    const nav = document.getElementById('mobile-bottom-nav');
    if (nav) {
      if (showFilter) {
        nav.style.display = 'none';
      } else {
        nav.style.display = 'block';
      }
    }
    return () => {
      if (nav) nav.style.display = 'block';
    };
  }, [showFilter]);
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
    nama: '', jenis: 'Simmental', lahir: '', kesehatan: 'Sehat', kelamin: 'betina'
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
      const cow = sapiList.find(h => 
        h.id === location.state.selectedCowId || 
        h.cow_id === location.state.selectedCowId ||
        h.nama?.toLowerCase() === location.state.selectedCowId?.toLowerCase()
      );
      if (cow) {
        setSelectedSapi(cow);
        // Clear selectedCowId from state but keep 'from' so back button works
        navigate(location.pathname, { 
          replace: true, 
          state: { ...location.state, selectedCowId: undefined } 
        });
      } else {
        toast.error(`Sapi "${location.state.selectedCowId}" tidak ditemukan di daftar ternak.`);
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
      kesehatan: editForm.kesehatan,
      kelamin: editForm.kelamin
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
        <>
          {document.getElementById('topbar-portal-mobile') && createPortal(
            <div className="w-full h-full bg-white flex items-center justify-between px-4 border-b border-gray-200 shadow-sm animate-in fade-in duration-200 pointer-events-auto">
              <button onClick={() => { setIsSelectMode(false); setSelectedForDelete([]); }} className="text-[var(--text-2)] font-bold text-sm py-2">
                {t.livestock_select_mode_cancel || 'Batal'}
              </button>
              <div className="text-[15px] font-bold text-[var(--text-1)]">
                {selectedForDelete.length > 0 
                  ? (t.livestock_select_mode_selected || '{count} Dipilih').replace('{count}', selectedForDelete.length) 
                  : (t.livestock_select_mode_title || (lang === 'id' ? 'Pilih Ternak' : 'Select Cattle'))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { if (selectedForDelete.length === filteredSapi.length) { setSelectedForDelete([]); } else { setSelectedForDelete(filteredSapi.map(s => s.id)); } }} className="text-[var(--accent)] font-bold text-sm">
                  {selectedForDelete.length === filteredSapi.length 
                    ? (t.livestock_select_mode_cancel_all || 'Batal Semua') 
                    : (t.livestock_select_mode_all || 'Semua')}
                </button>
                <button onClick={handleBulkDelete} disabled={selectedForDelete.length === 0} className={`flex items-center justify-center p-2 rounded-full ${selectedForDelete.length > 0 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-400'}`}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>,
            document.getElementById('topbar-portal-mobile')
          )}

          {document.getElementById('topbar-portal-desktop') && createPortal(
            <div className="w-full h-full bg-white flex items-center justify-between px-5 shadow-sm animate-in fade-in duration-200 pointer-events-auto">
              <button onClick={() => { setIsSelectMode(false); setSelectedForDelete([]); }} className="text-[var(--text-2)] font-bold text-sm py-2">
                {t.livestock_select_mode_cancel || 'Batal'}
              </button>
              <div className="text-[15px] font-bold text-[var(--text-1)]">
                {selectedForDelete.length > 0 
                  ? (t.livestock_select_mode_selected || '{count} Dipilih').replace('{count}', selectedForDelete.length) 
                  : (t.livestock_select_mode_title || (lang === 'id' ? 'Pilih Ternak' : 'Select Cattle'))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { if (selectedForDelete.length === filteredSapi.length) { setSelectedForDelete([]); } else { setSelectedForDelete(filteredSapi.map(s => s.id)); } }} className="text-[var(--accent)] font-bold text-sm">
                  {selectedForDelete.length === filteredSapi.length 
                    ? (t.livestock_select_mode_cancel_all || 'Batal Semua') 
                    : (t.livestock_select_mode_all || 'Semua')}
                </button>
                <button onClick={handleBulkDelete} disabled={selectedForDelete.length === 0} className={`flex items-center justify-center p-2 rounded-full ${selectedForDelete.length > 0 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-400'}`}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>,
            document.getElementById('topbar-portal-desktop')
          )}
        </>
      )}

      <div className="space-y-0 pb-6">
      {/* ── UNIFIED HEADER (Brand Orange with DNA accent) ── */}
      <div 
        className="rounded-t-none rounded-b-[40px] md:rounded-[40px] md:mt-4 px-6 md:pt-8 pb-[56px] shadow-sm relative overflow-hidden mb-0 text-white flex flex-col justify-between -mx-4 md:mx-0"
        style={{ 
          paddingTop: 'calc(env(safe-area-inset-top) + 86px)',
          background: 'linear-gradient(135deg, #FF7B1C 0%, #E65C00 100%)'
        }}
      >
        {/* Subtle DNA / Fingerprint Accent */}
        <Dna 
          size={320} 
          strokeWidth={0.8} 
          className="absolute -top-12 -right-12 text-white opacity-[0.12] rotate-12 pointer-events-none" 
        />

        <div className="flex justify-between items-start relative z-10">
          <div className="w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between w-full mb-6 gap-4">
              <div>
                <p className="text-[10px] md:text-[12px] font-black opacity-90 mb-1 uppercase tracking-widest text-[#FFD8B5]">
                  {lang === 'id' ? 'KELOLA DATA PROFIL DAN RIWAYAT REPRODUKSI SAPI.' : 'MANAGE CATTLE PROFILE AND REPRODUCTION HISTORY.'}
                </p>
                <h1 className="text-[32px] md:text-[36px] font-black tracking-tight leading-none">
                  {lang === 'id' ? 'Ternak Anda' : 'Your Cattle'}
                </h1>
              </div>
              <div className="hidden md:flex items-center gap-3">
                 <AnimatedHeroButton 
                    icon={Link} 
                    label={t.qa_pair_collar} 
                    onClick={() => setIsPairModalOpen(true)} 
                    colorClass="bg-white/20 text-white border-white/30 hover:bg-white/30" 
                 />
                 <AnimatedHeroButton 
                    icon={Plus} 
                    label={t.livestock_btn_add} 
                    onClick={() => setIsTambahModalOpen(true)} 
                    colorClass="bg-white text-[#FF7B1C] border-transparent hover:bg-white/90" 
                 />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 w-full">
              {/* Cards (Sapi, Bunting, Sehat) */}
              <button 
                onClick={() => setFilters(prev => ({...prev, kesehatan: 'all'}))}
                className="bg-white/20 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden group transition-all duration-300 border border-white/30 hover:bg-white/25 active:scale-95"
              >
                <Beef size={24} className="text-white mb-2 opacity-90" strokeWidth={1.5} />
                <span className="text-xl font-black leading-none mb-1">{sapiList.length}</span>
                <span className="text-[10px] font-medium opacity-90 text-center leading-tight tracking-wide">{lang === 'id' ? 'Total Sapi' : 'Total Cows'}</span>
              </button>
              
              <button 
                onClick={() => setFilters(prev => ({...prev, kesehatan: 'Hamil'}))}
                className="bg-white/20 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden group transition-all duration-300 border border-white/30 hover:bg-white/25 active:scale-95"
              >
                <Baby size={24} className="text-white mb-2 opacity-90" strokeWidth={1.5} />
                <span className="text-xl font-black leading-none mb-1">{sapiList.filter(s => s.status_kesehatan === 'Hamil').length}</span>
                <span className="text-[10px] font-medium opacity-90 text-center leading-tight tracking-wide">{lang === 'id' ? 'Bunting' : 'Pregnant'}</span>
              </button>
              
              <button 
                onClick={() => setFilters(prev => ({...prev, kesehatan: 'Sehat'}))}
                className="bg-white/20 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden group transition-all duration-300 border border-white/30 hover:bg-white/25 active:scale-95"
              >
                <CheckCircle size={24} className="text-white mb-2 opacity-90" strokeWidth={1.5} />
                <span className="text-xl font-black leading-none mb-1">{sapiList.filter(s => s.status_kesehatan === 'Sehat').length}</span>
                <span className="text-[10px] font-medium opacity-90 text-center leading-tight tracking-wide">{lang === 'id' ? 'Sehat' : 'Healthy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP CONTENT ── */}
      <div className="hidden md:flex flex-col gap-6 animate-in fade-in duration-300">
        
        {/* Floating Search & Filter Bar */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '8px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }} className="-mt-[28px] relative z-20 w-full max-w-4xl mx-auto flex flex-col">
          <div className="flex gap-4 justify-between items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--text-3)' }} />
              <input 
                type="text" 
                placeholder={t.livestock_search_placeholder} 
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px', background: 'transparent', border: 'none', color: 'var(--text-1)', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-3 border-l border-[var(--border)] pl-4">
              <button 
                onClick={() => setShowFilter(f => !f)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: `1px solid ${showFilter ? 'var(--accent)' : 'transparent'}`, color: showFilter ? 'var(--accent)' : 'var(--text-2)', borderRadius: '12px', background: showFilter ? 'var(--accent-dim)' : 'transparent', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}
                className="hover:bg-gray-100"
              >
                <Filter size={18} />
                {t.btn_filter}
              </button>
              <button 
                onClick={() => setIsSelectMode(!isSelectMode)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: `1px solid ${isSelectMode ? 'var(--accent)' : 'transparent'}`, color: isSelectMode ? 'var(--accent)' : 'var(--text-2)', borderRadius: '12px', background: isSelectMode ? 'var(--accent-dim)' : 'transparent', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}
                className="hover:bg-gray-100"
              >
                <ClipboardList size={18} />
                {lang === 'id' ? 'Pilih' : 'Select'}
              </button>
            </div>
          </div>
   
          {/* Filter Panel */}
          {showFilter && (
            <div className="filter-panel flex items-center gap-4 pt-4 mt-2 border-t border-[var(--border)]">
              <select className="filter-select bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium outline-none" value={filters.kesehatan} onChange={e => setFilters(f => ({ ...f, kesehatan: e.target.value }))}>
                <option value="all">{t.livestock_filter_all_health}</option>
                <option value="Sehat">{t.livestock_filter_sehat}</option>
                <option value="Sakit">{t.livestock_filter_sakit}</option>
                <option value="Hamil">{t.livestock_filter_hamil}</option>
                <option value="Butuh Perawatan">{t.livestock_filter_care}</option>
              </select>
              <select className="filter-select bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium outline-none" value={filters.jenis} onChange={e => setFilters(f => ({ ...f, jenis: e.target.value }))}>
                <option value="all">{t.status_all_types}</option>
                <option value="Simmental">{t.breed_simmental}</option>
                <option value="Bali">{t.breed_bali}</option>
                <option value="Brahman">{t.breed_brahman}</option>
                <option value="Limosin">{t.breed_limousin}</option>
                <option value="Angus">{t.breed_angus}</option>
                <option value="Friesian Holstein">{t.breed_friesholstein}</option>
              </select>
              <button onClick={() => setFilters({ kesehatan: 'all', jenis: 'all' })} style={{ fontSize: '13px', color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'Inter, sans-serif' }} className="hover:text-gray-800 font-medium">{t.btn_reset}</button>
            </div>
          )}
        </div>

        {/* Desktop View: Table Container */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '16px 24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '0.5px solid var(--border)' }} className="mx-0 overflow-hidden">
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
                      navigate('/ternak/' + sapi.id);
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
                  <option value="7">{lang === 'id' ? '7 Hari Terakhir' : 'Last 7 Days'}</option>
                  <option value="30">{lang === 'id' ? '30 Hari Terakhir' : 'Last 30 Days'}</option>
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
                  navigate('/ternak/' + sapi.id);
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
                  Terakhir IB: {sapi.terakhir_ib ? formatTgl(sapi.terakhir_ib, lang) : lang === 'id' ? '45 hari lalu' : '45 days ago'}
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
                    <option value="" disabled hidden>-- {lang === 'id' ? 'Pilih' : 'Select'} --</option>
                    <option value="Simmental">{t.breed_simmental}</option>
                    <option value="Brahman">{t.breed_brahman}</option>
                    <option value="Limosin">{t.breed_limousin}</option>
                    <option value="Bali">{t.breed_bali}</option>
                    <option value="Angus">{t.breed_angus}</option>
                    <option value="Friesian Holstein">{t.breed_friesholstein}</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-[42px] text-gray-500 pointer-events-none" size={18} />
                </div>
                <div className="relative">
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">
                    {t.livestock_add_health.replace('*', '')} <span className="text-red-500">*</span>
                  </label>
                  <select required style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 h-[48px] rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none appearance-none cursor-pointer" value={editForm.kesehatan} onChange={e => setEditForm({...editForm, kesehatan: e.target.value})}>
                    <option value="" disabled hidden>-- {lang === 'id' ? 'Pilih' : 'Select'} --</option>
                    <option value="Sehat">{t.livestock_filter_sehat}</option>
                    <option value="Sakit">{t.livestock_filter_sakit}</option>
                    <option value="Butuh Perawatan">{t.livestock_filter_care}</option>
                    <option value="Hamil">{t.livestock_filter_hamil}</option>
                  </select>
                </div>
              </div>
              
              {/* Jenis Kelamin */}
              <div className="relative">
                <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">
                  {lang === 'id' ? 'Jenis Kelamin' : 'Gender'} <span className="text-red-500">*</span>
                </label>
                <select required style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full px-4 h-[48px] rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none appearance-none cursor-pointer" value={editForm.kelamin} onChange={e => setEditForm({...editForm, kelamin: e.target.value})}>
                  <option value="betina">{lang === 'id' ? 'Betina' : 'Female'}</option>
                  <option value="jantan">{lang === 'id' ? 'Jantan' : 'Male'}</option>
                </select>
                <ChevronDown className="absolute right-4 top-[42px] text-gray-500 pointer-events-none" size={18} />
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
