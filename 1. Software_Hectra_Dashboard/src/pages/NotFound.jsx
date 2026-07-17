import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
// --------------------------

export default function NotFound() {
  const navigate = useNavigate(); 
  
  return (
    <div className="not-found-container" style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#050508',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      
      {/* --- AMBIENT GLOWS (Cahaya Latar) --- */}
      <div className="ambient-glow glow-green" />
      <div className="ambient-glow glow-purple" />

      {/* --- BACKGROUND IMAGE --- */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${image404})`,
        backgroundSize: 'cover', // Diubah ke cover agar lebih immersive
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'grayscale(100%) contrast(1.2)', // Bikin imejnya lebih menyatu dengan tema dark
        mixBlendMode: 'overlay',
        opacity: 0.15, // Dibuat lebih subtle agar teks lebih terbaca
        zIndex: 1,
      }} />

      {/* --- VIGNETTE / RADIAL GRADIENT --- */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at center, transparent 0%, #050508 100%)',
        zIndex: 2,
      }} />

      {/* --- MAIN CONTENT --- */}
      <div className="content-wrapper" style={{
        zIndex: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
      }}>
        
        {/* Glassmorphism Badge */}
        <div className="glass-badge">
          <span style={{ color: '#2f7d31', marginRight: '8px', fontSize: '18px' }}>•</span>
          404: THIS PAGE IS GONE FR FR
        </div>

        {/* Abstract Typography */}
        <h1 className="sheesh-text">
          SHEESH
        </h1>
        
        <p style={{
          fontSize: '16px',
          fontWeight: 400,
          color: 'rgba(255, 255, 255, 0.5)',
          maxWidth: '400px',
          margin: '0 0 32px 0',
          lineHeight: '1.6',
          animation: 'fadeUp 1s ease-out 0.4s both',
        }}>
          Looks like you've wandered too far. The cow you're looking for doesn't exist in this farm anymore.
        </p>

        {/* Upgraded Pill Button */}
        <button
          className="dashboard-btn"
          onClick={() => navigate('/dashboard')}
          title="Back to Dashboard"
        >
          <div className="icon-wrapper">
            <ArrowLeft size={18} />
          </div>
          <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
            Back to Dashboard
          </span>
        </button>
      </div>

      {/* --- STYLES & ANIMATIONS --- */}
      <style>{`
        /* Animations */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }

        /* Elements */
        .content-wrapper {
          animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .ambient-glow {
          position: absolute;
          width: 50vw;
          height: 50vw;
          border-radius: 50%;
          filter: blur(80px);
          z-index: 0;
          animation: pulseGlow 8s infinite alternate ease-in-out;
        }
        .glow-green {
          top: -10%;
          left: -10%;
          background: radial-gradient(circle, rgba(0, 212, 126, 0.15) 0%, transparent 70%);
        }
        .glow-purple {
          bottom: -20%;
          right: -10%;
          background: radial-gradient(circle, rgba(100, 50, 255, 0.1) 0%, transparent 70%);
          animation-delay: -4s;
        }

        .glass-badge {
          display: flex;
          align-items: center;
          padding: 8px 20px;
          border-radius: 100px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          font-family: "'DM Sans', system-ui, sans-serif";
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 24px;
          animation: fadeUp 1s ease-out 0.1s both;
        }

        .sheesh-text {
          font-size: clamp(80px, 15vw, 160px);
          font-weight: 900;
          line-height: 0.85;
          margin: 0 0 24px 0;
          letter-spacing: -0.04em;
          background: linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0.15) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0px 20px 40px rgba(0,0,0,0.5);
          animation: float 6s ease-in-out infinite;
          user-select: none;
        }

        .dashboard-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 24px 8px 8px;
          border-radius: 100px;
          backgroundColor: transparent;
          background: rgba(22, 22, 31, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: inherit;
          backdrop-filter: blur(10px);
          animation: fadeUp 1s ease-out 0.6s both;
        }

        .dashboard-btn .icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .dashboard-btn:hover {
          background: rgba(0, 212, 126, 0.1);
          border-color: rgba(0, 212, 126, 0.4);
          color: #2f7d31;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 212, 126, 0.15);
        }

        .dashboard-btn:hover .icon-wrapper {
          background: #2f7d31;
          color: #050508;
          transform: translateX(-2px);
        }
        
        .dashboard-btn:active {
          transform: translateY(1px);
        }
      `}</style>
    </div>
  );
}