/**
 * PostgreSQL Database Helper
 * Provides simple query methods similar to Supabase API
 */

const { Pool } = require('pg');

class Database {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        // Test connection on initialization
        this.testConnection();
    }

    async testConnection() {
        try {
            const client = await this.pool.connect();
            console.log('✅ PostgreSQL connection successful');
            client.release();
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * SELECT query - mimics Supabase .from().select().eq()
     * @param {string} table - Table name
     * @param {string} columns - Columns to select (default: '*')
     * @param {object} where - WHERE conditions (key-value pairs)
     * @param {object} options - Additional options (orderBy, limit, etc.)
     * @returns {Promise<{data, error}>}
     */
    async select(table, columns = '*', where = {}, options = {}) {
        try {
            let query = `SELECT ${columns} FROM ${table}`;
            const values = [];
            let paramIndex = 1;

            // WHERE clause
            if (Object.keys(where).length > 0) {
                const conditions = [];
                for (const [key, value] of Object.entries(where)) {
                    if (value && typeof value === 'object' && value.like) {
                        // Handle ILIKE for case-insensitive search
                        conditions.push(`${key} ILIKE $${paramIndex}`);
                        values.push(value.like);
                    } else {
                        conditions.push(`${key} = $${paramIndex}`);
                        values.push(value);
                    }
                    paramIndex++;
                }
                query += ` WHERE ${conditions.join(' AND ')}`;
            }

            // ORDER BY clause
            if (options.orderBy) {
                const { column, ascending = true } = options.orderBy;
                query += ` ORDER BY ${column} ${ascending ? 'ASC' : 'DESC'}`;
            }

            // LIMIT clause
            if (options.limit) {
                query += ` LIMIT ${options.limit}`;
            }

            const result = await this.pool.query(query, values);
            return { data: result.rows, error: null };
        } catch (error) {
            console.error('Database select error:', error.message);
            return { data: null, error };
        }
    }

    /**
     * INSERT query - mimics Supabase .from().insert()
     * @param {string} table - Table name
     * @param {object|array} data - Data to insert
     * @returns {Promise<{data, error}>}
     */
    async insert(table, data) {
        try {
            const records = Array.isArray(data) ? data : [data];
            const insertedRows = [];

            for (const record of records) {
                const columns = Object.keys(record);
                const values = Object.values(record);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                const query = `
                    INSERT INTO ${table} (${columns.join(', ')})
                    VALUES (${placeholders})
                    RETURNING *
                `;

                const result = await this.pool.query(query, values);
                insertedRows.push(result.rows[0]);
            }

            return { data: insertedRows, error: null };
        } catch (error) {
            console.error('Database insert error:', error.message);
            return { data: null, error };
        }
    }

    /**
     * UPDATE query - mimics Supabase .from().update().eq()
     * @param {string} table - Table name
     * @param {object} data - Data to update
     * @param {object} where - WHERE conditions
     * @returns {Promise<{data, error}>}
     */
    async update(table, data, where) {
        try {
            const setClauses = [];
            const values = [];
            let paramIndex = 1;

            // SET clause
            for (const [key, value] of Object.entries(data)) {
                setClauses.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }

            // WHERE clause
            const conditions = [];
            for (const [key, value] of Object.entries(where)) {
                conditions.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }

            const query = `
                UPDATE ${table}
                SET ${setClauses.join(', ')}
                WHERE ${conditions.join(' AND ')}
                RETURNING *
            `;

            const result = await this.pool.query(query, values);
            return { data: result.rows, error: null };
        } catch (error) {
            console.error('Database update error:', error.message);
            return { data: null, error };
        }
    }

    /**
     * UPSERT query - INSERT with ON CONFLICT UPDATE
     * @param {string} table - Table name
     * @param {object|array} data - Data to upsert
     * @param {string} conflictColumn - Column to check for conflicts (default: 'rfid')
     * @returns {Promise<{data, error}>}
     */
    async upsert(table, data, conflictColumn = 'rfid') {
        try {
            const records = Array.isArray(data) ? data : [data];
            const upsertedRows = [];

            for (const record of records) {
                const columns = Object.keys(record);
                const values = Object.values(record);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                // Build UPDATE clause for ON CONFLICT
                const updateClauses = columns
                    .filter(col => col !== conflictColumn)
                    .map(col => `${col} = EXCLUDED.${col}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${table} (${columns.join(', ')})
                    VALUES (${placeholders})
                    ON CONFLICT (${conflictColumn})
                    DO UPDATE SET ${updateClauses}
                    RETURNING *
                `;

                const result = await this.pool.query(query, values);
                upsertedRows.push(result.rows[0]);
            }

            return { data: upsertedRows, error: null };
        } catch (error) {
            console.error('Database upsert error:', error.message);
            return { data: null, error };
        }
    }

    /**
     * DELETE query - mimics Supabase .from().delete().eq()
     * @param {string} table - Table name
     * @param {object} where - WHERE conditions
     * @returns {Promise<{data, error}>}
     */
    async delete(table, where) {
        try {
            const conditions = [];
            const values = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(where)) {
                conditions.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }

            const query = `
                DELETE FROM ${table}
                WHERE ${conditions.join(' AND ')}
                RETURNING *
            `;

            const result = await this.pool.query(query, values);
            return { data: result.rows, error: null };
        } catch (error) {
            console.error('Database delete error:', error.message);
            return { data: null, error };
        }
    }

    /**
     * Raw query execution
     * @param {string} query - SQL query
     * @param {array} values - Query parameters
     * @returns {Promise<{rows, rowCount, error}>}
     */
    async query(query, values = []) {
        try {
            const result = await this.pool.query(query, values);
            return { rows: result.rows, rowCount: result.rowCount, error: null };
        } catch (error) {
            console.error('Database query error:', error.message);
            return { rows: null, rowCount: 0, error };
        }
    }

    /**
     * Close database connection
     */
    async close() {
        await this.pool.end();
    }
}

// Export singleton instance
module.exports = new Database();
