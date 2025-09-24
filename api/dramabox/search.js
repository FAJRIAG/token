export const config = { runtime: "nodejs22.x" };

export default async function handler(req, res) {
  const q = (req.query.query || "").toString();

  // TODO: ganti ke pencarian sumber asli
  const all = [
    { bookId: "41000121386", bookName: "Terjebak dalam Kontrak Cinta", chapterCount: 81, coverWap: "https://picsum.photos/400/600?1" },
    { bookId: "41000121766", bookName: "Kembalinya Sang Petinju", chapterCount: 72, coverWap: "https://picsum.photos/400/600?2" }
  ];
  const filtered = q ? all.filter(x => x.bookName.toLowerCase().includes(q.toLowerCase())) : all;

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json({ data: { records: filtered } });
}
