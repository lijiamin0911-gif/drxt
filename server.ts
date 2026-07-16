import express from 'express';
import { ServerDbService } from './dataLayer/serverDbService.js';

const app = express();

// Initialize DB on cold start
ServerDbService.initialize().catch((err) => {
  console.error("鉂?ServerDbService init failed:", err);
});

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// DB status
app.get("/api/db/status", async (_req, res) => {
  const isSupabase = !!(process.env.USE_SUPABASE === "true" || process.env.VITE_SUPABASE_URL);
  res.json({ activeClient: isSupabase ? "Supabase" : "local", supabaseEnabled: isSupabase });
});

app.get("/api/db/version", async (_req, res) => {
  res.json({ lastModified: ServerDbService.getLastModified() });
});

app.get("/api/health", async (_req, res) => {
  res.json({ status: "ok", lastModified: ServerDbService.getLastModified() });
});

// Debug: echo request info
app.get("/api/db/debug", async (req, res) => {
  res.json({
    env: { vite_url: process.env.VITE_SUPABASE_URL?.substring(0,20), vite_key: !!process.env.VITE_SUPABASE_KEY, use_supabase: process.env.USE_SUPABASE },
    headers: req.headers,
    method: req.method
  });
});

// Debug: test POST body parsing
app.post("/api/db/debug", async (req, res) => {
  res.json({
    bodyReceived: !!req.body,
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    hasBody: !!req.body,
    method: req.method
  });
});

// Unified DB API router
app.post("/api/db", async (req, res) => {
  try {
    const { method, args } = req.body as { method?: string; args?: any[] };
    if (!method) {
      res.status(400).json({ error: "Missing method parameter" });
      return;
    }
    const result = await ServerDbService.handleApiRequest(method, args || []);
    res.json(result);
  } catch (e: any) {
    console.error("API error:", e);
    res.status(500).json({ error: e.message || "Internal Server Error" });
  }
});

export default app;

