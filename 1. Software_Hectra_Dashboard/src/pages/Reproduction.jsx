import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Calendar, 
  User as UserIcon, 
  FileText, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw,
  Clock,
  Beef,
  Stethoscope
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toastStore';
import { handleError } from '@/lib/errorHandler';
import useConfirmStore from '@/store/confirmStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

export default function Reproduction() {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const ask = useConfirmStore((state) => state.ask);
  const [records, setRecords] = useState([]);
  const [cows, setCows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Form State
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedCow, setSelectedCow] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [method, setMethod] = useState('ib');
  const [technician, setTechnician] = useState('');
  const [notes, setNotes] = useState('');

  // Quick Confirm State
  const [confirmingRecord, setConfirmingRecord] = useState(null);

  // Stats State
  const [stats, setStats] = useState({
    conceptionRate: '—',
    avgInterval: '—',
    servicesPerConception: '—',
    pregnantCount: '0'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get reproduction records and stats concurrently
      const [reproRes, cattleRes, statsRes] = await Promise.all([
        axiosInstance.get('/reproduction'),
        axiosInstance.get('/hewan'),
        axiosInstance.get('/reproduction/stats')
      ]);

      setRecords(reproRes.data || []);
      setCows(cattleRes.data || []);

      const statsData = statsRes.data || {};
      setStats({
        conceptionRate: statsData.conception_rate !== null && statsData.conception_rate !== undefined ? statsData.conception_rate : '—',
        avgInterval: statsData.avg_interval !== null && statsData.avg_interval !== undefined ? statsData.avg_interval.replace('days', lang === 'id' ? 'Hari' : 'Days') : '—',
        servicesPerConception: statsData.services_per_conception !== null && statsData.services_per_conception !== undefined ? statsData.services_per_conception : '—',
        pregnantCount: statsData.pregnant_cows !== null && statsData.pregnant_cows !== undefined ? statsData.pregnant_cows.toString() : '0'
      });
    } catch (err) {
      console.error("Gagal mengambil data reproduksi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setSelectedCow('');
    setServiceDate(new Date().toISOString().split('T')[0]);
    setMethod('ib');
    setTechnician('');
    setNotes('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (record) => {
    setEditingRecord(record);
    setSelectedCow(record.rfid || record.cow_id || '');
    setServiceDate(record.tanggal_ib ? record.tanggal_ib.split('T')[0] : record.service_date ? record.service_date.split('T')[0] : '');
    setMethod(record.metode || record.method || 'ib');
    setTechnician(record.pemberi_ib || record.petugas || record.technician || '');
    setNotes(record.catatan || record.keterangan || record.notes || '');
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await ask({
      title: lang === 'id' ? "Hapus Catatan Reproduksi" : "Delete Reproduction Record",
      message: lang === 'id' ? "Apakah Anda yakin ingin menghapus data reproduksi ini? Tindakan ini tidak dapat dibatalkan." : "Are you sure you want to delete this reproduction record? This action cannot be undone.",
      confirmText: t.btn_delete,
      cancelText: t.btn_cancel,
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await axiosInstance.delete(`/reproduction/${id}`);
      fetchData();
      toast.success(t.repro_toast_delete_success);
    } catch (err) {
      handleError(err, 'hapus data reproduksi');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCow || !serviceDate) {
      toast.error(lang === 'id' ? "Sapi dan Tanggal Kawin harus diisi!" : "Cow and Breeding Date are required!");
      return;
    }

    const payload = {
      rfid: selectedCow,
      service_date: serviceDate,
      method: method,
      technician: technician,
      notes: notes,
      is_pregnant: editingRecord 
        ? (
            (editingRecord.results === true || editingRecord.results === 'true' || editingRecord.is_pregnant === true)
              ? true
              : (editingRecord.results === false || editingRecord.results === 'failed' || editingRecord.is_pregnant === false)
                ? false
                : null
          )
        : null
    };

    try {
      if (editingRecord) {
        await axiosInstance.put(`/reproduction/${editingRecord.id}`, payload);
        toast.success(t.repro_toast_update_success);
      } else {
        await axiosInstance.post('/reproduction', payload);
        toast.success(t.repro_save_success);
      }
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      handleError(err, 'simpan data reproduksi');
    }
  };

  const handleOpenConfirm = (record) => {
    setConfirmingRecord(record);
    setShowConfirmModal(true);
  };

  const submitConfirmResult = async (status) => {
    if (!confirmingRecord) return;
    try {
      const payload = {
        rfid: confirmingRecord.rfid || confirmingRecord.cow_id,
        service_date: confirmingRecord.tanggal_ib || confirmingRecord.service_date,
        method: confirmingRecord.metode || confirmingRecord.method || 'ib',
        technician: confirmingRecord.pemberi_ib || confirmingRecord.petugas || confirmingRecord.technician || '',
        notes: confirmingRecord.catatan || confirmingRecord.keterangan || confirmingRecord.notes || '',
        is_pregnant: status === 'true' ? true : status === 'failed' ? false : null
      };

      await axiosInstance.put(`/reproduction/${confirmingRecord.id}`, payload);
      setShowConfirmModal(false);
      setConfirmingRecord(null);
      fetchData();
      toast.success(lang === 'id' ? "Hasil reproduksi berhasil dikonfirmasi." : "Reproduction result successfully confirmed.");
    } catch (err) {
      handleError(err, 'konfirmasi hasil reproduksi');
    }
  };

  // Group and sort records to show only the latest reproduction status per cow
  const latestRecordsPerCow = (() => {
    // Sort records by date descending so the latest comes first
    const sorted = [...records].sort((a, b) => {
      const dateA = new Date(a.tanggal_ib || a.service_date || 0).getTime();
      const dateB = new Date(b.tanggal_ib || b.service_date || 0).getTime();
      return dateB - dateA;
    });

    const seen = new Set();
    return sorted.filter(r => {
      const cowKey = r.rfid || r.cow_id;
      if (!cowKey) return true; // keep if no key
      if (seen.has(cowKey)) return false;
      seen.add(cowKey);
      return true;
    });
  })();

  const filteredRecords = latestRecordsPerCow.filter(r => {
    const cowName = r.cow_name || '';
    const rfid = r.rfid || r.cow_id || '';
    const term = search.toLowerCase();
    return cowName.toLowerCase().includes(term) || rfid.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)]">{t.nav_repro_records}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">{lang === 'id' ? 'Kelola sejarah inseminasi buatan, kawin alam, dan prediksi bunting sapi.' : 'Manage artificial insemination history, natural breeding, and pregnancy predictions.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
          >
            <RefreshCw className="w-4 h-4" />
            {t.btn_refresh}
          </button>
        </div>
      </div>

      {/* STATS SECTION */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
          <p className="text-2xl sm:text-3xl font-bold text-[var(--color-forest)]">{stats.conceptionRate}</p>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mt-1">{t.repro_conception_rate}</p>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
          <p className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">{stats.avgInterval}</p>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mt-1">{t.repro_avg_interval}</p>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
          <p className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">{stats.servicesPerConception}</p>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mt-1">{t.repro_service_conception}</p>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
          <p className="text-2xl sm:text-3xl font-bold text-[var(--color-warning)]">{stats.pregnantCount}</p>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mt-1">{t.repro_pregnant_cows}</p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
          </div>
          <input
            type="text"
            placeholder={t.repro_search_placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 38px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
          />
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-5 h-5" />
          {t.repro_add_record}
        </button>
      </div>

      {/* TABLE */}
      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[var(--color-forest)] animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)] italic">{lang === 'id' ? 'Mengambil data reproduksi...' : 'Fetching reproduction data...'}</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center">
            <div style={{ background: 'var(--bg-hover)' }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-semibold">{t.repro_empty_state}</p>
            <p className="text-xs text-slate-400 mt-1">{t.repro_empty_state_sub}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)]">
                <thead style={{ background: 'var(--bg-hover)' }}>
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{lang === 'id' ? 'Sapi / RFID' : 'Cow / RFID'}</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.repro_mating_date}</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.repro_method}</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.repro_result}</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.repro_est_calving}</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.repro_officer_bull}</th>
                    <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.livestock_table_action}</th>
                  </tr>
                </thead>
                <tbody style={{ background: 'var(--bg-surface)' }} className="divide-y divide-[var(--border)]">
                  {filteredRecords.map((row) => {
                    const isPregnant = row.results === true || row.results === 'true' || row.is_pregnant === true;
                    const isFailed = row.results === false || row.results === 'failed' || row.is_pregnant === false;
                    const isPending = row.results === null || row.results === undefined || row.results === 'null' || row.is_pregnant === null;
                    const rawDate = row.tanggal_ib || row.service_date;
                    const expectedCalving = rawDate && isPregnant
                      ? new Date(new Date(rawDate).getTime() + 283 * 24 * 60 * 60 * 1000).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—';
                    return (
                      <tr key={row.id} className="hover:bg-[var(--bg-hover)] transition-colors text-sm">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-[var(--bg-hover)] text-[var(--color-forest)] flex items-center justify-center font-bold text-xs shrink-0"><Beef size={14} /></div>
                            <div className="ml-2">
                              <div className="font-bold text-[var(--color-text-primary)] text-xs sm:text-sm">{row.cow_name || '—'}</div>
                              <div className="text-[10px] sm:text-xs text-[var(--color-text-muted)]">{row.rfid || row.cow_id || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs sm:text-sm text-[var(--color-text-secondary)]">
                          {rawDate ? new Date(rawDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs sm:text-sm text-[var(--color-text-secondary)]">
                          {(row.metode || row.method || 'ib').toUpperCase()} {row.jumlah_ib ? (lang === 'id' ? `(Ke-${row.jumlah_ib})` : `(#${row.jumlah_ib})`) : ''}
                        </td>
                        <td className="px-4 py-3">
                          {isPregnant && <span className="px-2 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">{t.livestock_repro_pregnant}</span>}
                          {isFailed && <span className="px-2 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)]">{t.livestock_repro_failed}</span>}
                          {isPending && <span className="px-2 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)]">{t.livestock_repro_pending}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs sm:text-sm font-bold text-[var(--color-forest)]">{expectedCalving}</td>
                        <td className="px-4 py-3 text-xs sm:text-sm text-[var(--color-text-secondary)]">{row.pemberi_ib || row.petugas || row.technician || '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <button onClick={() => handleOpenConfirm(row)} className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-[var(--color-forest)] hover:bg-[var(--color-forest-light)] text-white shadow-sm transition-all">{t.btn_confirm}</button>
                            )}
                            <button onClick={() => handleOpenEdit(row)} className="p-1 rounded-md text-slate-400 hover:text-[var(--color-forest)] hover:bg-slate-100 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(row.id)} className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="block md:hidden space-y-3 p-4">
              {filteredRecords.map((row) => {
                const isPregnant = row.results === true || row.results === 'true' || row.is_pregnant === true;
                const isFailed = row.results === false || row.results === 'failed' || row.is_pregnant === false;
                const isPending = row.results === null || row.results === undefined || row.results === 'null' || row.is_pregnant === null;
                const rawDate = row.tanggal_ib || row.service_date;
                const expectedCalving = rawDate && isPregnant
                  ? new Date(new Date(rawDate).getTime() + 283 * 24 * 60 * 60 * 1000).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—';
                return (
                  <div key={row.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{row.cow_name || '—'}</p>
                        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{row.rfid || row.cow_id || '—'}</p>
                      </div>
                      {isPregnant && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">{t.livestock_repro_pregnant}</span>}
                      {isFailed && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)]">{t.livestock_repro_failed}</span>}
                      {isPending && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)]">{t.livestock_repro_pending}</span>}
                    </div>
                    {/* Detail rows */}
                    <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                      <div className="flex justify-between">
                        <span>{t.repro_mating_date}</span>
                        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{rawDate ? new Date(rawDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t.repro_method}</span>
                        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{(row.metode || row.method || 'ib').toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t.repro_est_calving}</span>
                        <span style={{ color: 'var(--color-forest)', fontWeight: 700 }}>{expectedCalving}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t.livestock_repro_inseminator}</span>
                        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{row.pemberi_ib || row.petugas || row.technician || '—'}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '0.5px solid var(--border)' }}>
                      {isPending && (
                        <button onClick={() => handleOpenConfirm(row)} className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-[var(--color-forest)] text-white">{t.btn_confirm}</button>
                      )}
                      <button onClick={() => handleOpenEdit(row)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-2)', background: 'var(--bg-hover)' }}><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg" style={{ color: 'var(--red)', background: 'var(--bg-hover)' }}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="max-w-lg w-full relative z-10 overflow-hidden">
            <div style={{ borderBottom: '0.5px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] font-display">
                {editingRecord ? t.repro_edit_record : t.repro_add_record}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">{t.repro_select_cow}</label>
                <select
                  value={selectedCow}
                  onChange={(e) => setSelectedCow(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                >
                  <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-3)' }}>{lang === 'id' ? '— Pilih Sapi —' : '— Choose Cow —'}</option>
                  {cows.map(c => (
                    <option key={c.id} value={c.rfid || c.id} style={{ background: 'var(--bg-card)', color: 'var(--text-1)' }}>{c.nama || c.name} ({c.rfid || c.id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">{t.repro_mating_date} *</label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">{t.repro_method}</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                  >
                    <option value="ib" style={{ background: 'var(--bg-card)', color: 'var(--text-1)' }}>{lang === 'id' ? 'Inseminasi Buatan (IB)' : 'Artificial Insemination (AI)'}</option>
                    <option value="natural" style={{ background: 'var(--bg-card)', color: 'var(--text-1)' }}>{lang === 'id' ? 'Kawin Alam' : 'Natural Mating'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">{t.repro_officer_bull}</label>
                <input
                  type="text"
                  placeholder={lang === 'id' ? 'e.g. Dr. Andi atau Bull #12' : 'e.g. Dr. Andy or Bull #12'}
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">{t.repro_notes}</label>
                <textarea
                  rows="3"
                  placeholder={t.repro_notes_placeholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', fontSize: '14px', fontFamily: 'Inter, sans-serif', resize: 'none' }}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '10px 24px', border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flex: 1 }}
                >
                  {t.btn_cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
                >
                  {t.repro_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK CONFIRM RESULT MODAL */}
      {showConfirmModal && confirmingRecord && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 max-w-sm w-full relative z-10 text-center animate-in scale-in duration-200">
            <div style={{ background: 'var(--bg-hover)' }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--color-primary)] shadow-inner">
              <Stethoscope size={28} className="text-[var(--color-primary)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] font-display mb-1">
              {t.repro_confirm_title}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {t.repro_confirm_msg.replace('{name}', confirmingRecord.cow_name || confirmingRecord.rfid)}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => submitConfirmResult('failed')}
                className="py-3 px-4 bg-[var(--color-danger-bg)] hover:opacity-85 text-[var(--color-danger)] border border-[var(--color-danger-border)] rounded-xl font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-sm"
              >
                <XCircle className="w-6 h-6" />
                <span className="text-xs">{t.repro_confirm_failed}</span>
              </button>
              <button
                onClick={() => submitConfirmResult('true')}
                className="py-3 px-4 bg-[var(--color-success-bg)] hover:opacity-85 text-[var(--color-success)] border border-[var(--color-success-border)] rounded-xl font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-sm"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span className="text-xs">{t.repro_confirm_success}</span>
              </button>
            </div>
            <button
              onClick={() => setShowConfirmModal(false)}
              className="mt-4 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] w-full py-2 transition-colors"
            >
              {t.btn_cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
