const fs = require('fs');
let c = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

c = c.replace(/>\n\s*\{filter\}\n\s*<\/button>/g, "> {lang === 'id' ? filter : filter === 'Hari' ? 'Day' : filter === 'Minggu' ? 'Week' : 'Month'} </button>");
c = c.replace(/Ada hal yang perlu kamu perhatikan hari ini/g, "{lang === 'id' ? 'Ada hal yang perlu kamu perhatikan hari ini' : 'Things to pay attention to today'}");

fs.writeFileSync('src/pages/Dashboard.jsx', c);
