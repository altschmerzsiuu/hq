import re

with open("/Volumes/Kerberos/Github-Repo/hq/Herd_Frontend/src/components/shared/CowEstrusView.jsx", "r") as f:
    content = f.read()

# Add motion hooks import if missing
if 'useMotionValue' not in content:
    content = content.replace("import { motion } from 'framer-motion';", "import { motion, useMotionValue, useTransform } from 'framer-motion';")
    if "import { motion, AnimatePresence } from 'framer-motion';" in content:
        content = content.replace("import { motion, AnimatePresence } from 'framer-motion';", "import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';")

# Find the empty prediction state block
start_marker = "{!prediction ? ("
end_marker = ") : ("

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    old_block = content[start_idx:end_idx]
    
    new_block = """{!prediction ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-[24px] border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <BrainCircuit size={40} className="text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {lang === 'id' ? 'Belum Ada Prediksi Birahi' : 'No Estrus Prediction Yet'}
          </h3>
          <p className="text-gray-500 max-w-sm mb-8 leading-relaxed">
            {lang === 'id' ? 'Jalankan AI untuk menganalisis siklus birahi sapi ini berdasarkan data historis dan sensor.' : 'Run AI to analyze this cow\\'s estrus cycle based on historical and sensor data.'}
          </p>
          
          {/* Slide to Predict Component */}
          <div className="relative w-64 h-14 bg-gray-100 rounded-full overflow-hidden shadow-inner flex items-center justify-center border border-gray-200">
            {isPredicting ? (
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                {lang === 'id' ? 'Memproses AI...' : 'Processing AI...'}
              </div>
            ) : (
              <>
                <span className="text-gray-400 font-bold text-sm pl-12 pointer-events-none select-none">
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
                  className="absolute left-1 top-1 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md cursor-grab active:cursor-grabbing z-10"
                >
                  <Wand2 className="w-5 h-5" />
                </motion.div>
              </>
            )}
          </div>
        </div>
      """
    content = content[:start_idx] + new_block + content[end_idx:]

with open("/Volumes/Kerberos/Github-Repo/hq/Herd_Frontend/src/components/shared/CowEstrusView.jsx", "w") as f:
    f.write(content)
