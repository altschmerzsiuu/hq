import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, AlertCircle, PlusCircle, Wifi, WifiOff, Smartphone, CheckCircle2, HeartPulse, FileText, Calendar, Syringe, Baby, Heart, Activity } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from '@/store/toastStore';
import { handleError } from '@/lib/errorHandler';
import herdLogo from '@/assets/logo/herd.jpeg';

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
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && !import.meta.env.DEV) {
    return apiUrl.replace(/^http/, 'ws') + '/api/ws';
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
  const [previewImage, setPreviewImage] = useState(null);   // State untuk preview gambar fullscreen

  const wsRef    = useRef(null);
  const inputRef = useRef(null);
  const videoRef = useRef(null);

  const streamRef = useRef(null);

  const shouldCameraRun = isOpen && !result && !notFound && !loading;

  // ── Camera lifecycle ────────────────────────
  useEffect(() => {
    let isMounted = true;

    if (!shouldCameraRun) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    const startCamera = async () => {
      if (!streamRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (!isMounted) {
             stream.getTracks().forEach(track => track.stop());
             return;
          }
          streamRef.current = stream;
        } catch (err) {
          if (!isMounted) return;
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
            toast.error('Akses kamera ditolak. Izinkan akses kamera di pengaturan browser Anda.');
          } else {
            handleError(err, 'akses kamera');
          }
        }
      }
      
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [shouldCameraRun]);

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

  // ── Auto-start NFC Scanning ──
  useEffect(() => {
    if (!isOpen || result || notFound || loading) return;
    if (!('NDEFReader' in window)) return;

    let ndef = null;
    let isMounted = true;

    const startNfc = async () => {
      try {
        setNfcScanning(true);
        ndef = new NDEFReader();
        await ndef.scan();

        ndef.onreadingerror = () => {
          // silently ignore
        };

        ndef.onreading = (event) => {
          if (!isMounted) return;
          const rawUid = event.serialNumber;
          if (rawUid) {
            const cleanedUid = rawUid.replace(/:/g, '').toUpperCase();
            setRfid(cleanedUid);
            setNfcScanning(false);
            handleScan(cleanedUid);
          }
        };
      } catch (error) {
        console.error("Web NFC Error:", error);
        if (isMounted) setNfcScanning(false);
      }
    };

    startNfc();

    return () => {
      isMounted = false;
      setNfcScanning(false);
      // NDEFReader doesn't have an explicit stop method yet, 
      // but it will stop when the tab is hidden or we re-instantiate.
    };
  }, [isOpen, result, notFound, loading]);

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
        @keyframes scan-line {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(240px); opacity: 0; }
        }
      `}</style>
      
      {/* ── Header ── */}
      <header className="pt-safe-16 pb-4 px-6 flex items-center justify-center relative bg-[var(--bg-base)]" style={{ zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={herdLogo} alt="HERD Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '18px', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.5px' }}>
            HERD
          </h3>
        </div>
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', left: '20px',
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '50%',
            width: '36px', height: '36px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)',
            transition: 'background 0.2s'
          }}
        >
          <X size={20} />
        </button>
      </header>

      {/* ── BACKGROUND LAYER: CAMERA VIEW ── */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
        <div style={{
          flex: 1, position: 'relative', overflow: 'hidden', 
          borderRadius: '24px', background: '#000',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} 
          />
          
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
            
            <div style={{ position: 'absolute', top: '32px', background: 'rgba(255,255,255,0.95)', padding: '10px 24px', borderRadius: '100px', fontWeight: 700, color: '#111', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 20 }}>
              Arahkan tag RFID ke kamera
            </div>

            <div style={{ position: 'relative', width: '240px', height: '240px', zIndex: 20 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '40px', height: '40px', borderTop: '4px solid #fff', borderLeft: '4px solid #fff', borderRadius: '16px 0 0 0' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', height: '40px', borderTop: '4px solid #fff', borderRight: '4px solid #fff', borderRadius: '0 16px 0 0' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '40px', height: '40px', borderBottom: '4px solid #fff', borderLeft: '4px solid #fff', borderRadius: '0 0 0 16px' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '40px', height: '40px', borderBottom: '4px solid #fff', borderRight: '4px solid #fff', borderRadius: '0 0 16px 0' }} />
              <div style={{ width: '100%', height: '3px', background: 'var(--accent)', boxShadow: '0 0 12px 2px var(--accent)', position: 'absolute', top: 0, animation: 'scan-line 2.5s infinite ease-in-out' }} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-ring 2s infinite' }} />
            <span style={{ color: 'var(--text-1)', fontSize: '14px', fontWeight: 700 }}>
              {nfcScanning ? 'Membaca tag NFC...' : wsStatus === 'connected' ? 'Mencari Data Sapi...' : 'Menunggu koneksi scanner...'}
            </span>
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', textAlign: 'center', maxWidth: '250px' }}>
            Pastikan tag RFID sapi berada di dalam kotak area scan.
          </p>

          {/* TOMBOL SIMULASI HANYA MUNCUL DI MODE DEVELOPMENT */}
          {/* DEV mockup buttons removed as requested */}
        </div>
      </div>

      {/* ── OVERLAY BOTTOM SHEETS ── */}
      <AnimatePresence>
        {(loading || hewan || notFound) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { if (!loading) { setResult(null); setNotFound(false); setRfid(''); } }}
            style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          >
            {loading ? (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                  <Loader2 size={40} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>Menganalisa Data...</h3>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>Sinkronisasi dengan database HERD</p>
              </motion.div>
            ) : hewan ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--bg-surface)', borderRadius: '32px',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}
              >
                <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Content */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {hewan.foto ? (
                      <div 
                        onClick={() => setPreviewImage(hewan.foto)}
                        style={{ width: '120px', height: '120px', borderRadius: '24px', overflow: 'hidden', marginBottom: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '4px solid var(--bg-surface)', cursor: 'pointer' }}
                      >
                        <img src={hewan.foto} alt={hewan.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: '120px', height: '120px', borderRadius: '24px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 8px 24px rgba(16,185,129,0.3)', border: '4px solid var(--bg-surface)' }}>
                        <CheckCircle2 size={48} color="#fff" />
                      </div>
                    )}
                    
                    <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '24px', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 4px 0', textAlign: 'center' }}>
                      {hewan.nama ?? '-'}
                    </h2>
                    
                    <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-2)', fontWeight: 600 }}>
                      {hewan.id || hewan.rfid ? (hewan.id ?? hewan.rfid) : 'Belum ada RFID nih'}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-2)', background: 'var(--bg-hover)', padding: '6px 14px', borderRadius: '100px', fontWeight: 700, border: '1px solid var(--border)' }}>
                        {hewan.jenis ?? '-'}
                      </span>
                    </div>

                    <div style={{ width: '100%', borderTop: '2px dashed var(--border)', margin: '8px 0 20px 0' }} />

                    {/* Details */}
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
                          <div style={{ width: '100%', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
                          <div style={{ width: '100%', background: 'var(--bg-surface)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 800, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <Activity size={16} color="var(--accent)" /> SIKLUS TERAKHIR
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                              {reproduksi.birahi && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Tanggal Birahi</span>
                                  <span style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 700 }}>{formatDate(reproduksi.birahi)}</span>
                                </div>
                              )}
                              {reproduksi.tanggal_ib && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Inseminasi {reproduksi.jumlah_ib ? `(Ke-${reproduksi.jumlah_ib})` : ''}</span>
                                  <span style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 700 }}>{formatDate(reproduksi.tanggal_ib)}</span>
                                </div>
                              )}
                              {reproduksi.pemberi_ib && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Inseminator</span>
                                  <span style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 700 }}>{reproduksi.pemberi_ib}</span>
                                </div>
                              )}
                              {reproduksi.bunting && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Bunting</span>
                                  <span style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 700 }}>{formatDate(reproduksi.bunting)}</span>
                                </div>
                              )}
                              {reproduksi.hpl && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                    <Baby size={12} /> HPL
                                  </span>
                                  <span style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 800 }}>{formatDate(reproduksi.hpl)}</span>
                                </div>
                              )}
                              {reproduksi.sapih && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Tanggal Sapih</span>
                                  <span style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 700 }}>{formatDate(reproduksi.sapih)}</span>
                                </div>
                              )}
                              {reproduksi.catatan && (
                                <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1', marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500, marginBottom: '2px' }}>Catatan</span>
                                  <span style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.4 }}>{reproduksi.catatan}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '24px' }}>
                      <button
                        onClick={() => { setResult(null); setNotFound(false); setRfid(''); setActiveTab('scan'); }}
                        style={{
                          flex: 1, padding: '14px', background: 'var(--bg-hover)', color: 'var(--text-1)',
                          border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '15px'
                        }}
                      >
                        Scan Lagi
                      </button>
                      <button
                        onClick={handleLanjutDetail}
                        style={{
                          flex: 1, padding: '14px', background: 'var(--accent)', color: '#fff',
                          border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '15px',
                          boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                        }}
                      >
                        Lihat Form
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : notFound ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--bg-surface)', borderRadius: '32px',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}
              >
                <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

                  <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '16px' }}>
                    <AlertCircle size={32} color="var(--error, #ef4444)" />
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-1)', marginBottom: '8px' }}>Hewan Tidak Ditemukan</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '24px', lineHeight: 1.5 }}>
                    RFID <span style={{ background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>{rfid}</span> belum terdaftar di sistem.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '12px', flexDirection: 'column', width: '100%' }}>
                    <button
                      onClick={handleDaftarBaru}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '16px', borderRadius: '16px', background: 'var(--accent)', color: '#fff',
                        border: 'none', fontWeight: 700, fontSize: '15px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                      }}
                    >
                      <PlusCircle size={18} /> Daftarkan Hewan Baru
                    </button>
                    <button
                      onClick={() => { setNotFound(false); setRfid(''); setActiveTab('scan'); }}
                      style={{ padding: '16px', borderRadius: '16px', background: 'var(--bg-hover)', color: 'var(--text-1)', border: 'none', fontWeight: 700, fontSize: '15px' }}
                    >
                      Scan Ulang
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── IMAGE PREVIEW MODAL ── */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '24px'
            }}
          >
            <div style={{ position: 'relative', display: 'inline-flex', maxWidth: '100%', maxHeight: '80vh' }}>
              <motion.img
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                src={previewImage} alt="Preview"
                style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '24px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)', objectFit: 'contain' }}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
              />
              <button
                onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                style={{
                  position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                  border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', cursor: 'pointer', zIndex: 10
                }}
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}