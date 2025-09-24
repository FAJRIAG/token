import express from "express";
import axios from "axios";
import { token } from "../get-token.js";

const router = express.Router();
const isPublic = process.env.PUBLIC_ONLY === "1";

// Preferensi bisa diubah sesuai kebutuhan
const CDN_PREF = ["nawsvideo.dramaboxdb.com", "nakavideo.dramaboxdb.com"];
const QUALITY_PREF = [720, 540, 1080];

function normalizeNode(raw) {
  const node = raw?.data ?? raw?.result ?? raw?.payload ?? {};
  const chapters = node?.chapterList ?? node?.list ?? [];
  return { node, chapters };
}

function pickUrlFromChapter(chapter, cdnPref = CDN_PREF, qualityPref = QUALITY_PREF) {
  if (!chapter) return null;
  const cdns = Array.isArray(chapter.cdnList) ? [...chapter.cdnList] : [];
  // Urutkan CDN sesuai preferensi
  cdns.sort((a, b) => cdnPref.indexOf(a?.cdnDomain) - cdnPref.indexOf(b?.cdnDomain));

  for (const cdn of cdns) {
    const list = Array.isArray(cdn?.videoPathList) ? [...cdn.videoPathList] : [];
    // Urutkan kualitas sesuai preferensi
    list.sort((a, b) => qualityPref.indexOf(a?.quality) - qualityPref.indexOf(b?.quality));
    for (const v of list) {
      if (v?.videoPath) {
        return {
          url: v.videoPath,
          quality: v.quality,
          cdn: cdn.cdnDomain || null,
        };
      }
    }
  }
  return null;
}

router.get("/", async (req, res) => {
  const { bookId, episode, episodeIndex, debug } = req.query;

  if (!bookId || !episode) {
    return res.status(400).json({ error: "Missing bookId or episode" });
  }
  const epIndex = Number(episodeIndex ?? 0);

  try {
    // =========================
    // ======= PUBLIC ==========
    // =========================
    if (isPublic) {
      const url = "https://api-dramabox.vercel.app/api/dramabox/stream";
      const upstream = await axios.get(url, {
        // penting: public API pakai 'bookid' lowercase
        params: { bookid: String(bookId), episode: String(episode) },
        timeout: 20000,
        validateStatus: () => true,
      });

      console.log("[PUBLIC STREAM]", {
        status: upstream.status,
        params: { bookid: String(bookId), episode: String(episode) },
      });

      // Mode debug: kirim balik apa adanya
      if (debug === "1") {
        return res.status(upstream.status).json({
          status: upstream.status,
          statusText: upstream.statusText,
          body: upstream.data,
        });
      }

      if (!String(upstream.status).startsWith("2")) {
        return res.status(upstream.status || 502).json({
          error: "Public stream failed",
          status: upstream.status,
          body: upstream.data,
        });
      }

      const { node, chapters } = normalizeNode(upstream.data);
      if (!Array.isArray(chapters) || chapters.length === 0) {
        return res.status(404).json({ error: "No chapters", meta: { count: chapters?.length || 0 } });
      }

      const ch = chapters[epIndex];
      if (!ch) {
        return res.status(404).json({
          error: "Episode index out of range",
          meta: { available: chapters.length, requestedIndex: epIndex },
        });
      }

      const chosen = pickUrlFromChapter(ch);
      if (!chosen) return res.status(404).json({ error: "No playable URL found" });

      return res.json({
        bookId: node.bookId ?? String(bookId),
        bookName: node.bookName ?? undefined,
        episodeIndex: ch.chapterIndex ?? epIndex,
        episodeName: ch.chapterName ?? undefined,
        quality: chosen.quality,
        cdn: chosen.cdn,
        playUrl: chosen.url,
        thumbnail: ch.chapterImg ?? undefined,
      });
    }

    // =========================
    // ======= PRIVATE =========
    // =========================
    const tk = await token();
    const headers = {
      "User-Agent": "okhttp/4.10.0",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
      tn: `Bearer ${tk.token}`,
      version: "430",
      vn: "4.3.0",
      cid: "DRA1000000",
      "package-name": "com.storymatrix.drama",
      apn: "1",
      "device-id": tk.deviceid,
      language: "in",
      "current-language": "in",
      p: "43",
      "time-zone": "+0800",
    };

    const url = "https://sapi.dramaboxdb.com/drama-box/chapterv2/batch/load";
    const data = {
      boundaryIndex: 0,
      comingPlaySectionId: -1,
      index: Number(episode),
      currencyPlaySource: "discover_new_rec_new",
      needEndRecommend: 0,
      currencyPlaySourceName: "",
      preLoad: false,
      rid: "",
      pullCid: "",
      loadDirection: 0,
      startUpKey: "",
      bookId: String(bookId),
    };

    const result = await axios.post(url, data, {
      headers,
      timeout: 20000,
      validateStatus: () => true,
    });

    console.log("[PRIVATE STREAM]", {
      status: result.status,
      bookId: String(bookId),
      episode: Number(episode),
    });

    // Mode debug: kirim balik apa adanya
    if (debug === "1") {
      return res.status(result.status).json({
        status: result.status,
        body: result.data,
      });
    }

    if (!String(result.status).startsWith("2")) {
      return res.status(result.status || 502).json({
        error: "Private stream failed",
        status: result.status,
        body: result.data,
      });
    }

    const { node, chapters } = normalizeNode(result.data);
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return res.status(404).json({ error: "No chapters", meta: { count: chapters?.length || 0 } });
    }

    const ch = chapters[epIndex];
    if (!ch) {
      return res.status(404).json({
        error: "Episode index out of range",
        meta: { available: chapters.length, requestedIndex: epIndex },
      });
    }

    const chosen = pickUrlFromChapter(ch);
    if (!chosen) return res.status(404).json({ error: "No playable URL found" });

    return res.json({
      bookId: node.bookId ?? String(bookId),
      bookName: node.bookName ?? undefined,
      episodeIndex: ch.chapterIndex ?? epIndex,
      episodeName: ch.chapterName ?? undefined,
      quality: chosen.quality,
      cdn: chosen.cdn,
      playUrl: chosen.url,
      thumbnail: ch.chapterImg ?? undefined,
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const body = err?.response?.data || null;
    console.error("[STREAM ERROR]", status, err?.message);
    return res.status(status).json({
      error: err?.message || "Unknown error (stream)",
      body,
    });
  }
});

export default router;
