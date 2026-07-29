const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

// The percentage is: herd.length > 0 ? (herd.filter(c => c.status === 'normal' || !c.status).length / herd.length) : 0
// Let's replace the static strokeDashoffset with dynamic values.

content = content.replace(
  /<circle cx="50" cy="50" r="40" fill="transparent" stroke="var\(--color-primary\)" strokeWidth="14" strokeDasharray="251.2" strokeDashoffset="50" strokeLinecap="round" className="opacity-90" \/>/g,
  `<circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-primary)" strokeWidth="14" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (herd.length > 0 ? (herd.filter(c => c.status === 'normal' || !c.status).length / herd.length) : 0))} strokeLinecap="round" className="opacity-90 transition-all duration-1000" />`
);

content = content.replace(
  /<circle cx="50" cy="50" r="40" fill="transparent" stroke="var\(--amber\)" strokeWidth="14" strokeDasharray="251.2" strokeDashoffset="200" strokeLinecap="round" \/>/g,
  `<circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--amber)" strokeWidth="14" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (herd.length > 0 ? (herd.filter(c => c.status !== 'normal' && c.status).length / herd.length) : 0))} strokeLinecap="round" className="transition-all duration-1000" style={{ strokeDashoffset: 251.2 - (251.2 * (herd.length > 0 ? (herd.filter(c => c.status !== 'normal' && c.status).length / herd.length) : 0)), transformOrigin: 'center', transform: \`rotate(\${360 * (herd.length > 0 ? (herd.filter(c => c.status === 'normal' || !c.status).length / herd.length) : 0)}deg)\` }} />`
);

fs.writeFileSync('src/pages/Dashboard.jsx', content);
