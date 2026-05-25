import { useState, useEffect } from 'react';
import { 
  Cpu, 
  Plus, 
  Trash2, 
  Loader2, 
  RefreshCw, 
  Battery, 
  Unlink, 
  Check, 
  AlertTriangle,
  Lock,
  Beef
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

export default function IotManager() {
  const { lang } = useSettingsStore();
  const t = translations[lang];
  const { user } = useAuthStore();
  const [devices, setDevices] = useState([]);
  const [cows, setCows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pairing Form State
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedCow, setSelectedCow] = useState('');
  const [pairing, setPairing] = useState(false);

  // Unpair Confirmation State
  const [showUnpairModal, setShowUnpairModal] = useState(false);
  const [pendingUnpair, setPendingUnpair] = useState(null);
  const [unpairing, setUnpairing] = useState(false);

  const isWorker = user?.role === 'worker';

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get all IoT devices
      const deviceRes = await axiosInstance.get('/iot/devices');
      setDevices(deviceRes.data || []);

      // Get cattle list
      const cattleRes = await axiosInstance.get('/hewan');
      setCows(cattleRes.data || []);
    } catch (err) {
      console.error("Gagal mengambil data IoT:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePairSubmit = async (e) => {
    e.preventDefault();
    if (isWorker) return;
    if (!selectedDevice || !selectedCow) {
      toast.error(lang === 'id' ? "Harap pilih kalung dan sapi terlebih dahulu!" : "Please select both a collar and a cow first!");
      return;
    }

    setPairing(true);
    try {
      await axiosInstance.post('/iot/pair', {
        device_id: selectedDevice,
        cattle_id: selectedCow
      });
      
      setSelectedDevice('');
      setSelectedCow('');
      fetchData();
      toast.success(lang === 'id' ? "Kalung sensor berhasil dipasangkan!" : "Collar sensor successfully paired!");
    } catch (err) {
      toast.error((lang === 'id' ? "Gagal memasangkan kalung: " : "Failed to pair collar: ") + (err.response?.data?.detail || err.message));
    } finally {
      setPairing(false);
    }
  };

  const handleOpenUnpair = (device) => {
    if (isWorker) return;
    setPendingUnpair(device);
    setShowUnpairModal(true);
  };

  const handleConfirmUnpair = async () => {
    if (!pendingUnpair || isWorker) return;
    setUnpairing(true);
    try {
      await axiosInstance.post('/iot/unpair', {
        device_id: pendingUnpair.device_id
      });
      setShowUnpairModal(false);
      setPendingUnpair(null);
      fetchData();
      toast.success(lang === 'id' ? `Kalung ${pendingUnpair.device_id} berhasil dilepaskan.` : `Collar ${pendingUnpair.device_id} successfully released.`);
    } catch (err) {
      toast.error((lang === 'id' ? "Gagal melepas kalung: " : "Failed to unpair collar: ") + (err.response?.data?.detail || err.message));
    } finally {
      setUnpairing(false);
    }
  };

  // Get unassigned devices (devices where cattle_id is null/empty)
  const unassignedDevices = devices.filter(d => !d.cattle_id);
  // Get active paired devices (devices where cattle_id exists)
  const activeDevices = devices.filter(d => d.cattle_id);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)]">{t.iot_title}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">{t.iot_sub}</p>
        </div>
        <button 
          onClick={fetchData} 
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[var(--color-cream-dark)] border border-[var(--color-sage-light)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-forest)] transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          {t.btn_refresh}
        </button>
      </div>

      {/* PAIRING FORM CARD */}
      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-card)', padding: '24px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div style={{ background: 'var(--accent)', color: '#fff' }} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <Cpu className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] font-display">{t.iot_pair_card_title}</h2>
        </div>

        <form onSubmit={handlePairSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Devices dropdown */}
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t.iot_select_device}</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                disabled={isWorker}
                style={{ width: '100%', padding: '12px 16px', border: '0.5px solid var(--border)', borderRadius: '12px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
              >
                <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-3)' }}>{t.iot_select_device_placeholder}</option>
                {unassignedDevices.map(d => (
                  <option key={d.device_id} value={d.device_id} style={{ background: 'var(--bg-card)', color: 'var(--text-1)' }}>{d.device_id}</option>
                ))}
                {unassignedDevices.length === 0 && (
                  <option key="no-collars" disabled style={{ background: 'var(--bg-card)', color: 'var(--text-3)' }}>{t.iot_all_paired}</option>
                )}
              </select>
            </div>

            {/* Cattle dropdown */}
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t.iot_select_cow}</label>
              <select
                value={selectedCow}
                onChange={(e) => setSelectedCow(e.target.value)}
                disabled={isWorker}
                style={{ width: '100%', padding: '12px 16px', border: '0.5px solid var(--border)', borderRadius: '12px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
              >
                <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-3)' }}>{t.iot_select_cow_placeholder}</option>
                {cows.map(c => (
                  <option key={c.id} value={c.id} style={{ background: 'var(--bg-card)', color: 'var(--text-1)' }}>{c.nama || c.name} ({c.rfid || c.id})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit pairing */}
          {isWorker ? (
            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold text-sm">
              <Lock className="w-5 h-5 shrink-0" />
              <span>{t.iot_worker_denied}</span>
            </div>
          ) : (
            <button
              type="submit"
              disabled={pairing}
              className="px-6 py-3 bg-[var(--color-forest)] hover:bg-[var(--color-forest-light)] disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              {pairing && <Loader2 className="w-5 h-5 animate-spin" />}
              <span>{t.iot_pair_btn}</span>
            </button>
          )}
        </form>
      </div>

      {/* PAIRED DEVICES TABLE */}
      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] font-display">{t.iot_list_card_title}</h2>
            <span className="px-3 py-0.5 bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)] text-xs font-bold rounded-full">
              {activeDevices.length} {lang === 'id' ? 'Aktif' : 'Active'}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[var(--color-forest)] animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)] italic">{lang === 'id' ? 'Memuat data perangkat...' : 'Loading device data...'}</p>
          </div>
        ) : activeDevices.length === 0 ? (
          <div className="py-16 text-center">
            <div style={{ background: 'var(--bg-hover)' }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Cpu className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-semibold">{t.iot_empty_state}</p>
            <p className="text-xs text-slate-400 mt-1">{t.iot_empty_state_sub}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead style={{ background: 'var(--bg-hover)' }}>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.iot_table_collar}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.iot_table_paired_cow}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.iot_table_battery}</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t.iot_table_action}</th>
                </tr>
              </thead>
              <tbody style={{ background: 'var(--bg-surface)' }} className="divide-y divide-[var(--border)]">
                {activeDevices.map((d) => {
                  const pct = d.battery_pct ?? d.battery ?? 0;
                  let batteryColor = 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]';
                  let batteryText = `${pct}% — ${t.iot_battery_good}`;
                  let BatteryIcon = Battery;
                  
                  if (pct < 25) {
                    batteryColor = 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]';
                    batteryText = `${pct}% — ${t.iot_battery_critical}`;
                    BatteryIcon = AlertTriangle;
                  } else if (pct < 60) {
                    batteryColor = 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]';
                    batteryText = `${pct}% — ${t.iot_battery_recharge}`;
                    BatteryIcon = Battery;
                  }

                  return (
                    <tr key={d.device_id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono font-semibold text-[var(--color-text-primary)] text-sm">{d.device_id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Beef size={16} className="mr-2 text-[var(--color-text-secondary)]" />
                          <span className="font-bold text-[var(--color-text-primary)] text-sm">{d.cattle_name || d.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${batteryColor}`}>
                          <BatteryIcon className="w-3.5 h-3.5" />
                          {batteryText}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {isWorker ? (
                          <span className="text-xs text-[var(--color-text-muted)] italic">{t.iot_worker_locked}</span>
                        ) : (
                          <button
                            onClick={() => handleOpenUnpair(d)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--red)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                          >
                            <Unlink className="w-3.5 h-3.5" />
                            {lang === 'id' ? 'Lepaskan' : 'Unpair'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* UNPAIR CONFIRMATION MODAL */}
      {showUnpairModal && pendingUnpair && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUnpairModal(false)}></div>
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-modal)' }} className="p-6 max-w-sm w-full relative z-10 text-center animate-in scale-in duration-200">
            <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }} className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 border border-[var(--color-danger-border)]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] font-display mb-2">{t.iot_unpair_modal_title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {lang === 'id' ? (
                <>
                  Kalung <strong className="text-[var(--color-forest)] font-mono">{pendingUnpair.device_id}</strong> akan dilepas dari sapi <strong className="text-[var(--color-text-primary)]">{pendingUnpair.cattle_name || pendingUnpair.name || '—'}</strong>. Aksi ini tidak dapat dibatalkan.
                </>
              ) : (
                <>
                  Collar <strong className="text-[var(--color-forest)] font-mono">{pendingUnpair.device_id}</strong> will be unpaired from cattle <strong className="text-[var(--color-text-primary)]">{pendingUnpair.cattle_name || pendingUnpair.name || '—'}</strong>. This action cannot be undone.
                </>
              )}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUnpairModal(false)}
                style={{ padding: '10px 24px', border: '0.5px solid var(--border)', color: 'var(--text-2)', fontWeight: 600, borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flex: 1 }}
              >
                {t.btn_cancel}
              </button>
              <button
                onClick={handleConfirmUnpair}
                disabled={unpairing}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1"
              >
                {unpairing && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{t.iot_unpair_confirm}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
