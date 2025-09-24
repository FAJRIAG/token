const { U } = require("./_util.cjs");
module.exports.config = { runtime: "nodejs" };

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    U.sendCors(res);
    return res.status(204).end();
  }
  U.sendCors(res);

  const q = ((req.query?.query || req.query?.q || "") + "").trim();
  const url = `${U.BASE}/dramabox/search?query=${encodeURIComponent(q)}`;

  const r = await U.fetchRetry(url, "search");
  const data = U.jsonTry(r.text);

  if (r.status === 200 && data) {
    U.cachePublic(res, 60, 300);
    return res.status(200).json(data);
  }

  U.cachePublic(res, 15, 60);
  return res.status(200).json({
    data: { records: [] },
    error: `search fallback: HTTP${r.status}`,
  });
};
