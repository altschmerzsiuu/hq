const fs = require('fs');
let code = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');

code = code.replace(
  '<div className="md:hidden flex flex-col bg-[#F3F4F6] min-h-screen -mx-4 -mt-4 pb-20">',
  '<div className="md:hidden fixed inset-0 z-[35] bg-[#F3F4F6] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-[100px]">'
);

fs.writeFileSync('src/pages/DetailTernak.jsx', code);
