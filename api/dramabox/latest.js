export const config = { runtime: "nodejs22.x" };

export default async function handler(req, res) {
  const page = parseInt(req.query.page || "1", 10);

  // TODO: ganti ke sumber asli kalau sudah siap
  const fake = {
    data: {
      records: [
        { bookId: "41000121386", bookName: "Terjebak dalam Kontrak Cinta", chapterCount: 81, coverWap: "https://picsum.photos/400/600?1" },
        { bookId: "41000121766", bookName: "Kembalinya Sang Petinju", chapterCount: 72, coverWap: "https://picsum.photos/400/600?2" }
      ],
      isMore: page < 3
    }
  };

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(fake);
}
