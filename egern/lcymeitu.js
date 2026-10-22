// ==UserScript==
// @Name         栗次元随机美图小组件
// @Platform     Egern
// @Type         generic
// @Author       Modified for t.alcy.cc
// @WebURL       https://t.alcy.cc
// ==/UserScript==

// 图源：t.alcy.cc
// 中号（systemMedium）：仅 pc 横图
// 小号/大号（systemSmall/systemLarge）：随机选择方图分类
// BATCH         每次候选数量，默认 5，范围 1~20
// COOLDOWN      每张图展示时长（分钟），默认 5；0 表示每次刷新换图
// MAX_HISTORY   历史去重数，默认 50

export default async function(ctx) {
  const batch = Math.min(20, Math.max(1, parseInt(ctx.env.BATCH || '5')));
  const maxHistory = Math.max(1, parseInt(ctx.env.MAX_HISTORY || '50'));
  const rawCooldown = parseInt(ctx.env.COOLDOWN || '5');
  const cooldown = rawCooldown === 0 ? 0 : Math.max(1, rawCooldown) * 60 * 1000;
  const refreshAfter = new Date(Date.now() + (cooldown > 0 ? cooldown : 60 * 60 * 1000)).toISOString();
  const family = ctx.widgetFamily;

  if (family === 'accessoryRectangular' || family === 'accessoryCircular') {
    return { type: 'widget', children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }] };
  }
  if (family === 'accessoryInline') {
    return { type: 'widget', children: [{ type: 'text', text: '栗次元美图', maxLines: 1 }] };
  }

  // 适配手机 Widget：中号横图约 1024px 宽；方形组件约 900px，避免原图过重又保留高分辨率。
  const imageWidth = family === 'systemMedium' ? 1024 : 900;
  const sources = family === 'systemMedium'
    ? ['pc']
    : ['tx', 'ys', 'fj', 'moe', 'miku', 'ycy'];
  // 所有持久化键统一使用独立前缀，避免与旧版 setu_* 键冲突。
  const storagePrefix = 'alcy_widget_v1';
  const currentKey = `${storagePrefix}_current_${family}`;
  const lastShowKey = `${storagePrefix}_lastshow_${family}`;
  const historyKey = `${storagePrefix}_history_${family}`;
  let history = [];
  try { history = JSON.parse(ctx.storage.get(historyKey) || '[]'); } catch (_) {}
  const historySet = new Set(history);

  const lastShow = parseInt(ctx.storage.get(lastShowKey) || '0');
  const shouldAdvance = cooldown === 0 || (Date.now() - lastShow) >= cooldown;
  if (!shouldAdvance) {
    const current = ctx.storage.getJSON(currentKey);
    if (current?.base64) return buildWidget(current.url, current.base64, refreshAfter);
  }

  async function downloadBase64(url) {
    const resp = await ctx.http.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' } });
    if (resp.status && resp.status >= 400) throw new Error(`HTTP ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  const urls = [];
  let lastError = '';
  for (let i = 0; i < batch; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)];
    // 随机参数避免 CDN/客户端复用上次的 302/图片响应
    urls.push(`https://t.alcy.cc/${source}?w=${imageWidth}&_t=${Date.now()}_${i}_${Math.random()}`);
  }
  const filtered = urls.filter(url => !historySet.has(url));
  const candidates = filtered.length ? filtered : urls;
  // 每个分类的入口会随机重定向到对应图片；用批次随机挑选入口。
  const picUrl = candidates[Math.floor(Math.random() * candidates.length)];

  let base64;
  try {
    base64 = await downloadBase64(picUrl);
  } catch (e) {
    lastError = e.message || '图片下载失败';
    const old = ctx.storage.getJSON(currentKey);
    if (old?.base64) return buildWidget(old.url, old.base64, refreshAfter);
    return buildErrorWidget(lastError, refreshAfter);
  }

  ctx.storage.setJSON(currentKey, { url: picUrl, base64 });
  history.push(picUrl);
  while (history.length > maxHistory) history.shift();
  ctx.storage.set(historyKey, JSON.stringify(history));
  ctx.storage.set(lastShowKey, String(Date.now()));
  return buildWidget(picUrl, base64, refreshAfter);
}

function buildWidget(url, base64, refreshAfter) {
  return {
    type: 'widget',
    refreshAfter,
    backgroundImage: `data:image/webp;base64,${base64}`,
    padding: 0,
    url,
    children: []
  };
}

function buildErrorWidget(message, refreshAfter) {
  return {
    type: 'widget', refreshAfter, backgroundColor: '#1C1C1E', padding: 16, gap: 8,
    children: [
      { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', color: '#FF9F0A', width: 24, height: 24 },
      { type: 'text', text: '加载失败', font: { size: 'headline', weight: 'bold' }, textColor: '#FFFFFF' },
      { type: 'text', text: message, font: { size: 'caption1' }, textColor: '#FFFFFF88', maxLines: 3 }
    ]
  };
}
