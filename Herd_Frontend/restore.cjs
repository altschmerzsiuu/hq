const fs = require('fs');
const data = JSON.parse(fs.readFileSync('temp_step_900.json', 'utf8'));
const toolCall = data.tool_calls.find(t => t.name === 'write_to_file');
fs.writeFileSync('src/pages/DetailTernak.jsx', toolCall.args.CodeContent);
