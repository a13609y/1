// ==UserScript==
// @Name         Pixiv 每日美图小组件 v4
// @Platform     Egern
// @Type         generic
// @Author       Cuttlefish
// @WebURL       https://www.pixiv.net/
// @Version      4.0.0
// ==/UserScript==

/* ================================================================
 * Pixiv 免登录搜索 + 反代图床的每日美图小组件（单一图源，仅全年龄）
 *
 * 数据链路：
 *   搜索  GET https://www.pixiv.net/ajax/search/artworks/{word}
 *         ?word=..&order=date_d&mode=safe&p=1&s_mode=s_tag&type=all&lang=zh
 *         -> body.illustManga.data，36 条/页，含 id/width/height/tags/userName
 *   图片  把返回的 i.pximg.net 缩略图路径改写后挂到反代域名：
 *         /img-master/..._master1200.jpg （1200px，约 300KB~1.2MB）
 *         /c/540x540_70/..._square1200.jpg （540 方图，约 40KB）
 *         实测反代只白名单 360/540 两档缩略，720 以上返回 403
 *
 * ── 环境变量（全部可选）────────────────────────────────────────
 * KEYWORD        搜索词，标签模糊匹配
 * TAGS           精确标签，多个用 | 或 , 分隔，第一个作为搜索词
 * PIXIV_WORD     搜索词，优先级最高
 * WORD_MODE      s_tag（默认，标签模糊）| s_tag_full（标签精确）| s_tc（标题简介）
 * ORDER          date_d（最新，默认）| popular_d（热门，免登录会退化）
 * TYPE           all（默认）| illust | manga
 * COOLDOWN       每张图展示时长（分钟），0 = 每次刷新换图   默认 30
 * MAX_HISTORY    本地去重条数                            默认 120
 * IMAGE_QUALITY  auto（默认，小号 540 / 中大号 1200）| master | thumb
 * IMG_HOST       图床，默认 i.pixiv.re（大陆可用）
 * ASPECT_FIT     auto（默认，按尺寸挑画幅）| off（纯随机）
 * SHOW_INFO      true/false 图上叠加标题作者              默认 true
 * TEXT_COLOR     叠加文字颜色                           默认 #FFFFFF
 * REQUEST_TIMEOUT 单次请求超时（秒）                      默认 15
 * ================================================================ */

const K = {
  cache: 'sx5_cache_',       // + family
  pool: 'sx5_pool',
  history: 'sx5_history',
  lastShow: 'sx5_lastshow_', // + family
  debug: 'sx5_debug'
};

const DEFAULT_HOST = 'i.pixiv.re';
const FALLBACK_HOSTS = ['i.pixiv.re', 'i.pixiv.cat'];
const PAGE_SIZE = 36; // Pixiv 网页搜索固定每页 36 条

