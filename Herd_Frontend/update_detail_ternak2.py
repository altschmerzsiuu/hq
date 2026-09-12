import re

with open("/Volumes/Kerberos/Github-Repo/hq/Herd_Frontend/src/pages/DetailTernak.jsx", "r") as f:
    content = f.read()

# 1. Update the Mobile Tabs Rendering Logic
start_marker = "{/* Bottom Display Area */}"
end_marker = "{/* RIGHT COLUMN: Workspace Area */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers for mobile rendering.")
    exit(1)

new_mobile_code = """{/* Bottom Display Area */}
          {activeDetailTab === 'catatan' ? (
            <>
              {/* Catatan Ternak (Active Cycle) */}
              <div className="px-5 pb-6 bg-white min-h-[500px]">
                <div className="flex justify-between items-center mb-4 gap-4 mt-2">
                   <h3 className="text-[17px] font-extrabold text-[#111] whitespace-nowrap">{lang === 'id' ? 'Catatan Ternak' : 'Cattle Records'}</h3>
                   {(!sortedReproHistory.some(item => item.results === true || item.results === 'true' || item.is_pregnant === true)) && (
                     <button
                       onClick={openCatatIB}
                       className="flex-1 flex items-center justify-center gap-1.5 rounded-full transition-transform active:scale-95 shadow-sm border border-[#E8F0EA] bg-[#F5F8F6] text-[#2E7D32]"
                       style={{ padding: '8px 16px' }}
                     >
                       <Plus size={16} />
                       <span className="font-bold text-[13px]">Catat IB</span>
                     </button>
                   )}
                </div>

                {reproCycles.length === 0 ? (
                  <div className="text-center text-sm text-[var(--text-3)] py-8">Belum ada catatan.</div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h4 className="font-bold text-[13px] text-gray-800">
                          {lang === 'id' ? 'Siklus Saat Ini' : 'Current Cycle'}
                        </h4>
                        <span className="text-[11px] font-semibold text-gray-500">{reproCycles[0].length} IB</span>
                      </div>
                      <div className="p-3 space-y-3">
                        {reproCycles[0].map((item) => {
                          const isPregnant    = item.results === true || item.results === 'true' || item.is_pregnant === true;
                          const isFailed      = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                          const isNote        = item.catatan && !item.pemberi_ib && !item.metode;
                          const isPending     = !isPregnant && !isFailed && !isNote;
                          const rawDate       = item.tanggal_ib || item.service_date;
                          const estCalving    = rawDate && isPregnant
                            ? new Date(new Date(rawDate).getTime() + 283 * 24 * 60 * 60 * 1000).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—';
                          const formattedDate = rawDate
                            ? new Date(rawDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—';
                          return (
                            <div key={item.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="font-extrabold text-[14px]" style={{ color: 'var(--text-1)' }}>
                                    {(item.metode || 'IB').toUpperCase()} {item.jumlah_ib ? <span className="font-bold text-[12px] text-gray-500 ml-1.5">(Ke-{item.jumlah_ib})</span> : ''}
                                  </p>
                                </div>
                                {isPregnant && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#ECFDF5] text-[#10B981] shrink-0 border border-[#10B981]/20">Bunting</span>}
                                {isFailed   && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#FEF2F2] text-[#EF4444] shrink-0 border border-[#EF4444]/20">Gagal</span>}
                                {isPending  && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#FFF8E1] text-[#F59E0B] shrink-0 border border-[#F59E0B]/20">Menunggu</span>}
                              </div>
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
                                {(item.catatan && item.catatan.trim() !== '') && (
                                  <div className="flex flex-col mt-2 pt-2" style={{ borderTop: '0.5px dashed var(--border)' }}>
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Catatan</span>
                                    <span className="text-sm text-gray-700">{item.catatan}</span>
                                  </div>
                                )}
                              </div>
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
                                <div className="flex items-center gap-2 ml-auto">
                                  <MobileAnimatedBtn icon={Pencil} label="Edit" onClick={() => startEditRepro(item)} />
                                  <MobileAnimatedBtn icon={Trash2} label="Hapus" danger onClick={() => deleteReproRecord(item)} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : activeDetailTab === 'estrus' ? (
            <div className="px-5 pb-12 pt-6 bg-[#F8FBF9] min-h-[500px]">
              <EstrusPrediction cowId={selectedSapi.id} sapiList={[selectedSapi]} hideHeader />
            </div>
          ) : activeDetailTab === 'riwayat' ? (
            <>
              {/* Riwayat Ternak (All Cycles) */}
              <div className="px-5 pb-6 bg-[#F8FBF9] min-h-[500px]">
                <div className="flex justify-between items-center mb-4 gap-4 mt-2">
                   <h3 className="text-[17px] font-extrabold text-[#111] whitespace-nowrap">{lang === 'id' ? 'Riwayat Ternak' : 'Cattle History'}</h3>
                   <div className="relative inline-flex items-center group flex-1">
                      <select 
                        value={reproFilter}
                        onChange={(e) => setReproFilter(e.target.value)}
                        className="appearance-none outline-none text-sm font-semibold border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32] py-2 pl-3 pr-9 w-full bg-white text-gray-800 hover:border-gray-300 transition-colors cursor-pointer"
                      >
                        <option value="semua_riwayat">{lang === 'id' ? 'Semua Riwayat' : 'All History'}</option>
                        {reproCycles.map((_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? (lang === 'id' ? 'Siklus Saat Ini' : 'Current Cycle') : (lang === 'id' ? `Siklus ${reproCycles.length - i}` : `Cycle ${reproCycles.length - i}`)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {reproCycles.length === 0 ? (
                  <div className="text-center text-sm text-[var(--text-3)] py-8">Belum ada riwayat.</div>
                ) : (
                  <div className="space-y-6 mt-4">
                    {reproCycles.map((cycle, cycleIndex) => {
                      if (reproFilter !== 'semua_riwayat' && parseInt(reproFilter) !== cycleIndex) return null;
                      return (
                      <div key={cycleIndex} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                          <h4 className="font-bold text-[13px] text-gray-800">
                            {cycleIndex === 0 ? (lang === 'id' ? 'Siklus Saat Ini' : 'Current Cycle') : (lang === 'id' ? `Siklus ${reproCycles.length - cycleIndex}` : `Cycle ${reproCycles.length - cycleIndex}`)}
                          </h4>
                          <span className="text-[11px] font-semibold text-gray-500">{cycle.length} IB</span>
                        </div>
                        <div className="p-3 space-y-3">
                          {cycle.map((item) => {
                            const isPregnant    = item.results === true || item.results === 'true' || item.is_pregnant === true;
                            const isFailed      = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                            const isNote        = item.catatan && !item.pemberi_ib && !item.metode;
                            const isPending     = !isPregnant && !isFailed && !isNote;
                            const rawDate       = item.tanggal_ib || item.service_date;
                            const estCalving    = rawDate && isPregnant
                              ? new Date(new Date(rawDate).getTime() + 283 * 24 * 60 * 60 * 1000).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—';
                            const formattedDate = rawDate
                              ? new Date(rawDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—';
                            return (
                              <div key={item.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <p className="font-extrabold text-[14px]" style={{ color: 'var(--text-1)' }}>
                                      {(item.metode || 'IB').toUpperCase()} {item.jumlah_ib ? <span className="font-bold text-[12px] text-gray-500 ml-1.5">(Ke-{item.jumlah_ib})</span> : ''}
                                    </p>
                                  </div>
                                  {isPregnant && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#ECFDF5] text-[#10B981] shrink-0 border border-[#10B981]/20">Bunting</span>}
                                  {isFailed   && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#FEF2F2] text-[#EF4444] shrink-0 border border-[#EF4444]/20">Gagal</span>}
                                  {isPending  && <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#FFF8E1] text-[#F59E0B] shrink-0 border border-[#F59E0B]/20">Menunggu</span>}
                                </div>
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
                                  {(item.catatan && item.catatan.trim() !== '') && (
                                    <div className="flex flex-col mt-2 pt-2" style={{ borderTop: '0.5px dashed var(--border)' }}>
                                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Catatan</span>
                                      <span className="text-sm text-gray-700">{item.catatan}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </>
          ) : null}
          """

