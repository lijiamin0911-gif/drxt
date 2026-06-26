import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 1. Load environment variables
dotenv.config();

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

async function migrate() {
  console.log('🚀 Starting Data Migration: JSON -> PostgreSQL/Supabase...');

  // 2. Check if local db.json exists
  if (!fs.existsSync(DB_FILE)) {
    console.error(`❌ Error: Local database file not found at ${DB_FILE}`);
    console.error('👉 Please make sure data/db.json exists before running the migration.');
    process.exit(1);
  }

  let dbData: Record<string, any> = {};
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    dbData = JSON.parse(raw);
    console.log(`📦 Loaded local db.json successfully. Found collections: [${Object.keys(dbData).join(', ')}]`);
  } catch (err: any) {
    console.error('❌ Error parsing data/db.json:', err.message);
    process.exit(1);
  }

  const useSupabase = process.env.USE_SUPABASE === 'true';

  if (useSupabase) {
    // ----------------------------
    // 方式A: Supabase Migration
    // ----------------------------
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;

    if (!url || !key) {
      console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_KEY in environment variables.');
      process.exit(1);
    }

    console.log('🔌 Connecting to Supabase via HTTP SDK...');
    const supabase = createClient(url, key);

    console.log('⚙️ Checking Supabase table connection...');
    const { error: testError } = await supabase.from('erp_kv_store').select('key').limit(1);
    if (testError) {
      console.warn(`⚠️ Warning connecting to erp_kv_store: ${testError.message}`);
      console.log('👉 Creating table is only supported via the SQL Editor on Supabase.');
      console.log('👉 Please ensure you run this DDL in your Supabase SQL Editor first:');
      console.log('\n   CREATE TABLE erp_kv_store (');
      console.log('     key VARCHAR(255) PRIMARY KEY,');
      console.log('     value TEXT NOT NULL,');
      console.log('     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      console.log('   );\n');
    }

    console.log('📤 Migrating collections to Supabase...');
    for (const [colKey, colVal] of Object.entries(dbData)) {
      if (colKey === 'lastModified') continue;
      console.log(`  -> Upserting collection "${colKey}"...`);
      const { error } = await supabase.from('erp_kv_store').upsert({
        key: colKey,
        value: JSON.stringify(colVal),
        updated_at: new Date().toISOString()
      });
      if (error) {
        console.error(`  ❌ Failed to upsert "${colKey}":`, error.message);
      } else {
        console.log(`  ✅ Collection "${colKey}" migrated successfully.`);
      }
    }
  } else {
    // ----------------------------
    // 方式B: Standard PostgreSQL Migration
    // ----------------------------
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host || !user || !password || !database) {
      console.error('❌ Error: Missing standard PostgreSQL database connection variables (DB_HOST, DB_USER, etc.)');
      process.exit(1);
    }

    const useSsl = process.env.DB_SSL !== 'false';
    const pool = new pg.Pool({
      host,
      user,
      password,
      database,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });

    console.log('🔌 Connecting to standard PostgreSQL database...');
    let client;
    try {
      client = await pool.connect();
      console.log('✅ Connected to database.');

      console.log('⚙️ Ensuring erp_kv_store table exists...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS erp_kv_store (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Table erp_kv_store created/verified.');

      console.log('📤 Migrating collections to PostgreSQL...');
      for (const [colKey, colVal] of Object.entries(dbData)) {
        if (colKey === 'lastModified') continue;
        console.log(`  -> Upserting collection "${colKey}"...`);
        const jsonStr = JSON.stringify(colVal);
        await client.query(
          `INSERT INTO erp_kv_store (key, value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) 
           DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [colKey, jsonStr]
        );
        console.log(`  ✅ Collection "${colKey}" migrated successfully.`);
      }
    } catch (err: any) {
      console.error('❌ PostgreSQL database operation failed:', err.message);
      process.exit(1);
    } finally {
      if (client) client.release();
      await pool.end();
    }
  }

  console.log('\n🎉 Database migration finished successfully!');
}

migrate().catch(err => {
  console.error('❌ Unhandled Migration Error:', err);
  process.exit(1);
});
