// api/dramabox/latest.js
const { proxy, send } = require("./_util.cjs");

module.exports = async (req, res) => {
  const page = String(req.query.page || "1");

  const result = await proxy(
    "/dramabox/latest",
    { page },
    {
      ttlMs: 45_000,      // fresh 45s
      maxStaleMs: 5 * 60_000, // boleh 5 menit stale
      retry: 3,
      backoffMs: 350,
      cbMaxFails: 5,
      cbOpenMs: 30_000,
    }
  );

  // Jika sukses/stale → kirim 200 dgn body upstream (Laravel happy)
  if (result.status === 200) {
    return send(res, result.body, 200, { swr: result.swr });
  }

  // Kalau benar2 gagal & tak ada cache → kirimkan error upstream (bukan 500)
  return send(res, { status: result.status, statusText: result.statusText, body: result.body }, result.status);
};
