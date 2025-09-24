// api/token.js
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({
    ok: true,
    ts: Date.now(),
    msg: "Hello from /api/token"
  });
}
