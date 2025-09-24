// api/token.js
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    token: "demo-token-" + Date.now(),
    info: "FAJRIAG Dramabox Token API"
  });
}
