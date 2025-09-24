export const config = { runtime: "nodejs" };
import U from "./_util";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    U.sendCors(res);
    return res.status(204).end();
  }
  U.sendCors(res);

  const bookId = (req.query.bookId || req.query.bookid || "").toString().trim();
  const episode = Math.max(1, parseInt(req.query.episode || "1", 10));

  if (!bookId) {
    return res.status(400).json({ error: "Missing bookId or episode" });
  }

  const upstream =
    `${U.BASE}/dramabox/stream?bookId=${encodeURIComponent(bookId)}&bookid=${encodeURIComponent(bookId)}&episode=${episode}`;

  const r = await U.fetchRetry(upstream, "stream");
  let data = U.jsonTry(r.text);

  if (r.status === 200 && data) {
    U.cachePublic(res, 30, 120);
    return res.status(200).json(data);
  }

  // ====== Fallback anti-502: berikan demo HLS agar player tetap jalan ======
  const demoHls = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
  const epCount = 12;
  const episodes = Array.from({ length: epCount }, (_, i) => ({
    number: i + 1, sources: [demoHls]
  }));

  U.cachePublic(res, 15, 60);
  return res.status(200).json({
    data: {
      m3u8: demoHls,
      hls: demoHls,
      sources: [demoHls],
      episodes
    },
    error: `fallback(stream): HTTP${r.status}`,
    debug: { upstream, base: U.BASE }
  });
}
