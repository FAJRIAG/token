// api/token.js
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    ts: Date.now(),
    author: "FAJRIAG",
    msg: "Hello from Token API 🚀"
  });
}
