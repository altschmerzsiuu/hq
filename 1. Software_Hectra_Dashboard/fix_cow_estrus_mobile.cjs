const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/shared/CowEstrusView.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

const oldHeader = `                <h3 className="font-extrabold text-gray-900 text-lg tracking-tight">Monitoring Siklus Birahi</h3>
                  <p className="text-sm text-gray-500 font-medium">ID Sapi: {selectedCow?.id || selectedCow?.cow_id} - {selectedCow?.nama}</p>`;

const newHeader = `                <h3 className="font-extrabold text-gray-900 text-base md:text-lg tracking-tight">Monitoring Siklus Birahi</h3>
                  <p className="text-xs md:text-sm text-gray-500 font-medium">ID Sapi: {selectedCow?.id || selectedCow?.cow_id} - {selectedCow?.nama}</p>`;

content = content.replace(oldHeader, newHeader);

// Let's also check if the icon size can be slightly smaller on mobile to fit everything better.
const oldIconWrapper = `<div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">`;
const newIconWrapper = `<div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">`;
content = content.replace(oldIconWrapper, newIconWrapper);

// And the Refresh button padding
const oldBtn = `className="p-3 rounded-xl border`;
const newBtn = `className="p-2 md:p-3 rounded-xl border`;
content = content.replace(oldBtn, newBtn);

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Updated CowEstrusView responsive sizes.");
