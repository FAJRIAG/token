import { fetchUpstream } from '../lib/fetchUpstream.js';

export default async function handler(req, res) {
  const query = (req.query.query ?? req.query.q ?? '').toString();
  const r = await fetchUpstream('/dramabox/search', { q: { query } });
  res.status(r.status).setHeader('Content-Type', 'application/json').send(r.body);
}
