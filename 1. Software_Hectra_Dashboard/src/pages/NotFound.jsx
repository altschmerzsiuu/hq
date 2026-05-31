import image404 from '@/assets/logo/404.webp';

export default function NotFound() {
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
      {/* Background Image at crisp actual size, centered and blended behind text */}
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '320px',
        backgroundImage: `url(${image404})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(0.4) contrast(1.1)',
        mixBlendMode: 'luminosity',
        opacity: 0.35,
        zIndex: 1,
      }} />

      {/* Dark overlay to match theme */}
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
