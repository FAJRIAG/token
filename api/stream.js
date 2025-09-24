import { fetchUpstream, fetchPublicStream } from '../lib/fetchUpstream.js';

function normalizePublic(node, episode) {
  try {
    const data = typeof node === 'string' ? JSON.parse(node) : node;
    const src  = data?.body?.data ?? data?.data ?? data;
    const chs  = Array.isArray(src?.chapterList) ? src.chapterList : [];
    const episodes = chs.map(ch => (ch?.chapterIndex ?? -1) + 1).filter(n => n > 0);

    // cari sources dari episode diminta
    const target = chs.find(ch => (ch?.chapterIndex ?? -1) + 1 === Number(episode));
    const sources = [];
    if (target?.cdnList) {
      for (const cdn of target.cdnList) {
        for (const v of (cdn.videoPathList ?? [])) {
          const u = v?.videoPath;
          if (u && /^https?:\/\//i.test(u)) sources.push(u);
        }
      }
    }
    return {
      data: {
        bookId: String(src?.bookId ?? ''),
        bookName: String(src?.bookName ?? ''),
        chapterCount: Number(src?.chapterCount ?? episodes.length),
        episodes: [...new Set(episodes)].sort().map(n => ({ number: n })),
        sources: [...new Set(sources)],
        m3u8: sources[0] ?? null,
        videoUrl: sources[0] ?? null
      }
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const bookId  = (req.query.bookId ?? req.query.bookid ?? '').toString().trim();
  const episode = Math.max(1, parseInt(req.query.episode ?? '1', 10) || 1);

  if (!bookId) {
    return res.status(400).json({ error: 'Missing bookId or episode' });
  }

  // 1) coba endpoint utama
  const r = await fetchUpstream('/dramabox/stream', {
    q: { bookId, bookid: bookId, episode, debug: 1 }
  });

  const isOverload = [429, 502, 503, 504].includes(r.status)
    || /limit|too many|overload|terlalu banyak/i.test(r.body || '');

  if (!isOverload) {
    return res.status(r.status).setHeader('Content-Type','application/json').send(r.body);
  }

  // 2) fallback: public stream
  const pf = await fetchPublicStream(bookId, episode);
  if (pf.status === 200) {
    const norm = normalizePublic(pf.body, episode);
    if (norm) return res.status(200).json(norm);
  }

  // 3) tetap gagal
  return res.status(r.status).setHeader('Content-Type','application/json').send(r.body);
}
