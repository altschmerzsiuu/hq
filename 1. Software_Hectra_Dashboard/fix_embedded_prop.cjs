const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/pages/DetailTernak.jsx');
let c = fs.readFileSync(p, 'utf8');
// Replace all ActivityTimeline usages to add embedded prop
c = c.replace(
  /<ActivityTimeline cowId={selectedSapi\?\.id} filter={activityFilter} \/>/g,
  '<ActivityTimeline cowId={selectedSapi?.id} filter={activityFilter} embedded={true} />'
);
fs.writeFileSync(p, c, 'utf8');
console.log('Added embedded prop.');
