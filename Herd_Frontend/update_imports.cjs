const fs = require('fs');
let code = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');

code = code.replace(
  "ActivityIcon, Plus, CheckCircle, XCircle, Beef, ThermometerSun, Weight, Stethoscope, ChevronRight, Cpu",
  "ActivityIcon, Plus, CheckCircle, XCircle, Beef, ThermometerSun, Weight, Stethoscope, ChevronRight, Cpu, LineChart, ClipboardList, Pencil, Loader2, Wand2"
);

fs.writeFileSync('src/pages/DetailTernak.jsx', code);
