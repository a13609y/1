// ==UserScript==
// @Name         每日色图小组件 v3（由 ai 编写适配 iPhone 端）
// @Platform     Egern
// @Type         generic
// @Author       Cuttlefish (改编为 Egern 版本)
// @WebURL       https://api.lolicon.app/#/setu
// ==/UserScript==

// ============================================================
// 环境变量说明（在 Egern 脚本 → Env 中填写）
// ============================================================
// API_KEY    可选  你的 lolicon API Key，不填也可使用但有次数限制
// R18        可选  0=仅非R18 1=仅R18 2=混合  默认：2
// KEYWORDS   可选  搜索标签，多个标签用 | 分隔，每次随机选一个
//            示例：初音ミク|エミリア|雷電将軍
// BATCH      可选  每次请求图片数量  默认：1  范围：1~20
// COOLDOWN   可选  请求最小间隔（分钟）默认：5  设为 0 则每次刷新都请求
// ============================================================

// ============================================================
// Storage Key 说明
// ============================================================
// setu_urls_{family}      当前图片 URL 池（JSON 数组）
// setu_index_{family}     下一张要显示的图片下标
// setu_cooldown_{family}  上次成功请求 API 的时间戳（毫秒）
// setu_config_{family}    上次请求时的配置签名，用于检测配置变更
// setu_img_{family}_{i}   第 i 张图片的 base64 缓存（JSON: {url, base64}）
// setu_history_{family}   已展示过的图片 URL 历史（JSON 数组，最多保留 MAX_HISTORY 条）
// ============================================================

// 历史去重最大记录数，超出后自动淘汰最早的记录
const MAX_HISTORY = 10;

