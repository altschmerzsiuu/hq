require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ SUPABASE_URL or SUPABASE_KEY missing in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabase() {
    try {
        console.log("Checking Supabase 'hewan' table...");
        const { data, error } = await supabase
            .from('hewan')
            .select('*');

        if (error) {
            console.error("Error querying Supabase:", error.message);
            return;
        }

        console.log(`Total rows in 'hewan': ${data.length}`);

        const anonimRows = data.filter(row =>
            (row.nama && row.nama.toLowerCase().includes('anonim')) ||
            (row.id && row.id.toLowerCase().includes('anonim'))
        );

        if (anonimRows.length > 0) {
            console.log("Found rows with 'anonim' in Supabase:");
            console.table(anonimRows);
        } else {
            console.log("No rows with 'anonim' found in Supabase.");
            if (data.length > 0) {
                console.log("Sample data (first 5 rows):");
                console.table(data.slice(0, 5));
            }
        }
    } catch (err) {
        console.error("Unexpected error:", err.message);
    }
}

checkSupabase();
