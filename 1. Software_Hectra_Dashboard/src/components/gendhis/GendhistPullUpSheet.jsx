import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, X, Maximize2, Send, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function GendhistPullUpSheet() {
  const [sheetState, setSheetState] = useState('closed'); // 'closed' | 'peek' | 'open' | 'fullscreen'
  const location = useLocation();

  // Hide entirely on login
  if (location.pathname === '/login') return null;

  const getSuggestions = (pathname) => {
    const map = {
      '/dashboard': ['Ringkasan kondisi kandang hari ini', 'Sapi mana yang butuh perhatian?', 'Ada berapa alert aktif?'],
      '/sensor-data': ['Kenapa suhu sapi ini naik?', 'Aktivitas sapi mana yang abnormal?', 'Sensor mana yang offline?'],
      '/recommendations': ['Sapi mana yang harus di-IB hari ini?', 'Kapan jadwal IB berikutnya?', 'Jelaskan rekomendasi ini'],
      '/ternak': ['Berapa total sapi di kandang?', 'Sapi mana yang belum punya collar?', 'Siapa yang HPL bulan ini?'],
    };
    return map[pathname] ?? ['Apa yang bisa saya bantu?', 'Tunjukkan ringkasan kandang', 'Ada pertanyaan lain?'];
  };

  const suggestions = getSuggestions(location.pathname);

  const handleDragStart = () => {
    if (sheetState === 'closed') setSheetState('peek');
  };

  const closeSheet = (e) => {
    e.stopPropagation();
    setSheetState('closed');
  };

  return (
    <>
      {/* Background Overlay when Open/Fullscreen */}
      {(sheetState === 'open' || sheetState === 'fullscreen') && (
        <div 
          className="fixed inset-0 bg-black/50 z-[190] md:hidden animate-in fade-in" 
          onClick={closeSheet}
        />
      )}

      {/* Main Container */}
      <div 
        className={cn(
          "fixed md:hidden bg-white transition-all duration-300 ease-in-out flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-[var(--color-border)]",
          sheetState === 'closed' ? "bottom-[100px] right-6 w-auto h-[48px] rounded-full px-4" :
          sheetState === 'peek' ? "bottom-[100px] right-6 left-6 h-[220px] rounded-3xl" :
          sheetState === 'open' ? "bottom-[100px] right-6 left-6 h-[70vh] rounded-3xl" :
          "inset-0" // fullscreen
        )}
        style={{ zIndex: sheetState === 'fullscreen' ? 9999 : sheetState === 'open' ? 200 : 30 }}
      >
        {/* Handle Bar Area */}
        <div 
          className={cn(
            "h-[48px] flex items-center cursor-pointer shrink-0",
            sheetState === 'closed' ? "justify-center gap-2" : "w-full justify-between px-5"
          )}
          onClick={() => {
            if (sheetState === 'closed') setSheetState('peek');
            else if (sheetState === 'peek') setSheetState('open');
            else if (sheetState === 'open') setSheetState('fullscreen');
          }}
          onTouchStart={handleDragStart}
        >
          {sheetState === 'closed' && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <div className="w-7 h-7 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
                <Bot size={16} className="text-[var(--color-primary)]" />
              </div>
              <span className="text-[14px] font-body font-bold text-[var(--color-primary)]">Tanya Gendhis</span>
            </div>
          )}

          {sheetState !== 'closed' && (
            <div className="w-full flex justify-center mt-2 absolute top-0 left-0">
               <div className="w-[32px] h-[4px] bg-[var(--color-border-strong)] rounded-full" />
            </div>
          )}
        </div>

        {/* Peek State Content (Suggestions) */}
        {sheetState === 'peek' && (
          <div className="px-4 py-2 animate-in fade-in slide-in-from-bottom-4 flex-1">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Saran Pertanyaan</p>
              <button onClick={closeSheet} className="p-1 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button 
                  key={i}
                  className="w-full text-left px-4 py-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-secondary)] font-medium hover:border-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors"
                  onClick={() => setSheetState('open')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Open / Fullscreen State Content */}
        {(sheetState === 'open' || sheetState === 'fullscreen') && (
          <div className="flex flex-col h-full animate-in fade-in">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-surface)] shrink-0 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                  <Bot size={18} className="text-[var(--color-accent)]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-[var(--color-primary)] leading-tight">Gendhis</h3>
                  <p className="text-[10px] text-[var(--color-accent)] font-medium">● AI Assistant Online</p>
                </div>
              </div>
              <div className="flex gap-2">
                {sheetState === 'open' && (
                  <button onClick={() => setSheetState('fullscreen')} className="p-2 text-gray-400 hover:text-[var(--color-primary)] transition-colors">
                    <Maximize2 size={18} />
                  </button>
                )}
                {sheetState === 'fullscreen' && (
                  <button onClick={() => setSheetState('open')} className="p-2 text-gray-400 hover:text-[var(--color-primary)] transition-colors">
                    <ChevronRight size={18} className="rotate-90" />
                  </button>
                )}
                <button onClick={closeSheet} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-[var(--color-bg-base)] p-4 overflow-y-auto">
              {/* Mock Chat Bubble */}
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-6 h-6 bg-[var(--color-primary)] rounded-full flex-shrink-0 flex items-center justify-center mt-1">
                  <Bot size={12} className="text-[var(--color-accent)]" />
                </div>
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl rounded-tl-sm p-3 shadow-sm">
                  <p className="text-sm text-[var(--color-text-primary)]">
                    Halo! Saya Gendhis. Sapi di kandang saat ini ada 1 yang membutuhkan perhatian (Indikasi Estrus). Ada yang ingin Anda tanyakan terkait data ini?
                  </p>
                </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-[var(--color-border)] bg-white shrink-0">
              <div className="flex items-end gap-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-1 shadow-sm focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] transition-all">
                <textarea 
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none resize-none px-3 py-2.5 text-sm text-[var(--color-text-primary)] max-h-[120px]"
                  placeholder="Ketik pesan..."
                />
                <button className="p-2.5 m-1 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors">
                  <Send size={16} className="-ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
