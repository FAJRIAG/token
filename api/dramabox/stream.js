export const config = { runtime: "nodejs22.x" };

export default async function handler(req, res) {
  const bookId = (req.query.bookId || req.query.bookid || "").toString();
  const episode = parseInt(req.query.episode || "1", 10);

  if (!bookId || !episode) {
    return res.status(400).json({ error: "Missing bookId or episode" });
  }

  // TODO: ganti ke sumber asli. Untuk demo pakai stream HLS publik:
  const demoHls = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

  const payload = {
    data: {
      m3u8: demoHls,
      episodes: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, sources: [demoHls] })),
      sources: [demoHls]
    }
  };

  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  res.status(200).json(payload);
}
