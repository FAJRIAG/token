export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).end(JSON.stringify({ ok: true, ts: Date.now(), msg: "Hello from /api/token" }));
}
