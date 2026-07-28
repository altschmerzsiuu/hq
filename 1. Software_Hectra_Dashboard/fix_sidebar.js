const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

// The Sidebar has a menu for Linimasa Aktivitas. Let's find it.
// Probably has Activity icon or 'Linimasa Aktivitas' text.
// We will replace it with empty string.
const lines = code.split('\n');
let newLines = [];
let skip = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('label: t.nav_timeline') || lines[i].includes('path: \'/timeline\'')) {
    // Find where the object starts (look back for '{')
    // Actually, let's just use regex.
  }
}
