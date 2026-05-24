import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
      <div className="w-24 h-24 bg-[var(--color-sage-light)]/20 rounded-full flex items-center justify-center mb-6">
        <Construction className="w-12 h-12 text-[var(--color-forest)] animate-bounce" />
      </div>
      
      <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)] mb-4">
        Segera Hadir!
      </h1>
      
      <p className="text-[var(--color-text-secondary)] max-w-md mb-8 leading-relaxed">
        Halaman ini sedang dalam tahap pengembangan intensif untuk memberikan pengalaman terbaik bagi manajemen peternakan Anda.
      </p>
      
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 px-6 py-3 bg-[var(--color-forest)] text-[var(--color-cream)] rounded-full font-bold shadow-lg hover:bg-[var(--color-forest-light)] hover:-translate-y-1 transition-all"
      >
        <ArrowLeft size={18} />
        Kembali ke Dashboard
      </button>
    </div>
  );
}