export default async function(ctx) {
  const family = ctx.widgetFamily || 'systemSmall';
  const cfg = readConfig(ctx.env);
  const now = Date.now();
  const cooldownMs = cfg.cooldownMin > 0 ? cfg.cooldownMin * 60000 : 0;

  if (family === 'accessoryInline') {
    return { type: 'widget', children: [{ type: 'text', text: 'Pixiv', maxLines: 1 }] };
  }
  if (family === 'accessoryCircular' || family === 'accessoryRectangular') {
    return buildAccessory(ctx, family, cfg);
  }

  const cached = readJSON(ctx, K.cache + family);
  const lastShow = Number(ctx.storage.get(K.lastShow + family) || 0) || 0;
  const remaining = cooldownMs - (now - lastShow);

  if (cached && cached.dataUri && remaining > 0) {
    return buildWidget(cached, family, cfg, new Date(now + remaining).toISOString());
  }

  let history = readJSON(ctx, K.history);
  if (!Array.isArray(history)) history = [];
  history = history.filter(x => typeof x === 'string' && x);
  const historySet = new Set(history);

  let pool = readJSON(ctx, K.pool) || {};
  if (!Array.isArray(pool.items)) pool.items = [];
  const sig = signature(cfg);
  // 搜索参数变了、或池子放了 12 小时，都作废重来
  if (pool.sig !== sig || !pool.ts || now - pool.ts > 12 * 3600 * 1000) {
    pool = { items: [], ts: now, page: 1, sig };
  }

  let lastError = '';
  let errorStatus = null;
  let candidate = pickFromPool(pool, historySet, family, cfg);
  if (candidate) writeJSON(ctx, K.pool, pool);

  if (!candidate) {
    try {
      const res = await searchPixiv(ctx, cfg, pool.page || 1);
      pool = { items: res.items, ts: now, page: res.page, sig };
      writeJSON(ctx, K.pool, pool);
      candidate = pickFromPool(pool, historySet, family, cfg) || pickByAspect(res.items, family, cfg.aspectFit);
      writeJSON(ctx, K.pool, pool);
    } catch (e) {
      lastError = e.message || '搜索失败';
      errorStatus = e.status || null;
    }
  }

  if (!candidate) {
    const backoff = (errorStatus === 429 || errorStatus === 403) ? 45 : 15;
    if (cached && cached.dataUri) return buildWidget(cached, family, cfg, nextIso(backoff));
    return buildError(lastError || '暂无可用图片', cfg, nextIso(Math.min(backoff, 15)));
  }

  // ── 下载（主选失败降一级，不反复打图床）─────────────────────
  let img = null;
  let blocked = false;
  const tried = [];
  for (const url of candidateSources(candidate, cfg, family)) {
    tried.push(url);
    try {
      img = await download(ctx, url, cfg);
      break;
    } catch (e) {
      lastError = e.message || '下载失败';
      if (e.status === 429 || e.status === 403) { blocked = true; break; }
    }
  }

  if (!img) {
    writeJSON(ctx, K.debug, { at: now, stage: 'image', error: lastError, host: hostOf(tried[0]) });
    if (cached && cached.dataUri) return buildWidget(cached, family, cfg, nextIso(blocked ? 45 : 10));
    return buildError(lastError || '图片下载失败', cfg, nextIso(5));
  }

  const entry = {
    pid: candidate.pid,
    page: candidate.page,
    title: clean(candidate.title),
    author: clean(candidate.author),
    tags: Array.isArray(candidate.tags) ? candidate.tags.slice(0, 8) : [],
    origin: candidate.url,
    url: img.url,
    dataUri: img.dataUri,
    at: now
  };

  writeJSON(ctx, K.cache + family, entry);
  history.push(candidate.url);
  while (history.length > cfg.maxHistory) history.shift();
  writeJSON(ctx, K.history, history);
  ctx.storage.set(K.lastShow + family, String(now));
  writeJSON(ctx, K.debug, {
    at: now,
    pid: entry.pid,
    pool: pool.items.length,
    page: pool.page,
    aspect: candidate.__aspect || null,
    error: lastError || null
  });

  return buildWidget(entry, family, cfg, nextIso(cfg.cooldownMin > 0 ? cfg.cooldownMin : 15));
}

/* ============================ 配置 ============================ */

function readConfig(env) {
  const s = (k, d) => {
    const v = env && env[k];
    return v === undefined || v === null || String(v).trim() === '' ? d : String(v).trim();
  };
  const bool = (k, d) => {
    const v = s(k, '');
    if (!v) return d;
    return /^(1|true|yes|on|开)$/i.test(v);
  };
  const int = (k, d, min, max) => {
    const n = parseInt(s(k, ''), 10);
    if (!Number.isFinite(n)) return d;
    return Math.min(max, Math.max(min, n));
  };
  const oneOf = (k, d, allowed) => {
    const v = s(k, d).toLowerCase();
    return allowed.indexOf(v) >= 0 ? v : d;
  };
  const list = (k, max) => s(k, '')
    .split(/[|,，、]/)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, max);

  let host = s('IMG_HOST', DEFAULT_HOST)
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  if (!host || host.indexOf('.') < 0) host = DEFAULT_HOST;

  return {
    keyword: s('KEYWORD', ''),
    pixivWord: s('PIXIV_WORD', ''),
    tags: list('TAGS', 10),
    wordMode: oneOf('WORD_MODE', 's_tag', ['s_tag', 's_tag_full', 's_tc']),
    order: oneOf('ORDER', 'date_d', ['date_d', 'popular_d', 'popular_male_d', 'popular_female_d']),
    type: oneOf('TYPE', 'all', ['all', 'illust', 'manga']),
    cooldownMin: int('COOLDOWN', 30, 0, 24 * 60),
    maxHistory: int('MAX_HISTORY', 120, 1, 500),
    quality: oneOf('IMAGE_QUALITY', 'auto', ['auto', 'master', 'thumb']),
    imgHost: host,
    aspectFit: s('ASPECT_FIT', 'auto').toLowerCase() !== 'off',
    showInfo: bool('SHOW_INFO', true),
    textColor: s('TEXT_COLOR', '#FFFFFF'),
    timeoutMs: int('REQUEST_TIMEOUT', 15, 5, 60) * 1000
  };
}

