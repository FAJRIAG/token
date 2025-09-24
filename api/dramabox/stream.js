// api/dramabox/stream.js
const { proxy, send } = require("./_util.cjs");

module.exports = async (req, res) => {
  const bookId = String(req.query.bookId || req.query.bookid || "");
  const episode = String(req.query.episode || "1");

  if (!bookId || !episode) {
    return send(res, { error: "Missing bookId or episode" }, 400);
  }

  // Sertakan kedua varian param (beberapa upstream peka huruf)
  const result = await proxy(
    "/dramabox/stream",
    { bookId, bookid: bookId, episode },
    {
      ttlMs: 10_000,          // stream cepat basi (10s)
      maxStaleMs: 2 * 60_000, // tapi boleh stale 2 menit saat overload
      retry: 3,
      backoffMs: 400,
      cbMaxFails: 4,
      cbOpenMs: 25_000,
    }
  );

  if (result.status === 200) {
    return send(res, result.body, 200, { swr: result.swr });
  }
  return send(res, { status: result.status, statusText: result.statusText, body: result.body }, result.status);
};
