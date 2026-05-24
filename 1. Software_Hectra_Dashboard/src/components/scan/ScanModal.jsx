import { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2, AlertCircle, PlusCircle, Wifi, WifiOff, Smartphone, CheckCircle2, HeartPulse, FileText, Calendar, Syringe, Baby, Heart, Activity } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Format tanggal ke bahasa Indonesia
 */
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Bangun URL WebSocket secara dinamis.
 * Prioritas: VITE_WS_URL → relatif dari window.location → fallback localhost
 */
function buildWsUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return `${import.meta.env.VITE_WS_URL}/api/ws`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host     = window.location.host;
  return `${protocol}//${host}/api/ws`;
}

/**
 * Normalisasi response BE — baik dari WebSocket maupun dari REST
 * supaya selalu jadi bentuk { hewan, reproduksi }.
 */
function normalizeResponse(data) {
  // Nested: { hewan: {...}, reproduksi_terbaru: {...} } atau { hewan, reproduksi }
  if (data?.hewan) {
    return {
      hewan:      data.hewan,
      reproduksi: data.reproduksi_terbaru ?? data.reproduksi ?? null,
    };
  }
  // Flat: objek hewan langsung di root (fallback)
  if (data?.id || data?.rfid) {
    return { hewan: data, reproduksi: null };
  }
  return null;
}

// ─────────────────────────────────────────────
// Komponen Utama
// ─────────────────────────────────────────────