function signature(cfg) {
  return [cfg.keyword, cfg.pixivWord, cfg.tags.join(','), cfg.order, cfg.type, cfg.wordMode, cfg.imgHost].join('|');
}

function nextIso(minutes) {
  return new Date(Date.now() + Math.max(1, minutes) * 60000).toISOString();
}

/* ============================ 搜索 ============================ */

async function searchPixiv(ctx, cfg, page) {
  const word = cfg.pixivWord || cfg.tags[0] || cfg.keyword || 'オリジナル';
  const p = Math.max(1, page | 0);
  const qs = [
    `word=${encodeURIComponent(word)}`,
    `order=${cfg.order}`,
    'mode=safe',                        // 固定全年龄
    `p=${p}`,
    `s_mode=${cfg.wordMode}`,
    `type=${cfg.type}`,
    'lang=zh'
  ].join('&');

  const url = `https://www.pixiv.net/ajax/search/artworks/${encodeURIComponent(word)}?${qs}`;
  const resp = await request(ctx, url, {
    'Accept': 'application/json',
    'Referer': 'https://www.pixiv.net/',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  }, cfg);

  const body = await resp.json().catch(() => null);
  if (!body) {
    const err = new Error('Pixiv 返回无法解析（可能被风控）');
    err.status = 403;
    throw err;
  }
  if (body.error === true) {
    const err = new Error((body.message || '') || 'Pixiv 搜索被拒绝');
    err.status = 403;
    throw err;
  }

  const box = (body.body && body.body.illustManga) || {};
  const raw = Array.isArray(box.data) ? box.data : [];

  const items = raw
    .filter(it => it && it.id && it.url && it.illustType !== 2) // 跳过动图（zip 包）
    .map(it => ({
      pid: Number(it.id),
      page: `https://www.pixiv.net/artworks/${it.id}`,
      title: it.title,
      author: it.userName,
      tags: it.tags,
      width: it.width,
      height: it.height,
      pageCount: it.pageCount,
      url: String(it.url)
    }))
    .filter(it => /\.(png|jpe?g|gif|webp)$/i.test(it.url.split('?')[0]));

  if (items.length === 0) {
    const err = new Error(p === 1 ? `「${word}」在 Pixiv 没有搜索结果` : '该标签已翻到最后一页');
    err.status = 200;
    throw err;
  }

  const total = Number(box.total) || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { items, page: p >= pages ? 1 : p + 1 };
}

async function request(ctx, url, headers, cfg) {
  let resp;
  try {
    resp = await ctx.http.get(url, { headers, timeout: cfg.timeoutMs });
  } catch (e) {
    const err = new Error('网络不可达 / 超时');
    err.status = 0;
    throw err;
  }
  const st = resp.status || 0;
  if (st === 429) {
    const err = new Error('请求过于频繁，已自动退避');
    err.status = 429;
    throw err;
  }
  if (st === 403) {
    const err = new Error('被 Pixiv 风控拦截（403）');
    err.status = 403;
    throw err;
  }
  if (st >= 400) {
    const err = new Error(`HTTP ${st}`);
    err.status = st;
    throw err;
  }
  return resp;
}

/* ======================= 画幅匹配 / 选图 ======================= */

function targetAspect(family) {
  switch (family) {
    case 'systemMedium': return 2.1;
    case 'systemExtraLarge': return 2.0;
    case 'systemLarge': return 0.95;
    case 'systemSmall': return 1.0;
    default: return 1.0;
  }
}

