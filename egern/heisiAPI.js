export default async function (ctx) {
  const API = "http://api.yujn.cn/api/heisi.php";
  const family = ctx.widgetFamily || "systemSmall";
  const MAX_RETRY = 10;

  const ratioRange = {
    systemSmall:          { min: 0.7, max: 1.45 },
    systemMedium:         { min: 1.5, max: 4.0  },
    systemLarge:          { min: 0.7, max: 1.45 },
    systemExtraLarge:     { min: 1.5, max: 4.0  },
    accessoryCircular:    { min: 0.7, max: 1.45 },
    accessoryRectangular: { min: 1.5, max: 4.0  },
    accessoryInline:      { min: 1.5, max: 4.0  },
  };
  const range = ratioRange[family] || { min: 0.5, max: 4.0 };
  const targetCenter = (range.min + range.max) / 2;

  function jpegSize(buf) {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    let i = 2;
    while (i + 8 < v.byteLength) {
      if (v.getUint8(i) !== 0xFF) break;
      const marker = v.getUint16(i);
      if (marker >= 0xFFC0 && marker <= 0xFFCF && marker !== 0xFFC4 && marker !== 0xFFCC) {
        const h = v.getUint16(i + 5);
        const w = v.getUint16(i + 7);
        if (w > 0 && h > 0) return { w, h };
      }
      const segLen = v.getUint16(i + 2);
      if (segLen < 2) break;
      i += 2 + segLen;
    }
    return null;
  }

  function pngSize(buf) {
    const v = new DataView(buf);
    if (v.byteLength < 24) return null;
    if (v.getUint32(0) !== 0x89504E47 || v.getUint32(4) !== 0x0D0A1A0A) return null;
    const w = v.getUint32(16), h = v.getUint32(20);
    return (w > 0 && h > 0) ? { w, h } : null;
  }

  function toBase64(buf) {
    const arr = new Uint8Array(buf);
    let bin = "";
    const CHUNK = 4096;
    for (let i = 0; i < arr.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  async function fetchOne() {
    try {
      const url = API + "?_=" + Date.now() + Math.random().toString(36).slice(2);
      const resp = await ctx.http.get(url);
      const buf  = await resp.arrayBuffer();
      if (!buf || buf.byteLength < 200) return null;

      let mime = "image/jpeg";
      try {
        const ct = (resp.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("png"))  mime = "image/png";
        else if (ct.includes("gif"))  mime = "image/gif";
        else if (ct.includes("webp")) mime = "image/webp";
      } catch (_) {
        const magic = new Uint8Array(buf.slice(0, 8));
        if (magic[0] === 0x89 && magic[1] === 0x50) mime = "image/png";
        else if (magic[0] === 0x47 && magic[1] === 0x49) mime = "image/gif";
      }

      const size = (mime === "image/png") ? pngSize(buf) : jpegSize(buf);
      const ratio = size ? (size.w / size.h) : 1.0;

      return { dataUri: `data:${mime};base64,` + toBase64(buf), ratio };
    } catch (e) {
      return null;
    }
  }

  let best = null, bestDiff = Infinity;
  for (let i = 0; i < MAX_RETRY; i++) {
    const r = await fetchOne();
    if (!r) continue;
    const diff = Math.abs(r.ratio - targetCenter);
    if (diff < bestDiff) { bestDiff = diff; best = r; }
    if (r.ratio >= range.min && r.ratio <= range.max) break;
  }

  const refreshAfter = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  if (!best) {
    return {
      type: "widget",
      backgroundColor: "#111",
      padding: 0,
      refreshAfter,
      url: API,
      children: [],
    };
  }

  return {
    type: "widget",
    backgroundImage: best.dataUri,
    padding: 0,
    refreshAfter,
    url: API,
    children: [],
  };
}
