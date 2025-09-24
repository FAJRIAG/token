// CommonJS handler
const { U } = require("./_util.cjs");
module.exports.config = { runtime: "nodejs" };

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    U.sendCors(res);
    return res.status(204).end();
  }
  U.sendCors(res);

  const page = Math.max(1, parseInt((req.query?.page || "1"), 10));
  const upstream = `${U.BASE}/dramabox/latest?page=${page}`;

  // 1) coba /latest
  let r = await U.fetchRetry(upstream, "latest");
  let out = U.jsonTry(r.text);

  // 2) fallback → /home
  if (r.status !== 200 || !out) {
    const rHome = await U.fetchRetry(`${U.BASE}/dramabox/home`, "home");
    const jHome = U.jsonTry(rHome.text);
    if (rHome.status === 200 && jHome) {
      const node = jHome.data || jHome;
      const records = node.records || node.list || [];
      out = { data: { records, isMore: false }, error: `fallback(home): ${r.status}` };
    }
  }

  // 3) fallback → /populer?page=1
  if (!out) {
    const rPop = await U.fetchRetry(`${U.BASE}/dramabox/populer?page=1`, "populer");
    const jPop = U.jsonTry(rPop.text);
    if (rPop.status === 200 && jPop) {
      const node = jPop.data || jPop;
      const records = node.records || node.list || [];
      out = { data: { records, isMore: true }, error: `fallback(populer): ${r.status}` };
    }
  }

  if (!out) {
    U.cachePublic(res, 15, 60);
    return res.status(200).json({
      data: { records: [], isMore: false },
      error: `latest failed: HTTP${r.status}`,
    });
  }

  U.cachePublic(res, 60, 300);
  return res.status(200).json(out);
};
