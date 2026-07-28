const fs = require('fs');
let code = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');

const mobileCode = `
      {/* ── MOBILE FULLSCREEN DETAIL MODAL (from dev-stage) ── */}
      <div className="md:hidden fixed inset-0 z-[50] bg-[#F3F4F6] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-20">
        {/* Header Photo */}
        <div className="sticky top-0 w-full h-[60vh] min-h-[450px] z-0">
          {selectedSapi.foto ? (
            <img 
              src={selectedSapi.foto} 
              alt={selectedSapi.nama} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="w-full h-full bg-gray-300 relative" />
          )}
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/40 to-transparent pointer-events-none" />
          
          {/* Photo Action Buttons if No Photo */}
          {!selectedSapi.foto && (
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                <div className="flex flex-col items-center mb-6">
                   <div className="bg-white/10 backdrop-blur-md p-4 rounded-full mb-3 border border-white/20 shadow-lg">
                      <Beef size={40} className="text-white/80" />
                   </div>
                   <p className="text-[13px] font-medium text-white/90 tracking-wide" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Belum ada foto</p>
                </div>
                <div className="flex items-center bg-white/20 backdrop-blur-md p-1 rounded-2xl border border-white/30 shadow-xl pointer-events-auto">
                   <label className="px-4 py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer active:scale-95 transition-transform flex items-center gap-2 hover:bg-white/10">
                     <Camera size={14} /> Ambil Foto
                     <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                        alert("Fitur upload foto segera hadir");
                     }} />
                   </label>
                   <div className="w-[1px] h-4 bg-white/30 mx-1" />
                   <label className="px-4 py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer active:scale-95 transition-transform flex items-center gap-2 hover:bg-white/10">
                     <ImagePlus size={14} /> Unggah Foto
                     <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        alert("Fitur upload foto segera hadir");
                     }} />
                   </label>
                </div>
             </div>
          )}
          
          {/* Top Bar / Back Button */}
          <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex justify-between items-start z-30">
            <button onClick={() => navigate('/ternak')} className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-800 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-white/50 active:scale-95 transition-transform">
              <ChevronLeft size={24} />
            </button>
            {/* Top Right Action Buttons */}
            <div className="flex gap-2">
              <button 
                onClick={() => alert("Gunakan mode desktop untuk mengedit data ternak.")}
                className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-800 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-white/50 active:scale-95 transition-transform"
              >
                <Edit2 size={24} />
              </button>
              <button 
                onClick={() => {
                  if (window.confirm("Yakin ingin menghapus sapi ini?")) {
                    hapusSapi(selectedSapi.id).then(() => { navigate('/ternak'); });
                  }
                }}
                className="p-2 bg-white/80 backdrop-blur-md rounded-full text-red-600 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-red-500/30 active:scale-95 transition-transform"
              >
                <Trash2 size={24} />
              </button>
            </div>
          </div>

          {/* Text Content at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-12 text-white">
             <div className="flex gap-2 mb-2 -ml-0.5">
                <span className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white border border-white/10 uppercase tracking-wider">
                  ID: #{selectedSapi.id || '--'}
                </span>
             </div>
             <h2 className="text-[36px] font-extrabold mb-1 tracking-tight leading-none" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
               {selectedSapi.nama || '--'}
             </h2>
             <p className="text-[13px] text-white/90 font-medium" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
               {selectedSapi.jenis || 'Sapi'} • {selectedSapi.bulan_tahun_lahir ? Math.floor((new Date() - new Date(selectedSapi.bulan_tahun_lahir))/(1000*60*60*24*30)) + ' Bulan' : '-- Bulan'}
             </p>
          </div>
        </div>

        {/* Scrollable Bottom Sheet Content */}
        <div className="relative z-10 bg-[#F3F4F6] min-h-[calc(100vh-200px)] -mt-6 rounded-t-[32px] shadow-[0_-12px_30px_rgba(0,0,0,0.1)] overflow-hidden">
          {/* Action Buttons — Tab Switchers */}
          <div className="px-4 py-5 grid grid-cols-4 gap-2 bg-white">
            <button 
              onClick={() => setActiveTab('riwayat')}
              className={\`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all \${
                activeTab === 'riwayat'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }\`}
            >
               <ActivityIcon size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Riwayat</span>
            </button>
            <button 
              onClick={() => setActiveTab('estrus')}
              className={\`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all \${
                activeTab === 'estrus'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }\`}
            >
               <CheckCircle size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Prediksi</span>
            </button>
            <button 
              onClick={() => setActiveTab('linimasa')}
              className={\`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all \${
                activeTab === 'linimasa'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }\`}
            >
               <Activity size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Linimasa</span>
            </button>
            <button 
              onClick={() => setActiveTab('analitik')}
              className={\`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all \${
                activeTab === 'analitik'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }\`}
            >
               <ThermometerSun size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Analitik</span>
            </button>
          </div>

          {/* Bottom Display Area */}
          <div className="px-5 pb-6 bg-white min-h-[500px]">
            {activeTab === 'riwayat' && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center mt-4 mb-2">
                   <h3 className="text-[17px] font-extrabold text-[#111]">Riwayat Ternak</h3>
                   <button className="group relative flex items-center gap-3 bg-white pr-5 pl-2 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-lg transition-all">
                     <div className="w-8 h-8 rounded-full bg-[#2E7D32] flex items-center justify-center text-white shadow-sm">
                       <Plus size={16} strokeWidth={2.5} />
                     </div>
                     <span className="text-sm font-bold text-gray-700">Catat</span>
                   </button>
                </div>
                
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Event</th>
                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedReproHistory.length > 0 ? (
                        sortedReproHistory.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-4">
                              <p className="font-bold text-gray-900 text-sm">IB Ke-{item.jumlah_ib || idx + 1}</p>
                              <p className="text-xs text-gray-500">{item.tanggal_ib || item.service_date || '-'}</p>
                            </td>
                            <td className="px-4 py-4">
                              <span className={\`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider \${item.results === true || item.results === 'true' ? 'bg-green-50 text-green-700 border border-green-100' : item.results === false || item.results === 'failed' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-gray-100 text-gray-600 border border-gray-200'}\`}>
                                {item.results === true || item.results === 'true' ? 'Bunting' : item.results === false || item.results === 'failed' ? 'Gagal' : 'Menunggu'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="2" className="px-4 py-12 text-center text-gray-400 text-sm font-medium">Belum ada riwayat reproduksi.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeTab === 'estrus' && (
              <div className="animate-in fade-in duration-300 mt-4">
                <CowEstrusView selectedCow={selectedSapi} reproHistory={sortedReproHistory} />
              </div>
            )}

            {activeTab === 'linimasa' && (
               <div className="animate-in fade-in duration-300 mt-4">
                 <h3 className="text-lg font-bold text-gray-900 mb-6">Log Aktivitas</h3>
                 <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[17px] before:-translate-x-px before:w-0.5 before:bg-gray-100">
                    <div className="text-center text-sm text-gray-400 py-12 border-2 border-dashed border-gray-100 rounded-2xl ml-8">
                      Tidak ada aktivitas terbaru.
                    </div>
                 </div>
               </div>
            )}

            {activeTab === 'analitik' && (
               <div className="animate-in fade-in duration-300 mt-4">
                 <CowAnalyticsView selectedCow={selectedSapi} />
               </div>
            )}
          </div>
        </div>
      </div>
`;

// Insert the mobileCode before the desktop wrapper
code = code.replace('<div className="flex-1 p-4 lg:p-6 max-w-[1400px] mx-auto w-full flex flex-col lg:flex-row gap-6">', mobileCode + '\n      {/* ── DESKTOP LAYOUT ── */}\n      <div className="hidden md:flex flex-1 p-4 lg:p-6 max-w-[1400px] mx-auto w-full flex-col lg:flex-row gap-6">');

// We also need to get hapusSapi from useTernakStore
code = code.replace('const { selectedSapi', 'const { hapusSapi, selectedSapi');

fs.writeFileSync('src/pages/DetailTernak.jsx', code);
