        {/* ── MOBILE FULLSCREEN DETAIL MODAL ── */}
        <div className="md:hidden fixed inset-0 z-[900] bg-[#F3F4F6] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-20">
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
                          if (e.target.files && e.target.files[0]) {
                             const url = URL.createObjectURL(e.target.files[0]);
                             setSelectedSapi({...selectedSapi, foto: url});
                          }
                       }} />
                     </label>
                     <div className="w-[1px] h-4 bg-white/30 mx-1" />
                     <label className="px-4 py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer active:scale-95 transition-transform flex items-center gap-2 hover:bg-white/10">
                       <ImagePlus size={14} /> Unggah Foto
                       <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                             const url = URL.createObjectURL(e.target.files[0]);
                             setSelectedSapi({...selectedSapi, foto: url});
                          }
                       }} />
                     </label>
                  </div>
               </div>
            )}
            
            {/* Top Bar / Back Button */}
            <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex justify-between items-start z-30">
              <button onClick={handleBack} className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-800 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-white/50 active:scale-95 transition-transform">
                <ChevronLeft size={24} />
              </button>
              {/* Top Right Action Buttons */}
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    let formattedLahir = '';
                    const lahir = selectedSapi.bulan_tahun_lahir;
                    if (lahir) {
                      if (/^\d{4}-\d{2}-\d{2}$/.test(lahir)) {
                        formattedLahir = lahir;
                      } else if (lahir.includes('/')) {
                        const parts = lahir.split('/');
                        if (parts.length === 3) {
                          formattedLahir = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                      } else {
                        const d = new Date(lahir);
                        if (!isNaN(d.getTime())) {
                          formattedLahir = d.toISOString().split('T')[0];
                        }
                      }
                    }
                    setEditForm({
                      rfid: selectedSapi.id || '',
                      nama: selectedSapi.nama || '',
                      jenis: selectedSapi.jenis || 'Simmental',
                      lahir: formattedLahir,
                      kesehatan: selectedSapi.status_kesehatan || 'Sehat',
                      kelamin: selectedSapi.kelamin || 'betina'
                    });
                    setIsEditModalOpen(true);
                  }}
                  className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-800 shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-white/50 active:scale-95 transition-transform"
                >
                  <Edit2 size={24} />
                </button>
                <button 
                  onClick={async () => {
                    const confirmed = await ask({
                      title: t.livestock_confirm_delete_title,
                      message: t.livestock_confirm_delete_msg.replace('{name}', selectedSapi.nama || selectedSapi.id),
                      confirmText: t.btn_delete,
                      cancelText: t.btn_cancel,
                      isDanger: true
                    });
                    if (confirmed) {
                      hapusSapi(selectedSapi.id).then((res) => {
                        if (res.success) {
                          handleBack();
                          toast.success(t.livestock_toast_delete_success);
                        } else {
                          toast.error(res.message || t.livestock_toast_delete_failed);
                        }
                      });
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
                    ID: #{selectedSapi.id}
                  </span>
               </div>
               <h2 className="text-[36px] font-extrabold mb-1 tracking-tight leading-none" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                 {selectedSapi.nama}
               </h2>
               <p className="text-[13px] text-white/90 font-medium" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                 {selectedSapi.jenis} • {hitungUsia(selectedSapi.bulan_tahun_lahir, lang)}
               </p>
            </div>
          </div>

          {/* Scrollable Bottom Sheet Content */}
          <div className="relative z-10 bg-[#F3F4F6] min-h-[calc(100vh-200px)] -mt-6 rounded-t-[32px] shadow-[0_-12px_30px_rgba(0,0,0,0.1)] overflow-hidden">
            {/* Action Buttons — Tab Switchers */}
            <div className="px-4 py-5 grid grid-cols-4 gap-2 bg-white">
              {/* Tab 1: Riwayat Ternak */}
            <button 
              onClick={() => setActiveDetailTab('riwayat')}
              className={`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'riwayat'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }`}
            >
               <ClipboardList size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Riwayat</span>
            </button>
            {/* Tab 2: Prediksi Estrus */}
            <button 
              onClick={() => setActiveDetailTab('estrus')}
              className={`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'estrus'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }`}
            >
               <Sparkles size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Prediksi</span>
            </button>
            {/* Tab 3: Linimasa */}
            <button 
              onClick={() => setActiveDetailTab('linimasa')}
              className={`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'linimasa'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }`}
            >
               <Activity size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Linimasa</span>
            </button>
            {/* Tab 4: Analitik */}
            <button 
              onClick={() => setActiveDetailTab('analitik')}
              className={`py-3 rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all ${
                activeDetailTab === 'analitik'
                  ? 'bg-[#2E7D32] text-white shadow-lg shadow-green-900/15'
                  : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
              }`}
            >
               <LineChart size={20} strokeWidth={2.5} />
               <span className="font-bold text-[10px] tracking-wide text-center leading-tight">Analitik</span>
            </button>
          </div>

          {/* Bottom Display Area */}
          {activeDetailTab === 'riwayat' ? (
            <>
              {/* Riwayat Ternak - Card Style */}
              <div className="px-5 pb-6 bg-white">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-[17px] font-extrabold text-[#111]">Riwayat Ternak</h3>
                   {(!sortedReproHistory.some(item => item.results === true || item.results === 'true' || item.is_pregnant === true)) && (
                     <button
                       onClick={() => {
                         const today = new Date().toISOString().split('T')[0];
                         const countIB = sortedReproHistory.filter(h => !h.metode || h.metode?.toLowerCase() === 'ib' || h.method?.toLowerCase() === 'ib').length + 1;
                         setReproForm(f => ({ ...f, tanggal_ib: today, jumlah_ib: countIB }));
                         setIsReproModalOpen(true);
                       }}
                       className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] transition-colors"
                     >
                       Catat IB
                     </button>
                   )}
                </div>

                {sortedReproHistory.length === 0 ? (
                  <div className="text-center text-sm text-[var(--text-3)] py-8">Belum ada riwayat.</div>
                ) : (
                  <div className="space-y-3">
                    {sortedReproHistory.map((item) => {
                      const isPregnant    = item.results === true || item.results === 'true' || item.is_pregnant === true;
                      const isFailed      = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                      const isNote        = item.catatan && !item.pemberi_ib && !item.metode;
                      const isPending     = !isPregnant && !isFailed && !isNote;
                      const rawDate       = item.tanggal_ib || item.service_date;
                      const estCalving    = rawDate && isPregnant
                        ? new Date(new Date(rawDate).getTime() + 283 * 24 * 60 * 60 * 1000)
                            .toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—';
                      const formattedDate = rawDate
                        ? new Date(rawDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—';
                      return (
                        <div key={item.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-extrabold text-[14px]" style={{ color: 'var(--text-1)' }}>
                                {(item.metode || 'IB').toUpperCase()} {item.jumlah_ib ? <span className="font-bold text-[12px] text-gray-500 ml-1.5">(Ke-{item.jumlah_ib})</span> : ''}
                              </p>
                              {(item.catatan || item.notes) && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{item.catatan || item.notes}</p>}
                            </div>
                            {isPregnant && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#ECFDF5] text-[#10B981] shrink-0 border border-[#10B981]/20">Bunting</span>}
                            {isFailed   && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#FEF2F2] text-[#EF4444] shrink-0 border border-[#EF4444]/20">Gagal</span>}
                            {isPending  && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#FFF8E1] text-[#F59E0B] shrink-0 border border-[#F59E0B]/20">Menunggu</span>}
                          </div>
                          {/* Detail rows */}
                          <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                            <div className="flex justify-between">
                              <span>Tanggal Kawin</span>
                              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{formattedDate}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Metode</span>
                              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{(item.metode || 'IB').toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Perkiraan Calving</span>
                              <span style={{ color: isPregnant ? 'var(--color-forest)' : 'var(--text-1)', fontWeight: isPregnant ? 700 : 600 }}>{estCalving}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Inseminator</span>
                              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{item.pemberi_ib || item.petugas || item.technician || '—'}</span>
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '0.5px solid var(--border)' }}>
                            {isPending && (
                              <>
                                <button
                                  onClick={() => confirmPregnancy(item, true)}
                                  disabled={confirmingPregnancy === item.id}
                                  className="flex-1 py-2.5 text-[13px] font-extrabold rounded-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-green-900/10 border border-green-500/30 backdrop-blur-md"
                                  style={{ background: 'rgba(46, 125, 50, 0.15)', color: '#2E7D32' }}
                                >
                                  {confirmingPregnancy === item.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={15} strokeWidth={2.5} />} Bunting
                                </button>
                                <button
                                  onClick={() => confirmPregnancy(item, false)}
                                  disabled={confirmingPregnancy === item.id}
                                  className="flex-1 py-2.5 text-[13px] font-extrabold rounded-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-red-900/10 border border-red-500/30 backdrop-blur-md"
                                  style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#DC2626' }}
                                >
                                  {confirmingPregnancy === item.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={15} strokeWidth={2.5} />} Gagal
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => startEditRepro(item)}
                              className="p-2 rounded-lg ml-auto text-gray-500 hover:bg-gray-100"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => deleteReproRecord(item)}
                              className="p-2 rounded-lg"
                              style={{ color: 'var(--red, #EF4444)', background: 'var(--bg-hover)' }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* Promo Banner */}
              <div className="px-5 pb-12 bg-white">
                <div className="bg-[#F5F8F6] p-5 rounded-[20px] border border-[#E8F0EA] flex gap-4 overflow-hidden relative">
                   <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#E8F0EA] rounded-full opacity-50 pointer-events-none" />
                   <div className="bg-[#E8F0EA] w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
                      <Activity size={22} className="text-[#2E7D32]" />
                   </div>
                   <div className="relative z-10">
                      <h4 className="text-[14px] font-bold text-[#111] mb-1">Pantau {selectedSapi.nama} 24/7</h4>
                      <p className="text-[11px] text-[#555] leading-relaxed mb-3 pr-2">Gunakan Smart Collar HERD untuk deteksi estrus otomatis dan monitoring kesehatan.</p>
                      <button className="text-[11px] font-bold text-[#2E7D32] flex items-center gap-1">Lihat Produk Sensor <ChevronRight size={14} /></button>
                   </div>
                </div>
              </div>
            </>
          ) : activeDetailTab === 'analitik' ? (
            <div className="px-5 pb-12 pt-2 bg-[#F3F4F6] min-h-[500px]">
              <CowAnalyticsView selectedCow={selectedSapi} />
            </div>
          ) : activeDetailTab === 'linimasa' ? (
            <div className="px-5 pb-12 pt-6 bg-[#F8FBF9] min-h-[500px]">
              <div className="mb-8">
                <h3 className="text-[20px] font-extrabold text-[#111]">Linimasa Aktivitas</h3>
                <p className="text-[13px] text-gray-500 mt-1">Jejak rekaman aktivitas personal untuk <strong className="text-[#2E7D32]">{selectedSapi.nama}</strong></p>
              </div>
              
              <Stepper orientation="vertical" defaultValue={2} className="w-full">
                <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[17px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#2E7D32]/20 before:to-transparent">
                  
                  {(() => {
                      if (!sortedReproHistory || sortedReproHistory.length === 0) {
                          return (
                              <div className="w-full text-center py-10 bg-white border border-[#E8F0EA] rounded-[16px] shadow-sm">
                                  <p className="text-[13px] text-gray-500">Belum ada data aktivitas untuk ternak ini.</p>
                              </div>
                          );
                      }
                      
                      const formatTglStr = (ts) => new Date(ts).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {day: 'numeric', month: 'short', year: 'numeric'});
                      const timelineEvents = [];
                      
                      sortedReproHistory.forEach(item => {
                          const isPregnant    = item.results === true || item.results === 'true' || item.is_pregnant === true;
                          const isFailed      = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                          const rawDate       = item.tanggal_ib || item.service_date;
                          if (!rawDate) return;
                          
                          const baseTime = new Date(rawDate).getTime();
                          const eventId = item.id || Math.random().toString();
                          
                          // Add Inseminasi Buatan event
                          timelineEvents.push({
                              id: eventId + '-ib',
                              title: `Inseminasi Buatan (Ke-${item.jumlah_ib || 1})`,
                              dateRaw: baseTime,
                              dateFmt: formatTglStr(baseTime),
                              desc: `Metode: ${(item.metode || 'IB').toUpperCase()}${item.pemberi_ib ? `. Inseminator: ${item.pemberi_ib}` : ''}`,
                              status: isPregnant ? 'completed' : (isFailed ? 'failed' : 'active')
                          });
                          
                          // If pregnant, extrapolate future events
                          if (isPregnant) {
                              const pkbTime = baseTime + 60 * 24 * 60 * 60 * 1000;
                              const isPkbPast = pkbTime < Date.now();
                              timelineEvents.push({
                                  id: eventId + '-pkb',
