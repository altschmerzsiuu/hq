const fs = require('fs');
let code = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');

// Replace Catat button with AnimatedQAButton
const animatedQAButtonCode = `// ── ANIMATED QUICK ACTION BUTTON ──
function AnimatedQAButton({ icon: Icon, label, onClick, colorClass = "var(--color-primary)" }) {
  const spanRef = React.useRef(null);
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center rounded-full bg-white border border-gray-200 shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md"
      style={{ padding: '11px', gap: 0 }}
      onMouseEnter={e => {
        e.currentTarget.style.paddingLeft = '18px';
        e.currentTarget.style.paddingRight = '18px';
        e.currentTarget.style.gap = '8px';
        e.currentTarget.style.background = colorClass;
        e.currentTarget.style.borderColor = colorClass;
        if (spanRef.current) { spanRef.current.style.fontSize = '13px'; spanRef.current.style.color = '#fff'; }
        const icon = e.currentTarget.querySelector('svg');
        if (icon) icon.style.color = '#fff';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.paddingLeft = '11px';
        e.currentTarget.style.paddingRight = '11px';
        e.currentTarget.style.gap = '0';
        e.currentTarget.style.background = 'white';
        e.currentTarget.style.borderColor = '#e5e7eb';
        if (spanRef.current) { spanRef.current.style.fontSize = '0px'; spanRef.current.style.color = 'transparent'; }
        const icon = e.currentTarget.querySelector('svg');
        if (icon) icon.style.color = '#4b5563';
      }}
    >
      <Icon size={20} className="text-gray-600 transition-colors duration-300" />
      <span
        ref={spanRef}
        className="font-bold transition-all duration-300 whitespace-nowrap overflow-hidden"
        style={{ fontSize: '0px', color: 'transparent', lineHeight: '1' }}
      >
        {label}
      </span>
    </button>
  );
}
`;

if (!code.includes('function AnimatedQAButton')) {
  code = code.replace('export default function DetailTernak() {', animatedQAButtonCode + '\nexport default function DetailTernak() {');
}

// Replace the old Catat button
code = code.replace(
  /<button className="group relative flex items-center gap-3 bg-white pr-5 pl-2 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-lg transition-all">[\s\S]*?<\/button>/,
  '<AnimatedQAButton icon={Plus} label="Catat Inseminasi" onClick={() => {}} />'
);

// Add edit pencil icon to table rows
code = code.replace(
  '<p className="text-xs text-gray-500">{item.tanggal_ib || item.service_date || \'-\'}</p>\n                            </td>',
  '<p className="text-xs text-gray-500">{item.tanggal_ib || item.service_date || \'-\'}</p>\n                            </td>\n                            <td className="px-4 py-4 w-10">\n                              <button className="p-2 bg-gray-50 hover:bg-white text-gray-400 hover:text-gray-900 rounded-full border border-gray-200 shadow-sm transition-all">\n                                <Edit2 size={14} />\n                              </button>\n                            </td>'
);

// Add empty <th> for the edit column
code = code.replace(
  '<th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>\n                      </tr>',
  '<th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>\n                        <th className="px-4 py-3 w-10"></th>\n                      </tr>'
);
// Fix colspan
code = code.replace('colSpan="2"', 'colSpan="3"');

// Fix max height on Profile Card container to prevent overflow
code = code.replace(
  'className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden sticky top-6"',
  'className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto no-scrollbar"'
);

// Fix Edit and Delete buttons on Desktop profile card
code = code.replace(
  '<div className="absolute top-4 right-4 flex gap-2 z-20">\n              <button className="p-2 bg-white/80 hover:bg-white text-gray-500 hover:text-gray-900 rounded-full shadow-sm border border-gray-100 transition-all">\n                <Edit2 size={16} />\n              </button>\n              <button className="p-2 bg-white/80 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full shadow-sm border border-gray-100 transition-all">\n                <Trash2 size={16} />\n              </button>\n            </div>',
  `<div className="absolute top-4 right-4 flex gap-2 z-20">
              <button 
                onClick={() => alert("Fitur edit akan membuka EditSapiModal")}
                className="p-2 bg-white/80 hover:bg-white text-gray-500 hover:text-gray-900 rounded-full shadow-sm border border-gray-100 transition-all"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => {
                  if (window.confirm("Yakin ingin menghapus sapi ini?")) {
                    hapusSapi(selectedSapi.id).then(() => { navigate('/ternak'); });
                  }
                }}
                className="p-2 bg-white/80 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full shadow-sm border border-gray-100 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>`
);

fs.writeFileSync('src/pages/DetailTernak.jsx', code);
