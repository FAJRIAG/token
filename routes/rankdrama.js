import express from "express";
import axios from "axios";
import { token } from "../get-token.js";

const router = express.Router();

const buildHeaders = (tk) => ({
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
});

router.get("/", async (req, res) => {
  try {
    const rankType = Number(req.query.ranktype || 1);
    const tk = await token();
    const url = "https://sapi.dramaboxdb.com/drama-box/ranking/list";
    const data = { rankType };
    const result = await axios.post(url, data, { headers: buildHeaders(tk), timeout: 20000 });

    const raw = result?.data ?? {};
    const dataNode = raw.data ?? raw.result ?? raw.payload ?? {};
    const records = dataNode.records ?? dataNode.list ?? [];
    return res.json(records);
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Unknown error (rankdrama)" });
  }
});

export default router;