// 各尺寸接受的画幅区间，先硬筛再算最近邻
function aspectBand(family) {
  switch (family) {
    case 'systemMedium':
    case 'systemExtraLarge':
      return [1.4, 99];
    default:
      return [0.62, 1.45];
  }
}

function pickByAspect(items, family, aspectFit) {
  if (!items || items.length === 0) return null;
  if (!aspectFit) return items[Math.floor(Math.random() * items.length)];

  const band = aspectBand(family);
  const lo = band[0], hi = band[1];
  const target = targetAspect(family);
  const scored = items.map(it => {
    const ar = (it.width && it.height) ? it.width / it.height : 0;
    return { it, ar, score: ar > 0 ? Math.abs(Math.log(ar / target)) : 1 };
  });

  const inBand = scored.filter(x => x.ar >= lo && x.ar <= hi);
  const base = inBand.length ? inBand : scored;

  base.sort((a, b) => a.score - b.score);
  const limit = Math.max(0.1, base[0].score + 0.15);
  const head = base.filter(x => x.score <= limit).slice(0, 3);
  const picked = head[Math.floor(Math.random() * head.length)];

  picked.it.__aspect = {
    target,
    ar: picked.ar ? +picked.ar.toFixed(2) : null,
    band: inBand.length ? 'in' : 'relaxed'
  };
  return picked.it;
}

function pickFromPool(pool, historySet, family, cfg) {
  if (!pool || !Array.isArray(pool.items) || pool.items.length === 0) return null;
  const fresh = pool.items.filter(it => it && it.url && !historySet.has(it.url));
  if (fresh.length === 0) return null;

  const picked = pickByAspect(fresh, family, cfg.aspectFit);
  pool.items = pool.items.filter(it => it !== picked);
  return picked;
}

/* ========================= 图片地址推导 ======================= */

// 从缩略图 URL 取出 /img-master/... 主干，再拼 1200 / 540 两档
function imageStem(rawUrl) {
  const m = /^https?:\/\/[^/]+(\/.*)$/.exec(String(rawUrl || ''));
  if (!m) return null;
  let path = m[1];
  path = path.replace(/^\/c\/[^/]+\//, '/');   // 去掉 CDN 的 /c/250x250_80_a2/
  path = path.replace('/img-original/', '/img-master/');
  const fm = /^(.*_p\d+?)(?:_square1200|_master1200)?\.(?:png|jpe?g|gif|webp)$/i.exec(path);
  return fm ? fm[1] : null;
}

function hostOf(url) {
  const m = /^https?:\/\/([^/]+)/.exec(String(url || ''));
  return m ? m[1] : '';
}

function candidateSources(item, cfg, family) {
  const stem = imageStem(item.url);
  if (!stem) return [item.url]; // 推不出来就直连原地址

  const hosts = [cfg.imgHost].concat(FALLBACK_HOSTS.filter(h => h !== cfg.imgHost));
  const master = hosts.map(h => `https://${h}${stem}_master1200.jpg`);
  const square = hosts.map(h => `https://${h}/c/540x540_70${stem}_square1200.jpg`);

  const quality = cfg.quality === 'auto'
    ? (family === 'systemSmall' ? 'thumb' : 'master')
    : cfg.quality;

  return quality === 'thumb'
    ? square.concat(master.slice(0, 1))
    : master.concat(square.slice(0, 1));
}

async function download(ctx, url, cfg) {
  let resp;
  try {
    resp = await ctx.http.get(url, {
      headers: { 'Referer': 'https://www.pixiv.net/', 'User-Agent': 'Egern/PixivWidget 4.0' },
      timeout: cfg.timeoutMs
    });
  } catch (e) {
    const err = new Error('图片下载超时');
    err.status = 0;
    throw err;
  }

  const status = resp.status || 0;
  if (status === 429) {
    const err = new Error('图床限流');
    err.status = 429;
    throw err;
  }
  if (status >= 400) {
    const err = new Error(`图片 HTTP ${status}`);
    err.status = status;
    throw err;
  }

  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.byteLength < 1024) {
    const err = new Error('图片内容异常');
    err.status = 0;
    throw err;
  }

  const mime = detectMime(bytes, resp.headers);
  return { url, dataUri: `data:${mime};base64,${toBase64(bytes)}` };
}

