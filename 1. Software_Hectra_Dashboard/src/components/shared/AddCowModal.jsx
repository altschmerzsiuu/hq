import React, { useState } from 'react';
import { X, Activity, ScanLine, ChevronDown } from 'lucide-react';
import { useTernakStore } from '@/store/useTernakStore';
import { toast } from '@/store/toastStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import ScanModal from '@/components/scan/ScanModal';

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

export default function AddCowModal({ isOpen, onClose }) {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const { tambahSapi, loading } = useTernakStore();
  
  const [scanOpen, setScanOpen] = useState(false);
  const [tambahForm, setTambahForm] = useState({
    nama: '', rfid: '', jenis: 'Simmental', lahir: '', kesehatan: 'Sehat'
  });

  if (!isOpen) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    const res = await tambahSapi(tambahForm);
    if (res.success) {
      setTambahForm({ nama: '', rfid: '', jenis: 'Simmental', lahir: '', kesehatan: 'Sehat' });
      onClose();
      toast.success(t.livestock_toast_add_success);
    } else {
      toast.error(res.message || t.livestock_toast_add_failed);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[1100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 w-full max-w-lg animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">{t.livestock_add_title}</h2>
            <button onClick={onClose} className="p-2 bg-[var(--bg-surface)] rounded-full hover:bg-[var(--border)]">
              <X size={20} />
            </button>
          </div>
          
          <form className="space-y-5 flex flex-col" onSubmit={onSubmit}>
            {/* 1. Nama Sapi */}
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_name}</label>
              <input type="text" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full h-[52px] px-4 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" placeholder={t.livestock_add_name_placeholder} value={tambahForm.nama} onChange={e => setTambahForm({...tambahForm, nama: e.target.value})} required />
            </div>

            {/* 2. Tanggal Lahir */}
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_birthdate}</label>
              <input type="date" style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full h-[52px] px-4 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none" value={tambahForm.lahir} onChange={e => setTambahForm({...tambahForm, lahir: e.target.value})} required />
              {tambahForm.lahir && (
                <p className="text-xs text-[var(--color-primary)] mt-2 font-medium flex items-center gap-1">
                  <Activity size={12}/> {t.livestock_add_current_age} {hitungUsia(tambahForm.lahir, lang)}
                </p>
              )}
            </div>

            {/* 3. Jenis Sapi */}
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_breed}</label>
              <div className="relative">
                <select style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full h-[52px] pl-4 pr-10 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none appearance-none cursor-pointer" value={tambahForm.jenis} onChange={e => setTambahForm({...tambahForm, jenis: e.target.value})}>
                  <option value="Simmental">{t.breed_simmental}</option>
                  <option value="Brahman">{t.breed_brahman}</option>
                  <option value="Limosin">{t.breed_limousin}</option>
                  <option value="Bali">{t.breed_bali}</option>
                  <option value="Angus">{t.breed_angus}</option>
                  <option value="Friesian Holstein">{t.breed_friesholstein}</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={18} />
              </div>
            </div>

            {/* 4. Status Kesehatan */}
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{t.livestock_add_health}</label>
              <div className="relative">
                <select style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '0.5px solid var(--border)' }} className="w-full h-[52px] pl-4 pr-10 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none appearance-none cursor-pointer" value={tambahForm.kesehatan} onChange={e => setTambahForm({...tambahForm, kesehatan: e.target.value})}>
                  <option value="Sehat">{t.livestock_filter_sehat}</option>
                  <option value="Sakit">{t.livestock_filter_sakit}</option>
                  <option value="Butuh Perawatan">{t.livestock_filter_care}</option>
                  <option value="Hamil">{t.livestock_filter_hamil}</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={18} />
              </div>
            </div>

            {/* 5. Scan RFID (CTA Block) */}
            <div className="pt-2">
              <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-1.5">RFID UID</label>
              {tambahForm.rfid ? (
                <div className="relative flex items-center w-full h-[52px] bg-[var(--bg-card)] border-[0.5px] border-[var(--border)] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[var(--accent)]">
                  <div className="flex-1 px-4 text-[var(--text-1)] font-medium truncate">
                    {tambahForm.rfid}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setScanOpen(true)} 
                    className="h-full px-4 flex items-center justify-center bg-[var(--bg-surface)] border-l border-[var(--border)] hover:bg-[var(--border)] transition-colors text-[var(--color-primary)] font-bold text-sm gap-2"
                  >
                    <ScanLine size={16} />
                    <span>Ulangi</span>
                  </button>
                </div>
              ) : (
                <button 
                  type="button" 
                  onClick={() => setScanOpen(true)} 
                  className="w-full flex items-center justify-center gap-2 h-[60px] text-white font-bold rounded-xl transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, #10b981 100%)',
                    boxShadow: '0 8px 20px -6px rgba(16, 185, 129, 0.5)',
                  }}
                >
                  <ScanLine size={24} className="animate-pulse" />
                  <span style={{ letterSpacing: '0.03em', fontSize: '15px' }}>{t.qa_scan_rfid || 'Scan RFID Kalung'}</span>
                </button>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 mt-4 border-t border-[var(--color-border)] flex gap-3 w-full">
              <button type="button" onClick={onClose} style={{ border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '12px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }} className="w-1/2 py-3 text-center">
                {t.btn_cancel}
              </button>
              <button type="submit" className="w-1/2 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-md text-center" disabled={loading}>
                {loading ? t.btn_saving : t.btn_save}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ScanModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={(data) => {
          const scannedRfid = data.id || data.rfid || '';
          setTambahForm(f => ({ ...f, rfid: scannedRfid }));
          setScanOpen(false);
          toast.success((lang === 'id' ? 'RFID ditemukan: ' : 'RFID found: ') + scannedRfid);
        }}
      />
    </>
  );
}
