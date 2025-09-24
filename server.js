import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

import homeRouter from "./routes/home.js";
import latestRouter from "./routes/latest.js";
import searchRouter from "./routes/search.js";
import populerRouter from "./routes/populer.js";
import rankRouter from "./routes/rankdrama.js";
import streamRouter from "./routes/stream.js";
import { token as getTok } from "./get-token.js";

const app = express();
app.use(bodyParser.json());

// Healthcheck
app.get("/debug/ping", (_req, res) => res.json({ ok: true }));

// Lihat token/deviceId (PRIVATE mode)
app.get("/debug/token", async (_req, res) => {
  try {
    const t = await getTok();
    res.json({
      ok: true,
      tokenSample: (t.token || "").slice(0, 12) + (t.token ? "..." : ""),
      deviceId: t.deviceid || null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message });
  }
});

// === DEBUG PUBLIK: proxy langsung ke public stream; kembalikan status + body aslinya ===
app.get("/debug/public/stream", async (req, res) => {
  try {
    const { bookId, episode } = req.query;
    if (!bookId || !episode) {
      return res.status(400).json({ error: "Missing bookId or episode" });
    }
    const url = "https://api-dramabox.vercel.app/api/dramabox/stream";
    const upstream = await axios.get(url, {
      // ⬇️ WAJIB: gunakan 'bookid' (lowercase) untuk public API
      params: { bookid: String(bookId), episode: String(episode) },
      timeout: 20000,
      validateStatus: () => true
    });

    console.log("[DEBUG PUBLIC STREAM]", {
      status: upstream.status,
      params: { bookid: String(bookId), episode: String(episode) },
      bodyType: typeof upstream.data
    });

    return res.status(upstream.status).json({
      status: upstream.status,
      statusText: upstream.statusText,
      body: upstream.data
    });
  } catch (e) {
    return res.status(e?.response?.status || 500).json({
      error: e?.message || "debug proxy error",
      body: e?.response?.data || null
    });
  }
});

// Mount routers (endpoint utama)
app.use("/dramabox/home", homeRouter);
app.use("/dramabox/latest", latestRouter);
app.use("/dramabox/search", searchRouter);
app.use("/dramabox/populer", populerRouter);
app.use("/dramabox/rankdrama", rankRouter);
app.use("/dramabox/stream", streamRouter);

// 404 fallback
app.use((req, res) => res.status(404).json({ error: "Not found", path: req.path }));

const PORT = process.env.PORT || 5174;
console.log(`✅ API server running at http://localhost:${PORT} (PUBLIC_ONLY=${process.env.PUBLIC_ONLY || "0"})`);
app.listen(PORT);