export default async function(ctx) {
  // ── 读取环境变量 ──────────────────────────────────────────
  const apiKey  = ctx.env.API_KEY  || '';           // lolicon API Key（可选）
  const r18     = ctx.env.R18      || '2';           // R18 模式：0/1/2
  const keywords = ctx.env.KEYWORDS || '';           // 标签关键词，| 分隔
  const batch   = Math.min(20, Math.max(1, parseInt(ctx.env.BATCH || '1'))); // 单次请求图片数，1~20

  // cooldown 为 0 表示每次都请求；否则最小 1 分钟，转换为毫秒
  const rawCooldown = parseInt(ctx.env.COOLDOWN || '5');
  const cooldown    = rawCooldown === 0 ? 0 : Math.max(1, rawCooldown) * 60 * 1000;

  // 从 | 分隔的关键词中随机取一个
  const tagList = keywords.split('|').map(t => t.trim()).filter(Boolean);
  const keyword = tagList.length > 0
    ? tagList[Math.floor(Math.random() * tagList.length)]
    : '';

  // ── 小组件尺寸 ────────────────────────────────────────────
  const family = ctx.widgetFamily; // systemSmall / systemMedium / systemLarge 等

  // 锁屏小组件：返回占位图标
  if (family === 'accessoryRectangular' || family === 'accessoryCircular') {
    return { type: 'widget', children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }] };
  }
  // 锁屏行内小组件：返回文字
  if (family === 'accessoryInline') {
    return { type: 'widget', children: [{ type: 'text', text: '每日色图', maxLines: 1 }] };
  }

  // 中号用横图，小号/大号用方形图
  let aspectRatio;
  if (family === 'systemMedium') {
    aspectRatio = 'gt1.6lt2.4'; // 横图
  } else {
    aspectRatio = 'gt0.8lt1.3'; // 方形图
  }

  // small 用 small 尺寸图片，其余用 regular
  const imageSize = (family === 'systemSmall') ? 'small' : 'regular';

  // ── Storage Key ───────────────────────────────────────────
  const urlPoolKey  = `setu_urls_${family}`;      // 当前图片 URL 池
  const indexKey    = `setu_index_${family}`;     // 下一张图片的下标
  const cooldownKey = `setu_cooldown_${family}`;  // 上次请求时间戳
  const configKey   = `setu_config_${family}`;    // 配置签名（检测变更用）
  const historyKey  = `setu_history_${family}`;   // 去重历史记录

  // ── 读取持久化数据 ─────────────────────────────────────────
  let urlPool = [];
  try { urlPool = JSON.parse(ctx.storage.get(urlPoolKey) || '[]'); } catch (_) {}

  let index = parseInt(ctx.storage.get(indexKey) || '0');

  // 去重历史：已展示过的图片 URL 列表
  let history = [];
  try { history = JSON.parse(ctx.storage.get(historyKey) || '[]'); } catch (_) {}
  const historySet = new Set(history); // 用 Set 加速查重

  // ── 判断是否需要重新请求 API ──────────────────────────────
  const lastRequestStr = ctx.storage.get(cooldownKey);
  const lastRequest    = lastRequestStr ? parseInt(lastRequestStr) : 0;
  const expired        = cooldown === 0 || (Date.now() - lastRequest) >= cooldown; // 冷却是否到期

  // 配置签名：任意参数变化时强制刷新
  const configSig     = `${batch}|${r18}|${keywords}|${imageSize}|${aspectRatio}`;
  const configChanged = configSig !== (ctx.storage.get(configKey) || '');

  if (expired || configChanged) {
    // 清除旧图片的 base64 缓存
    for (let i = 0; i < urlPool.length; i++) {
      ctx.storage.delete(`setu_img_${family}_${i}`);
    }

    try {
      // 构造请求体
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

      // 提取 URL，过滤掉历史中已展示过的，避免重复
      let newUrls = obj.data
        .map(pic => pic.urls?.[imageSize] || pic.urls?.original || '')
        .filter(Boolean)
        .filter(url => !historySet.has(url)); // 去重过滤

      // 如果全部被过滤（历史太满），清空历史重来
      if (newUrls.length === 0) {
        history = [];
        historySet.clear();
        ctx.storage.set(historyKey, '[]');
        newUrls = obj.data
          .map(pic => pic.urls?.[imageSize] || pic.urls?.original || '')
          .filter(Boolean);
      }

      if (newUrls.length > 0) {
        // 随机打乱，避免每次从同一张开始
        urlPool = newUrls.sort(() => Math.random() - 0.5);
        index = 0;
        ctx.storage.set(urlPoolKey, JSON.stringify(urlPool));
        ctx.storage.set(indexKey, '0');
        ctx.storage.set(cooldownKey, String(Date.now())); // 记录本次请求时间
        ctx.storage.set(configKey, configSig);
      }

    } catch (e) {
      // 请求失败且无历史池子可用时，显示错误
      if (urlPool.length === 0) return buildErrorWidget(e.message || '请求失败');
    }
  }

  if (urlPool.length === 0) return buildErrorWidget('暂无图片');

  // index 越界时归零（不重置 cooldown，只是翻页）
  if (index >= urlPool.length) {
    index = 0;
  }

  const picUrl    = urlPool[index];
  const nextIndex = (index + 1) % urlPool.length; // 预加载的下一张下标
  const nextUrl   = urlPool[nextIndex];

  // 更新下标（存 index+1，下次进来直接用）
  ctx.storage.set(indexKey, String(index + 1));

  // ── 将当前图加入历史记录 ──────────────────────────────────
  if (!historySet.has(picUrl)) {
    history.push(picUrl);
    if (history.length > MAX_HISTORY) history.shift(); // 超出上限，丢最旧的
    ctx.storage.set(historyKey, JSON.stringify(history));
  }

  // ── 读取或下载当前图片的 base64 缓存 ──────────────────────
  const imgCacheKey = `setu_img_${family}_${index}`;
  const imgCache    = ctx.storage.getJSON(imgCacheKey);

  let base64;

  if (imgCache?.url === picUrl && imgCache?.base64) {
    // 命中缓存
    base64 = imgCache.base64;
  } else {
    try {
      base64 = await downloadBase64(ctx, picUrl);
      ctx.storage.setJSON(imgCacheKey, { url: picUrl, base64 });
    } catch (e) {
      return buildErrorWidget('图片下载失败');
    }
  }

  // ── 构造小组件返回值 ──────────────────────────────────────
  const result = {
    type: 'widget',
    backgroundImage: `data:image/jpeg;base64,${base64}`,
    padding: 0,
    url: picUrl,   // 点击小组件时在浏览器打开原图
    children: []
  };

  // ── 后台预加载下一张 ──────────────────────────────────────
  const nextCacheKey = `setu_img_${family}_${nextIndex}`;
  const nextCache    = ctx.storage.getJSON(nextCacheKey);
  if (!nextCache || nextCache.url !== nextUrl) {
    downloadBase64(ctx, nextUrl)
      .then(b64 => ctx.storage.setJSON(nextCacheKey, { url: nextUrl, base64: b64 }))
      .catch(() => {});
  }

  return result;
}

// ── 工具函数：下载图片并转为 base64 字符串 ────────────────────
async function downloadBase64(ctx, url) {
  const imgResp = await ctx.http.get(url, {
    headers: { 'Referer': 'https://www.pixiv.net/' } // Pixiv 图片需要带 Referer
  });
  const buffer = await imgResp.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ── 工具函数：构造错误提示小组件 ──────────────────────────────
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
