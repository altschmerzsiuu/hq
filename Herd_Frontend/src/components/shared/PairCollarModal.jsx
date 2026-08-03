// src/components/shared/PairCollarModal.jsx
// Shared Pair Collar Modal — dipakai di ManajemenTernak & Dashboard Quick Action

import { useEffect } from 'react';
import { X, Beef, Activity, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { useTernakStore } from '@/store/useTernakStore';
import { toast } from '@/store/toastStore';

export default function PairCollarModal({
  isOpen,
  onClose,
  pairSelectedSapi,
  setPairSelectedSapi,
  pairSelectedCollar,
  setPairSelectedCollar,
  isWidgetMode = false,
  onBack,
}) {
  const {
    sapiList,
    unpairedCollars,
    fetchSapiList,
    fetchUnpairedCollars,
    pairCollar,
    loading,
  } = useTernakStore();

  useBodyScrollLock(isOpen);

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

  const overlayClass = isWidgetMode 
    ? "fixed inset-0 z-[200] pointer-events-none" 
    : "fixed inset-0 z-[1100] flex justify-center items-center md:justify-end md:items-start bg-black/60 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none p-4 md:pr-8 md:pt-[130px] animate-in fade-in pointer-events-none";

  const contentClass = isWidgetMode
    ? "fixed bottom-[190px] md:bottom-[84px] right-4 md:right-6 w-[420px] h-[540px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] z-[200] animate-in slide-in-from-bottom-8 fade-in duration-300 flex flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-[24px] shadow-[var(--shadow-modal)] pointer-events-auto overflow-hidden"
    : "relative z-10 p-6 w-full max-w-2xl rounded-[24px] md:h-full max-h-[90vh] md:max-h-full animate-in zoom-in-95 md:zoom-in-100 md:slide-in-from-right-1/2 duration-300 pointer-events-auto bg-[var(--bg-surface)] border-[0.5px] border-[var(--border)] shadow-[var(--shadow-modal)] flex flex-col overflow-hidden";

  return (
    <>
      <div className={overlayClass}>
        <div className="absolute inset-0 z-0 pointer-events-auto md:pointer-events-auto" onClick={onClose} />
        <div className={contentClass}>
        {/* Header */}
        <div
          className={
            isWidgetMode
              ? 'p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-surface)] z-10 flex justify-between items-start shrink-0'
              : 'flex justify-between items-start mb-6 shrink-0'
          }
        >
          <div>
            <h2 className="text-xl font-heading font-bold text-[var(--color-primary)]">
              Pairing Collar IoT
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Pasangkan collar ke sapi yang belum memiliki sensor.
            </p>
          </div>
          {onBack ? (
            <button
              onClick={onBack}
              className="p-2 bg-[var(--bg-surface)] rounded-full hover:bg-[var(--bg-hover)] shrink-0 transition-colors self-start"
              title="Kembali ke Menu"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="p-2 bg-[var(--color-bg-surface)] rounded-full hover:bg-[var(--color-border)] ml-4 shrink-0 self-start transition-colors"
              title="Tutup"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className={isWidgetMode ? "p-5 flex-1 flex flex-col min-h-0" : "flex-1 flex flex-col min-h-0"}>

        {/* Two-column picker */}
        <div className={isWidgetMode ? "grid grid-cols-2 gap-4 flex-1 min-h-0" : "grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0"}>
          {/* Left: Sapi tanpa collar */}
          <div
            className="rounded-2xl p-5 border border-[var(--color-border)] flex flex-col min-h-0"
            style={{ background: 'var(--bg-card)' }}
          >
            <h3 className="font-bold text-[var(--color-primary)] mb-4 flex items-center gap-2 shrink-0">
              <Beef size={18} /> Sapi Tanpa Collar
            </h3>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
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
            className="rounded-2xl p-5 border border-[var(--color-border)] flex flex-col min-h-0"
            style={{ background: 'var(--bg-card)' }}
          >
            <h3 className="font-bold text-[var(--color-primary)] mb-4 flex items-center gap-2 shrink-0">
              <Activity size={18} /> Collar Tersedia
            </h3>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
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
        <div className="mt-6 flex gap-3 shrink-0">
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
      </div>
    </>
  );
}
