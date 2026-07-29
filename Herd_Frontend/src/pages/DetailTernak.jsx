import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Camera, Activity, Edit2, Trash2, Link, Unlink, ActivityIcon, Plus, Beef, ThermometerSun, Weight, Stethoscope, Pencil, X, Save, Loader2, CheckCircle, XCircle, ChevronRight, ChevronDown, LineChart, ClipboardList, Sparkles, Check } from 'lucide-react';
import { useTernakStore } from '../store/useTernakStore';
import useSettingsStore from '@/store/settingsStore';
import { motion } from 'framer-motion';
import translations from '@/lib/i18n';
import CowAnalyticsView from '@/components/shared/CowAnalyticsView';
import CowEstrusView from '@/components/shared/CowEstrusView';
import PairCollarModal from '@/components/shared/PairCollarModal';

import { Stepper, StepperItem, StepperTitle, StepperDescription } from '@/components/ui/stepper';
import { toast } from '@/store/toastStore';

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
  const { language } = useSettingsStore();
  const lang = language || 'id';
  const t = translations[lang];

  const handleBack = () => navigate(-1);
  const [activeDetailTab, setActiveDetailTab] = useState('riwayat');
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
  const [reproFilter, setReproFilter] = useState('siklus_saat_ini');
  const [activityFilter, setActivityFilter] = useState('hari_ini');
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [pairSelectedSapi, setPairSelectedSapi] = useState(null);
  const [pairSelectedCollar, setPairSelectedCollar] = useState(null);

  useEffect(() => {
    if (id) {
      fetchSapiDetail(id);
    }
  }, [id, fetchSapiDetail]);

  const sortedReproHistory = useMemo(() => {
    if (!selectedSapi || !selectedSapi.reproduksi) return [];
    return [...selectedSapi.reproduksi].sort((a, b) => {
      const dateA = new Date(a.tanggal_ib || a.service_date).getTime();
      const dateB = new Date(b.tanggal_ib || b.service_date).getTime();
      return dateB - dateA;
    });
  }, [selectedSapi]);

  if (loading || !selectedSapi) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen bg-[#F3F4F6]">
        <div className="w-10 h-10 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium">Memuat data ternak...</p>
      </div>
    );
  }

  const usiaText = hitungUsia(selectedSapi.bulan_tahun_lahir, lang);
  const isPregnant = selectedSapi.status_kebuntingan === 'Bunting' || selectedSapi.status_kebuntingan?.toLowerCase().includes('pregnant');

  // ── Mobile Animated Button (AnimatedQAButton style for mobile) ─────────
  const MobileAnimatedBtn = ({ icon: Icon, label, onClick, danger = false, className = '' }) => {
    const baseColor = danger ? '#DC2626' : '#2E7D32';
    const dimBg = danger ? 'rgba(220,38,38,0.08)' : 'rgba(46,125,50,0.08)';
    return (
      <button
        onClick={onClick}
        className={`group inline-flex items-center rounded-full border shadow-sm cursor-pointer transition-all duration-300 active:scale-95 ${className}`}
        style={{ padding: '10px', gap: 0, background: dimBg, borderColor: `${baseColor}30`, color: baseColor }}
        onMouseEnter={e => {
          e.currentTarget.style.paddingLeft = '16px';
          e.currentTarget.style.paddingRight = '16px';
          e.currentTarget.style.gap = '6px';
          e.currentTarget.style.background = baseColor;
          e.currentTarget.style.borderColor = baseColor;
          e.currentTarget.style.color = '#fff';
          const span = e.currentTarget.querySelector('span');
          if (span) { span.style.maxWidth = '80px'; span.style.opacity = '1'; }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.paddingLeft = '10px';
          e.currentTarget.style.paddingRight = '10px';
          e.currentTarget.style.gap = '0';
          e.currentTarget.style.background = dimBg;
          e.currentTarget.style.borderColor = `${baseColor}30`;
          e.currentTarget.style.color = baseColor;
          const span = e.currentTarget.querySelector('span');
          if (span) { span.style.maxWidth = '0'; span.style.opacity = '0'; }
        }}
      >
        <Icon size={18} />
        <span style={{ maxWidth: 0, opacity: 0, overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 700, transition: 'max-width 0.25s ease, opacity 0.2s ease' }}>{label}</span>
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
              <h3 className="text-lg font-bold text-gray-900">Edit Profil Ternak</h3>
              <button onClick={() => setIsEditProfileOpen(false)} className="p-2 rounded-full hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={submitEditProfile} className="flex flex-col gap-4">
              {[
                { key: 'nama', label: 'Nama', type: 'text', placeholder: 'Nama ternak' },
                { key: 'jenis', label: 'Ras / Jenis', type: 'text', placeholder: 'mis. Brahman, PO, Limousin' },
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
                <label className="block text-xs font-semibold text-gray-500 mb-1">Status Kesehatan</label>
                <div className="relative">
                  <select value={editProfileForm.kesehatan || ''} onChange={e => setEditProfileForm(f => ({ ...f, kesehatan: e.target.value }))}
                    className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]">
                    <option value="">Pilih status...</option>
                    <option value="Sehat / Aktif">Sehat / Aktif</option>
                    <option value="Sakit">Sakit</option>
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
              <button onClick={() => setIsIBModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={submitIB} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tanggal IB</label>
                <input type="date" value={ibForm.tanggal_ib} required
                  onChange={e => setIBForm(f => ({ ...f, tanggal_ib: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Inseminator / Pemberi IB</label>
                <input type="text" value={ibForm.pemberi_ib} placeholder="Nama inseminator" required
                  onChange={e => setIBForm(f => ({ ...f, pemberi_ib: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Ke-IB Berapa</label>
                <input type="number" value={ibForm.jumlah_ib} placeholder="mis. 1, 2, 3..." min={1}
                  onChange={e => setIBForm(f => ({ ...f, jumlah_ib: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-0 h-[46px] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32]" />
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
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Hapus Ternak?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Data ternak <strong>{selectedSapi.nama}</strong> akan dihapus permanen dan tidak dapat dikembalikan.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-3 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors">Batal</button>
              <button onClick={handleHapusSapi} disabled={hapusLoading}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
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
              <button onClick={() => setIsDeleteIBConfirmOpen(false)} className="flex-1 py-3 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors">Batal</button>
              <button onClick={handleConfirmDeleteIB}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center transition-colors">
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MOBILE VIEW ── */}
        {/* ── MOBILE FULLSCREEN DETAIL MODAL ── */}
        <div className="md:hidden fixed inset-0 z-[35] bg-[#F3F4F6] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-[100px]">
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
                       <Camera size={14} /> Unggah Foto
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
              {/* Top Right Action Buttons — AnimatedQAButton style */}
              <div className="flex gap-2">
                <MobileAnimatedBtn
                  icon={Edit2}
                  label="Edit Profil"
                  onClick={openEditProfile}
                  className="shadow-[0_2px_10px_rgba(0,0,0,0.1)] bg-white/80 backdrop-blur-md"
                />
                <MobileAnimatedBtn
                  icon={Trash2}
                  label="Hapus"
                  danger
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="shadow-[0_2px_10px_rgba(0,0,0,0.1)] bg-white/80 backdrop-blur-md"
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
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Catatan Harian</span>
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
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Grafik Sensor</span>
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
                     <MobileAnimatedBtn
                       icon={Plus}
                       label="Catat IB"
                       onClick={openCatatIB}
                     />
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
                  <h3 className="text-[20px] font-extrabold text-[#111]">Catatan Aktivitas Ternak</h3>
                  <p className="text-[13px] text-gray-500 mt-1">Rekaman aktivitas untuk <strong className="text-[#2E7D32]">{selectedSapi.nama}</strong></p>
                </div>
                <div className="relative shrink-0">
                  <select
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value)}
                    className="appearance-none outline-none text-xs font-semibold border border-gray-200 rounded-lg shadow-sm py-2 pl-3 pr-8 bg-white text-gray-800 cursor-pointer"
                  >
                    <option value="hari_ini">Hari Ini</option>
                    <option value="minggu_ini">Minggu Ini</option>
                    <option value="bulan_ini">Bulan Ini</option>
                    <option value="semua">Semua</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
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

      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:block">
        {/* ── MAIN CONTENT (Profile Sidebar Layout) ── */}
        <div className="flex flex-col lg:flex-row gap-6 pt-2 lg:items-stretch">

          {/* LEFT COLUMN: Profile Card (fixed 280px) */}
          <div className="w-full lg:w-[280px] shrink-0 flex flex-col">
            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex flex-col items-center relative overflow-hidden flex-1">
              {/* Top decorative gradient */}
              <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-gray-50 to-white" />

              {/* Action Row: Back | Edit | Hapus */}
              <div className="w-full flex items-center justify-between mb-4 z-10 relative">
                <DesktopAnimatedBtn icon={ChevronLeft} label="Kembali" onClick={() => navigate('/ternak')} />
                <div className="flex gap-2">
                  <DesktopAnimatedBtn icon={Edit2} label="Edit" onClick={openEditProfile} />
                  <DesktopAnimatedBtn icon={Trash2} label="Hapus" danger onClick={() => setIsDeleteConfirmOpen(true)} />
                </div>
              </div>

              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden shrink-0 border-4 border-white shadow-md relative group z-10">
                {selectedSapi.foto ? (
                  <img src={selectedSapi.foto} alt={selectedSapi.nama} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <Beef size={36} className="text-gray-300" />
                  </div>
                )}
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <Camera size={20} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" />
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
                  <div className="w-2 h-2 rounded-full bg-[#4CAF50]" /> {selectedSapi.status_kesehatan || 'Sehat / Aktif'}
                </div>
                <div className={`px-4 py-2 rounded-full text-[12px] font-bold border flex items-center justify-center gap-2 ${isPregnant ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {isPregnant ? 'Bunting' : 'Tidak Bunting'}
                </div>
                <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-[12px] font-bold border border-blue-100 flex items-center justify-center gap-2">
                  Fase: {selectedSapi.fase_produksi || 'Laktasi'}
                </div>
              </div>

              <div className="w-full h-px bg-gray-100 mb-5" />

              {/* Quick Stats */}
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center"><Weight size={14} /></div>
                    <span className="text-sm font-medium">Berat</span>
                  </div>
                  <span className="font-bold text-gray-900 text-sm">{selectedSapi.berat_estimasi || '--'} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center"><ThermometerSun size={14} /></div>
                    <span className="text-sm font-medium">Suhu</span>
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
                    {tab === 'riwayat' && 'Riwayat Reproduksi'}
                    {tab === 'estrus' && 'Pantau Birahi'}
                    {tab === 'linimasa' && 'Catatan Harian'}
                    {tab === 'analitik' && 'Grafik Sensor'}

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
                  
                  {/* Top Bar: Title, Filter, Summary Cards, and Actions */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">Riwayat Reproduksi Sapi</h3>
                      <div className="relative inline-flex items-center group w-fit">
                        <select 
                          value={reproFilter}
                          onChange={(e) => setReproFilter(e.target.value)}
                          className="appearance-none outline-none text-sm font-semibold border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32] py-2 pl-3 pr-9 bg-white text-gray-800 hover:border-gray-300 transition-colors cursor-pointer"
                        >
                          <option value="siklus_saat_ini">Siklus Saat Ini</option>
                          <option value="semua_riwayat">Semua Riwayat</option>
                        </select>
                        <ChevronDown className="absolute right-3 w-4 h-4 text-gray-400 group-hover:text-gray-600 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-white border border-gray-100 shadow-sm rounded-xl px-4 py-2 flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Siklus</span>
                        <span className="text-xl font-black text-gray-900">2</span>
                      </div>
                      <div className="bg-green-50/50 border border-green-100 shadow-sm rounded-xl px-4 py-2 flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Siklus Berhasil</span>
                        <span className="text-xl font-black text-green-700">1</span>
                      </div>
                      <div className="bg-red-50/50 border border-red-100 shadow-sm rounded-xl px-4 py-2 flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Siklus Gagal</span>
                        <span className="text-xl font-black text-red-700">1</span>
                      </div>
                      
                      <div className="shrink-0 ml-2">
                        <DesktopAnimatedBtn icon={Plus} label="Catat Inseminasi" onClick={openCatatIB} />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-auto max-h-[500px] rounded-2xl border border-gray-100 relative shadow-inner mt-2">
                    <table className="w-full text-center border-collapse">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm whitespace-nowrap">IB Ke-</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm whitespace-nowrap">Tanggal Kawin</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm whitespace-nowrap">Perkiraan Hamil</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm whitespace-nowrap">Inseminator</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm whitespace-nowrap">Status</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm w-full min-w-[150px]">Catatan</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 sticky top-0 shadow-sm w-[170px]">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedReproHistory.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="px-2 py-8 text-center text-sm text-gray-500">
                              Belum ada catatan reproduksi.
                            </td>
                          </tr>
                        ) : (
                          sortedReproHistory.map((item, idx) => {
                            const isPregnant    = item.results === true || item.results === 'true' || item.is_pregnant === true;
                            const isFailed      = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                            const isNote        = item.catatan && !item.pemberi_ib;
                            const isPending     = !isPregnant && !isFailed && !isNote;

                            return (
                              <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-4 text-sm font-bold text-gray-900 align-top">
                                  {item.jumlah_ib || (sortedReproHistory.length - idx)}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600 align-top text-center">
                                  {item.tanggal_ib || item.service_date || '-'}
                                </td>
                                <td className="px-4 py-4 text-sm font-bold text-gray-900 align-top text-center">
                                  {isPregnant ? (item.hpl || '-') : '-'}
                                </td>
                                <td className="px-4 py-4 text-sm font-bold text-gray-900 align-top text-center">
                                  {item.pemberi_ib || '-'}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${item.results === true || item.results === 'true' ? 'bg-green-50 text-green-700 border border-green-100' : item.results === false || item.results === 'failed' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                                    {item.results === true || item.results === 'true' ? 'Bunting' : item.results === false || item.results === 'failed' ? 'Gagal' : 'Menunggu'}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600 align-top text-center">
                                  {(item.catatan && item.catatan.trim() !== '') ? (
                                    <div className="break-words line-clamp-3 inline-block" title={item.catatan}>
                                      {item.catatan}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <div className="flex items-center justify-center gap-2 w-[140px] shrink-0 mx-auto">
                                    {isPending ? (
                                      <>
                                        <DesktopAnimatedBtn icon={Check} label="Berhasil" expandedWidth="90px" onClick={() => confirmPregnancy(item, true)} />
                                        <DesktopAnimatedBtn icon={X} label="Gagal" danger expandedWidth="80px" onClick={() => confirmPregnancy(item, false)} />
                                      </>
                                    ) : (
                                      <>
                                        <DesktopAnimatedBtn icon={Pencil} label="Edit" type="info" expandedWidth="70px" onClick={() => startEditRepro(item)} />
                                        <DesktopAnimatedBtn icon={Trash2} label="Hapus" danger expandedWidth="80px" onClick={() => deleteReproRecord(item)} />
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
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
                       <h3 className="text-lg font-bold text-gray-900">Catatan Aktivitas Ternak</h3>
                       <p className="text-sm text-gray-500 mt-0.5">Rekaman aktivitas untuk <strong className="text-[#2E7D32]">{selectedSapi?.nama}</strong></p>
                     </div>
                     <div className="relative">
                       <select
                         value={activityFilter}
                         onChange={(e) => setActivityFilter(e.target.value)}
                         className="appearance-none outline-none text-xs font-semibold border border-gray-200 rounded-lg shadow-sm py-2 pl-3 pr-8 bg-white text-gray-800 cursor-pointer"
                       >
                         <option value="hari_ini">Hari Ini</option>
                         <option value="minggu_ini">Minggu Ini</option>
                         <option value="bulan_ini">Bulan Ini</option>
                         <option value="semua">Semua</option>
                       </select>
                       <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                     </div>
                   </div>
                   <Stepper orientation="vertical" defaultValue={2} className="w-full">
                     <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[17px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#2E7D32]/20 before:to-transparent">
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
                               const isPregnant = item.results === true || item.results === 'true' || item.is_pregnant === true;
                               const isFailed   = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                               const rawDate    = item.tanggal_ib || item.service_date;
                               if (!rawDate) return;
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
