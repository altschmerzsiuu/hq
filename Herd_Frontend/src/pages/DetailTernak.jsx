import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Camera, Activity, Edit2, Trash2, Link, Unlink, ActivityIcon, Plus, Beef, ThermometerSun, Weight, Stethoscope, Pencil, X, Save, Loader2, CheckCircle, XCircle, ChevronRight, ChevronDown, LineChart, ClipboardList, Sparkles, Check, AlertCircle, Baby, Heart } from 'lucide-react';
import { useTernakStore } from '../store/useTernakStore';
import useSettingsStore from '@/store/settingsStore';
import { motion } from 'framer-motion';
import translations from '@/lib/i18n';
import CowAnalyticsView from '@/components/shared/CowAnalyticsView';
import CowEstrusView from '@/components/shared/CowEstrusView';
import PairCollarModal from '@/components/shared/PairCollarModal';
import ReportSickModal from '@/components/shared/ReportSickModal';
import ImageCropperModal from '@/components/shared/ImageCropperModal';

import { Stepper, StepperItem, StepperTitle, StepperDescription } from '@/components/ui/stepper';
import { toast } from '@/store/toastStore';
import axiosInstance from '@/lib/axios';

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

export default function DetailTernak() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchSapiDetail, selectedSapi, loading, hapusSapi, editSapi, tambahReproduksi } = useTernakStore();
  const { lang: storeLang } = useSettingsStore();
  const lang = storeLang || 'id';
  const t = translations[lang];

  const handleBack = () => navigate(-1);
  const [activeDetailTab, setActiveDetailTab] = useState('riwayat');
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);

  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Create an object URL for the cropper
    const url = URL.createObjectURL(file);
    setSelectedFileUrl(url);
    setIsCropperOpen(true);
    e.target.value = ''; // Reset input
  };

  const handleUploadFoto = async (croppedBlob) => {
    setIsUploadingFoto(true);
    const tid = toast.loading(lang === 'id' ? 'Mengunggah foto sapi...' : 'Uploading cow photo...');
    try {
      const formData = new FormData();
      formData.append('file', croppedBlob, 'profile.jpg');
      
      const response = await axiosInstance.post(`/hewan/${selectedSapi.id}/upload`, formData);
      const newUrl = response.data.url;
      
      // Update immediately for smooth loading
      useTernakStore.setState({
        selectedSapi: { ...selectedSapi, foto: newUrl }
      });
      
      toast.success(lang === 'id' ? 'Foto berhasil diunggah!' : 'Photo uploaded successfully!', { id: tid });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || (lang === 'id' ? 'Gagal mengunggah foto.' : 'Failed to upload photo.'), { id: tid });
    } finally {
      setIsUploadingFoto(false);
    }
  };
  const [confirmingPregnancy, setConfirmingPregnancy] = useState(null);
  const confirmPregnancy = (item, isPregnant) => {
    setConfirmingPregnancy(item.id || item.jumlah_ib);
    setTimeout(() => {
      const updatedSapi = {
        ...selectedSapi,
        reproduksi: (selectedSapi.reproduksi || []).map(r => 
          (r.id ? r.id === item.id : r.jumlah_ib === item.jumlah_ib) ? { ...r, results: isPregnant } : r
        )
      };
      useTernakStore.setState({ selectedSapi: updatedSapi });
      setConfirmingPregnancy(null);
      toast.success(isPregnant ? 'Status diupdate: Bunting' : 'Status diupdate: Gagal');
    }, 500);
  };

  // ── Edit Profile Modal state ──────────────────────────────────────
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({});
  const [editProfileLoading, setEditProfileLoading] = useState(false);

  // ── Catat / Edit IB Modal state ───────────────────────────────────
  const [isIBModalOpen, setIsIBModalOpen] = useState(false);
  const [ibForm, setIBForm] = useState({ tanggal_ib: '', pemberi_ib: '', jumlah_ib: '', catatan: '' });
  const [ibLoading, setIBLoading] = useState(false);
  const [editingIB, setEditingIB] = useState(null); // null = tambah baru, item = edit

  // ── Hapus Ternak ─────────────────────────────────────────────────
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [hapusLoading, setHapusLoading] = useState(false);

  // ── Lapor Sakit Modal state ────────────────────────────────────────
  const [isReportSickOpen, setIsReportSickOpen] = useState(false);

  const handleReportSick = async (cowId, data) => {
    // Ideally this goes to backend: await axiosInstance.post(`/scanner/hewan/${cowId}/sick`, data);
    toast.success('Laporan sakit berhasil dikirim!');
    setIsReportSickOpen(false);
  };

  // ── Handle Location State (from Recommendations) ─────────────────
  useEffect(() => {
    if (location.state) {
      if (location.state.openInseminasi) {
        setTimeout(() => {
          setIsIBModalOpen(true);
          setEditingIB(null);
        }, 100);
      }
      if (location.state.activeTab) {
        setActiveTab(location.state.activeTab);
        setActiveDetailTab(location.state.activeTab);
      }
      // Clear state after handling
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const openEditProfile = () => {
    setEditProfileForm({
      nama: selectedSapi.nama || '',
      jenis: selectedSapi.jenis || '',
      bulan_tahun_lahir: selectedSapi.bulan_tahun_lahir || '',
      kesehatan: selectedSapi.status_kesehatan || '',
    });
    setIsEditProfileOpen(true);
  };

  const submitEditProfile = async (e) => {
    e.preventDefault();
    setEditProfileLoading(true);
    const res = await editSapi(selectedSapi.id, editProfileForm);
    setEditProfileLoading(false);
    if (res?.success) {
      toast.success('Profil ternak berhasil diperbarui.');
      fetchSapiDetail(id);
      setIsEditProfileOpen(false);
    } else {
      toast.error(res?.message || 'Gagal memperbarui profil.');
    }
  };

  const openCatatIB = () => {
    setEditingIB(null);
    setIBForm({
      tanggal_ib: new Date().toISOString().split('T')[0],
      pemberi_ib: '',
      jumlah_ib: String((selectedSapi?.reproduksi?.length || 0) + 1),
      catatan: '',
    });
    setIsIBModalOpen(true);
  };

  const startEditRepro = (item) => {
    setEditingIB(item);
    setIBForm({
      tanggal_ib: item.tanggal_ib || item.service_date || '',
      pemberi_ib: item.pemberi_ib || '',
      jumlah_ib: String(item.jumlah_ib || ''),
      catatan: item.catatan || '',
    });
    setIsIBModalOpen(true);
  };

  const submitIB = async (e) => {
    e.preventDefault();
    setIBLoading(true);
    let res;

    const formattedPemberi = ibForm.pemberi_ib 
      ? ibForm.pemberi_ib.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
      : '';
    const formattedIBForm = { ...ibForm, pemberi_ib: formattedPemberi };

    if (editingIB) {
      // Edit: gunakan editSapi dengan data repro
      res = await editSapi(selectedSapi.id, { ...formattedIBForm, rfid: selectedSapi.id });
    } else {
      // Tambah baru
      res = await tambahReproduksi({ ...formattedIBForm, birahi: formattedIBForm.tanggal_ib, rfid: selectedSapi.id });
    }
    setIBLoading(false);
    if (res?.success) {
      toast.success(editingIB ? 'Data IB berhasil diperbarui.' : 'Catatan IB berhasil ditambahkan.');
      
      // Optimistically update the local state so the UI reflects changes instantly
      useTernakStore.setState((state) => {
        if (state.selectedSapi && state.selectedSapi.id === selectedSapi.id) {
          const updatedRepro = [...(state.selectedSapi.reproduksi || [])];
          if (editingIB) {
            const index = updatedRepro.findIndex(r => r.jumlah_ib === parseInt(formattedIBForm.jumlah_ib));
            if (index !== -1) {
              updatedRepro[index] = { ...updatedRepro[index], ...formattedIBForm };
            }
          } else {
            const hpl = formattedIBForm.tanggal_ib ? new Date(new Date(formattedIBForm.tanggal_ib).getTime() + 283 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null;
            updatedRepro.unshift({ ...formattedIBForm, birahi: formattedIBForm.tanggal_ib, hpl, jumlah_ib: updatedRepro.length + 1, results: 'Menunggu' });
          }
          return { selectedSapi: { ...state.selectedSapi, reproduksi: updatedRepro } };
        }
        return {};
      });

      // DO NOT call fetchSapiDetail(id) here! 
      // It will instantly overwrite our optimistic update with the backend's data.
      // fetchSapiDetail(id);
      
      setIsIBModalOpen(false);
    } else {
      toast.error(res?.message || 'Gagal menyimpan data IB.');
    }
  };

  const [isDeleteIBConfirmOpen, setIsDeleteIBConfirmOpen] = useState(false);
  const [deleteIBTarget, setDeleteIBTarget] = useState(null);

  const deleteReproRecord = (item) => {
    setDeleteIBTarget(item);
    setIsDeleteIBConfirmOpen(true);
  };

  const handleConfirmDeleteIB = () => {
    if (!deleteIBTarget) return;
    const updatedSapi = {
      ...selectedSapi,
      reproduksi: (selectedSapi.reproduksi || []).filter(r => r.id !== deleteIBTarget.id)
    };
    useTernakStore.setState({ selectedSapi: updatedSapi });
    setIsDeleteIBConfirmOpen(false);
    setDeleteIBTarget(null);
    toast.success('Catatan IB berhasil dihapus');
  };

  const handleHapusSapi = async () => {
    setHapusLoading(true);
    const res = await hapusSapi(selectedSapi.id);
    setHapusLoading(false);
    setIsDeleteConfirmOpen(false);
    if (res?.success) {
      toast.success(`Ternak ${selectedSapi.nama} berhasil dihapus.`);
      navigate('/ternak');
    } else {
      toast.error(res?.message || 'Gagal menghapus ternak.');
    }
  };

  // ── Desktop AnimatedQAButton ──────────────────────────────────────────────────
  const DesktopAnimatedBtn = ({ icon: Icon, label, onClick, danger = false, type = 'success', expandedWidth = '150px' }) => {
    let baseColor = '#2E7D32';
    let dimBg = 'rgba(46,125,50,0.07)';
    if (danger || type === 'danger') {
      baseColor = '#DC2626';
      dimBg = 'rgba(220,38,38,0.07)';
    } else if (type === 'info') {
      baseColor = '#2563EB';
      dimBg = 'rgba(37,99,235,0.07)';
    }
    return (
      <button
        onClick={onClick}
        className="group inline-flex items-center rounded-full border shadow-sm cursor-pointer transition-all duration-300"
        style={{ padding: '9px', gap: 0, background: dimBg, borderColor: `${baseColor}30`, color: baseColor }}
        onMouseEnter={e => {
          e.currentTarget.style.paddingLeft = '16px';
          e.currentTarget.style.paddingRight = '16px';
          e.currentTarget.style.gap = '6px';
          e.currentTarget.style.background = baseColor;
          e.currentTarget.style.borderColor = baseColor;
          e.currentTarget.style.color = '#fff';
          const span = e.currentTarget.querySelector('span');
          if (span) { span.style.maxWidth = expandedWidth; span.style.opacity = '1'; }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.paddingLeft = '9px';
          e.currentTarget.style.paddingRight = '9px';
          e.currentTarget.style.gap = '0';
          e.currentTarget.style.background = dimBg;
          e.currentTarget.style.borderColor = `${baseColor}30`;
          e.currentTarget.style.color = baseColor;
          const span = e.currentTarget.querySelector('span');
          if (span) { span.style.maxWidth = '0'; span.style.opacity = '0'; }
        }}
      >
        <Icon size={16} />
        <span style={{ maxWidth: 0, opacity: 0, overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 700, transition: 'max-width 0.25s ease, opacity 0.2s ease' }}>{label}</span>
      </button>
    );
  };


  const [activeTab, setActiveTab] = useState('riwayat');
  const [reproFilter, setReproFilter] = useState('0');
  const [activityFilter, setActivityFilter] = useState(0);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [pairSelectedSapi, setPairSelectedSapi] = useState(null);
  const [pairSelectedCollar, setPairSelectedCollar] = useState(null);
  const [showBirthModal, setShowBirthModal] = useState(false);
  const [birthReproItem, setBirthReproItem] = useState(null);
  const [birthLoading, setBirthLoading] = useState(false);
  const [birthForm, setBirthForm] = useState({
    tanggal_lahir_aktual: new Date().toISOString().split('T')[0],
    jenis_kelamin_pedet: 'Betina',
    nama_pedet: '',
    rfid_pedet: '',
    berat_pedet: '',
  });

  useEffect(() => {
    if (id) {
      fetchSapiDetail(id);
    }
  }, [id, fetchSapiDetail]);

  const reproCycles = useMemo(() => {
    if (!selectedSapi || !selectedSapi.reproduksi || selectedSapi.reproduksi.length === 0) return [];
    
    // Sort oldest to newest first to chronologically group
    const sorted = [...selectedSapi.reproduksi].sort((a, b) => {
      const dateA = new Date(a.tanggal_ib || a.service_date).getTime();
      const dateB = new Date(b.tanggal_ib || b.service_date).getTime();
      return dateA - dateB;
    });
    
    const cycles = [];
    let currentCycle = [];
    
    for (const item of sorted) {
      // Shallow copy so we can safely mutate jumlah_ib for the UI without breaking other refs if any
      const itemCopy = { ...item };
      currentCycle.push(itemCopy);
      const isPreg = itemCopy.results === true || itemCopy.results === 'true' || itemCopy.is_pregnant === true;
      if (isPreg) {
        currentCycle.forEach((it, idx) => it.jumlah_ib = idx + 1);
        cycles.push([...currentCycle].reverse()); // newest IB first within cycle
        currentCycle = [];
      }
    }
    
    if (currentCycle.length > 0) {
      currentCycle.forEach((it, idx) => it.jumlah_ib = idx + 1);
      cycles.push([...currentCycle].reverse());
    }
    
    return cycles.reverse(); // newest cycle first
  }, [selectedSapi]);

  const cycleStats = useMemo(() => {
    let success = 0;
    let failed = 0;
    reproCycles.forEach(cycle => {
      if (cycle.length === 0) return;
      const newestIB = cycle[0];
      const isPreg = newestIB.results === true || newestIB.results === 'true' || newestIB.is_pregnant === true;
      const isFail = newestIB.results === false || newestIB.results === 'failed' || newestIB.is_pregnant === false;
      if (isPreg) success++;
      else if (isFail) failed++;
    });
    return { total: reproCycles.length, success, failed };
  }, [reproCycles]);

  const sortedReproHistory = useMemo(() => {
    return reproCycles.flat();
  }, [reproCycles]);

  // Detect overdue pregnancy: results=true AND hpl has passed today
  const overduePregnancy = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sortedReproHistory.find(item => {
      const isPreg = item.results === true || item.results === 'true' || item.is_pregnant === true;
      if (!isPreg || !item.hpl) return false;
      const hplDate = new Date(item.hpl);
      hplDate.setHours(0, 0, 0, 0);
      return hplDate < today;
    }) || null;
  }, [sortedReproHistory]);

  const openBirthModal = (reproItem) => {
    setBirthReproItem(reproItem);
    setBirthForm({
      tanggal_lahir_aktual: new Date().toISOString().split('T')[0],
      jenis_kelamin_pedet: 'Betina',
      nama_pedet: '',
      rfid_pedet: '',
      berat_pedet: '',
    });
    setShowBirthModal(true);
  };

  const confirmBirth = async () => {
    if (!birthReproItem || !selectedSapi) return;
    setBirthLoading(true);
    try {
      // 1. Update the repro record to mark as confirmed birth (add actual date)
      await axiosInstance.put(`/api/reproduction/${birthReproItem.id}`, {
        results: true,
        catatan: `${birthReproItem.catatan ? birthReproItem.catatan + ' | ' : ''}Melahirkan: ${birthForm.tanggal_lahir_aktual}`,
      });

      // 2. Update mother's health status back to Sehat
      await axiosInstance.put(`/api/hewan/${selectedSapi.id}`, {
        nama: selectedSapi.nama,
        tanggal_lahir: selectedSapi.bulan_tahun_lahir,
        jenis: selectedSapi.jenis,
        kelamin: selectedSapi.kelamin,
        berat_badan: selectedSapi.berat_badan,
        status_kesehatan: 'Sehat',
      });

      // 3. If user provided pedet info, create new cattle entry
      if (birthForm.rfid_pedet && birthForm.rfid_pedet.trim() !== '') {
        const pedetId = birthForm.rfid_pedet.trim();
        await axiosInstance.post('/api/hewan', {
          id: pedetId,
          nama: birthForm.nama_pedet.trim() || `Pedet ${selectedSapi.nama}`,
          tanggal_lahir: birthForm.tanggal_lahir_aktual,
          jenis: selectedSapi.jenis,
          kelamin: birthForm.jenis_kelamin_pedet,
          berat_badan: birthForm.berat_pedet ? parseFloat(birthForm.berat_pedet) : null,
          status_kesehatan: 'Sehat',
        });
        toast.success(`Pedet berhasil didaftarkan sebagai ternak baru (RFID: ${pedetId})`);
      }

      toast.success('Kelahiran dikonfirmasi! Data diperbarui.');
      setShowBirthModal(false);
      fetchSapiDetail(id);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan konfirmasi kelahiran.');
    } finally {
      setBirthLoading(false);
    }
  };

  if (loading || !selectedSapi) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen bg-[#F3F4F6]">
        <div className="w-10 h-10 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium">{lang === 'id' ? 'Memuat data ternak...' : 'Loading cattle data...'}</p>
      </div>
    );
  }

  const usiaText = hitungUsia(selectedSapi.bulan_tahun_lahir, lang);
  const isPregnant = selectedSapi.status_kebuntingan === 'Bunting' || selectedSapi.status_kebuntingan?.toLowerCase().includes('pregnant');

  // ── Mobile Animated Button (Static version for mobile to avoid hover conflict) ─────────
  const MobileAnimatedBtn = ({ icon: Icon, onClick, danger = false, className = '' }) => {
    const iconColor = danger ? '#DC2626' : '#2E7D32';
    const bgColor = danger ? '#FDF6F6' : '#F5F8F6';
    const borderColor = danger ? '#FCE8E8' : '#E8F0EA';
    return (
      <button
        onClick={onClick}
        className={`flex items-center justify-center rounded-full cursor-pointer transition-transform active:scale-95 backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.05)] ${className}`}
        style={{ width: '42px', height: '42px', background: bgColor, border: `1px solid ${borderColor}`, color: iconColor }}
      >
        <Icon size={20} />
      </button>
    );
  };

  return (
    <>
      {/* ── Modal: Edit Profile ────────────────────────────────────────────────── */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsEditProfileOpen(false)}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{lang === 'id' ? 'Edit Profil Ternak' : 'Edit Cattle Profile'}</h3>
              <button type="button" onClick={() => setIsEditProfileOpen(false)} className="p-2 rounded-full active:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={submitEditProfile} className="flex flex-col gap-4">
              {/* Photo Upload in Edit Modal */}
              <div className="flex flex-col items-center mb-2">
                <div className="relative group w-24 h-24 rounded-[32px] overflow-hidden bg-gray-100 border border-gray-200 shadow-sm cursor-pointer">
                  {selectedSapi?.foto ? (
                    <img src={selectedSapi.foto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Camera size={32} />
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera size={24} className="text-white" />
                    <input type="file" accept="image/*" className="hidden" disabled={isUploadingFoto} onChange={handleFileSelect} />
                  </label>
                </div>
                <span className="text-[11px] font-semibold text-gray-400 mt-2">{lang === 'id' ? 'Ketuk untuk ubah foto' : 'Tap to change photo'}</span>
              </div>
              <div className="flex gap-3">
                {[
                  { key: 'nama', label: 'Nama', type: 'text', placeholder: lang === 'id' ? 'Nama ternak' : 'Cattle name' },
                  { key: 'jenis', label: 'Ras / Jenis', type: 'text', placeholder: 'mis. Brahman, PO, Limousin' },
                ].map(({ key, label, type, placeholder }) => (
                  <div key={key} className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                    <input
                      type={type} value={editProfileForm[key] || ''} placeholder={placeholder}
                      onChange={e => setEditProfileForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]"
                    />
                  </div>
                ))}
              </div>
              {[
                { key: 'bulan_tahun_lahir', label: 'Tanggal Lahir', type: 'date', placeholder: '' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                  <input
                    type={type} value={editProfileForm[key] || ''} placeholder={placeholder}
                    onChange={e => setEditProfileForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]"
                  />
                </div>
              ))}
              


              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{lang === 'id' ? 'Status Kesehatan' : 'Health Status'}</label>
                <div className="relative">
                  <select value={editProfileForm.kesehatan || ''} onChange={e => setEditProfileForm(f => ({ ...f, kesehatan: e.target.value }))}
                    className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]">
                    <option value="">Pilih status...</option>
                    <option value="Sehat / Aktif">Sehat / Aktif</option>
                    <option value="Sakit">{lang === 'id' ? 'Sakit' : 'Sick'}</option>
                    <option value="Karantina">Karantina</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>
              <button type="submit" disabled={editProfileLoading}
                className="mt-2 w-full py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                {editProfileLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editProfileLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Catat / Edit IB ──────────────────────────────────────────────── */}
      {isIBModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsIBModalOpen(false)}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editingIB ? 'Edit Data IB' : 'Catat Inseminasi Buatan'}</h3>
              <button type="button" onClick={() => setIsIBModalOpen(false)} className="p-2 rounded-full active:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={submitIB} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Inseminator / Pemberi IB</label>
                <input type="text" value={ibForm.pemberi_ib} placeholder="Nama inseminator" required
                  onChange={e => setIBForm(f => ({ ...f, pemberi_ib: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tanggal IB</label>
                  <input type="date" value={ibForm.tanggal_ib} required
                    onChange={e => setIBForm(f => ({ ...f, tanggal_ib: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]" />
                </div>
                <div className="w-[120px]">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Ke-IB Berapa</label>
                  <input type="number" value={ibForm.jumlah_ib} placeholder="mis. 1" min={1}
                    onChange={e => setIBForm(f => ({ ...f, jumlah_ib: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Catatan (opsional)</label>
                <textarea value={ibForm.catatan} rows={3} placeholder="Catatan tambahan..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitIB(e);
                    }
                  }}
                  onChange={e => setIBForm(f => ({ ...f, catatan: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32] resize-none" />
              </div>
              <button type="submit" disabled={ibLoading}
                className="mt-2 w-full py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                {ibLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {ibLoading ? 'Menyimpan...' : (editingIB ? 'Perbarui Data IB' : 'Simpan Catatan IB')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Konfirmasi Hapus Ternak ──────────────────────────────────────── */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteConfirmOpen(false)}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{lang === 'id' ? 'Hapus Ternak?' : 'Delete Cattle?'}</h3>
            <p className="text-sm text-gray-500 text-center mb-6">{lang === 'id' ? <>Data ternak <strong>{selectedSapi.nama}</strong> akan dihapus permanen dan tidak dapat dikembalikan.</> : <>Cattle data <strong>{selectedSapi.nama}</strong> will be permanently deleted and cannot be undone.</>}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-3 border border-gray-200 text-gray-700 font-bold rounded-xl active:bg-gray-50 transition-colors">Batal</button>
              <button type="button" onClick={handleHapusSapi} disabled={hapusLoading}
                className="flex-1 py-3 bg-red-500 active:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                {hapusLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                {hapusLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Konfirmasi Hapus IB ─────────────────────────────────────────── */}
      {isDeleteIBConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteIBConfirmOpen(false)}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Hapus Catatan IB?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Catatan IB ini akan dihapus permanen dan tidak dapat dikembalikan.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsDeleteIBConfirmOpen(false)} className="flex-1 py-3 border border-gray-200 text-gray-700 font-bold rounded-xl active:bg-gray-50 transition-colors">Batal</button>
              <button type="button" onClick={handleConfirmDeleteIB}
                className="flex-1 py-3 bg-red-500 active:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center transition-colors">
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Lapor Sakit ─────────────────────────────────────────── */}
      <ReportSickModal
        isOpen={isReportSickOpen}
        onClose={() => setIsReportSickOpen(false)}
        onSubmit={handleReportSick}
        cowId={selectedSapi?.id}
      />

      {/* ── Modal: Cropper ─────────────────────────────────────────── */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        imageSrc={selectedFileUrl}
        onCropComplete={handleUploadFoto}
        aspectRatio={1}
      />

      {/* ── MOBILE VIEW ── */}
        {/* ── MOBILE FULLSCREEN DETAIL MODAL ── */}
        <div className="lg:hidden fixed inset-0 z-[35] bg-[#F3F4F6] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-[100px]">
          {/* Header Photo */}
          <div className="sticky top-0 w-full h-[60vh] min-h-[450px] z-0">
            {selectedSapi.foto ? (
              <div className="w-full h-full relative bg-gray-200 animate-pulse">
                <img 
                  src={selectedSapi.foto} 
                  alt={selectedSapi.nama} 
                  fetchpriority="high"
                  className="w-full h-full object-cover absolute inset-0 transition-opacity duration-300 opacity-0"
                  onLoad={(e) => {
                    e.target.style.opacity = 1;
                    e.target.parentElement.classList.remove('animate-pulse');
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-full bg-gray-300 relative" />
            )}
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/40 to-transparent pointer-events-none" />
            
            {/* Clickable Overlay for Photo Upload */}
            <label className="absolute inset-0 z-20 cursor-pointer flex flex-col items-center justify-center group">
              <input type="file" accept="image/*" className="hidden" disabled={isUploadingFoto} onChange={handleFileSelect} />
              
              {!selectedSapi.foto ? (
                <div className="flex flex-col items-center mb-6">
                   <div className="bg-white/20 backdrop-blur-md p-4 rounded-full mb-3 border border-white/30 shadow-lg group-active:scale-95 transition-transform flex items-center justify-center">
                      <Camera size={36} className="text-white/90" />
                   </div>
                   <p className="text-[13px] font-medium text-white/90 tracking-wide" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Ketuk untuk tambah foto</p>
                </div>
              ) : (
                <div className="opacity-0 group-active:opacity-100 transition-opacity bg-black/40 w-full h-full flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <Camera size={48} className="text-white/90 mb-2" />
                    <p className="text-sm font-bold text-white">Ubah Foto</p>
                  </div>
                </div>
              )}
            </label>
            
            {/* Top Bar / Back Button */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-30" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
              <button onClick={handleBack} className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-800 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-white/50 active:scale-95 transition-transform">
                <ChevronLeft size={24} />
              </button>
              {/* Top Right Action Buttons — AnimatedQAButton style */}
              <div className="flex gap-2">
                <MobileAnimatedBtn
                  icon={Edit2}
                  onClick={openEditProfile}
                  className="shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
                />
                <MobileAnimatedBtn
                  icon={Trash2}
                  danger
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
                />
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
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">{lang === 'id' ? 'Riwayat' : 'History'}</span>
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
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">{lang === 'id' ? 'Prediksi' : 'Predict'}</span>
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
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">{lang === 'id' ? 'Catatan Harian' : 'Daily Notes'}</span>
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
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">{lang === 'id' ? 'Grafik Sensor' : 'Sensor Graph'}</span>
            </button>
          </div>

          {/* Bottom Display Area */}
          {activeDetailTab === 'riwayat' ? (
            <>
              {/* Riwayat Ternak - Card Style */}
              <div className="px-5 pb-6 bg-white">
                <div className="flex justify-between items-center mb-4 gap-4">
                   <h3 className="text-[17px] font-extrabold text-[#111] whitespace-nowrap">{lang === 'id' ? 'Riwayat Ternak' : 'Cattle History'}</h3>
                   {(!sortedReproHistory.some(item => item.results === true || item.results === 'true' || item.is_pregnant === true)) && (
                     <button
                       onClick={openCatatIB}
                       className="flex-1 flex items-center justify-center gap-1.5 rounded-full transition-transform active:scale-95 shadow-sm border border-[#E8F0EA] bg-[#F5F8F6] text-[#2E7D32]"
                       style={{ padding: '8px 16px' }}
                     >
                       <Plus size={16} />
                       <span className="font-bold text-[13px]">Catat IB</span>
                     </button>
                   )}
                </div>

                {reproCycles.length === 0 ? (
                  <div className="text-center text-sm text-[var(--text-3)] py-8">Belum ada riwayat.</div>
                ) : (
                  <div className="space-y-6">
                    {reproCycles.map((cycle, cycleIndex) => (
                      <div key={cycleIndex} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                          <h4 className="font-bold text-[13px] text-gray-800">
                            {cycleIndex === 0 ? (lang === 'id' ? 'Siklus Saat Ini' : 'Current Cycle') : (lang === 'id' ? `Siklus ${reproCycles.length - cycleIndex}` : `Cycle ${reproCycles.length - cycleIndex}`)}
                          </h4>
                          <span className="text-[11px] font-semibold text-gray-500">{cycle.length} IB</span>
                        </div>
                        <div className="p-3 space-y-3">
                          {cycle.map((item) => {
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
                             {(item.catatan && item.catatan.trim() !== '') && (
                              <div className="flex flex-col mt-2 pt-2" style={{ borderTop: '0.5px dashed var(--border)' }}>
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Catatan</span>
                                <span className="text-sm text-gray-700">{item.catatan}</span>
                              </div>
                            )}
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
                            <div className="flex items-center gap-2 ml-auto">
                              <MobileAnimatedBtn
                                icon={Pencil}
                                label="Edit"
                                onClick={() => startEditRepro(item)}
                              />
                              <MobileAnimatedBtn
                                icon={Trash2}
                                label="Hapus"
                                danger
                                onClick={() => deleteReproRecord(item)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                        </div>
                      </div>
                    ))}
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
              <div className="mb-8 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[20px] font-extrabold text-[#111]">{lang === 'id' ? 'Catatan Aktivitas Ternak' : 'Cattle Activity Notes'}</h3>
                  <p className="text-[13px] text-gray-500 mt-1">{lang === 'id' ? 'Rekaman aktivitas untuk' : 'Activity records for'} <strong className="text-[#2E7D32]">{selectedSapi.nama}</strong></p>
                </div>
                {reproCycles.length > 0 && (
                  <div className="relative shrink-0">
                    <select
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(Number(e.target.value))}
                      className="appearance-none outline-none text-xs font-semibold border border-gray-200 rounded-lg shadow-sm py-2 pl-3 pr-8 bg-white text-gray-800 cursor-pointer"
                    >
                      {reproCycles.map((_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? (lang === 'id' ? 'Siklus Saat Ini' : 'Current Cycle') : (lang === 'id' ? `Siklus ${reproCycles.length - i}` : `Cycle ${reproCycles.length - i}`)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>
              
              <Stepper orientation="vertical" defaultValue={2} className="w-full">
                <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[17px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#2E7D32]/20 before:to-transparent">
                  
                  {(() => {
                      if (!reproCycles || reproCycles.length === 0) {
                          return (
                              <div className="w-full text-center py-10 bg-white border border-[#E8F0EA] rounded-[16px] shadow-sm">
                                  <p className="text-[13px] text-gray-500">{lang === 'id' ? 'Belum ada data aktivitas untuk ternak ini.' : 'No activity data for this cattle yet.'}</p>
                              </div>
                          );
                      }
                      
                      const formatTglStr = (ts) => new Date(ts).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {day: 'numeric', month: 'short', year: 'numeric'});
                      const timelineEvents = [];
                      
                      const activeIndex = Math.min(Number(activityFilter) || 0, Math.max(0, reproCycles.length - 1));
                      const cycle = reproCycles[activeIndex] || [];
                      
                      cycle.forEach((item) => {
                          const isPregnant    = item.results === true || item.results === 'true' || item.is_pregnant === true;
                          const isFailed      = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                          const rawDate       = item.tanggal_ib || item.service_date;
                          
                          if (rawDate) {
                              const baseTime = new Date(rawDate).getTime();
                              const eventId = item.id || Math.random().toString();
                              
                              timelineEvents.push({
                                  id: eventId + '-ib',
                                  title: `Inseminasi Buatan (Ke-${item.jumlah_ib || 1})`,
                                  dateRaw: baseTime,
                                  dateFmt: formatTglStr(baseTime),
                                  desc: `Metode: ${(item.metode || 'IB').toUpperCase()}${item.pemberi_ib ? `. Inseminator: ${item.pemberi_ib}` : ''}`,
                                  status: isPregnant ? 'completed' : (isFailed ? 'failed' : 'active')
                              });
                              
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
                          }
                      });
                      
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
                               <StepperItem key={evt.id} step={idx + 1} completed={isCompleted} asChild>
                                 <div className="relative flex items-start gap-4 outline-none w-full text-left cursor-default">
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

      {/* ── DESKTOP VIEW ── */}
      <div className="hidden lg:block">
        {/* ── MAIN CONTENT (Profile Sidebar Layout) ── */}
        <div className="flex flex-col lg:flex-row gap-6 pt-2 lg:items-stretch">

          {/* LEFT COLUMN: Profile Card (fixed 280px) */}
          <div className="w-full lg:w-[280px] shrink-0 flex flex-col">
            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex flex-col items-center relative overflow-hidden flex-1">
              {/* Top decorative gradient */}
              <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-gray-50 to-white" />

              {/* Action Row: Back | Edit | Hapus */}
              <div className="w-full flex items-center justify-between mb-4 z-10 relative">
                <DesktopAnimatedBtn icon={ChevronLeft} label={lang === 'id' ? 'Kembali' : 'Back'} onClick={() => navigate('/ternak')} />
                <div className="flex gap-2">
                  <DesktopAnimatedBtn icon={Edit2} label="Edit" onClick={openEditProfile} />
                  <DesktopAnimatedBtn icon={Trash2} label="Hapus" danger onClick={() => setIsDeleteConfirmOpen(true)} />
                </div>
              </div>

              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden shrink-0 border-4 border-white shadow-md relative group z-10">
                {selectedSapi.foto ? (
                  <div className="w-full h-full relative bg-gray-200 animate-pulse">
                    <img 
                      src={selectedSapi.foto} 
                      alt={selectedSapi.nama} 
                      fetchpriority="high"
                      className="w-full h-full object-cover absolute inset-0 transition-opacity duration-300 opacity-0"
                      onLoad={(e) => {
                        e.target.style.opacity = 1;
                        e.target.parentElement.classList.remove('animate-pulse');
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <Beef size={36} className="text-gray-300" />
                  </div>
                )}
                
                {/* Upload Overlay */}
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera size={24} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" disabled={isUploadingFoto} onChange={handleFileSelect} />
                </label>
              </div>

              {/* Name & ID */}
              <div className="text-center mt-3 mb-4 z-10">
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{selectedSapi.nama || '--'}</h2>
                <p className="text-xs font-medium text-gray-500 mt-0.5">ID: {selectedSapi.id}</p>
              </div>

              {/* Badges */}
              <div className="flex flex-col gap-2 w-full z-10 mb-5">
                <div className="px-4 py-2 bg-[#E8F5E9] text-[#2E7D32] rounded-full text-[12px] font-bold border border-[#C8E6C9] flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#4CAF50]" /> {selectedSapi.status_kesehatan === 'Sakit' ? (lang === 'id' ? 'Sakit' : 'Sick') : (lang === 'id' ? 'Sehat / Aktif' : 'Healthy / Active')}
                </div>
                <div className={`px-4 py-2 rounded-full text-[12px] font-bold border flex items-center justify-center gap-2 ${isPregnant ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {isPregnant ? (lang === 'id' ? 'Bunting' : 'Pregnant') : (lang === 'id' ? 'Tidak Bunting' : 'Not Pregnant')}
                </div>
                <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-[12px] font-bold border border-blue-100 flex items-center justify-center gap-2">
                  {lang === 'id' ? 'Fase:' : 'Phase:'} {selectedSapi.fase_produksi === 'Kering' ? (lang === 'id' ? 'Kering' : 'Dry') : (lang === 'id' ? 'Laktasi' : 'Lactation')}
                </div>
              </div>

              <div className="w-full h-px bg-gray-100 mb-5" />

              {/* Quick Stats */}
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center"><Weight size={14} /></div>
                    <span className="text-sm font-medium">{lang === 'id' ? 'Berat' : 'Weight'}</span>
                  </div>
                  <span className="font-bold text-gray-900 text-sm">{selectedSapi.berat_estimasi || '--'} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center"><ThermometerSun size={14} /></div>
                    <span className="text-sm font-medium">{lang === 'id' ? 'Suhu' : 'Temp'}</span>
                  </div>
                  <span className="font-bold text-gray-900 text-sm">{selectedSapi.suhu || '--'} °C</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center"><Stethoscope size={14} /></div>
                    <span className="text-sm font-medium">Total IB</span>
                  </div>
                  <span className="font-bold text-gray-900 text-sm">{sortedReproHistory.length} kali</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Workspace Area */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Tab Bar */}
            <div className="bg-white rounded-t-[20px] border-b border-gray-100 shadow-sm flex items-center justify-between px-2 overflow-x-auto no-scrollbar">
              <div className="flex">
                {['riwayat', 'estrus', 'linimasa', 'analitik'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-4 text-[14px] font-bold whitespace-nowrap transition-colors relative ${
                      activeTab === tab ? 'text-[#2E7D32]' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {tab === 'riwayat' && (lang === 'id' ? 'Riwayat Reproduksi' : 'Reproduction History')}
                    {tab === 'estrus' && (lang === 'id' ? 'Pantau Birahi' : 'Estrus Monitor')}
                    {tab === 'linimasa' && (lang === 'id' ? 'Catatan Harian' : 'Daily Notes')}
                    {tab === 'analitik' && (lang === 'id' ? 'Grafik Sensor' : 'Sensor Graph')}

                    {activeTab === tab && (
                      <motion.div layoutId="detailTabIndicator" className="absolute bottom-0 left-4 right-4 h-[3px] bg-[#2E7D32] rounded-t-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-b-[20px] shadow-sm p-6 min-h-[400px] flex-1">
              {activeTab === 'riwayat' && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">{lang === 'id' ? 'Riwayat Reproduksi Sapi' : 'Reproduction History'}</h3>
                      <div className="relative inline-flex items-center group w-fit">
                        <select 
                          value={reproFilter}
                          onChange={(e) => setReproFilter(e.target.value)}
                          className="appearance-none outline-none text-sm font-semibold border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32] py-2 pl-3 pr-9 bg-white text-gray-800 hover:border-gray-300 transition-colors cursor-pointer"
                        >
                          <option value="semua_riwayat">{lang === 'id' ? 'Semua Riwayat' : 'All History'}</option>
                          {reproCycles.map((_, i) => (
                            <option key={i} value={i}>
                              {i === 0 ? (lang === 'id' ? 'Siklus Saat Ini' : 'Current Cycle') : (lang === 'id' ? `Siklus ${reproCycles.length - i}` : `Cycle ${reproCycles.length - i}`)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 w-4 h-4 text-gray-400 group-hover:text-gray-600 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-white border border-gray-100 shadow-sm rounded-xl px-4 py-2 flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{lang === 'id' ? 'Total Siklus' : 'Total Cycles'}</span>
                        <span className="text-xl font-black text-gray-900">{reproCycles.length}</span>
                      </div>
                      <div className="bg-green-50/50 border border-green-100 shadow-sm rounded-xl px-4 py-2 flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{lang === 'id' ? 'Siklus Berhasil' : 'Successful Cycles'}</span>
                        <span className="text-xl font-black text-green-700">{reproCycles.filter(c => c.some(i => i.is_pregnant === true || i.results === true)).length}</span>
                      </div>
                      <div className="bg-red-50/50 border border-red-100 shadow-sm rounded-xl px-4 py-2 flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{lang === 'id' ? 'Siklus Gagal' : 'Failed Cycles'}</span>
                        <span className="text-xl font-black text-red-700">{reproCycles.filter(c => c.some(i => i.is_pregnant === false || i.results === false)).length}</span>
                      </div>
                      <div className="shrink-0 ml-2">
                        <DesktopAnimatedBtn icon={Plus} label={lang === 'id' ? 'Catat Inseminasi' : 'Record AI'} onClick={openCatatIB} />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-auto max-h-[500px] rounded-2xl border border-gray-100 relative shadow-inner mt-2">
                    <table className="w-full text-center border-collapse">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">IB #</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">Tanggal</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">Status</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {reproCycles.length === 0 ? (
                          <tr><td colSpan="4" className="py-8 text-sm text-gray-500">Belum ada data.</td></tr>
                        ) : (
                          (reproFilter === 'semua_riwayat' ? reproCycles : (reproCycles[Number(reproFilter)] ? [reproCycles[Number(reproFilter)]] : [])).map((cycle, cycleIdx) => (
                            <React.Fragment key={cycleIdx}>
                              {cycle.map((item) => (
                                <tr key={item.id}>
                                  <td className="px-4 py-4 text-sm font-bold text-gray-900">{item.jumlah_ib || '-'}</td>
                                  <td className="px-4 py-4 text-sm text-gray-600">{new Date(item.tanggal_ib || item.service_date).toLocaleDateString()}</td>
                                  <td className="px-4 py-4">
                                    <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${item.is_pregnant ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {item.is_pregnant ? 'Bunting' : 'Aktif'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex gap-2 justify-center">
                                      <DesktopAnimatedBtn icon={Pencil} label="Edit" onClick={() => startEditRepro(item)} />
                                      <DesktopAnimatedBtn icon={Trash2} label="Hapus" danger onClick={() => deleteReproRecord(item)} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'estrus' && (
                <div className="animate-in fade-in duration-300">
                  <CowEstrusView selectedCow={selectedSapi} reproHistory={sortedReproHistory} />
                </div>
              )}

              {activeTab === 'linimasa' && (
                 <div className="animate-in fade-in duration-300">
                   <div className="flex items-center justify-between mb-6">
                     <div>
                       <h3 className="text-lg font-bold text-gray-900">{lang === 'id' ? 'Catatan Aktivitas Ternak' : 'Cattle Activity Notes'}</h3>
                       <p className="text-sm text-gray-500 mt-0.5">{lang === 'id' ? 'Rekaman aktivitas untuk' : 'Activity records for'} <strong className="text-[#2E7D32]">{selectedSapi.nama}</strong></p>
                     </div>
                     {reproCycles.length > 0 && (
                       <div className="relative shrink-0">
                         <select
                           value={activityFilter}
                           onChange={(e) => setActivityFilter(Number(e.target.value))}
                           className="appearance-none outline-none text-xs font-semibold border border-gray-200 rounded-lg shadow-sm py-2 pl-3 pr-8 bg-white text-gray-800 cursor-pointer"
                         >
                           {Array.from({ length: Math.min(5, sortedReproHistory.length) }).map((_, i) => (
                             <option key={i} value={i}>
                               {i === 0 ? (lang === 'id' ? 'Siklus Saat Ini' : 'Current Cycle') : (lang === 'id' ? `Siklus ${sortedReproHistory.length - i}` : `Cycle ${sortedReproHistory.length - i}`)}
                             </option>
                           ))}
                         </select>
                         <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                       </div>
                     )}
                   </div>
                   <Stepper orientation="vertical" defaultValue={2} className="w-full">
                     <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[17px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#2E7D32]/20 before:to-transparent">
                       {(() => {
                           if (!sortedReproHistory || sortedReproHistory.length === 0) {
                               return (
                                   <div className="w-full text-center py-10 bg-white border border-[#E8F0EA] rounded-[16px] shadow-sm">
                                       <p className="text-[13px] text-gray-500">{lang === 'id' ? 'Belum ada data aktivitas untuk ternak ini.' : 'No activity data for this cattle yet.'}</p>
                                   </div>
                               );
                           }
                           const formatTglStr = (ts) => new Date(ts).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {day: 'numeric', month: 'short', year: 'numeric'});
                           const timelineEvents = [];
                           
                           const activeIndex = Math.min(Number(activityFilter) || 0, Math.max(0, reproCycles.length - 1));
                           const cycle = reproCycles[activeIndex] || [];
                           
                           cycle.forEach((item) => {
                               const isPregnant = item.results === true || item.results === 'true' || item.is_pregnant === true;
                               const isFailed   = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                               const rawDate    = item.tanggal_ib || item.service_date;
                               if (rawDate) {
                                   const baseTime = new Date(rawDate).getTime();
                                   const eventId = item.id || Math.random().toString();
                                   timelineEvents.push({
                                       id: eventId + '-ib',
                                       title: `Inseminasi Buatan (Ke-${item.jumlah_ib || 1})`,
                                       dateRaw: baseTime,
                                       dateFmt: formatTglStr(baseTime),
                                       desc: `Metode: ${(item.metode || 'IB').toUpperCase()}${item.pemberi_ib ? `. Inseminator: ${item.pemberi_ib}` : ''}`,
                                       status: isPregnant ? 'completed' : (isFailed ? 'failed' : 'active')
                                   });
                                   if (isPregnant) {
                                       const pkbTime = baseTime + 60 * 24 * 60 * 60 * 1000;
                                       timelineEvents.push({ id: eventId + '-pkb', title: 'Pemeriksaan Kebuntingan', dateRaw: pkbTime, dateFmt: formatTglStr(pkbTime), desc: 'Dinyatakan Bunting (PKB positif).', status: 'completed' });
                                       const masaKeringTime = baseTime + 223 * 24 * 60 * 60 * 1000;
                                       timelineEvents.push({ id: eventId + '-kering', title: 'Masa Kering', dateRaw: masaKeringTime, dateFmt: formatTglStr(masaKeringTime), desc: 'Persiapan menjelang kelahiran.', status: masaKeringTime < Date.now() ? 'completed' : 'future_active' });
                                       const calvingTime = baseTime + 283 * 24 * 60 * 60 * 1000;
                                       timelineEvents.push({ id: eventId + '-calving', title: 'Perkiraan Kelahiran', dateRaw: calvingTime, dateFmt: 'Est. ' + formatTglStr(calvingTime), desc: 'Pindahkan ke kandang isolasi.', status: calvingTime < Date.now() ? 'completed' : 'future' });
                                   }
                               }
                           });
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
               )}

              {activeTab === 'analitik' && (
                 <div className="animate-in fade-in duration-300">
                   <CowAnalyticsView selectedCow={selectedSapi} />
                 </div>
              )}
            </div>
          </div>
        </div>

        {/* Birth Confirmation Modal */}
        {showBirthModal && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !birthLoading && setShowBirthModal(false)} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col gap-0 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Header */}
              <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Baby className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-black text-lg">Konfirmasi Kelahiran</h3>
                  <p className="text-rose-100 text-xs">{selectedSapi?.nama} — {birthReproItem?.hpl}</p>
                </div>
                {!birthLoading && (
                  <button onClick={() => setShowBirthModal(false)} className="ml-auto w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                    <X size={14} className="text-white" />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal Lahir Aktual *</label>
                  <input
                    type="date"
                    value={birthForm.tanggal_lahir_aktual}
                    onChange={e => setBirthForm(f => ({ ...f, tanggal_lahir_aktual: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                  />
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                  <p className="text-xs font-black text-rose-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Baby className="w-3.5 h-3.5" />
                    Data Anak Sapi (Pedet)
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Jenis Kelamin</label>
                        <select
                          value={birthForm.jenis_kelamin_pedet}
                          onChange={e => setBirthForm(f => ({ ...f, jenis_kelamin_pedet: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                        >
                          <option value="Betina">Betina</option>
                          <option value="Jantan">Jantan</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Berat (kg)</label>
                        <input
                          type="number"
                          placeholder="Opsional"
                          value={birthForm.berat_pedet}
                          onChange={e => setBirthForm(f => ({ ...f, berat_pedet: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Nama Pedet</label>
                      <input
                        type="text"
                        placeholder="Opsional (default: Pedet [nama induk])"
                        value={birthForm.nama_pedet}
                        onChange={e => setBirthForm(f => ({ ...f, nama_pedet: e.target.value }))}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">RFID Pedet <span className="text-rose-500">*wajib untuk daftar ke sistem</span></label>
                      <input
                        type="text"
                        placeholder="Kosongkan jika belum ada RFID"
                        value={birthForm.rfid_pedet}
                        onChange={e => setBirthForm(f => ({ ...f, rfid_pedet: e.target.value }))}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setShowBirthModal(false)}
                  disabled={birthLoading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm py-3 rounded-2xl transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={confirmBirth}
                  disabled={birthLoading}
                  className="flex-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-black text-sm py-3 px-6 rounded-2xl transition-all shadow-lg shadow-rose-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {birthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                  {birthLoading ? 'Menyimpan...' : 'Konfirmasi Kelahiran'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <PairCollarModal
          isOpen={isPairModalOpen}
          onClose={() => { setPairSelectedSapi(null); setPairSelectedCollar(null); setIsPairModalOpen(false); }}
          pairSelectedSapi={pairSelectedSapi}
          setPairSelectedSapi={setPairSelectedSapi}
          pairSelectedCollar={pairSelectedCollar}
          setPairSelectedCollar={setPairSelectedCollar}
        />
      </div>
    </>
  );
}
