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
    }}>
      {/* Background Image - scales to fit screen dynamically (contain) without cropping or pixelation */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${image404})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(0.35) contrast(1.15)',
        mixBlendMode: 'luminosity',
        opacity: 0.65,
        zIndex: 1,
      }} />

      {/* Dark radial overlay to blend image borders with the page background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle, rgba(10, 10, 15, 0.4) 0%, rgba(10, 10, 15, 0.95) 100%)',
        zIndex: 2,
      }} />

      {/* Content Container */}
      <div style={{
        zIndex: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        animation: 'hq-fadeup 1s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        <h1 style={{
          fontSize: '110px',
          fontWeight: 900,
          lineHeight: '0.95',
          margin: '0 0 12px 0',
          letterSpacing: '-0.05em',
          color: 'rgba(255, 255, 255, 0.12)', // Low-contrast abstract typography
          mixBlendMode: 'overlay',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}>
          SHEESH
        </h1>
        
        <p style={{
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.4)', // Subtle and integrated subtext
          margin: 0,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
          404: this page is gone fr fr.
        </p>

        {/* Small circular button to navigate back to dashboard */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            marginTop: '28px',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: '#16161F',
            border: '1px solid #1D1D2B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00D47E',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#00D47E';
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#1D1D2B';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Back to Dashboard"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      <style>{`
        @keyframes hq-fadeup {
          from {
            opacity: 0;
            transform: translateY(30px);
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
