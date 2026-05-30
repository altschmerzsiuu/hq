import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import image404 from '@/assets/logo/404.webp';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0A0A0F',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      color: '#F2F2F7',
    }}>
      {/* Dynamic Ambient Background Glows */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '15%',
        width: '350px',
        height: '350px',
        background: 'radial-gradient(circle, rgba(0, 212, 126, 0.08) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        filter: 'blur(50px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '15%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(0, 136, 204, 0.08) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      {/* Main Container */}
      <div style={{
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '550px',
        width: '100%',
        animation: 'hq-fadeup 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        
        {/* Blended 404 Image Container */}
        <div style={{
          position: 'relative',
          width: '280px',
          height: '280px',
          marginBottom: '2rem',
          borderRadius: '24px',
          overflow: 'hidden',
          border: '1px solid rgba(29, 29, 43, 0.5)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}>
          {/* Base Image */}
          <img 
            src={image404} 
            alt="404 - Not Found" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.65) contrast(1.15)',
              mixBlendMode: 'luminosity',
            }}
          />
          
          {/* Abstract Vignette / Gradients Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(10, 10, 15, 0.1) 0%, rgba(10, 10, 15, 0.85) 95%)',
            pointerEvents: 'none',
          }} />

          {/* Integrated Typography overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mixBlendMode: 'overlay', // Makes it blend seamlessly with the image textures
            opacity: 0.8,
          }}>
            <span style={{
              fontSize: '92px',
              fontWeight: 900,
              letterSpacing: '-0.05em',
              color: '#FFFFFF',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            }}>
              404
            </span>
          </div>
        </div>

        {/* Text Details (Abstract & Low Contrast) */}
        <h1 style={{
          fontSize: '24px',
          fontWeight: 800,
          letterSpacing: '-0.5px',
          marginBottom: '8px',
          color: '#F2F2F7',
        }}>
          Sensor Jangkauan Terputus
        </h1>
        
        <p style={{
          fontSize: '13px',
          color: '#8E8EA0',
          lineHeight: '1.6',
          marginBottom: '2rem',
          fontWeight: 500,
          padding: '0 1rem',
        }}>
          Rute yang Anda tuju berada di luar batas wilayah koordinat sensor pintar kami. Halaman ini mungkin telah dipindahkan atau sudah tidak ada lagi.
        </p>

        {/* Premium Go Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#16161F',
            border: '1px solid #1D1D2B',
            borderRadius: '12px',
            padding: '12px 24px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#00D47E',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#1C1C27';
            e.currentTarget.style.borderColor = '#00D47E';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 212, 126, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#16161F';
            e.currentTarget.style.borderColor = '#1D1D2B';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
        >
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </button>
      </div>

      <style>{`
        @keyframes hq-fadeup {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
