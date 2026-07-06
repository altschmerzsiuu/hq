// src/components/layout/ToastContainer.jsx
// Beautiful, premium Neo Bio-Tech custom Toast notifications UI

import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import useToastStore from '@/store/toastStore';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '380px',
        width: 'calc(100% - 48px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isInfo = toast.type === 'info';

        // Custom colors based on Neo Bio-Tech theme
        let borderColor = 'var(--border)';
        let iconColor = 'var(--text-2)';
        let bgGlow = 'rgba(255, 255, 255, 0.01)';
        let Icon = Info;

        if (isSuccess) {
          borderColor = 'var(--accent)';
          iconColor = 'var(--accent)';
          bgGlow = 'var(--accent-dim)';
          Icon = CheckCircle2;
        } else if (isError) {
          borderColor = 'var(--red)';
          iconColor = 'var(--red)';
          bgGlow = 'var(--red-dim)';
          Icon = AlertTriangle;
        } else if (isInfo) {
          borderColor = 'var(--blue)';
          iconColor = 'var(--blue)';
          bgGlow = 'var(--blue-dim)';
          Icon = Info;
        }

        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '16px',
              background: 'var(--bg-glass-toast)', // Frosted glass background
              backdropFilter: 'blur(30px) saturate(140%)',
              WebkitBackdropFilter: 'blur(30px) saturate(140%)',
              border: '1px solid var(--border-glass-toast)',
              boxShadow: 'var(--shadow-toast)',
              fontFamily: 'Inter, system-ui, sans-serif',
              pointerEvents: 'auto',
              animation: 'toast-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transition: 'all 0.2s',
              position: 'relative',
              width: '100%',
            }}
          >
            {/* Left: App/Type icon */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: bgGlow,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={16} style={{ color: iconColor }} />
            </div>

            {/* Middle: Content layout */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '2px' }}>
              {/* Header: Title & Time */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-2)', textTransform: 'uppercase' }}>
                  HERD
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-2)' }}>
                  Sekarang
                </span>
              </div>
              {/* Message */}
              <span style={{ fontSize: '13px', fontWeight: 500, lineHeight: 1.4, color: 'var(--text-1)' }}>
                {toast.message}
              </span>
            </div>

            {/* Close Button */}
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--text-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'background 0.15s, color 0.15s',
                marginTop: '2px',
              }}
              className="hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--text-1)]"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
