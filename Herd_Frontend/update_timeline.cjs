const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Add timelineFilter state
if (!content.includes('const [timelineFilter, setTimelineFilter]')) {
    content = content.replace(
        "const [reproFilter, setReproFilter] = useState('siklus_saat_ini');",
        "const [reproFilter, setReproFilter] = useState('siklus_saat_ini');\n  const [timelineFilter, setTimelineFilter] = useState('semua');"
    );
}

// Find the IIFE in the mobile view
const iifeRegex = /\{(?:\(\) => \{)([\s\S]*?)(?:\}\)\(\)\}/;
const match = content.match(iifeRegex);
if (!match) {
    console.error("IIFE not found");
    process.exit(1);
}

// We need to replace the entire rendering of the timeline. Let's create a separate script to properly do this via AST or just string replacement if careful.
