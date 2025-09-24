// api/dramabox/_util.cjs
// CommonJS util for Vercel Node (nodejs) runtime

// Node 18/20/22 di Vercel sudah punya global fetch.
// Tidak perlu require('node-fetch').

const BASE = "https://api-dramabox.vercel.app/api";

// status yang dianggap overload/limit
const OVERLOAD = new Set([429, 502, 503, 504]);

// memori lokal dalam proses (akan hilang saat cold start — masih oke untuk SWR singkat)
const mem = {
  cache: new Map(),  // key -> { ts, ttl, data }
  cb: new Map(),     // key -> { fails, openUntil }
};

// helper: buat key cache deterministik
function cacheKey(path, queryObj) {
  const qs = new URLSearchParams();
  Object.entries(queryObj || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  return path + "?" + qs.toString();
}

function now() {
  return Date.now();
}

// cache helpers
function putCache(key, data, ttlMs) {
  mem.cache.set(key, { ts: now(), ttl: ttlMs, data });
}
function getCache(key) {
  const entry = mem.cache.get(key);
  if (!entry) return { fresh: false, stale: null };
  const age = now() - entry.ts;
  const fresh = age <= entry.ttl;
  return { fresh, stale: entry.data };
}

// circuit breaker helpers
function cbState(key) {
  const s = mem.cb.get(key) || { fails: 0, openUntil: 0 };
  if (s.openUntil && now() < s.openUntil) return { ...s, open: true };
  return { ...s, open: false };
}
function cbFail(key, maxFails = 5, openMs = 30_000) {
  const s = cbState(key);
  s.fails += 1;
  if (s.fails >= maxFails) {
    s.openUntil = now() + openMs;
    s.fails = 0; // reset counter setelah membuka
  }
  mem.cb.set(key, s);
}
function cbReset(key) {
  mem.cb.set(key, { fails: 0, openUntil: 0 });
}

// parse JSON aman
async function safeJson(res) {
  try {
    return await res.json();
  } catch (e) {
    try {
      const txt = await res.text();
      return txt; // biar terlihat di debug
    } catch {
      return null;
    }
  }
}

// request upstream dengan retry & backoff
async function requestUpstream(url, attempts = 3, baseDelay = 300, jitter = 120) {
  let last = { status: 0, statusText: "NO_REQUEST", body: null };
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Vercel-Proxy/1.0" },
      });
      const body = await safeJson(res);
      return { status: res.status, statusText: res.statusText, body };
    } catch (e) {
      last = { status: 0, statusText: "FETCH_ERR", body: { error: String(e.message || e) } };
      // backoff sebelum retry (kecuali attempt terakhir)
      if (i < attempts - 1) {
        const delay = Math.round(baseDelay * Math.pow(1.8, i)) + Math.floor(Math.random() * jitter);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return last;
}

/**
 * Proxy utama dengan cache + SWR + circuit breaker.
 *
 * @param {string} path - path upstream (mis. "/dramabox/latest")
 * @param {object} query - query params
 * @param {object} opt - { ttlMs, maxStaleMs, retry, backoffMs, cbMaxFails, cbOpenMs }
 */
async function proxy(path, query = {}, opt = {}) {
  const {
    ttlMs = 45_000,      // fresh window
    maxStaleMs = 5 * 60_000, // boleh sajikan stale max 5 menit
    retry = 3,
    backoffMs = 300,
    cbMaxFails = 5,
    cbOpenMs = 30_000,
  } = opt;

  // circuit breaker per endpoint (gabungkan path sebagai key)
  const cbKey = "cb:" + path;
  const cb = cbState(cbKey);
  const key = cacheKey(path, query);

  // kalau CB open → coba serve cache stale
  if (cb.open) {
    const entry = mem.cache.get(key);
    if (entry && now() - entry.ts <= ttlMs + maxStaleMs) {
      return { status: 200, statusText: "OK(STALE-CB)", body: entry.data, swr: true };
    }
    return {
      status: 503,
      statusText: "Service Unavailable (circuit-open)",
      body: { error: "circuit-open" },
    };
  }

  // kalau ada cache fresh → langsung balas
  const { fresh, stale } = getCache(key);
  if (fresh && stale) {
    return { status: 200, statusText: "OK(CACHE)", body: stale };
  }

  // rakit URL upstream
  const url = new URL(BASE + path);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });

  // request upstream
  const result = await requestUpstream(url.toString(), retry, backoffMs);

  // sukses 200 → reset CB & cache
  if (result.status === 200 && result.body) {
    cbReset(cbKey);
    putCache(key, result.body, ttlMs);
    return { status: 200, statusText: "OK", body: result.body };
  }

  // kalau overload → naikkan fail dan coba stale
  if (OVERLOAD.has(result.status)) {
    cbFail(cbKey, cbMaxFails, cbOpenMs);

    const entry = mem.cache.get(key);
    if (entry && now() - entry.ts <= ttlMs + maxStaleMs) {
      // sajikan stale agar klien (Laravel) tidak error
      return { status: 200, statusText: "OK(STALE)", body: entry.data, swr: true };
    }

    // tidak ada cache → propagasi status/isi upstream (TAPI tidak crash)
    return {
      status: result.status,
      statusText: result.statusText,
      body: result.body || { error: "upstream-overload" },
    };
  }

  // selain overload:
  // - kalau ada cache stale → kasih stale (supaya UI tetap jalan)
  const entry = mem.cache.get(key);
  if (entry && now() - entry.ts <= ttlMs + maxStaleMs) {
    return { status: 200, statusText: "OK(STALE)", body: entry.data, swr: true };
  }

  // - kalau tidak ada cache → propagate error non-500
  const safeStatus = result.status && result.status !== 0 ? result.status : 502;
  return { status: safeStatus, statusText: result.statusText || "Bad Gateway", body: result.body };
}

// kirim JSON + beberapa header info
function send(res, payload, code = 200, extra = {}) {
  try {
    if (!res.headersSent) {
      res.setHeader("Cache-Control", "no-store"); // kontrol respons proxy
      if (extra.swr) res.setHeader("x-swr", "1");
    }
  } catch {}
  res.status(code).json(payload);
}

module.exports = { proxy, send };
