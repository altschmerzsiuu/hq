const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

// 1. Imports
content = content.replace(
  "import { useState, useEffect, useRef } from 'react';",
  "import { useState, useEffect, useRef } from 'react';\nimport { createPortal } from 'react-dom';"
);
content = content.replace("import StatsDrawer from '@/components/shared/StatsDrawer';\n", "");

// 2. State replacements
content = content.replace(
  "const [drawerData, setDrawerData] = useState({ isOpen: false, type: 'pantau', data: [] });",
  "const [activePopover, setActivePopover] = useState(null);"
);
// Remove handleExportPDF and statusMessage
content = content.replace(/const handleExportPDF[\s\S]*?};\n\n  useEffect/g, "useEffect");
content = content.replace(/let statusMessage[\s\S]*?const userName/g, "const userName");

// 3. Greeting container (remove overflow-hidden and wrap Sun)
content = content.replace(
  /className="rounded-t-none rounded-b-\[40px\] p-6 pt-\[76px\] shadow-lg relative overflow-hidden mb-2 text-white flex flex-col justify-between -mx-4 md:-mx-\[22px\]"/g,
  `className="rounded-t-none rounded-b-[40px] p-6 pt-[76px] shadow-lg relative mb-2 text-white flex flex-col justify-between -mx-4 md:-mx-[22px]"`
);
content = content.replace(
  /<Sun[\s\S]*?\/>/,
  `<div className="absolute inset-0 overflow-hidden rounded-b-[40px] pointer-events-none">
            <Sun 
              size={180} 
              strokeWidth={1} 
              className="absolute -top-10 -right-10 text-white opacity-5 rotate-12" 
            />
          </div>`
);

// 4. Wrap root div with onClick for popover
content = content.replace(
  `<div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>`,
  `<div onClick={() => setActivePopover(null)} className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>`
);

// 5. Replace stats section
const oldStats = `<div className="flex items-center mt-8">
            <button 
              onClick={() => setDrawerData({ isOpen: true, type: 'pantau', data: herd.filter(c => c.collar_id) })}
              className="flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
            >
              <div className="text-[40px] font-black leading-none">{stats.collars}</div>
              <div className="text-[13px] font-medium mt-1 opacity-90">{lang === 'id' ? 'Ternak dipantau' : 'Cows monitored'}</div>
            </button>
            <div className="w-px h-14 bg-white/30 mx-4 md:mx-6"></div>
            <button 
              onClick={() => setDrawerData({ isOpen: true, type: 'action', data: intel.filter(i => i.urgency === 'critical' || i.urgency === 'monitor') })}
              className="flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
            >
              <div className="text-[40px] font-black leading-none">{intel.filter(i => i.urgency === 'critical' || i.urgency === 'monitor').length}</div>
              <div className="text-[13px] font-medium mt-1 opacity-90">{lang === 'id' ? 'Perlu tindakan' : 'Action needed'}</div>
            </button>
          </div>`;

