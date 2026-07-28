const fs = require('fs');

// 1. Read files
let detailTernak = fs.readFileSync('src/pages/DetailTernak.jsx', 'utf8');
const oldMobile = fs.readFileSync('temp_mobile_layout_full.jsx', 'utf8');

// 2. Add imports
const importsToReplace = "ActivityIcon, Plus, CheckCircle, XCircle, Beef, ThermometerSun, Weight, Stethoscope, ChevronRight";
const newImports = "ActivityIcon, Plus, CheckCircle, XCircle, Beef, ThermometerSun, Weight, Stethoscope, ChevronRight, LineChart, ClipboardList, Pencil, Loader2, Wand2";
if (detailTernak.includes(importsToReplace)) {
  detailTernak = detailTernak.replace(importsToReplace, newImports);
} else {
  detailTernak = detailTernak.replace("import { ChevronLeft", "import { LineChart, ClipboardList, Pencil, Loader2, Wand2, ChevronLeft");
}

// 3. Add state
const stateToAdd = `
  const [activeDetailTab, setActiveDetailTab] = useState('riwayat');
  const [editForm, setEditForm] = useState({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [confirmingPregnancy, setConfirmingPregnancy] = useState(null);
  
  const handleBack = () => navigate(-1);
  const ask = async (opts) => window.confirm(opts.message);
  const confirmPregnancy = () => alert("Fitur segera hadir");
  const startEditRepro = () => alert("Fitur segera hadir");
  const deleteReproRecord = () => alert("Fitur segera hadir");
`;
detailTernak = detailTernak.replace("const t = translations[lang];", "const t = translations[lang];\n" + stateToAdd);

// 4. Extract mobile lines 1 to 467
const oldMobileLines = oldMobile.split('\n');
let mobileCode = oldMobileLines.slice(0, 467).join('\n');

// Update z-index and padding
mobileCode = mobileCode.replace(
  'className="md:hidden fixed inset-0 z-[900] bg-[#F3F4F6] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-20"',
  'className="md:hidden fixed inset-0 z-[35] bg-[#F3F4F6] overflow-y-auto animate-in slide-in-from-bottom duration-300 no-scrollbar pb-[100px]"'
);

// Remove the `ask` prompt logic for delete since it uses an undefined component?
// Actually, `window.confirm` is used instead, so it's fine.

// 5. Wrap the return statement
const returnStart = detailTernak.indexOf('  return (\n    <div className="min-h-screen bg-[#F4F5F7] pb-24 lg:pb-8 flex flex-col">');

if (returnStart === -1) {
  console.log("Could not find return statement");
  process.exit(1);
}

const beforeReturn = detailTernak.substring(0, returnStart);
const afterReturn = detailTernak.substring(returnStart + 11); // Skip "  return (\n"

const finalCode = beforeReturn + 
  "  return (\n" +
  "    <>\n" +
  "      {/* ── MOBILE VIEW ── */}\n" +
  mobileCode + "\n\n" +
  "      {/* ── DESKTOP VIEW ── */}\n" +
  afterReturn.replace(
    '<div className="min-h-screen bg-[#F4F5F7] pb-24 lg:pb-8 flex flex-col">',
    '<div className="hidden md:flex min-h-screen bg-[#F4F5F7] pb-24 lg:pb-8 flex-col">'
  ).replace(/}$/, '    </>\n  );\n}');

fs.writeFileSync('src/pages/DetailTernak.jsx', finalCode);
console.log("Successfully replaced layout.");
