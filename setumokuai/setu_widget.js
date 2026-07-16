// ==UserScript==
// @Name         每日美图小组件
// @Platform     Egern
// @Type         generic
// @Author       Cuttlefish
// @WebURL       https://api.lolicon.app/#/setu
// ==/UserScript==

// ============================================================
// 环境变量说明
// ============================================================
// API_KEY      可选  你的 lolicon API Key
// R18          可选  0=仅非R18 1=仅R18 2=混合  默认：2
// KEYWORDS     可选  搜索标签，多个标签用 | 分隔
// BATCH        可选  每次请求图片数量  默认：10  范围：1~20
// COOLDOWN     可选  每张图展示时长（小时）默认：1  设为 0 则每次刷新都换图
// MAX_HISTORY  可选  历史去重最大记录数  默认：50
// ============================================================

export default async function(ctx) {
  const apiKey     = ctx.env.API_KEY    || '';
  const r18        = ctx.env.R18        || '2';
  const keywords   = ctx.env.KEYWORDS   || '';
  const batch      = Math.min(20, Math.max(1, parseInt(ctx.env.BATCH      || '10')));
  const maxHistory = Math.max(1,           parseInt(ctx.env.MAX_HISTORY   || '50'));

  // COOLDOWN 单位：小时
  const rawCooldown = parseInt(ctx.env.COOLDOWN || '1');
  const cooldown    = rawCooldown === 0 ? 0 : Math.max(1, rawCooldown) * 60 * 60 * 1000;

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
  const lastShowKey = `setu_lastshow_${family}`;
  const cooldownKey = `setu_cooldown_${family}`;
  const configKey   = `setu_config_${family}`;
  const historyKey  = `setu_history_${family}`;

  let urlPool = [];
  try { urlPool = JSON.parse(ctx.storage.get(urlPoolKey) || '[]'); } catch (_) {}

  let index = parseInt(ctx.storage.get(indexKey) || '0');

  let history = [];
  try { history = JSON.parse(ctx.storage.get(historyKey) || '[]'); } catch (_) {}
  const historySet = new Set(history);

  const configSig     = `${batch}|${r18}|${keywords}|${imageSize}|${aspectRatio}`;
  const configChanged = configSig !== (ctx.storage.get(configKey) || '');

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

    const effectiveMaxHistory = Math.min(maxHistory, obj.data.length - 1);

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
    index   = 0;
    ctx.storage.set(urlPoolKey,  JSON.stringify(urlPool));
    ctx.storage.set(indexKey,    '0');
    ctx.storage.set(cooldownKey, String(Date.now()));
    ctx.storage.set(configKey,   configSig);

    return effectiveMaxHistory;
  }

  const lastShowStr   = ctx.storage.get(lastShowKey);
  const lastShow      = lastShowStr ? parseInt(lastShowStr) : 0;
  const shouldAdvance = cooldown === 0 || (Date.now() - lastShow) >= cooldown;

  let effectiveMaxHistory = maxHistory;

  if (shouldAdvance || configChanged) {
    if (!configChanged && urlPool.length > 0 && index + 1 < urlPool.length) {
      // 池子还有剩余，直接推进 index（Schedule 已提前缓存好下一张）
      index = index + 1;
      ctx.storage.set(indexKey,    String(index));
      ctx.storage.set(lastShowKey, String(Date.now()));
    } else {
      try {
        effectiveMaxHistory = await fetchNewPool();
        ctx.storage.set(lastShowKey, String(Date.now()));
      } catch (e) {
        if (urlPool.length === 0) return buildErrorWidget(e.message || '请求失败');
      }
    }
  }

  if (urlPool.length === 0) return buildErrorWidget('暂无图片');
  if (index >= urlPool.length) index = 0;

  const MAX_RETRY = 5;
  let base64;
  let validIndex = index;

  for (let attempt = 0; attempt < Math.min(MAX_RETRY, urlPool.length); attempt++) {
    const tryUrl      = urlPool[validIndex];
    const imgCacheKey = `setu_img_${family}_${validIndex}`;
    const imgCache    = ctx.storage.getJSON(imgCacheKey);

    if (imgCache?.url === tryUrl && imgCache?.base64) {
      base64 = imgCache.base64;
      break;
    }

    try {
      base64 = await downloadBase64(tryUrl);
      ctx.storage.setJSON(imgCacheKey, { url: tryUrl, base64 });
      break;
    } catch (e) {
      ctx.storage.delete(imgCacheKey);
      urlPool.splice(validIndex, 1);

      if (urlPool.length === 0) {
        try {
          effectiveMaxHistory = await fetchNewPool();
          ctx.storage.set(lastShowKey, String(Date.now()));
        } catch (_) {}
        if (urlPool.length === 0) return buildErrorWidget('图片均已失效且拉取新图失败，请稍后重试');
        validIndex = 0;
        break;
      }

      if (validIndex >= urlPool.length) validIndex = 0;
      ctx.storage.set(urlPoolKey, JSON.stringify(urlPool));
    }
  }

  if (!base64) return buildErrorWidget('图片加载失败，请稍后重试');

  const picUrl = urlPool[validIndex];

  if (!historySet.has(picUrl)) {
    history.push(picUrl);
    if (history.length > effectiveMaxHistory) history.shift();
    ctx.storage.set(historyKey, JSON.stringify(history));
  }

  return {
    type: 'widget',
    backgroundImage: `data:image/jpeg;base64,${base64}`,
    padding: 0,
    url: picUrl,
    children: []
  };
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