const newStats = `<div className="flex items-center gap-3 mt-8 relative z-20">
            <div className="flex-1 relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover(activePopover === 'pantau' ? null : 'pantau');
                }}
                className="w-full text-left p-3.5 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-2xl transition-all cursor-pointer focus:outline-none shadow-sm flex flex-col"
              >
                <div className="text-[34px] font-black leading-none">{stats.collars}</div>
                <div className="text-[12px] font-medium text-white/90 mt-1">{lang === 'id' ? 'Ternak dipantau' : 'Monitored cows'}</div>
              </button>
              {activePopover === 'pantau' && (
                <div 
                  className="absolute top-full left-0 mt-4 w-72 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="max-h-64 overflow-y-auto p-3 flex flex-col gap-2">
                    {herd.filter(c => c.collar_id).map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--bg-card)]">
                        <div>
                          <p className="text-sm font-bold text-[var(--text-1)] m-0">{c.nama || c.cow_name || (c.cow_id ? \`Cow #\${c.cow_id.slice(0,6)}\` : 'Sapi')}</p>
                          <p className="text-xs text-[var(--accent)] font-medium m-0">Aktif</p>
                        </div>
                      </div>
                    ))}
                    {herd.filter(c => c.collar_id).length === 0 && (
                      <p className="text-xs text-center text-[var(--text-3)] py-4 m-0">Tidak ada data</p>
                    )}
                  </div>
                  <div className="border-t border-[var(--border)] p-2">
                    <button 
                      onClick={() => navigate('/ternak')}
                      className="w-full py-2 text-xs font-bold text-[var(--text-1)] bg-[var(--bg-card)] rounded-xl hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-1"
                    >
                      Lihat Lebih Lanjut <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover(activePopover === 'action' ? null : 'action');
                }}
                className="w-full text-left p-3.5 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-2xl transition-all cursor-pointer focus:outline-none shadow-sm flex flex-col"
              >
                <div className="text-[34px] font-black leading-none">{intel.filter(i => i.urgency === 'critical' || i.urgency === 'monitor').length}</div>
                <div className="text-[12px] font-medium text-white/90 mt-1">{lang === 'id' ? 'Perlu tindakan' : 'Action needed'}</div>
              </button>
              {activePopover === 'action' && (
                <div 
                  className="absolute top-full left-0 mt-4 w-72 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="max-h-64 overflow-y-auto p-3 flex flex-col gap-2">
                    {intel.filter(i => i.urgency === 'critical' || i.urgency === 'monitor').map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--bg-card)]">
                        <div>
                          <p className="text-sm font-bold text-[var(--text-1)] m-0">{c.cow_name || (c.cow_id ? \`Cow #\${c.cow_id.slice(0,6)}\` : c.title.split('—')[0].trim())}</p>
                          <p className={\`text-xs font-medium m-0 \${c.urgency === 'critical' ? "text-[var(--red)]" : "text-[var(--amber)]"}\`}>
                            {c.urgency === 'critical' ? 'Kritis' : 'Perhatian'}
                          </p>
                        </div>
                      </div>
                    ))}
                    {intel.filter(i => i.urgency === 'critical' || i.urgency === 'monitor').length === 0 && (
                      <p className="text-xs text-center text-[var(--text-3)] py-4 m-0">Tidak ada data</p>
                    )}
                  </div>
                  <div className="border-t border-[var(--border)] p-2">
                    <button 
                      onClick={() => navigate('/ternak')}
                      className="w-full py-2 text-xs font-bold text-[var(--text-1)] bg-[var(--bg-card)] rounded-xl hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-1"
                    >
                      Lihat Lebih Lanjut <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>`;
content = content.replace(oldStats, newStats);

// 6. Fix RecommendationCard component
const oldRecCard = `// ── RECOMMENDATION CARD ──────────────────────────────────────
function RecommendationCard({ title, badgeText, id, name, daysLeft, icon: Icon, message }) {
  const actionName = title.split('—')[1]?.trim() || title;
  const displayTitle = \`\${name} | \${id}\`;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:border-[#2f7d31]/30 transition-all cursor-pointer relative">
      <span className="absolute top-4 right-4 text-[10px] font-bold text-blue-600 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
        {badgeText}
      </span>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-blue-500" />
        </div>
        <div className="flex flex-col flex-1 min-w-0 pr-16">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-bold text-gray-900 font-display truncate">{displayTitle}</h4>
          </div>
          <p className="text-xs text-gray-600 font-medium mb-1.5">
            {actionName} • Dalam {daysLeft} hari
          </p>
          {message && (
            <p className="text-[11px] text-gray-700 leading-snug">
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="h-px w-full bg-gray-100 my-1" />

      <div className="flex items-center justify-between gap-2">
        <button className="flex items-center gap-2 bg-[#2f7d31] hover:bg-[#007b46] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">
          <Check size={14} /> Selesai
        </button>
        <button className="flex items-center justify-center w-8 h-8 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}`;

const newRecCard = `// ── RECOMMENDATION CARD ──────────────────────────────────────
function RecommendationCard({ title, badgeText, id, name, daysLeft, icon: Icon, message, cow_id }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const actionName = title.split('—')[1]?.trim() || title;
  const displayTitle = id ? \`\${name} | \${id}\` : name;

  const handleAction = (e) => {
    e.stopPropagation();
    toast.success('Melanjutkan tindakan rekomendasi sistem...');
    
    if (cow_id) {
      navigate('/ternak', { state: { selectedCowId: cow_id } });
    } else {
      navigate('/ternak');
    }
  };

  const handleFinish = (e) => {
    e.stopPropagation();
    toast.success('Tugas ditandai selesai!');
    setIsExpanded(false);
  };

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col shadow-sm hover:border-[#2f7d31]/30 transition-all cursor-pointer relative overflow-hidden"
    >
      <span className="absolute top-4 right-4 text-[10px] font-bold text-blue-600 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
        {badgeText}
      </span>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-blue-500" />
        </div>
        <div className="flex flex-col flex-1 min-w-0 pr-16">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-bold text-gray-900 font-display truncate">{displayTitle}</h4>
          </div>
          <p className="text-xs text-gray-600 font-medium mb-1.5 flex items-center gap-1">
            {actionName} • Dalam {daysLeft} hari
          </p>
          {!isExpanded && (
            <p className="text-[10px] text-[var(--color-primary)] font-semibold mt-1 opacity-80 flex items-center gap-1">
              Ketuk untuk detail <ChevronRight size={10} />
            </p>
          )}
        </div>
      </div>

      <div 
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr', opacity: isExpanded ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          {message && (
            <div className="mt-3 text-[11px] text-gray-700 leading-snug">
              {message}
            </div>
          )}
          <div className="h-px w-full bg-gray-100 my-3" />
          <div className="flex items-center justify-between gap-2">
            <button 
              onClick={handleFinish}
              className="flex items-center gap-2 bg-[#2f7d31] hover:bg-[#007b46] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <Check size={14} /> Selesai
            </button>
            <button 
              onClick={handleAction}
              className="flex items-center justify-center w-8 h-8 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}`;
