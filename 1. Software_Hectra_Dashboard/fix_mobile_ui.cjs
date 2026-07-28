const fs = require('fs');
let code = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');
const oldLayout = fs.readFileSync('temp_mobile_layout.jsx', 'utf8');

// The mobile section starts at: {/* ── MOBILE FULLSCREEN DETAIL MODAL (from dev-stage) ── */}
// And ends at the last </div> before the final </div> of the file.
const startMarker = '{/* ── MOBILE FULLSCREEN DETAIL MODAL (from dev-stage) ── */}';
const startIndex = code.indexOf(startMarker);
if (startIndex === -1) throw new Error("Start marker not found");

// Find the last </div> before the end of the file.
const endOfDesktop = code.indexOf(startMarker);
// Actually, let's just use regex to replace everything from startMarker to the end of the return statement.
const match = code.substring(startIndex);
// The last closing tag of the component is `    </div>\n  );\n}`.
// Let's just find `    </div>\n  );\n}`
const endMarker = '    </div>\n  );\n}';
const endIdx = code.lastIndexOf(endMarker);
if (endIdx === -1) throw new Error("End marker not found");

let newMobileCode = oldLayout;

// Need to replace state variables and functions in the new mobile code
newMobileCode = newMobileCode.replace(/activeDetailTab/g, 'activeTab');
newMobileCode = newMobileCode.replace(/setActiveDetailTab/g, 'setActiveTab');
newMobileCode = newMobileCode.replace(/<div className="md:hidden fixed inset-0 z-\[900\] bg-\[#F3F4F6\] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-20">/g, '<div className="md:hidden fixed inset-0 z-[35] bg-[#F3F4F6] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-[100px]">');
newMobileCode = newMobileCode.replace(/handleBack/g, '(() => navigate(-1))');
newMobileCode = newMobileCode.replace(/setIsEditModalOpen\(true\)/g, 'alert("Fitur edit mobile sedang dalam pengembangan.")');
newMobileCode = newMobileCode.replace(/const confirmed = await ask\(\{[^}]+\}\);/g, 'const confirmed = window.confirm("Yakin ingin menghapus sapi ini?");');
newMobileCode = newMobileCode.replace(/confirmPregnancy\([^)]+\)/g, 'alert("Fitur konfirmasi sedang dalam pengembangan.")');
newMobileCode = newMobileCode.replace(/startEditRepro\([^)]+\)/g, 'alert("Fitur edit repro sedang dalam pengembangan.")');
newMobileCode = newMobileCode.replace(/deleteReproRecord\([^)]+\)/g, 'alert("Fitur hapus repro sedang dalam pengembangan.")');

// Replace everything from startMarker to the endMarker with the new mobile code
const finalCode = code.substring(0, startIndex) + startMarker + '\n' + newMobileCode + '\n' + endMarker;

fs.writeFileSync('src/pages/DetailTernak.jsx', finalCode);
