import image404 from '@/assets/logo/404.webp';

export default function NotFound() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundImage: `url(${image404})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      {/* Dark overlay to match theme and blend the background image */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(10, 10, 15, 0.55) 0%, rgba(10, 10, 15, 0.92) 100%)',
        zIndex: 1,
      }} />

      {/* Content Container */}
      <div style={{
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        animation: 'hq-fadeup 1s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        <h1 style={{
          fontSize: '120px',
          fontWeight: 800,
          lineHeight: '1',
          margin: '0 0 8px 0',
          letterSpacing: '-0.05em',
          color: 'rgba(255, 255, 255, 0.15)', // Extremely clean abstract text blending into background
          mixBlendMode: 'overlay',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}>
          404
        </h1>
        
        <p style={{
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.35)', // Blended subtle English wording
          margin: 0,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
          Page Not Found
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
