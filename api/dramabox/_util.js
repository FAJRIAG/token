// api/dramabox/_util.js
export const config = { runtime: "nodejs" };

const U = {};

// ====== ENV ======
const envInt = (k, d) => {
  const v = parseInt(process.env[k] || "", 10);
  return Number.isFinite(v) ? v : d;
};
const envFloat = (k, d) => {
  const v = parseFloat(process.env[k] || "");
  return Number.isFinite(v) ? v : d;
};

U.BASE = (process.env.UPSTREAM_BASE || "https://api-dramabox.vercel.app/api").replace(/\/+$/,"");

U.RETRY_MAX        = envInt("RETRY_MAX", 3);
U.BACKOFF_MS       = envInt("BACKOFF_MS", 350);
U.BACKOFF_FACTOR   = envFloat("BACKOFF_FACTOR", 1.8);
U.BACKOFF_JITTER_MS= envInt("BACKOFF_JITTER_MS", 120);
U.CB_MAX_ERRORS    = envInt("CB_MAX_ERRORS", 6);
U.CB_TTL_MS        = envInt("CB_TTL_MS", 30000);

// ====== Circuit breaker (sederhana; per-proses) ======
const cbMap = new Map(); // key -> {openUntil:number, fails:number}
U.cbKey = (action) => `cb:${action}`;

U.cbIsOpen = (key) => {
  const s = cbMap.get(key);
  return !!(s && s.openUntil && Date.now() < s.openUntil);
};

U.cbHitFail = (key) => {
  const s = cbMap.get(key) || { openUntil: 0, fails: 0 };
  s.fails++;
  if (s.fails >= U.CB_MAX_ERRORS) {
    s.openUntil = Date.now() + U.CB_TTL_MS;
    s.fails = 0; // reset counter setelah buka
  }
  cbMap.set(key, s);
};

U.cbReset = (key) => {
  cbMap.set(key, { openUntil: 0, fails: 0 });
};

// ====== HTTP util dengan retry + backoff + jitter ======
U.isOverloaded = (status, text) => {
  if ([429,502,503,504].includes(status)) return true;
  const b = (text || "").toLowerCase();
  return b.includes("limit") || b.includes("too many") || b.includes("overload") || b.includes("terlalu banyak");
};

U.sleep = (ms) => new Promise(r => setTimeout(r, ms));

U.fetchRetry = async (url, action, { headers = {}, timeoutMs = 18000 } = {}) => {
  const cb = U.cbKey(action);
  if (U.cbIsOpen(cb)) {
    return { status: 503, text: '{"error":"circuit-open"}' };
  }

  let attempt = 0;
  let last = { status: 0, text: "" };

  while (attempt < U.RETRY_MAX) {
    attempt++;

    const ctl = new AbortController();
    const tmr = setTimeout(() => ctl.abort("timeout"), timeoutMs);

    let res, text;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "vercel-dramabox/1.0",
          ...headers,
        },
        signal: ctl.signal,
        cache: "no-store",
      });
      text = await res.text();
      clearTimeout(tmr);
    } catch (e) {
      clearTimeout(tmr);
      last = { status: 0, text: `Exception: ${e?.message || e}` };
      // treat as overloaded to trigger backoff
      if (attempt < U.RETRY_MAX) {
        const jitter = Math.floor(Math.random() * U.BACKOFF_JITTER_MS);
        const wait = Math.round(U.BACKOFF_MS * Math.pow(U.BACKOFF_FACTOR, attempt-1)) + jitter;
        await U.sleep(wait);
        continue;
      } else {
        U.cbHitFail(cb);
        return last;
      }
    }

    last = { status: res.status, text };

    if (!U.isOverloaded(res.status, text)) {
      U.cbReset(cb);
      return last;
    }

    // Overloaded → retry (kecuali attempt terakhir)
    if (attempt < U.RETRY_MAX) {
      const jitter = Math.floor(Math.random() * U.BACKOFF_JITTER_MS);
      const wait = Math.round(U.BACKOFF_MS * Math.pow(U.BACKOFF_FACTOR, attempt-1)) + jitter;
      await U.sleep(wait);
      continue;
    } else {
      U.cbHitFail(cb);
      return last;
    }
  }

  return last;
};

// ====== helpers ======
U.jsonTry = (s) => {
  try { return JSON.parse(s); } catch { return null; }
};

U.sendCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

U.cachePublic = (res, seconds, stale = 300) => {
  res.setHeader("Cache-Control", `s-maxage=${seconds}, stale-while-revalidate=${stale}`);
};

export default U;
