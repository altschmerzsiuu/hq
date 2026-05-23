/**
 * Comprehensive syntax fixer for app.js
 * Fixes remaining broken db.select patterns after automated conversion
 */

const fs = require('fs');
const path = require('path');

const APP_JS_PATH = path.join(__dirname, '..', 'app.js');
const BACKUP_PATH = path.join(__dirname, '..', 'app.js.beforefix');

console.log('🔧 Comprehensive Syntax Fixer\n');

// Read app.js
let content = fs.readFileSync(APP_JS_PATH, 'utf8');

// Create backup
fs.writeFileSync(BACKUP_PATH, content);
console.log(`✅ Backup created: ${BACKUP_PATH}\n`);

let fixCount = 0;

// Fix 1: Replace remaining broken db.select with .limit patterns
const pattern1 = /const { data: (\w+), error: (\w+) } = await db\.select\('([^']+)', '\*', { rfid: ([^)]+)\)\s+\.limit\(1 }\);/g;
content = content.replace(pattern1, (match, dataVar, errorVar, table, condition) => {
    fixCount++;
    return `const { data: ${dataVar}, error: ${errorVar} } = await db.select('${table}', '*', { rfid: ${condition} }, { limit: 1 });`;
});

// Fix 2: Replace .order().limit() patterns
const pattern2 = /const { data: (\w+), error: (\w+) } = await db\.select\('([^']+)', '\*', { rfid: ([^)]+)\)\s+\.order\('([^']+)', { ascending: (\w+) }\)\s+\.limit\(1 }\);/g;
content = content.replace(pattern2, (match, dataVar, errorVar, table, condition, orderCol, ascending) => {
    fixCount++;
    return `const { data: ${dataVar}, error: ${errorVar} } = await db.select('${table}', '*', { rfid: ${condition} }, { orderBy: { column: '${orderCol}', ascending: ${ascending} }, limit: 1 });`;
});

console.log(`✅ Fixed ${fixCount} broken db.select patterns\n`);

// Write fixed content
fs.writeFileSync(APP_JS_PATH, content);

console.log('✨ Syntax fixes applied!');
console.log('\n📝 Next: Check remaining errors and restart Docker container');
console.log('   docker restart scanner-app\n');
