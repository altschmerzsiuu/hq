import { useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { toast } from '@/store/toastStore';
import { useTernakStore } from '@/store/useTernakStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

export default function ReproModal({ isOpen, onClose, isWidgetMode = false, onBack }) {
  useBodyScrollLock(isOpen);
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const { sapiList, tambahReproduksi, loading: reproLoading } = useTernakStore();
  const [reproForm, setReproForm] = useState({
    rfid: '',
    tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
    bunting: '', hpl: '', catatan: ''
  });

  if (!isOpen) return null;

  const handleTanggalIBChange = (e) => {
    const val = e.target.value;
    if (val) {
      const date = new Date(val);
      let b = '', h = '';
      if (!isNaN(date.getTime())) {
        const bDate = new Date(val);
        bDate.setMonth(bDate.getMonth() + 3);
        b = bDate.toISOString().split('T')[0];

        const hDate = new Date(val);
        hDate.setMonth(hDate.getMonth() + 9);
        hDate.setDate(hDate.getDate() + 10);
        h = hDate.toISOString().split('T')[0];
      }
      setReproForm({ ...reproForm, tanggal_ib: val, bunting: b, hpl: h });
    } else {
      setReproForm({ ...reproForm, tanggal_ib: val, bunting: '', hpl: '' });
    }
  };

  const onTambahReproduksi = async (e) => {
    e.preventDefault();
    if (!reproForm.rfid) {
      toast.error(lang === 'id' ? 'Silakan pilih sapi terlebih dahulu.' : 'Please select a cow first.');
      return;
    }

    let formattedInseminator = reproForm.pemberi_ib
      ? reproForm.pemberi_ib
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      : '';

    const res = await tambahReproduksi({ ...reproForm, pemberi_ib: formattedInseminator });
    if (res.success) {
      setReproForm({
        rfid: '',
        tanggal_ib: '', pemberi_ib: '', jumlah_ib: 1,
        bunting: '', hpl: '', catatan: ''
      });
      onClose();
      toast.success(lang === 'id' ? 'Data reproduksi berhasil ditambahkan' : 'Reproduction data added successfully');
    } else {
      toast.error(res.message || (lang === 'id' ? 'Gagal menyimpan data IB.' : 'Failed to save IB record.'));
    }
  };

  const overlayClass = isWidgetMode 
    ? "fixed inset-0 z-[200] pointer-events-none" 
    : "fixed inset-0 z-[1100] flex justify-center items-center md:justify-end md:items-end bg-black/60 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none p-4 md:p-4 md:pt-[100px] animate-in fade-in pointer-events-none";

  const contentClass = isWidgetMode
    ? "fixed bottom-[190px] md:bottom-[84px] right-4 md:right-6 w-[360px] h-[540px] max-w-[calc(100vw-32px)] z-[200] animate-in slide-in-from-bottom-8 fade-in duration-300 flex flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-[24px] shadow-[var(--shadow-modal)] pointer-events-auto overflow-y-auto no-scrollbar"
    : "relative z-10 p-6 w-full max-w-lg md:max-w-[400px] rounded-[24px] md:h-full overflow-y-auto animate-in zoom-in-95 md:zoom-in-100 md:slide-in-from-right-1/2 duration-300 pointer-events-auto max-h-[90vh] md:max-h-full overflow-x-hidden no-scrollbar bg-[var(--bg-surface)] border-[0.5px] border-[var(--border)] shadow-[var(--shadow-modal)]";

  return (
    <div className={overlayClass}>
      <div className="absolute inset-0 z-0 pointer-events-auto md:pointer-events-auto" onClick={onClose} />
      <div className={contentClass} style={isWidgetMode ? {} : { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }}>
        <div className={isWidgetMode ? "p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-surface)] z-10 flex justify-between items-center" : "flex justify-between items-center mb-6"}>
          <h2 className={isWidgetMode ? "text-lg font-heading font-bold text-[var(--color-primary)]" : "text-xl font-heading font-bold text-[var(--color-primary)]"}>
            {t.repro_record_new}
          </h2>
          {onBack ? (
            <button onClick={onBack} className="p-2 bg-[var(--bg-surface)] rounded-full hover:bg-[var(--border)] shrink-0 transition-colors" title="Kembali ke Menu">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <button onClick={onClose} className="p-2 bg-[var(--bg-surface)] rounded-full hover:bg-[var(--border)] shrink-0 transition-colors" title="Tutup">
              <X size={20} />
            </button>
          )}
        </div>

        <form className={isWidgetMode ? "p-5 space-y-4" : "space-y-4"} onSubmit={onTambahReproduksi}>
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
              {t.repro_select_cow} <span className="text-red-500">*</span>
            </label>
            <select
              style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }}
              className="w-full px-3 h-[42px] rounded-xl text-sm outline-none focus:border-[var(--color-primary)]"
              required
              value={reproForm.rfid}
              onChange={e => {
                setReproForm({ ...reproForm, rfid: e.target.value });
                if (e.target.value) {
                  const cowHistory = sapiList.find(c => c.id === e.target.value)?.reproduksi || [];
                  const countIB = cowHistory.filter(h => !h.metode || h.metode?.toLowerCase() === 'ib' || h.method?.toLowerCase() === 'ib').length + 1;
                  setReproForm(prev => ({ ...prev, rfid: e.target.value, jumlah_ib: countIB }));
                }
              }}
            >
              <option value="">-- {t.repro_choose_cow} --</option>
              {sapiList.map(s => (
                <option key={s.id} value={s.id}>{s.nama} ({s.id})</option>
              ))}
            </select>
          </div>

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
                onChange={handleTanggalIBChange}
              />
            </div>
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
              onChange={e => setReproForm({ ...reproForm, pemberi_ib: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">{t.repro_notes}</label>
            <textarea rows="2" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)', boxSizing: 'border-box' }} className="w-full min-w-0 px-4 py-3 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] resize-none" placeholder={t.repro_notes_placeholder} value={reproForm.catatan} onChange={e => setReproForm({ ...reproForm, catatan: e.target.value })} />
          </div>


          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} style={{ border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }} className="w-1/2 py-3 text-center">{t.btn_cancel}</button>
            <button type="submit" className="w-1/2 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-lg text-center" disabled={reproLoading}>
              {reproLoading ? t.repro_saving : t.repro_save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