content = content.replace(oldRecCard, newRecCard);

// 7. Render Recommendations natively without Slice
content = content.replace(
  /<div style={{ display: 'flex', alignItems: 'center', justify[\s\S]*?Semua kondisi ternak hari ini dalam keadaan baik. Tidak ada rekomendasi tambahan untuk saat ini.\n              <\/div>\n            \)}/,
  `<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p className="eyebrow" style={{ marginBottom: 0 }}>REKOMENDASI LAINNYA</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {intel.filter(card => card.urgency === 'scheduled').length > 0 ? (
              <>
                {intel.filter(card => card.urgency === 'scheduled')
                  .map((card, i) => {
                  const cowName = card.title.split('—')[0].trim() || 'Ternak';
                  let friendlyMsg = '';
                  if (card.title.toLowerCase().includes('kebuntingan')) {
                    friendlyMsg = \`Update kebuntingan \${cowName} perlu dicatat. Sebaiknya diperbarui sekarang agar data kehamilan tetap akurat dan bisa diprediksi dengan baik.\`;
                  } else if (card.title.toLowerCase().includes('inseminasi')) {
                    friendlyMsg = \`Jadwal inseminasi \${cowName} sudah tiba. Pastikan persiapan sudah matang agar peluang kebuntingan maksimal.\`;
                  } else if (card.title.toLowerCase().includes('estrus') || card.title.toLowerCase().includes('birahi')) {
                    friendlyMsg = \`\${cowName} menunjukkan tanda birahi. Waktu terbaik untuk inseminasi adalah 12–18 jam ke depan, jangan sampai terlewat.\`;
                  } else {
                    friendlyMsg = \`Ada hal yang perlu kamu tindak lanjuti untuk \${cowName}. Sebaiknya segera dicek agar tidak terlewat.\`;
                  }
                  return (
                    <RecommendationCard
                      key={i}
                      title={card.title}
                      badgeText="SEDANG"
                      id={card.cow_id ? \`C\${card.cow_id.slice(0,4).toUpperCase()}A\` : \`C\${Math.floor(Math.random() * 9000) + 1000}A\`}
                      name={cowName}
                      daysLeft={Math.floor(Math.random() * 10) + 1}
                      icon={card.icon}
                      message={friendlyMsg}
                      cow_id={card.cow_id}
                    />
                  );
                })}
              </>
            ) : (
              <div style={{
                padding: '14px', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                borderRadius: '10px', fontSize: '13px', color: 'var(--text-2)', textAlign: 'center'
              }}>
                Semua kondisi ternak hari ini dalam keadaan baik. Tidak ada rekomendasi tambahan untuk saat ini.
              </div>
            )`
);

// 8. Portals
// Wrap all modals at the end in createPortal
const modalsIndex = content.indexOf('{/* MODAL: Tambah Reproduksi */}');
if (modalsIndex !== -1) {
  const beforeModals = content.substring(0, modalsIndex);
  let modalsBlock = content.substring(modalsIndex);
  
  // Remove StatsDrawer
  modalsBlock = modalsBlock.replace(/<StatsDrawer[\s\S]*?\/>/, '');
  
  // Replace the closing tags properly
  modalsBlock = modalsBlock.replace("      </div>\n    </div>\n  );\n}", "      </div>\n    </div>\n  </>,\n  document.body\n)}\n  );\n}");
  
  content = beforeModals + "{createPortal(\n  <>\n" + modalsBlock;
}

fs.writeFileSync('src/pages/Dashboard.jsx', content);
