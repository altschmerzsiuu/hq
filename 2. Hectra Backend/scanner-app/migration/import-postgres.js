/**
 * Import data from JSON files to PostgreSQL
 * Run this AFTER running export-supabase.js
 * 
 * Usage: node migration/import-postgres.js
 */

require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// PostgreSQL configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgre@localhost:5432/Collar_to_Gateway"
});

// Data directory
const dataDir = path.join(__dirname, "data");

/**
 * Import table from JSON file
 */
async function importTable(tableName) {
    console.log(`\n📤 Importing table: ${tableName}...`);

    const filePath = path.join(dataDir, `${tableName}.json`);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${filePath} - Skipping`);
        return 0;
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (data.length === 0) {
            console.log(`ℹ️  No data to import for ${tableName}`);
            return 0;
        }

        let inserted = 0;

        for (const row of data) {
            try {
                // Build INSERT query dynamically
                const columns = Object.keys(row);
                const values = Object.values(row);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                const query = `
                    INSERT INTO ${tableName} (${columns.join(', ')})
                    VALUES (${placeholders})
                    ON CONFLICT DO NOTHING
                `;

                await pool.query(query, values);
                inserted++;
            } catch (error) {
                console.error(`   ⚠️  Error inserting row:`, error.message);
                // Continue with next row
            }
        }

        console.log(`✅ Imported ${inserted} / ${data.length} rows to ${tableName}`);
        return inserted;
    } catch (error) {
        console.error(`❌ Error importing ${tableName}:`, error.message);
        throw error;
    }
}

/**
 * Verify data integrity
 */
async function verifyData() {
    console.log("\n🔍 Verifying data integrity...");

    const tables = ['hewan', 'reproduksi_ternak', 'riwayat_reproduksi', 'feed_ai'];

    for (const table of tables) {
        try {
            const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
            const count = parseInt(result.rows[0].count);
            console.log(`   ${table.padEnd(25)} : ${count} rows`);
        } catch (error) {
            console.log(`   ${table.padEnd(25)} : Table not found or error`);
        }
    }
}

/**
 * Main import function
 */
async function importAllData() {
    console.log("🚀 Starting PostgreSQL data import...");
    console.log("=".repeat(50));

    // Check if data directory exists
    if (!fs.existsSync(dataDir)) {
        console.error(`❌ Error: Data directory not found: ${dataDir}`);
        console.error(`   Please run 'node migration/export-supabase.js' first`);
        process.exit(1);
    }

    // Test database connection
    try {
        await pool.query('SELECT NOW()');
        console.log("✅ Database connection successful");
    } catch (error) {
        console.error("❌ Database connection failed:", error.message);
        console.error("   Check your DATABASE_URL in .env file");
        process.exit(1);
    }

    // Import tables in order (respect foreign keys)
    const tables = [
        'hewan',                  // Master table first
        'reproduksi_ternak',      // References hewan
        'riwayat_reproduksi',    // References hewan
        'feed_ai'                // References hewan
    ];

    const summary = {};

    for (const table of tables) {
        try {
            const rowCount = await importTable(table);
            summary[table] = rowCount;
        } catch (error) {
            console.log(`⚠️  Skipping ${table}`);
            summary[table] = 0;
        }
    }

    // Verify imported data
    console.log("\n" + "=".repeat(50));
    console.log("📊 Import Summary:");
    console.log("=".repeat(50));
    Object.entries(summary).forEach(([table, count]) => {
        console.log(`   ${table.padEnd(25)} : ${count} rows`);
    });
    console.log("=".repeat(50));
    console.log(`   Total                      : ${Object.values(summary).reduce((a, b) => a + b, 0)} rows`);
    console.log("=".repeat(50));

    await verifyData();

    console.log("\n✅ Import completed!");
    console.log("\n🔜 Next steps:");
    console.log("   1. Verify data in PostgreSQL: docker-compose exec db psql -U postgres -d Collar_to_Gateway");
    console.log("   2. Update app.js to use PostgreSQL (next phase)");
    console.log("   3. Test the application");
}

// Run import
importAllData()
    .then(() => {
        console.log("\n✨ All done!");
        pool.end();
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Import failed:", error);
        pool.end();
        process.exit(1);
    });
