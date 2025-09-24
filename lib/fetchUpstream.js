const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function fetchUpstream(path, { q = {}, retry = 2 } = {}) {
  const base = process.env.UPSTREAM_BASE || 'https://api-dramabox.vercel.app/api';
  const url  = new URL(base.replace(/\/$/, '') + path);

  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  let attempt = 0, res, text;
  while (attempt <= retry) {
    attempt++;
    try {
      res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Vercel-Noken/1.0'
        },
        // penting: Vercel serverless, jangan cache fetch otomatis
        cache: 'no-store'
      });
      text = await res.text();

      // overload?
      const overloaded = [429, 502, 503, 504].includes(res.status)
        || /limit|too many|overload|terlalu banyak/i.test(text || '');

      if (!overloaded) return { status: res.status, body: text };

      if (attempt <= retry) {
        const backoff = Math.min(1200 * attempt, 2000) + Math.floor(Math.random() * 200);
        await sleep(backoff);
        continue;
      }
      return { status: res.status, body: text };
    } catch (e) {
      if (attempt <= retry) {
        const backoff = 400 * attempt + Math.floor(Math.random() * 150);
        await sleep(backoff);
        continue;
      }
      return { status: 500, body: JSON.stringify({ error: e.message }) };
    }
  }
  return { status: 500, body: '{"error":"unknown"}' };
}

// fallback khusus: /debug/public/stream
export async function fetchPublicStream(bookId, episode) {
  const base = process.env.UPSTREAM_BASE || 'https://api-dramabox.vercel.app/api';
  const url  = new URL(base.replace(/\/$/, '') + '/debug/public/stream');
  url.searchParams.set('bookId', bookId);
  url.searchParams.set('episode', String(episode));
  const res  = await fetch(url.toString(), { cache: 'no-store' });
  return { status: res.status, body: await res.text() };
}
