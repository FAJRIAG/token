import express from "express";
import axios from "axios";
import { token } from "../get-token.js";

const router = express.Router();
const isPublic = process.env.PUBLIC_ONLY === "1";

router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);

    if (isPublic) {
      const r = await axios.get("https://api-dramabox.vercel.app/api/dramabox/latest", {
        params: { page }
      });
      // public API biasanya sudah kirim array langsung
      return res.json(r.data);
    }

    // === PRIVATE MODE (butuh token) ===
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
    const url = "https://sapi.dramaboxdb.com/drama-box/he001/theater";
    const data = { newChannelStyle: 1, isNeedRank: 1, pageNo: page, index: 1, channelId: 43 };
    const result = await axios.post(url, data, { headers, timeout: 20000 });
    const raw = result?.data ?? {};
    const node = raw.data ?? raw.result ?? raw.payload ?? {};
    const records = node?.newTheaterList?.records ?? node?.records ?? node?.list ?? [];
    return res.json(records);
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Unknown error (latest)" });
  }
});

export default router;
