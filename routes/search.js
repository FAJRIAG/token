import express from "express";
import axios from "axios";
import { token } from "../get-token.js";

const router = express.Router();
const isPublic = process.env.PUBLIC_ONLY === "1";

router.get("/", async (req, res) => {
  try {
    const query = (req.query.query || "").trim();
    if (!query) return res.json([]);

    if (isPublic) {
      const r = await axios.get("https://api-dramabox.vercel.app/api/dramabox/search", {
        params: { query }
      });
      return res.json(r.data);
    }

    const tk = await token();
    const headers = {
      "User-Agent": "okhttp/4.10.0",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
      "tn": `Bearer ${tk.token}`,
      "version": "430",
      "vn": "4.3.0",
      "cid": "DRA1000042",
      "package-name": "com.storymatrix.drama",
      "apn": "1",
      "device-id": tk.deviceid,
      "language": "in",
      "current-language": "in",
      "p": "43",
      "time-zone": "+0800"
    };
    const url = "https://sapi.dramaboxdb.com/drama-box/search/suggest";
    const data = { keyword: query };
    const result = await axios.post(url, data, { headers, timeout: 20000 });
    const raw = result?.data ?? {};
    const node = raw.data ?? raw.result ?? raw.payload ?? {};
    const list = node.suggestList ?? node.list ?? node.records ?? [];
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Unknown error (search)" });
  }
});

export default router;
