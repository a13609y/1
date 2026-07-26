// ==UserScript==
// @Name         每日美图小组件 v11（由 ai 编写适配 iPhone 端）
// @Platform     Egern
// @Type         generic
// @Author       Cuttlefish (改编为 Egern 版本)
// @WebURL       https://api.lolicon.app/#/setu
// ==/UserScript==

// ============================================================
// 环境变量说明（在 Egern 脚本 → Env 中填写）
// ============================================================
// API_KEY      可选  你的 lolicon API Key，不填也可使用但有次数限制
// R18          可选  0=仅非R18 1=仅R18 2=混合  默认：2
// KEYWORDS     可选  搜索标签，多个标签用 | 分隔，所有标签同时参与 OR 搜索
//              示例：初音ミク|エミリア|雷電将軍
// BATCH        可选  每次请求 URL 数量  默认：5  范围：1~20
// COOLDOWN     可选  每张图展示时长（分钟）默认：5  设为 0 则每次刷新都换图
// MAX_HISTORY  可选  历史去重最大记录数，满了淘汰最早的  默认：50
// ============================================================

export default async function(ctx) {
  const apiKey     = ctx.env.API_KEY   || '';
  const r18        = ctx.env.R18       || '2';
  const keywords   = ctx.env.KEYWORDS  || '';
  const batch      = Math.min(20, Math.max(1, parseInt(ctx.env.BATCH      || '5')));
  const maxHistory = Math.max(1,           parseInt(ctx.env.MAX_HISTORY  || '50'));

  const rawCooldown = parseInt(ctx.env.COOLDOWN || '5');
  const cooldown    = rawCooldown === 0 ? 0 : Math.max(1, rawCooldown) * 60 * 1000;

  const tagList = keywords.split('|').map(t => t.trim()).filter(Boolean);
  const keyword = tagList.join('|'); // 所有标签 OR 搜索

  const family = ctx.widgetFamily;

  if (family === 'accessoryRectangular' || family === 'accessoryCircular') {
    return { type: 'widget', children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }] };
  }
  if (family === 'accessoryInline') {
    return { type: 'widget', children: [{ type: 'text', text: '每日色图', maxLines: 1 }] };
  }

  const aspectRatio = (family === 'systemMedium') ? 'gt1.6lt2.4' : 'gt0.8lt1.3';
  const imageSize   = (family === 'systemSmall') ? 'small' : 'regular';

  const currentKey  = `setu_current_${family}`;
  const lastShowKey = `setu_lastshow_${family}`;
  const historyKey  = `setu_history_${family}`;
  const debugKey    = `setu_debug_${family}`;

  // ── 读取持久化数据 ─────────────────────────────────────────
  let history = [];
  try { history = JSON.parse(ctx.storage.get(historyKey) || '[]'); } catch (_) {}
  const historySet = new Set(history);

  const lastShow      = parseInt(ctx.storage.get(lastShowKey) || '0');
  const shouldAdvance = cooldown === 0 || (Date.now() - lastShow) >= cooldown;

  // ── 冷却期内直接用缓存 ─────────────────────────────────────
  if (!shouldAdvance) {
    const current = ctx.storage.getJSON(currentKey);
    if (current?.base64) return buildWidget(current.url, current.base64);
  }

  // ── 工具：拉 batch 个 URL ──────────────────────────────────
  async function fetchUrls() {
    const body = {
      r18: parseInt(r18),
      num: batch,
      size: [imageSize],
      aspectRatio: [aspectRatio]
    };
    if (apiKey)  body.apikey = apiKey;
    if (keyword) body.tag = [[keyword]];

    const resp = await ctx.http.post(`https://api.lolicon.app/setu/v2?_t=${Math.random()}`, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      },
      body: JSON.stringify(body)
    });
    const obj = await resp.json();
    if (obj.error) throw new Error(obj.error);
    if (!obj.data || obj.data.length === 0) throw new Error('No data');
    return obj.data
      .map(pic => pic.urls?.[imageSize] || pic.urls?.original || '')
      .filter(Boolean);
  }

  // ── 工具：下载图片转 base64 ────────────────────────────────
  async function downloadBase64(url) {
    const imgResp = await ctx.http.get(url, {
      headers: { 'Referer': 'https://www.pixiv.net/' }
    });
    if (imgResp.status && imgResp.status >= 400) throw new Error(`HTTP ${imgResp.status}`);
    const buffer = await imgResp.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  // ── 工具：写入 history ─────────────────────────────────────
  function addToHistory(url) {
    if (!historySet.has(url)) {
      history.push(url);
      historySet.add(url);
      if (history.length > maxHistory) history.shift();
      ctx.storage.set(historyKey, JSON.stringify(history));
    }
  }

  // ── 拉 URL，过滤历史，有新的用新的，全重复随机用一个 ──────
  let picUrl    = null;
  let lastError = '';

  try {
    const urls     = await fetchUrls();
    const filtered = urls.filter(url => !historySet.has(url));

    if (filtered.length > 0) {
      picUrl = filtered[Math.floor(Math.random() * filtered.length)];
    } else {
      picUrl = urls[Math.floor(Math.random() * urls.length)];
    }

    ctx.storage.setJSON(debugKey, {
      total: urls.length,
      filtered: filtered.length,
      picked: picUrl
    });
  } catch (e) {
    lastError = e.message || '请求失败';
  }

  // ── 请求失败，降级用旧缓存 ─────────────────────────────────
  if (!picUrl) {
    const old = ctx.storage.getJSON(currentKey);
    if (old?.base64) return buildWidget(old.url, old.base64);
    return buildErrorWidget(lastError || '请求失败');
  }

  // ── 下载图片 ───────────────────────────────────────────────
  let base64;
  try {
    base64 = await downloadBase64(picUrl);
  } catch (e) {
    const old = ctx.storage.getJSON(currentKey);
    if (old?.base64) return buildWidget(old.url, old.base64);
    return buildErrorWidget(e.message || '图片下载失败');
  }

  // ── 写入缓存、history、时间戳 ─────────────────────────────
  ctx.storage.setJSON(currentKey, { url: picUrl, base64 });
  addToHistory(picUrl);
  ctx.storage.set(lastShowKey, String(Date.now()));

  return buildWidget(picUrl, base64);
}

function buildWidget(url, base64) {
  return {
    type: 'widget',
    backgroundImage: `data:image/jpeg;base64,${base64}`,
    padding: 0,
    url,
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
