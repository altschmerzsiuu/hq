require("dotenv").config();
const db = require("./database");


async function test() {
    try {
        console.log("Listing all tables in the database...");
        const { rows, error } = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        if (error) {
            console.error("Error listing tables:", error);
            return;
        }
        console.log("Tables in database:");
        console.table(rows);

        process.exit(0);
    } catch (err) {
        console.error("Unexpected error:", err);
        process.exit(1);
    }
}

test();
