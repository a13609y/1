// ==UserScript==
// @Name         每日色图小组件v2（由 ai 编写适配 iPhone 端）
// @Platform     Egern
// @Type         generic
// @Author       Cuttlefish (改编为 Egern 版本)
// @WebURL       https://api.lolicon.app/#/setu
// ==/UserScript==

export default async function(ctx) {
  const apiKey   = ctx.env.API_KEY  || '';
  const r18      = ctx.env.R18      || '2';
  const keywords = ctx.env.KEYWORDS || '';
  const batch    = Math.min(20, Math.max(1, parseInt(ctx.env.BATCH || '1')));

  const rawCooldown = parseInt(ctx.env.COOLDOWN || '5');
  const cooldown    = rawCooldown === 0 ? 0 : Math.max(1, rawCooldown) * 60 * 1000;

  const tagList = keywords.split('|').map(t => t.trim()).filter(Boolean);
  const keyword = tagList.length > 0
    ? tagList[Math.floor(Math.random() * tagList.length)]
    : '';

  const family = ctx.widgetFamily;

  if (family === 'accessoryRectangular' || family === 'accessoryCircular') {
    return { type: 'widget', children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }] };
  }
  if (family === 'accessoryInline') {
    return { type: 'widget', children: [{ type: 'text', text: '每日色图', maxLines: 1 }] };
  }

  let aspectRatio;
  if (family === 'systemMedium') {
    aspectRatio = 'gt1.6lt2.4';
  } else {
    aspectRatio = 'gt0.8lt1.3';
  }

  const imageSize = (family === 'systemSmall') ? 'small' : 'regular';

  const urlPoolKey  = `setu_urls_${family}`;
  const indexKey    = `setu_index_${family}`;
  const cooldownKey = `setu_cooldown_${family}`;
  const configKey   = `setu_config_${family}`;

  let urlPool = [];
  try { urlPool = JSON.parse(ctx.storage.get(urlPoolKey) || '[]'); } catch (_) {}
  let index = parseInt(ctx.storage.get(indexKey) || '0');

  const lastRequestStr = ctx.storage.get(cooldownKey);
  const lastRequest    = lastRequestStr ? parseInt(lastRequestStr) : 0;
  const expired        = cooldown === 0 || (Date.now() - lastRequest) >= cooldown;
  const configSig      = `${batch}|${r18}|${keywords}|${imageSize}|${aspectRatio}`;
  const configChanged  = configSig !== (ctx.storage.get(configKey) || '');

  if (expired || configChanged) {
    for (let i = 0; i < urlPool.length; i++) {
      ctx.storage.delete(`setu_img_${family}_${i}`);
    }

    try {
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

      const newUrls = obj.data
        .map(pic => pic.urls?.[imageSize] || pic.urls?.original || '')
        .filter(Boolean);

      if (newUrls.length > 0) {
        urlPool = newUrls;
        index = 0;
        ctx.storage.set(urlPoolKey, JSON.stringify(urlPool));
        ctx.storage.set(indexKey, '0');
        ctx.storage.set(cooldownKey, String(Date.now())); // 仅在真正请求后写入
        ctx.storage.set(configKey, configSig);
      }

    } catch (e) {
      if (urlPool.length === 0) return buildErrorWidget(e.message || '请求失败');
    }
  }

  if (urlPool.length === 0) return buildErrorWidget('暂无图片');

  // 修复：index 归零不重置 cooldown
  if (index >= urlPool.length) {
    index = 0;
  }

  const picUrl    = urlPool[index];
  const nextIndex = (index + 1) % urlPool.length;
  const nextUrl   = urlPool[nextIndex];

  ctx.storage.set(indexKey, String(index + 1));

  const imgCacheKey = `setu_img_${family}_${index}`;
  const imgCache    = ctx.storage.getJSON(imgCacheKey);

  let base64;

  if (imgCache?.url === picUrl && imgCache?.base64) {
    base64 = imgCache.base64;
  } else {
    try {
      base64 = await downloadBase64(ctx, picUrl);
      ctx.storage.setJSON(imgCacheKey, { url: picUrl, base64 });
    } catch (e) {
      return buildErrorWidget('图片下载失败');
    }
  }

  const result = {
    type: 'widget',
    backgroundImage: `data:image/jpeg;base64,${base64}`,
    padding: 0,
    url: picUrl,
    children: []
  };

  const nextCacheKey = `setu_img_${family}_${nextIndex}`;
  const nextCache    = ctx.storage.getJSON(nextCacheKey);
  if (!nextCache || nextCache.url !== nextUrl) {
    downloadBase64(ctx, nextUrl)
      .then(b64 => ctx.storage.setJSON(nextCacheKey, { url: nextUrl, base64: b64 }))
      .catch(() => {});
  }

  return result;
}

async function downloadBase64(ctx, url) {
  const imgResp = await ctx.http.get(url, {
    headers: { 'Referer': 'https://www.pixiv.net/' }
  });
  const buffer = await imgResp.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildErrorWidget(message) {
  return {
    type: 'widget',
    backgroundColor: '#1C1C1E',
    padding: 16,
    gap: 8,
    children: [
      { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', color: '#FF9F0A', width: 24, height: 24 },
      { type: 'text', text: '加载失败', font: { size: 'headline', weight: 'bold' }, textColor: '#FFFFFF' },
      { type: 'text', text: message, font: { size: 'caption1' }, textColor: '#FFFFFF88', maxLines: 3 }
    ]
  };
}
