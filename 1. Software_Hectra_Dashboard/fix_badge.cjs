const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/shared/CowEstrusView.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// The badge HTML is:
//             {/* Optional badge based on status */}
// Or in my previous script it was replaced but maybe the old badge code was left?
// Let's check what I wrote in `fix_svg_simple.cjs`.
// Ah! In `fix_svg.cjs` there was:
//             {/* Badges pointing to the ring */}
//             <div className="absolute top-28 left-6 bg-green-100 border border-green-200 px-3 py-1.5 rounded-xl shadow-sm z-10">
//               <p className="text-xs font-bold text-green-800">Masa Subur</p>
//               <p className="text-[10px] font-semibold text-green-600">Hari 18-21</p>
//             </div>

// Then in `fix_svg_simple.cjs`, the regex was:
// /<div className="relative w-72 h-72 flex items-center justify-center my-6">[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* Badges pointing to the ring \*\/\}/m
// And I replaced it with `newSvgBlock + '\n\n            {/* Optional badge based on status */}'`
// Wait, if I look at the regex, it matched up to `{* Badges pointing to the ring *}`. 
// BUT it DID NOT match the actual `div` of the badge that comes AFTER it!
// So the badge was left there.

const badgeRegex = /<div className="absolute top-28 left-6 bg-green-100 border border-green-200 px-3 py-1\.5 rounded-xl shadow-sm z-10">[\s\S]*?<\/div>/m;
content = content.replace(badgeRegex, '');

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Removed Masa Subur badge.");
