import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEVICE_FILE = path.join(__dirname, ".deviceid");

function loadOrCreateDeviceId() {
  // 1) Prioritaskan dari ENV
  if (process.env.DEVICE_ID && process.env.DEVICE_ID.trim()) {
    return process.env.DEVICE_ID.trim();
  }

  // 2) Baca dari file cache lokal
  try {
    if (fs.existsSync(DEVICE_FILE)) {
      const saved = fs.readFileSync(DEVICE_FILE, "utf8").trim();
      if (saved) return saved;
    }
  } catch { /* ignore */ }

  // 3) Generate UUID v4 dan simpan
  const generated = crypto.randomUUID();
  try {
    fs.writeFileSync(DEVICE_FILE, generated, "utf8");
  } catch { /* ignore */ }
  return generated;
}

export const token = async () => {
  const url = process.env.TOKEN_URL || "https://dramabox-token.vercel.app/token";
  const res = await axios.get(url, { timeout: 15000 });
  const data = res?.data || {};

  // Ambil token dari berbagai kemungkinan bentuk
  const tok =
    data.token ||
    data?.data?.token ||
    (typeof data === "string" ? data : null);

  if (!tok) {
    throw new Error(
      `Invalid token response from TOKEN_URL: missing token. Keys: ${Object.keys(data)}`
    );
  }

  // Ambil/make deviceId
  const dev =
    data.deviceid || data.deviceId || data?.data?.deviceid || data?.data?.deviceId || loadOrCreateDeviceId();

  return { token: tok, deviceid: dev, raw: data };
};

export default { token };
