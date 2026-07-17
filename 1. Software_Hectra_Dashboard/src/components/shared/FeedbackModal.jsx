import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus } from 'lucide-react';

export default function FeedbackModal({ isOpen, onClose, lang }) {
  const [feedback, setFeedback] = useState('');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg overflow-hidden flex flex-col bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white rounded-[24px] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700/50">
            <button onClick={onClose} className="text-[15px] font-medium text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors">
              {lang === 'id' ? 'Batal' : 'Cancel'}
            </button>
            <h2 className="text-[16px] font-bold">
              {lang === 'id' ? 'Kirim Masukan' : 'Send feedback'}
            </h2>
            <button 
              disabled={!feedback.trim()}
              className={`text-[15px] font-bold transition-colors ${feedback.trim() ? 'text-[#2f7d31] hover:text-[#43a047]' : 'text-gray-500'}`}
            >
              {lang === 'id' ? 'Kirim' : 'Send'}
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto max-h-[80vh] scrollbar-hide">
            <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-400 mb-6">
              {lang === 'id' ? (
                <>Gunakan form ini untuk melaporkan masalah teknis atau menyarankan peningkatan. Untuk masalah lain, Anda dapat meminta bantuan di <span className="text-[#2f7d31] font-semibold cursor-pointer">Pusat Bantuan</span>, atau <span className="text-[#2f7d31] font-semibold cursor-pointer">hubungi kami</span>.</>
              ) : (
                <>Use this form to report technical issues or suggest improvements. For other issues, you can get help from the <span className="text-[#2f7d31] font-semibold cursor-pointer">Help Centre</span>, or <span className="text-[#2f7d31] font-semibold cursor-pointer">contact us</span>.</>
              )}
            </p>

            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={lang === 'id' ? 'Jelaskan masalah teknis' : 'Describe the technical issue'}
              className="w-full min-h-[140px] p-4 rounded-xl resize-none outline-none text-[15px] transition-colors bg-gray-50 dark:bg-[#2c2c2e] text-gray-900 dark:text-white border border-transparent focus:border-[#2f7d31]"
            />

            <div className="mt-6">
              <h3 className="text-[14px] font-semibold mb-3">
                {lang === 'id' ? 'Tangkapan layar atau rekaman (opsional)' : 'Screenshots or recordings (optional)'}
              </h3>
              <div 
                className="w-32 h-32 rounded-xl flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity bg-gray-100 dark:bg-[#2c2c2e]"
              >
                <ImagePlus className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-[12px] text-gray-500 mt-3">
                {lang === 'id' ? 'Ketuk tangkapan layar untuk mengedit atau menghapus info sensitif.' : 'Tap screenshot to edit or remove sensitive info.'}
              </p>
            </div>

            <p className="text-[12px] leading-relaxed text-gray-500 mt-8">
              {lang === 'id' ? (
                <>Dengan mengirim, Anda mengizinkan kami untuk meninjau info teknis terkait untuk membantu mengatasi masukan Anda. <span className="text-[#2f7d31] font-semibold cursor-pointer">Pelajari lebih lanjut</span></>
              ) : (
                <>By sending, you allow us to review related technical info to help address your feedback. <span className="text-[#2f7d31] font-semibold cursor-pointer">Learn more</span></>
              )}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
