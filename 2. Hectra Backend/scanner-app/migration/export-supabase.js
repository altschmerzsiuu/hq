/**
 * Export data from Supabase to JSON files
 * Run this script ONCE before migration to PostgreSQL
 * 
 * Usage: node migration/export-supabase.js
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: SUPABASE_URL dan SUPABASE_KEY harus diisi di .env");
    console.error("   Tambahkan konfigurasi Supabase di file .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Data directory
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Export table data to JSON file
 */
async function exportTable(tableName) {
    console.log(`\n📥 Exporting table: ${tableName}...`);

    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        const filePath = path.join(dataDir, `${tableName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        console.log(`✅ Exported ${data.length} rows to ${filePath}`);
        return data.length;
    } catch (error) {
        console.error(`❌ Error exporting ${tableName}:`, error.message);
        throw error;
    }
}

/**
 * Main export function
 */
async function exportAllData() {
    console.log("🚀 Starting Supabase data export...");
    console.log("=".repeat(50));

    const tables = [
        'hewan',
        'reproduksi_ternak',
        'riwayat_reproduksi',
        'feed_ai'  // Optional: if exists
    ];

    const summary = {};

    for (const table of tables) {
        try {
            const rowCount = await exportTable(table);
            summary[table] = rowCount;
        } catch (error) {
            console.log(`⚠️  Skipping ${table} (table might not exist or empty)`);
            summary[table] = 0;
        }
    }

    // Create summary file
    const summaryPath = path.join(dataDir, "_export_summary.json");
    const exportSummary = {
        exportDate: new Date().toISOString(),
        tables: summary,
        totalRows: Object.values(summary).reduce((a, b) => a + b, 0)
    };
    fs.writeFileSync(summaryPath, JSON.stringify(exportSummary, null, 2));

    console.log("\n" + "=".repeat(50));
    console.log("📊 Export Summary:");
    console.log("=".repeat(50));
    Object.entries(summary).forEach(([table, count]) => {
        console.log(`   ${table.padEnd(25)} : ${count} rows`);
    });
    console.log("=".repeat(50));
    console.log(`   Total                      : ${exportSummary.totalRows} rows`);
    console.log("=".repeat(50));
    console.log(`\n✅ Export completed! Data saved to: ${dataDir}`);
    console.log(`📄 Summary: ${summaryPath}`);
    console.log("\n🔜 Next step: Run 'node migration/import-postgres.js' to import data");
}

// Run export
exportAllData()
    .then(() => {
        console.log("\n✨ All done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Export failed:", error);
        process.exit(1);
    });