function detectMime(bytes, headers) {
  const h = headers || {};
  const ct = (h['content-type'] || h['Content-Type'] || '').toLowerCase();
  if (ct.startsWith('image/')) return ct.split(';')[0].trim();
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return 'image/jpeg';
}

function toBase64(bytes) {
  const CHUNK = 0x2000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, bytes.length);
    let part = '';
    for (let j = i; j < end; j++) part += String.fromCharCode(bytes[j]);
    bin += part;
  }
  return btoa(bin);
}

/* ============================ 渲染 ============================ */

function buildWidget(entry, family, cfg, refreshAfter) {
  const isSmall = family === 'systemSmall';
  const showInfo = cfg.showInfo && entry && (entry.title || entry.author);
  const children = [];

  if (showInfo) {
    const lines = [];
    if (entry.title) {
      lines.push({
        type: 'text',
        text: entry.title,
        font: { size: isSmall ? 'caption1' : 'subheadline', weight: 'bold' },
        textColor: cfg.textColor,
        maxLines: 1,
        minScale: 0.7
      });
    }
    if (!isSmall && entry.author) {
      lines.push({
        type: 'text',
        text: `@${entry.author}`,
        font: { size: 'caption2' },
        textColor: 'rgba(255,255,255,0.78)',
        maxLines: 1,
        minScale: 0.75
      });
    }
    children.push({ type: 'spacer' });
    children.push({
      type: 'stack',
      direction: 'column',
      alignItems: 'start',
      gap: 2,
      padding: [10, 12],
      backgroundGradient: {
        type: 'linear',
        colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)'],
        startPoint: { x: 0.5, y: 0 },
        endPoint: { x: 0.5, y: 1 }
      },
      children: lines
    });
  }

  const node = {
    type: 'widget',
    refreshAfter,
    padding: 0,
    backgroundImage: entry.dataUri,
    children
  };
  if (entry.page) node.url = entry.page;
  return node;
}

function buildAccessory(ctx, family, cfg) {
  const cached = readJSON(ctx, K.cache + 'systemSmall') || readJSON(ctx, K.cache + 'systemMedium');
  const has = cached && cached.dataUri;

  if (family === 'accessoryCircular') {
    if (has) {
      return {
        type: 'widget',
        padding: 0,
        ...(cached.page ? { url: cached.page } : {}),
        children: [{
          type: 'image',
          src: cached.dataUri,
          resizeMode: 'cover',
          width: 60,
          height: 60,
          borderRadius: 'auto'
        }]
      };
    }
    return { type: 'widget', children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }] };
  }

  const title = (cached && cached.title) || 'Pixiv';
  const author = (cached && cached.author) ? `@${cached.author}` : '等待刷新';
  return {
    type: 'widget',
    padding: 0,
    ...(cached && cached.page ? { url: cached.page } : {}),
    children: [{
      type: 'stack',
      direction: 'column',
      alignItems: 'start',
      gap: 1,
      children: [
        { type: 'text', text: title, font: { size: 'caption1', weight: 'semibold' }, maxLines: 1, minScale: 0.7 },
        { type: 'text', text: author, font: { size: 'caption2' }, opacity: 0.7, maxLines: 1 }
      ]
    }]
  };
}

function buildError(message, cfg, refreshAfter) {
  return {
    type: 'widget',
    refreshAfter,
    backgroundColor: '#1C1C1E',
    padding: 16,
    gap: 8,
    url: 'https://www.pixiv.net/',
    children: [
      { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', color: '#FF9F0A', width: 24, height: 24 },
      { type: 'text', text: '加载失败', font: { size: 'headline', weight: 'bold' }, textColor: '#FFFFFF' },
      { type: 'text', text: message, font: { size: 'caption1' }, textColor: 'rgba(255,255,255,0.6)', maxLines: 3 },
      { type: 'spacer' },
      { type: 'text', text: '轻点打开 Pixiv', font: { size: 'caption2' }, textColor: 'rgba(255,255,255,0.35)', maxLines: 1 }
    ]
  };
}

/* ============================ 工具 ============================ */

function readJSON(ctx, key) {
  try {
    const raw = ctx.storage.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeJSON(ctx, key, value) {
  try {
    ctx.storage.set(key, JSON.stringify(value));
  } catch (_) {}
}

function clean(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}
