// api/dramabox/search.js
const { proxy, send } = require("./_util.cjs");

module.exports = async (req, res) => {
  const query = String(req.query.query || req.query.q || "");

  // Untuk pencarian, cache lebih pendek
  const result = await proxy(
    "/dramabox/search",
    { query },
    {
      ttlMs: 20_000,          // fresh 20s
      maxStaleMs: 3 * 60_000, // stale 3 menit
      retry: 2,
      backoffMs: 300,
      cbMaxFails: 5,
      cbOpenMs: 25_000,
    }
  );

  if (result.status === 200) {
    return send(res, result.body, 200, { swr: result.swr });
  }
  return send(res, { status: result.status, statusText: result.statusText, body: result.body }, result.status);
};
