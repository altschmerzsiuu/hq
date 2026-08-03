import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

export default function ReportSickModal({ isOpen, onClose, onSubmit, cowId }) {
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(cowId, { symptoms, notes });
      setSymptoms('');
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Failed to report sick:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-2xl shadow-xl z-10 overflow-hidden border border-[var(--border)] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--color-danger)]">
            <AlertCircle size={20} />
            <h3 className="font-heading font-bold text-lg text-[var(--text-1)]">
              Lapor Sapi Sakit
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-hover)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-2)] mb-1">
                Sapi ID
              </label>
              <div className="px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-1)] font-medium">
                {cowId || '-'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-2)] mb-1">
                Gejala Klinis
              </label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--color-primary)] transition-colors min-h-[80px]"
                placeholder="Misal: Nafsu makan turun, demam..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-2)] mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--color-primary)] transition-colors min-h-[80px]"
                placeholder="Detail lain yang perlu dicatat..."
              />
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-[var(--text-2)] bg-[var(--bg-base)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-[var(--color-danger)] hover:bg-[#A93226] transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Memproses...' : 'Lapor Sakit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
