import React from 'react';
import useConfirmStore from '@/store/confirmStore';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export default function ConfirmDialog() {
  const { isOpen, title, message, confirmText, cancelText, isDanger, confirm, cancel } = useConfirmStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity" 
        onClick={cancel}
      />

      {/* Dialog Content */}
      <div className="relative bg-[var(--bg-surface)] border border-[var(--border)] shadow-[var(--shadow-modal)] rounded-2xl max-w-md w-full p-6 text-left overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-255">
        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-xl flex-shrink-0 ${isDanger ? 'bg-[var(--red-dim)] text-[var(--red)]' : 'bg-[var(--accent-dim)] text-[var(--accent)]'}`}>
            {isDanger ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <HelpCircle className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[var(--text-1)] mb-2">
              {title}
            </h3>
            <p className="text-sm text-[var(--text-2)] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
            onClick={cancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all shadow-lg cursor-pointer ${
              isDanger 
                ? 'bg-[var(--red)] hover:brightness-110 active:brightness-90 shadow-red-500/10' 
                : 'bg-[var(--accent)] hover:brightness-110 active:brightness-90 shadow-[var(--accent)]/10'
            }`}
            onClick={confirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
