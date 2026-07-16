// ==UserScript==
// @Name         每日美图预缓存 Schedule
// @Platform     Egern
// @Type         schedule
// @Author       Cuttlefish
// @WebURL       https://api.lolicon.app/#/setu
// ==/UserScript==

// ============================================================
// 环境变量说明（与 Generic 脚本共享）
// ============================================================
// API_KEY      可选
// R18          可选  0/1/2  默认：2
// KEYWORDS     可选
// BATCH        可选  默认：10
// MAX_HISTORY  可选  默认：50
// FAMILIES     可选  默认：systemMedium  多个用 | 分隔
// ============================================================

export default async function(ctx) {
  const apiKey     = ctx.env.API_KEY    || '';
  const r18        = ctx.env.R18        || '2';
  const keywords   = ctx.env.KEYWORDS   || '';
  const batch      = Math.min(20, Math.max(1, parseInt(ctx.env.BATCH      || '10')));
  const maxHistory = Math.max(1,           parseInt(ctx.env.MAX_HISTORY   || '50'));

  const familiesRaw = ctx.env.FAMILIES || 'systemMedium';
  const families    = familiesRaw.split('|').map(f => f.trim()).filter(Boolean);

  const tagList = keywords.split('|').map(t => t.trim()).filter(Boolean);
  const keyword = tagList.length > 0
    ? tagList[Math.floor(Math.random() * tagList.length)]
    : '';

  async function downloadBase64(url) {
    const imgResp = await ctx.http.get(url, {
      headers: { 'Referer': 'https://www.pixiv.net/' }
    });
    if (imgResp.status && imgResp.status >= 400) {
      throw new Error(`HTTP ${imgResp.status}`);
    }
    const buffer = await imgResp.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  for (const family of families) {
    const imageSize   = (family === 'systemSmall') ? 'small' : 'regular';
    const aspectRatio = (family === 'systemMedium') ? 'gt1.6lt2.4' : 'gt0.8lt1.3';

    const urlPoolKey  = `setu_urls_${family}`;
    const indexKey    = `setu_index_${family}`;
    const cooldownKey = `setu_cooldown_${family}`;
    const configKey   = `setu_config_${family}`;
    const historyKey  = `setu_history_${family}`;

    let urlPool = [];
    try { urlPool = JSON.parse(ctx.storage.get(urlPoolKey) || '[]'); } catch (_) {}

    const index = parseInt(ctx.storage.get(indexKey) || '0');

    let history = [];
    try { history = JSON.parse(ctx.storage.get(historyKey) || '[]'); } catch (_) {}
    const historySet = new Set(history);

    const configSig = `${batch}|${r18}|${keywords}|${imageSize}|${aspectRatio}`;

    async function fetchNewPool() {
      for (let i = 0; i < urlPool.length; i++) {
        ctx.storage.delete(`setu_img_${family}_${i}`);
      }

      const body = {
        r18: parseInt(r18),
        num: batch,
        size: [imageSize],
        aspectRatio: [aspectRatio]
      };
      if (apiKey)  body.apikey = apiKey;
      if (keyword) body.tag = [[keyword]];

      const resp = await ctx.http.post('https://api.lolicon.app/setu/v2', {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
        },
        body: JSON.stringify(body)
      });
      const obj = await resp.json();

      if (obj.error) throw new Error(obj.error);
      if (!obj.data || obj.data.length === 0) throw new Error('No data');

      let newUrls = obj.data
        .map(pic => pic.urls?.[imageSize] || pic.urls?.original || '')
        .filter(Boolean)
        .filter(url => !historySet.has(url));

      if (newUrls.length === 0) {
        history = [];
        historySet.clear();
        ctx.storage.set(historyKey, '[]');
        newUrls = obj.data
          .map(pic => pic.urls?.[imageSize] || pic.urls?.original || '')
          .filter(Boolean);
      }

      if (newUrls.length === 0) throw new Error('No valid URLs');

      urlPool = newUrls.sort(() => Math.random() - 0.5);
      ctx.storage.set(urlPoolKey,  JSON.stringify(urlPool));
      ctx.storage.set(indexKey,    '0');
      ctx.storage.set(cooldownKey, String(Date.now()));
      ctx.storage.set(configKey,   configSig);
    }

    // 池子空了，拉新池
    if (urlPool.length === 0) {
      try { await fetchNewPool(); } catch (_) { continue; }
    }

    // 下一张已经是池子最后一张，提前拉新池备用
    if (index + 1 >= urlPool.length) {
      try { await fetchNewPool(); } catch (_) {}
      // 缓存新池第 0 张
      if (urlPool.length > 0) {
        const cacheKey = `setu_img_${family}_0`;
        const cached   = ctx.storage.getJSON(cacheKey);
        if (!cached || cached.url !== urlPool[0]) {
          try {
            const b64 = await downloadBase64(urlPool[0]);
            ctx.storage.setJSON(cacheKey, { url: urlPool[0], base64: b64 });
          } catch (_) {}
        }
      }
      continue;
    }

    // 下载并缓存下一张
    const nextIndex    = index + 1;
    const nextUrl      = urlPool[nextIndex];
    const nextCacheKey = `setu_img_${family}_${nextIndex}`;
    const nextCache    = ctx.storage.getJSON(nextCacheKey);

    if (!nextCache || nextCache.url !== nextUrl) {
      try {
        const b64 = await downloadBase64(nextUrl);
        ctx.storage.setJSON(nextCacheKey, { url: nextUrl, base64: b64 });
      } catch (_) {}
    }
  }
}
