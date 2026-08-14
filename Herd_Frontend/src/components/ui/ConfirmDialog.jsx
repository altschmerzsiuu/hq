import React, { useEffect } from 'react';
import useConfirmStore from '@/store/confirmStore';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export default function ConfirmDialog() {
  const { isOpen, title, message, confirmText, cancelText, isDanger, confirm, cancel } = useConfirmStore();

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') cancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, cancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.15s ease-out' }}
        onClick={cancel}
      />

      {/* Dialog Panel */}
      <div
        className="relative bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl max-w-sm w-full p-6 text-left overflow-hidden shadow-2xl"
        style={{ animation: 'dialogSlideUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        {/* Icon + Content */}
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center ${
            isDanger ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
          }`}>
            {isDanger
              ? <AlertTriangle className="w-5 h-5" />
              : <HelpCircle className="w-5 h-5" />
            }
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3
              id="confirm-dialog-title"
              className="text-base font-bold text-[var(--text-1)] leading-snug mb-1.5"
            >
              {title}
            </h3>
            <p className="text-sm text-[var(--text-2)] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
            onClick={cancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg cursor-pointer ${
              isDanger
                ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-red-500/20'
                : 'bg-[var(--accent)] hover:brightness-110 active:brightness-90 shadow-[var(--accent)]/20'
            }`}
            onClick={confirm}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dialogSlideUp {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