export default function ScanModal({ isOpen, onClose, onResult }) {
  const [rfid,         setRfid]         = useState('');
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState(null);   // { hewan, reproduksi }
  const [notFound,     setNotFound]     = useState(false);  // RFID tidak terdaftar
  const [wsStatus,     setWsStatus]     = useState('disconnected'); // 'connected' | 'disconnected'
  const [nfcScanning,  setNfcScanning]  = useState(false);  // State untuk scanning NFC HP
  const [activeTab,    setActiveTab]    = useState('scan'); // 'scan' | 'manual'

  const wsRef    = useRef(null);
  const inputRef = useRef(null);

  // ── WebSocket lifecycle ──────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Reset state setiap kali modal dibuka
    setRfid('');
    setResult(null);
    setNotFound(false);
    setActiveTab('scan');

    const url = buildWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type !== 'rfid_scan') return;

        // DO NOT auto-fill search bar; just update result state directly
        if (data.found) {
          const normalized = normalizeResponse(data);
          if (!normalized) return;

          setResult(normalized);
          setNotFound(false);
          
        } else {
          // RFID ada tapi belum terdaftar di DB
          setRfid(data.uid ?? ''); // store uid for registration card
          setResult(null);
          setNotFound(true);
          setActiveTab('manual');
        }
      } catch (err) {
        // silently ignore parse errors
      }
    };

    ws.onerror = (err) => {
      setWsStatus('disconnected');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isOpen]);

  // Auto-focus input saat pindah tab ke manual
  useEffect(() => {
    if (isOpen && activeTab === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTab]);

  // ── Manual search (input + tombol Cari) ─────
  const handleScan = async (forcedUid) => {
    const trimmed = typeof forcedUid === 'string' ? forcedUid.trim() : rfid.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);
    setNotFound(false);

    try {
      // 1. Coba cari menggunakan /scanner/search untuk mendukung pencarian berdasarkan Nama & ID
      const searchRes = await axiosInstance.get('/scanner/search', { params: { q: trimmed } });
      const searchData = searchRes.data?.data || [];
      
      let targetRfid = trimmed;
      if (searchData.length > 0) {
        // Ambil sapi pertama yang paling cocok
        targetRfid = searchData[0].id;
      }

      // 2. Ambil profil lengkap beserta data reproduksi terbarunya
      const res        = await axiosInstance.get(`/scanner/profil/${targetRfid}`);
      const normalized = normalizeResponse(res.data);

      if (normalized?.hewan) {
        setResult(normalized);
      } else {
        setNotFound(true);
        setActiveTab('manual');
      }
    } catch (err) {
      // 404 dari BE → hewan belum terdaftar
      if (err.response?.status === 404) {
        setNotFound(true);
        setActiveTab('manual');
      } else {
        toast.error('Terjadi kesalahan. Coba lagi.');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Scan NFC menggunakan fitur sensor HP (Web NFC API) ──
  const handleNfcScan = async () => {
    if (!('NDEFReader' in window)) {
      toast.error("Web NFC tidak didukung browser ini (butuh HTTPS & Chrome Android)");
      return;
    }

    try {
      setNfcScanning(true);
      const ndef = new NDEFReader();
      await ndef.scan();

      ndef.onreadingerror = () => {
        // silently ignore continuous read errors to prevent spam
      };

      ndef.onreading = (event) => {
        const rawUid = event.serialNumber;
        if (rawUid) {
          const cleanedUid = rawUid.replace(/:/g, '').toUpperCase();
          setRfid(cleanedUid);
          setNfcScanning(false);
          // Cari profil sapi secara otomatis
          handleScan(cleanedUid);
        }
      };
    } catch (error) {
      console.error("Web NFC Error:", error);
      toast.error("Akses NFC ditolak atau dibatalkan.");
      setNfcScanning(false);
    }
  };

  const handleClose = () => {
    setRfid('');
    setResult(null);
    setNotFound(false);
    setNfcScanning(false);
    setActiveTab('scan');
    onClose();
  };

  const handleDaftarBaru = () => {
    // Tutup modal scan, terusin RFID ke parent supaya parent bisa
    // buka form tambah hewan dengan kolom RFID sudah terisi
    onResult?.({ uid: rfid.trim(), needsRegistration: true });
    handleClose();
  };

  const handleLanjutDetail = () => {
    // Mengarahkan parent dengan detail hewan (seperti sebelumnya)
    if (result) {
      onResult?.({
        hewan:             result.hewan,
        reproduksi_terbaru: result.reproduksi,
      });
      handleClose();
    }
  };

  if (!isOpen) return null;

  // ── Render ───────────────────────────────────
  const hewan     = result?.hewan;
  const reproduksi = result?.reproduksi;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--bg-base)',
        display: 'flex', flexDirection: 'column',
        animation: 'toast-in 0.22s cubic-bezier(0.16,1,0.3,1) forwards',
      }}
    >
      <style>{`
        .pulse-animation {
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          animation: pulse-ring 2s infinite cubic-bezier(0.66, 0, 0, 1);
        }
        @keyframes pulse-ring {
          100% {
            box-shadow: 0 0 0 30px rgba(16, 185, 129, 0);
          }
        }
      `}</style>
      
      {/* ── Header ── */}
      <header style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '20px 24px', background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '18px', fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
          {hewan ? 'Data Hewan Ditemukan' : 'Scan RFID'}
        </h3>
        <button
          onClick={handleClose}
          style={{
            background: 'var(--bg-hover)', border: 'none', borderRadius: '50%',
            width: '36px', height: '36px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)',
            transition: 'background 0.2s'
          }}
        >
          <X size={20} />
        </button>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        
        {/* JIKA DATA DITEMUKAN (TAMPILAN PROFIL MIRIP LIVIN) */}
        {hewan ? (
          <div style={{
            background: 'var(--bg-surface)', borderRadius: '20px',
            padding: '24px 20px', border: '1px solid var(--accent-border)',
            boxShadow: '0 8px 32px rgba(16,185,129,0.08)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            animation: 'toast-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards'
          }}>
            <div style={{ 
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px', boxShadow: '0 4px 16px rgba(16,185,129,0.3)'
            }}>
              <CheckCircle2 size={28} color="#fff" />
            </div>
            
            <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '22px', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 8px 0', textAlign: 'center' }}>
              {hewan.nama ?? '-'}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px', color: 'var(--accent)', background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: '100px', fontWeight: 700, border: '1px solid var(--accent-border)' }}>
                {hewan.id ?? hewan.rfid ?? '-'}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-2)', background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: '100px', fontWeight: 600, border: '1px solid var(--border)' }}>
                {hewan.jenis ?? '-'}
              </span>
            </div>

            <div style={{ width: '100%', borderTop: '2px dashed var(--border)', margin: '8px 0 20px 0' }} />

            {/* List Details */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HeartPulse size={14} /> Status Kesehatan
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {hewan.status_kesehatan === 'Sehat' ? <><CheckCircle2 size={14} color="var(--accent)"/> Sehat</> : (hewan.status_kesehatan ?? '-')}
                </span>
              </div>

              {reproduksi && (
                <>
                  <div style={{ width: '100%', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <p style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={12} /> Data Reproduksi Terbaru
                  </p>
                  
                  {reproduksi.tanggal_ib && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Tanggal IB</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 700 }}>{formatDate(reproduksi.tanggal_ib)}</span>
                    </div>
                  )}
                  {reproduksi.pemberi_ib && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}><Syringe size={14} /> Pemberi IB</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 700 }}>{reproduksi.pemberi_ib}</span>
                    </div>
                  )}
                  {reproduksi.jumlah_ib && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> Jumlah IB</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 700 }}>Ke-{reproduksi.jumlah_ib}</span>
                    </div>
                  )}
                  {reproduksi.birahi && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}><Heart size={14} /> Tanggal Birahi</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 700 }}>{formatDate(reproduksi.birahi)}</span>
                    </div>
                  )}
                  {reproduksi.bunting && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={14} /> Tanggal Bunting</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 700 }}>{formatDate(reproduksi.bunting)}</span>
                    </div>
                  )}
                  {reproduksi.hpl && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}><Baby size={14} /> Perkiraan Lahir</span>
                      <span style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 800 }}>{formatDate(reproduksi.hpl)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '24px' }}>
              <button
                onClick={() => { setResult(null); setRfid(''); setActiveTab('scan'); }}
                style={{
                  flex: 1, padding: '12px',
                  background: 'var(--bg-hover)', color: 'var(--text-1)',
                  border: '1px solid var(--border)', borderRadius: '12px', fontWeight: 700,
                  fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                Scan Lagi
              </button>
              <button
                onClick={handleLanjutDetail}
                style={{
                  flex: 1, padding: '12px',
                  background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: '12px', fontWeight: 700,
                  fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                }}
              >
                Lihat Form
              </button>
            </div>
          </div>
        ) : (
          /* JIKA BELUM ADA HASIL -> TAMPILAN SCAN / MANUAL */
          <>
            {/* ── Tabs Pilihan ── */}
            <div style={{ 
              display: 'flex', background: 'var(--bg-surface)', padding: '6px', 
              borderRadius: '20px', marginBottom: '40px',
              border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <button 
                onClick={() => setActiveTab('scan')} 
                style={{ 
                  flex: 1, padding: '14px', 
                  background: activeTab === 'scan' ? 'var(--accent)' : 'transparent', 
                  color: activeTab === 'scan' ? '#fff' : 'var(--text-2)', 
                  borderRadius: '16px', border: 'none', fontWeight: 700,
                  fontSize: '15px', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', cursor: 'pointer',
                  boxShadow: activeTab === 'scan' ? '0 4px 12px rgba(16,185,129,0.3)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Wifi size={18} />
                  Scan NFC
                </div>
              </button>
              <button 
                onClick={() => { setActiveTab('manual'); setTimeout(() => inputRef.current?.focus(), 100); }} 
                style={{ 
                  flex: 1, padding: '14px', 
                  background: activeTab === 'manual' ? 'var(--bg-card)' : 'transparent', 
                  color: activeTab === 'manual' ? 'var(--text-1)' : 'var(--text-2)', 
                  borderRadius: '16px', border: 'none', fontWeight: 700,
                  fontSize: '15px', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', cursor: 'pointer',
                  boxShadow: activeTab === 'manual' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Search size={18} />
                  Input ID
                </div>
              </button>
            </div>

            {/* ── WebSocket status indicator ── */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
              {wsStatus === 'connected'
                ? <><Wifi size={16} color="var(--accent)" /><span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600 }}>Scanner Hardware Aktif</span></>
                : <><WifiOff size={16} color="var(--text-3)" /><span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500 }}>Scanner Hardware Offline</span></>
              }
            </div>

            {activeTab === 'scan' ? (
              /* SCAN MODE */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: '60px' }}>
                <div 
                  className={wsStatus === 'connected' || nfcScanning ? "pulse-animation" : ""}
                  style={{ 
                    width: '160px', height: '160px', background: 'var(--bg-surface)', 
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    marginBottom: '32px', border: '4px solid var(--bg-hover)',
                    transition: 'all 0.3s'
                  }}
                >
                  <Smartphone size={64} color="var(--accent)" />
                </div>
                
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-1)', marginBottom: '16px' }}>
                  Silakan Scan Kartu
                </h3>
                <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.6, marginBottom: '40px', maxWidth: '320px' }}>
                  Tempelkan kartu RFID NFC ke bagian <strong>belakang HP Anda</strong> atau letakkan di atas <strong>alat scanner hardware</strong>.
                </p>

                {('NDEFReader' in window) && (
                  <button
                    onClick={handleNfcScan}
                    disabled={nfcScanning}
                    style={{
                      padding: '18px 24px', background: nfcScanning ? 'var(--bg-hover)' : 'var(--accent)', 
                      color: nfcScanning ? 'var(--text-2)' : '#fff', borderRadius: '16px', 
                      width: '100%', maxWidth: '340px', fontSize: '16px', fontWeight: 700,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      boxShadow: nfcScanning ? 'none' : '0 4px 16px rgba(16,185,129,0.3)', transition: 'all 0.2s'
                    }}
                  >
                    <Smartphone size={20} />
                    {nfcScanning ? 'Menunggu Kartu...' : 'Mulai Scan Sensor HP'}
                  </button>
                )}
              </div>
            ) : (
              /* MANUAL INPUT MODE */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fade-in 0.2s ease-out forwards' }}>
                <div style={{
                  background: 'var(--bg-surface)', borderRadius: '24px',
                  padding: '32px 24px', border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <p style={{ fontSize: '15px', color: 'var(--text-2)', marginBottom: '24px', textAlign: 'center', fontWeight: 500 }}>
                    Masukkan kode RFID secara manual jika kartu tidak terbaca.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={rfid}
                      onChange={e => { setRfid(e.target.value.toUpperCase()); setNotFound(false); setResult(null); }}
                      onKeyDown={e => e.key === 'Enter' && handleScan()}
                      placeholder="Contoh: C670AE03"
                      style={{
                        width: '100%', padding: '18px 20px',
                        background: 'var(--bg-base)',
                        border: `2px solid ${notFound ? 'var(--error, #ef4444)' : 'var(--border)'}`,
                        borderRadius: '16px', color: 'var(--text-1)',
                        fontSize: '18px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
                        outline: 'none', transition: 'all 0.2s', textAlign: 'center',
                        letterSpacing: '2px'
                      }}
                    />
                    <button
                      onClick={() => handleScan()}
                      disabled={loading || !rfid.trim()}
                      style={{
                        padding: '18px', width: '100%',
                        background: 'var(--accent)', color: '#fff',
                        border: 'none', borderRadius: '16px',
                        fontWeight: 800, fontSize: '16px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        opacity: !rfid.trim() ? 0.5 : 1, transition: 'all 0.2s',
                        boxShadow: '0 4px 16px rgba(16,185,129,0.3)'
                      }}
                    >
                      {loading ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={20} />}
                      Cari ID Ternak
                    </button>
                  </div>
                </div>

                {/* ── RFID tidak terdaftar ── */}
                {notFound && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.05)', borderRadius: '16px',
                    padding: '20px', border: '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'flex', flexDirection: 'column', gap: '12px',
                    marginTop: '20px', animation: 'toast-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <AlertCircle size={20} color="var(--error, #ef4444)" />
                      <p style={{ fontSize: '15px', color: 'var(--error, #ef4444)', margin: 0, fontWeight: 800 }}>
                        RFID <span style={{ background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '6px' }}>{rfid}</span> Belum Terdaftar
                      </p>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                      Kartu ini belum tersambung dengan hewan manapun. Apakah Anda ingin mendaftarkannya sekarang?
                    </p>
                    <button
                      onClick={handleDaftarBaru}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px', borderRadius: '12px',
                        background: 'var(--accent)', color: '#fff',
                        border: 'none', cursor: 'pointer',
                        fontSize: '14px', fontWeight: 700, marginTop: '8px',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                      }}
                    >
                      <PlusCircle size={16} />
                      Daftar Cepat
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}