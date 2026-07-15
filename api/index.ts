import express from 'express';
import { ServerDbService } from '../dataLayer/serverDbService.js';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize the database on startup
let isInitialized = false;
const initDbPromise = (async () => {
  try {
    await ServerDbService.initialize();
    isInitialized = true;
    console.log("✅ ServerDbService successfully initialized inside Vercel Serverless Function.");
  } catch (err) {
    console.error("❌ Failed to initialize ServerDbService in Vercel:", err);
  }
})();

// Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
  if (!isInitialized) {
    await initDbPromise;
  }
  next();
});

// Unified database action router
app.post("/api/db", async (req, res) => {
  const { method, args } = req.body;
  try {
    if (!method) {
      return res.status(400).json({ error: "Method parameter is required" });
    }
    const val = await ServerDbService.handleApiRequest(method, args || []);
    res.json(val !== undefined ? val : null);
  } catch (error: any) {
    console.error(`Error executing ServerDbService.${method}:`, error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Multi-terminal instant synchronization version endpoint
app.get("/api/db/version", (req, res) => {
  try {
    res.json({ lastModified: ServerDbService.getLastModified() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Database connection status diagnostic endpoint
app.get("/api/db/status", (req, res) => {
  try {
    const isSupabase = process.env.USE_SUPABASE === 'true';
    const hasSupabaseEnv = !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
    const hasPgEnv = !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD);
    
    let activeClient = "本地文件 (db.json)";
    if (isSupabase && hasSupabaseEnv) {
      activeClient = "Supabase 线上数据库";
    } else if (hasPgEnv) {
      activeClient = "腾讯云 PostgreSQL";
    }

    res.json({
      supabaseEnabled: isSupabase,
      supabaseConfigured: hasSupabaseEnv,
      pgConfigured: hasPgEnv,
      activeClient
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", lastModified: ServerDbService.getLastModified() });
});

export default app;
