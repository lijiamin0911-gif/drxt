import pg from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface DbClientInterface {
  init(): Promise<void>;
  getAll(): Promise<Record<string, any>>;
  set(key: string, value: any): Promise<void>;
  isEnabled(): boolean;
}

class PostgresClient implements DbClientInterface {
  private pool: pg.Pool | null = null;

  constructor() {
    const isConfigured = !!(
      process.env.DB_HOST &&
      process.env.DB_USER &&
      process.env.DB_PASSWORD &&
      process.env.DB_NAME
    );

    if (isConfigured) {
      console.log('🔌 Initializing standard PostgreSQL client (Tencent Cloud)...');
      // Support customizable SSL settings (many cloud PGs require SSL)
      const useSsl = process.env.DB_SSL !== 'false';
      this.pool = new pg.Pool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }
  }

  public isEnabled(): boolean {
    return this.pool !== null;
  }

  public async init(): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      console.log('⚙️ Checking/Creating erp_kv_store table in PostgreSQL...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS erp_kv_store (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ PostgreSQL table erp_kv_store is ready.');
    } catch (err) {
      console.error('❌ Failed to initialize PostgreSQL table:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  public async getAll(): Promise<Record<string, any>> {
    if (!this.pool) return {};
    const client = await this.pool.connect();
    try {
      const res = await client.query('SELECT key, value FROM erp_kv_store');
      const data: Record<string, any> = {};
      for (const row of res.rows) {
        try {
          data[row.key] = JSON.parse(row.value);
        } catch (e) {
          data[row.key] = row.value;
        }
      }
      return data;
    } catch (err) {
      console.error('❌ Error reading all data from PostgreSQL:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  public async set(key: string, value: any): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      const jsonStr = JSON.stringify(value);
      await client.query(
        `INSERT INTO erp_kv_store (key, value, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) 
         DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, jsonStr]
      );
    } catch (err) {
      console.error(`❌ Error setting key "${key}" in PostgreSQL:`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}

class SupabaseDbClient implements DbClientInterface {
  private client: SupabaseClient | null = null;

  constructor() {
    const isConfigured = !!(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_KEY
    );

    if (isConfigured) {
      console.log('🔌 Initializing Supabase client...');
      this.client = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
      );
    }
  }

  public isEnabled(): boolean {
    return this.client !== null;
  }

  public async init(): Promise<void> {
    if (!this.client) return;
    console.log('⚙️ Testing connection to Supabase table erp_kv_store...');
    try {
      // Test if table exists by reading from it
      const { error } = await this.client.from('erp_kv_store').select('key').limit(1);
      if (error) {
        console.warn('⚠️ Supabase erp_kv_store table is not found or inaccessible.', error.message);
        console.warn('👉 Please run the database migration/setup SQL script in your Supabase SQL Editor:');
        console.warn(`
          CREATE TABLE erp_kv_store (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } else {
        console.log('✅ Supabase connection tested and erp_kv_store table exists.');
      }
    } catch (err: any) {
      console.error('❌ Failed to test Supabase connection:', err);
    }
  }

  public async getAll(): Promise<Record<string, any>> {
    if (!this.client) return {};
    try {
      const { data, error } = await this.client.from('erp_kv_store').select('key, value');
      if (error) throw error;
      const result: Record<string, any> = {};
      if (data) {
        for (const row of data) {
          try {
            result[row.key] = JSON.parse(row.value);
          } catch (e) {
            result[row.key] = row.value;
          }
        }
      }
      return result;
    } catch (err) {
      console.error('❌ Error reading all data from Supabase:', err);
      throw err;
    }
  }

  public async set(key: string, value: any): Promise<void> {
    if (!this.client) return;
    try {
      const jsonStr = JSON.stringify(value);
      const { error } = await this.client.from('erp_kv_store').upsert({
        key,
        value: jsonStr,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
    } catch (err) {
      console.error(`❌ Error setting key "${key}" in Supabase:`, err);
      throw err;
    }
  }
}

class CombinedDbClient implements DbClientInterface {
  private activeClient: DbClientInterface | null = null;

  constructor() {
    const useSupabase = process.env.USE_SUPABASE === 'true';
    const supabaseClient = new SupabaseDbClient();
    const pgClient = new PostgresClient();

    if (useSupabase && supabaseClient.isEnabled()) {
      this.activeClient = supabaseClient;
      console.log('🚀 Active Database: Supabase Client');
    } else if (pgClient.isEnabled()) {
      this.activeClient = pgClient;
      console.log('🚀 Active Database: Tencent Cloud PostgreSQL');
    } else {
      console.log('ℹ️ No relational DB configured. Falling back to local JSON file (data/db.json).');
    }
  }

  public isEnabled(): boolean {
    return this.activeClient !== null;
  }

  public async init(): Promise<void> {
    if (this.activeClient) {
      await this.activeClient.init();
    }
  }

  public async getAll(): Promise<Record<string, any>> {
    if (this.activeClient) {
      return this.activeClient.getAll();
    }
    return {};
  }

  public async set(key: string, value: any): Promise<void> {
    if (this.activeClient) {
      await this.activeClient.set(key, value);
    }
  }
}

export const dbClient = new CombinedDbClient();
