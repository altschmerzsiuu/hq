require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

async function checkSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Supabase credentials missing in .env");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const tables = ["hewan", "reproduksi_ternak", "riwayat_reproduksi"];

    for (const table of tables) {
        console.log(`\n--- Fetching data from '${table}' ---`);
        const { data, error } = await supabase.from(table).select("*");
        if (error) {
            console.error(`❌ Error fetching ${table}:`, error.message);
        } else {
            console.table(data);
        }
    }
}

checkSupabase();
