import { fetchUpstream } from '../lib/fetchUpstream.js';

export default async function handler(req, res) {
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
  const r = await fetchUpstream('/dramabox/latest', { q: { page } });
  res.status(r.status).setHeader('Content-Type', 'application/json').send(r.body);
}
