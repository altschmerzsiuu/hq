import re

with open("/Volumes/Kerberos/Github-Repo/hq/Herd_Frontend/src/pages/EstrusPrediction.jsx", "r") as f:
    content = f.read()

# 1. Add framer-motion
if 'framer-motion' not in content:
    content = content.replace("import { useState, useEffect, useCallback } from 'react';", "import { useState, useEffect, useCallback } from 'react';\nimport { motion } from 'framer-motion';")

# 2. Add the Slide to Predict UI in the header
start_marker = "<div className=\"flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10\">"
end_marker = "<div className=\"px-4 lg:px-0 space-y-8 mt-2 relative z-20\">"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    new_header = """<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex-1">
            <p className="text-[10px] md:text-[12px] font-black opacity-90 mb-1 uppercase tracking-widest text-rose-200">
              {lang === 'id' ? 'PEMANTAUAN MASA SUBUR & REPRODUKSI' : 'FERTILITY & REPRODUCTION MONITORING'}
            </p>
            <h1 className="text-[32px] md:text-[36px] font-black tracking-tight leading-none mb-4 md:mb-2">
              {t.prediction_title}
            </h1>
            <p className="text-rose-100 text-sm md:text-base font-medium opacity-90">
              {lang === 'id' ? 'Pemantauan otomatis 24/7 menggunakan data aktivitas dan riwayat reproduksi HERD.' : 'Automated 24/7 monitoring using activity data and HERD reproduction history.'}
            </p>
          </div>
          
          <div className="flex flex-col items-center justify-center md:justify-end gap-3 w-full md:w-auto shrink-0">
            {/* Slide to Predict Component */}
            <div className="relative w-64 h-14 bg-white/20 backdrop-blur-md rounded-full overflow-hidden shadow-inner flex items-center justify-center border border-white/30">
              {isPredicting ? (
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {predictStage || (lang === 'id' ? 'Memproses AI...' : 'Processing AI...')}
                </div>
              ) : (
                <>
                  <span className="text-white/80 font-bold text-sm pl-12 pointer-events-none select-none">
                    {lang === 'id' ? 'Geser untuk Prediksi' : 'Slide to Predict'}
                  </span>
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 200 }}
                    dragElastic={0.1}
                    onDragEnd={(e, info) => {
                      if (info.offset.x > 150) {
                        handleRunPredict();
                      }
                    }}
                    className="absolute left-1 top-1 w-12 h-12 bg-white rounded-full flex items-center justify-center text-rose-600 shadow-md cursor-grab active:cursor-grabbing z-10"
                  >
                    <Wand2 className="w-5 h-5" />
                  </motion.div>
                </>
              )}
            </div>

            <div className="flex items-center justify-center md:justify-end gap-2 w-full opacity-80">
              <RefreshCw size={14} className="text-white" />
              <span className="text-[11px] font-medium text-white tracking-wide">
                <strong className="text-white">{lang === 'id' ? 'Terakhir update:' : 'Last updated:'}</strong> {lang === 'id' ? `jam ${new Date().toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', {hour: '2-digit', minute:'2-digit'})}` : `at ${new Date().toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', {hour: '2-digit', minute:'2-digit'})}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      """
    content = content[:start_idx] + new_header + content[end_idx:]

with open("/Volumes/Kerberos/Github-Repo/hq/Herd_Frontend/src/pages/EstrusPrediction.jsx", "w") as f:
    f.write(content)
