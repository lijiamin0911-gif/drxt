import express from "express";
import path from "path";
import fs from "fs";
import { ServerDbService } from "./dataLayer/serverDbService";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON request body parsing with size threshold for bulk operations
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

  // Auto-detect production mode based on environment variable
  const isProd = process.env.NODE_ENV === "production";

  // Vite middleware for development vs static serve for production
  if (!isProd) {
    console.log("🛠️  Running in DEVELOPMENT mode: Vite hot-reload & transpilation enabled.");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to load Vite dev middleware. If you wanted to run in production, run 'npm run build' first.", e);
      process.exit(1);
    }
  } else {
    console.log("📦 Running in PRODUCTION mode: Serving optimized, pre-compiled static files.");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 ERP Full-Stack Server running on port ${PORT}`);
    console.log(`   - Environment: ${isProd ? "PRODUCTION" : "DEVELOPMENT"}`);
    console.log(`   - API Endpoint: http://localhost:${PORT}/api/db`);
  });
}

startServer();
