// src/components/shared/PairCollarModal.jsx
// Shared Pair Collar Modal — dipakai di ManajemenTernak & Dashboard Quick Action

import { useEffect } from 'react';
import { X, Beef, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTernakStore } from '@/store/useTernakStore';
import { toast } from '@/store/toastStore';

export default function PairCollarModal({
  isOpen,
  onClose,
  pairSelectedSapi,
  setPairSelectedSapi,
  pairSelectedCollar,
  setPairSelectedCollar,
}) {
  const {
    sapiList,
    unpairedCollars,
    fetchSapiList,
    fetchUnpairedCollars,
    pairCollar,
    loading,
  } = useTernakStore();

  // Ensure fresh data every time modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSapiList();
      fetchUnpairedCollars();
    }
  }, [isOpen, fetchSapiList, fetchUnpairedCollars]);

  if (!isOpen) return null;

  const handlePair = async () => {
    if (!pairSelectedSapi || !pairSelectedCollar) return;
    const res = await pairCollar(pairSelectedSapi, pairSelectedCollar);
    if (res.success) {
      setPairSelectedSapi(null);
      setPairSelectedCollar(null);
      toast.success('Kalung sensor berhasil dipasangkan!');
      onClose();
    } else {
      toast.error(res.message || 'Gagal pairing collar.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-modal)',
        }}
        className="p-6 w-full max-w-4xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">
              Pairing Collar IoT
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Pasangkan collar ke sapi yang belum memiliki sensor.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Two-column picker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Sapi tanpa collar */}
          <div
            className="rounded-2xl p-5 border border-[var(--color-border)]"
            style={{ background: 'var(--bg-card)' }}
          >
            <h3 className="font-bold text-[var(--color-primary)] mb-4 flex items-center gap-2">
              <Beef size={18} /> Sapi Tanpa Collar
            </h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {sapiList.filter((s) => !s.collar_id).map((sapi) => (
                <button
                  key={sapi.id}
                  type="button"
                  onClick={() =>
                    setPairSelectedSapi(
                      pairSelectedSapi === sapi.id ? null : sapi.id
                    )
                  }
                  className={cn(
                    'w-full p-3 border-2 rounded-xl flex justify-between items-center cursor-pointer transition-all text-left',
                    pairSelectedSapi === sapi.id
                      ? 'border-[var(--accent)] ring-2 ring-[var(--accent-dim)]'
                      : 'border-[var(--border)] hover:border-[var(--accent-border)]'
                  )}
                  style={{ background: 'var(--bg-surface)' }}
                >
                  <div>
                    <p className="font-bold text-[var(--color-primary)]">{sapi.nama}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{sapi.id}</p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 shrink-0',
                      pairSelectedSapi === sapi.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]'
                        : 'border-[var(--border)]'
                    )}
                  />
                </button>
              ))}
              {sapiList.filter((s) => !s.collar_id).length === 0 && (
                <p
                  style={{
                    textAlign: 'center',
                    padding: '32px 0',
                    color: 'var(--text-3)',
                    fontSize: '12px',
                  }}
                >
                  Semua sapi sudah terpasang collar.
                </p>
              )}
            </div>
          </div>

          {/* Right: Collar tersedia */}
          <div
            className="rounded-2xl p-5 border border-[var(--color-border)]"
            style={{ background: 'var(--bg-card)' }}
          >
            <h3 className="font-bold text-[var(--color-primary)] mb-4 flex items-center gap-2">
              <Activity size={18} /> Collar Tersedia
            </h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {unpairedCollars.map((cid) => (
                <button
                  key={cid}
                  type="button"
                  onClick={() =>
                    setPairSelectedCollar(
                      pairSelectedCollar === cid ? null : cid
                    )
                  }
                  className={cn(
                    'w-full p-3 border-2 rounded-xl flex justify-between items-center cursor-pointer transition-all text-left',
                    pairSelectedCollar === cid
                      ? 'border-[var(--accent)] ring-2 ring-[var(--accent-dim)]'
                      : 'border-[var(--border)] hover:border-[var(--accent-border)]'
                  )}
                  style={{ background: 'var(--bg-surface)' }}
                >
                  <div>
                    <p className="font-bold text-[var(--color-text-primary)]">
                      ID: {cid}
                    </p>
                    <p className="text-[10px] text-[var(--color-success)] font-medium">
                      ● Online / Ready
                    </p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 shrink-0',
                      pairSelectedCollar === cid
                        ? 'border-[var(--accent)] bg-[var(--accent)]'
                        : 'border-[var(--border)]'
                    )}
                  />
                </button>
              ))}
              {unpairedCollars.length === 0 && (
                <p
                  style={{
                    textAlign: 'center',
                    padding: '32px 0',
                    color: 'var(--text-3)',
                    fontSize: '12px',
                  }}
                >
                  Tidak ada collar tersedia.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 24px',
              border: '0.5px solid var(--border)',
              color: 'var(--text-2)',
              fontWeight: 600,
              borderRadius: '10px',
              background: 'var(--bg-card)',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              flex: 1
            }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handlePair}
            disabled={!pairSelectedSapi || !pairSelectedCollar || loading}
            style={{
              padding: '12px 24px',
              border: 'none',
              color: '#fff',
              fontWeight: 600,
              borderRadius: '12px',
              background:
                !pairSelectedSapi || !pairSelectedCollar || loading
                  ? 'var(--border)'
                  : 'var(--color-primary)',
              cursor:
                !pairSelectedSapi || !pairSelectedCollar || loading
                  ? 'not-allowed'
                  : 'pointer',
              flex: 1,
              opacity: loading ? 0.7 : 1,
            }}
            className="shadow-lg hover:brightness-110 transition-all"
          >
            {loading ? 'Menyimpan...' : 'Pasang'}
          </button>
        </div>
      </div>
    </div>
  );
}