# Now desktop block
desktop_start_marker = "{/* Tab Content */}"
desktop_end_marker = "{/* Birth Confirmation Modal */}"
d_start_idx = content.find(desktop_start_marker)
d_end_idx = content.find(desktop_end_marker)

if d_start_idx == -1 or d_end_idx == -1:
    print("Could not find markers for desktop rendering.")
    exit(1)

new_desktop_code = """{/* Tab Content */}
            <div className="bg-white rounded-b-[20px] shadow-sm p-6 min-h-[400px] flex-1">
              {activeTab === 'catatan' && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">{lang === 'id' ? 'Catatan Ternak (Siklus Saat Ini)' : 'Cattle Records'}</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {(!sortedReproHistory.some(item => item.results === true || item.results === 'true' || item.is_pregnant === true)) && (
                        <div className="shrink-0 ml-2">
                          <DesktopAnimatedBtn icon={Plus} label={lang === 'id' ? 'Catat Inseminasi' : 'Record AI'} onClick={openCatatIB} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="overflow-auto max-h-[500px] rounded-2xl border border-gray-100 relative shadow-inner mt-2">
                    <table className="w-full text-center border-collapse">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">IB #</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">Tanggal</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">Status</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {reproCycles.length === 0 ? (
                           <tr><td colSpan="4" className="py-12 text-gray-400 font-medium">Belum ada catatan.</td></tr>
                        ) : (
                          reproCycles[0].map((item) => {
                            const isPregnant = item.results === true || item.results === 'true' || item.is_pregnant === true;
                            const isFailed   = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                            const isNote     = item.catatan && !item.pemberi_ib && !item.metode;
                            const isPending  = !isPregnant && !isFailed && !isNote;
                            const dateObj    = new Date(item.tanggal_ib || item.service_date);
                            const tglStr     = dateObj.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                            return (
                              <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                  {item.jumlah_ib ? `IB Ke-${item.jumlah_ib}` : '—'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-600">{tglStr}</td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  {isPregnant ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle size={14}/> Bunting</span>
                                  ) : isFailed ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><XCircle size={14}/> Gagal</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><Clock size={14}/> Menunggu</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex items-center justify-center gap-3">
                                    {isPending && (
                                      <>
                                        <button onClick={() => confirmPregnancy(item, true)} className="text-green-600 hover:text-green-800 p-1.5 hover:bg-green-50 rounded-lg transition-colors" title="Konfirmasi Bunting"><CheckCircle size={18} /></button>
                                        <button onClick={() => confirmPregnancy(item, false)} className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Konfirmasi Gagal"><XCircle size={18} /></button>
                                      </>
                                    )}
                                    <button onClick={() => startEditRepro(item)} className="text-gray-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit"><Pencil size={16} /></button>
                                    <button onClick={() => deleteReproRecord(item)} className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><Trash2 size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'estrus' && (
                <div className="animate-in fade-in duration-300 min-h-[500px]">
                  <EstrusPrediction cowId={selectedSapi.id} sapiList={[selectedSapi]} hideHeader />
                </div>
              )}

              {activeTab === 'riwayat' && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">{lang === 'id' ? 'Riwayat Reproduksi Sapi' : 'Reproduction History'}</h3>
                      <div className="relative inline-flex items-center group w-fit">
                        <select 
                          value={reproFilter}
                          onChange={(e) => setReproFilter(e.target.value)}
                          className="appearance-none outline-none text-sm font-semibold border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32] py-2 pl-3 pr-9 bg-white text-gray-800 hover:border-gray-300 transition-colors cursor-pointer"
                        >
                          <option value="semua_riwayat">{lang === 'id' ? 'Semua Riwayat' : 'All History'}</option>
                          {reproCycles.map((_, i) => (
                            <option key={i} value={i}>
                              {i === 0 ? (lang === 'id' ? 'Siklus Saat Ini' : 'Current Cycle') : (lang === 'id' ? `Siklus ${reproCycles.length - i}` : `Cycle ${reproCycles.length - i}`)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 w-4 h-4 text-gray-400 group-hover:text-gray-600 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-white border border-gray-100 shadow-sm rounded-xl px-4 py-2 flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{lang === 'id' ? 'Total Siklus' : 'Total Cycles'}</span>
                        <span className="text-xl font-black text-gray-900">{reproCycles.length}</span>
                      </div>
                      <div className="bg-green-50/50 border border-green-100 shadow-sm rounded-xl px-4 py-2 flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{lang === 'id' ? 'Siklus Berhasil' : 'Successful Cycles'}</span>
                        <span className="text-xl font-black text-green-700">{reproCycles.filter(c => c.some(i => i.is_pregnant === true || i.results === true)).length}</span>
                      </div>
                      <div className="bg-red-50/50 border border-red-100 shadow-sm rounded-xl px-4 py-2 flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{lang === 'id' ? 'Siklus Gagal' : 'Failed Cycles'}</span>
                        <span className="text-xl font-black text-red-700">{reproCycles.filter(c => c.some(i => i.is_pregnant === false || i.results === false)).length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-auto max-h-[500px] rounded-2xl border border-gray-100 relative shadow-inner mt-2">
                    <table className="w-full text-center border-collapse">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">Siklus</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">IB #</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">Tanggal</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 shadow-sm">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {reproCycles.map((cycle, cycleIndex) => {
                          if (reproFilter !== 'semua_riwayat' && parseInt(reproFilter) !== cycleIndex) return null;
                          return cycle.map((item, idx) => {
                            const isPregnant = item.results === true || item.results === 'true' || item.is_pregnant === true;
                            const isFailed   = item.results === false || item.results === 'failed' || item.is_pregnant === false;
                            const isNote     = item.catatan && !item.pemberi_ib && !item.metode;
                            const isPending  = !isPregnant && !isFailed && !isNote;
                            const dateObj    = new Date(item.tanggal_ib || item.service_date);
                            const tglStr     = dateObj.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                            return (
                              <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                {idx === 0 && (
                                  <td rowSpan={cycle.length} className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900 border-r border-gray-100">
                                    {cycleIndex === 0 ? 'Siklus Saat Ini' : `Siklus ${reproCycles.length - cycleIndex}`}
                                  </td>
                                )}
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                  {item.jumlah_ib ? `IB Ke-${item.jumlah_ib}` : '—'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-600">{tglStr}</td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  {isPregnant ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle size={14}/> Bunting</span>
                                  ) : isFailed ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><XCircle size={14}/> Gagal</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><Clock size={14}/> Menunggu</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })}
                        {reproCycles.length === 0 && (
                           <tr><td colSpan="4" className="py-12 text-gray-400 font-medium">Belum ada riwayat reproduksi.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Birth Confirmation Modal */}"""

new_content = content[:start_idx] + new_mobile_code + content[end_idx:d_start_idx] + new_desktop_code + content[d_end_idx:]

with open("/Volumes/Kerberos/Github-Repo/hq/Herd_Frontend/src/pages/DetailTernak.jsx", "w") as f:
    f.write(new_content)

print("Done updating DetailTernak.jsx")

