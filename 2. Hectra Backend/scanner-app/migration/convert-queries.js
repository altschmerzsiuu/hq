/**
 * Automated Supabase to PostgreSQL Query Converter
 * 
 * This script converts Supabase queries in app.js to PostgreSQL
 * Run this AFTER database migration is complete
 * 
 * Usage: node migration/convert-queries.js
 */

const fs = require('fs');
const path = require('path');

const APP_JS_PATH = path.join(__dirname, '..', 'app.js');
const BACKUP_PATH = path.join(__dirname, '..', 'app.js.backup');

console.log('🔄 Supabase to PostgreSQL Converter\n');

// Read app.js
let content = fs.readFileSync(APP_JS_PATH, 'utf8');

// Create backup
fs.writeFileSync(BACKUP_PATH, content);
console.log(`✅ Backup created: ${BACKUP_PATH}\n`);

let changeCount = 0;

// Conversion patterns
const conversions = [
    // Pattern 1: Simple select with eq
    {
        name: 'SELECT with single .eq()',
        pattern: /const { data: (\w+), error: (\w+) } = await supabase\s*\.from\('(\w+)'\)\s*\.select\('([^']+)'\)\s*\.eq\('(\w+)', ([^;]+?)\);/gs,
        replacement: (match, dataVar, errorVar, table, columns, eqColumn, eqValue) => {
            return `const { data: ${dataVar}, error: ${errorVar} } = await db.select('${table}', '${columns}', { ${eqColumn}: ${eqValue} });`;
        }
    },

    // Pattern 2: Select with ilike
    {
        name: 'SELECT with .ilike()',
        pattern: /const { data: (\w+), error: (\w+) } = await supabase\s*\.from\('(\w+)'\)\s*\.select\('([^']+)'\)\s*\.ilike\('(\w+)', ([^;]+?)\);/gs,
        replacement: (match, dataVar, errorVar, table, columns, column, value) => {
            return `const { data: ${dataVar}, error: ${errorVar} } = await db.select('${table}', '${columns}', { ${column}: { like: \`%\${${value}}%\` } });`;
        }
    },

    // Pattern 3: Select with eq, order, and limit
    {
        name: 'SELECT with .eq().order().limit()',
        pattern: /const { data: (\w+), error: (\w+) } = await supabase\s*\.from\('(\w+)'\)\s*\.select\('([^']+)'\)\s*\.eq\('(\w+)', ([^;]+?)\)\s*\.order\('(\w+)', { ascending: (\w+) }\)\s*\.limit\((\d+)\);/gs,
        replacement: (match, dataVar, errorVar, table, columns, eqColumn, eqValue, orderColumn, ascending, limit) => {
            return `const { data: ${dataVar}, error: ${errorVar} } = await db.select('${table}', '${columns}', { ${eqColumn}: ${eqValue} }, { orderBy: { column: '${orderColumn}', ascending: ${ascending} }, limit: ${limit} });`;
        }
    },

    // Pattern 4: Insert
    {
        name: 'INSERT',
        pattern: /const { error: (\w+) } = await supabase\s*\.from\('(\w+)'\)\s*\.insert\(\[([^\]]+)\]\);/gs,
        replacement: (match, errorVar, table, data) => {

            return `const { data: _inserted, error: ${errorVar} } = await db.insert('${table}', ${data});`;
        }
    },

    // Pattern 5: Update with eq
    {
        name: 'UPDATE with .eq()',
        pattern: /const { error: (\w+) } = await supabase\s*\.from\('(\w+)'\)\s*\.update\((\{[^}]+\})\)\s*\.eq\('(\w+)', ([^;]+?)\);/gs,
        replacement: (match, errorVar, table, data, column, value) => {
            return `const { data: _updated, error: ${errorVar} } = await db.update('${table}', ${data}, { ${column}: ${value} });`;
        }
    },

    // Pattern 6: Delete with eq
    {
        name: 'DELETE with .eq()',
        pattern: /const { error: (\w+) } = await supabase\s*\.from\('(\w+)'\)\s*\.delete\(\)\s*\.eq\('(\w+)', ([^;]+?)\);/gs,
        replacement: (match, errorVar, table, column, value) => {
            return `const { data: _deleted, error: ${errorVar} } = await db.delete('${table}', { ${column}: ${value} });`;
        }
    }
];

console.log('🔍 Searching for Supabase patterns...\n');

// Apply conversions
conversions.forEach(({ name, pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
        console.log(`📌 Found ${matches.length} instances of: ${name}`);
        content = content.replace(pattern, replacement);
        changeCount += matches.length;
    }
});

// Additional manual replacements for complex patterns
console.log('\n⚙️  Applying manual fixes for complex patterns...');

// Fix: .maybeSingle() - PostgreSQL returns array, need to get first item
content = content.replace(/\.maybeSingle\(\);/g, ';\n        if (data && data.length > 0) data = data[0]; else data = null;');

console.log('\n✅ Conversion Summary:');
console.log(`   Total automatic replacements: ${changeCount}`);
console.log(`   Backup saved to: app.js.backup`);

// Write converted content
fs.writeFileSync(APP_JS_PATH, content);

console.log('\n✨ Conversion complete!');
console.log('\n⚠️  IMPORTANT: Manual review required for:');
console.log('   1. Complex multi-condition queries');
console.log('   2. Queries with .in(), .not(), .or() operators');
console.log('   3. Nested queries');
console.log('   4. Any query that uses .maybeSingle()');
console.log('\n📝 Next steps:');
console.log('   1. Review changes in app.js');
console.log('   2. Test all Telegram bot functions');
console.log('   3. Run: docker-compose up -d scanner-app');
console.log('   4. Check logs: docker-compose logs -f scanner-app\n');
