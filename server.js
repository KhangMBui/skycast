import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";

const app = express();
app.use(cors());
app.disable("x-powered-by");

// Serve built frontend when present (production on Render)
const distDir = path.join(process.cwd(), "dist");
app.use(express.static(distDir));

// SPA fallback for client routes
app.use((req, res, next) => {
  // allow API routes to continue
  if (req.path.startsWith("/api/") || req.path.startsWith("/windborne/"))
    return next();
  const indexPath = path.join(distDir, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) next(err);
  });
});

const CACHE_TTL_MS = 1000 * 30; // 30s cache for dev; increase for prod
const cache = new Map();

async function upstreamFetch(url) {
  const res = await fetch(url, { timeout: 8000 });
  const text = await res.text(); // upstream can be corrupted — keep raw
  return text;
}

app.get("/api/treasure/:id", async (req, res) => {
  const id = req.params.id;
  const key = `single:${id}`;
  const now = Date.now();
  if (cache.has(key) && cache.get(key).ts + CACHE_TTL_MS > now) {
    return res.type("application/json").send(cache.get(key).data);
  }
  try {
    const url = `https://a.windbornesystems.com/treasure/${id}.json`;
    const data = await upstreamFetch(url);
    // try to parse JSON to ensure it's valid; if parse fails return raw text
    try {
      JSON.parse(data);
      res.type("application/json").send(data);
    } catch {
      // return text as-is but with application/json header may cause parse error client-side;
      // safer to send as text and let client handle — we send as text here
      res.type("text").send(data);
    }
    cache.set(key, { data, ts: Date.now() });
  } catch (err) {
    console.error("proxy error", err?.message || err);
    res.status(502).json({ error: "Failed to fetch upstream" });
  }
});

app.get("/api/treasure/all", async (_, res) => {
  const key = "all";
  const now = Date.now();
  if (cache.has(key) && cache.get(key).ts + CACHE_TTL_MS > now) {
    return res.type("application/json").send(cache.get(key).data);
  }

  try {
    const ids = Array.from({ length: 24 }, (_, i) =>
      String(i).padStart(2, "0")
    );
    const promises = ids.map((id) =>
      fetch(`https://a.windbornesystems.com/treasure/${id}.json`)
        .then((r) => (r.ok ? r.text().catch(() => null) : null))
        .catch(() => null)
    );
    const results = await Promise.all(promises);
    // results is array of raw texts (or null). Send JSON with index -> raw parsed if possible
    const parsed = results.map((t, i) => {
      if (!t) return null;
      try {
        return JSON.parse(t);
      } catch {
        return t;
      } // keep raw if corrupted
    });
    const payload = JSON.stringify({ ids, parsed });
    cache.set(key, { data: payload, ts: Date.now() });
    res.type("application/json").send(payload);
  } catch (err) {
    console.error("proxy all error", err?.message || err);
    res.status(502).json({ error: "Failed to fetch upstream" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Proxy running on port ${port}`));
