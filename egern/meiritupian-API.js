// ==UserScript==
// @Name         每日图片小组件 Ai 生成（自定义 API 接口默认真人）
// @Platform     Egern
// @Type         generic
// @Author       Cuttlefish (改编为 Egern 版本)
// ==/UserScript==

// ============================================================
// 环境变量说明（在 Egern 脚本 → Env 中填写）
// ============================================================
// API_URL    可选  图片接口地址，需直接返回图片（支持 302 跳转）
//            默认：https://v2.xxapi.cn/api/heisi?return=302
//            示例：https://你的接口地址
//
// COOLDOWN   可选  两次向 API 发起请求的最小间隔（分钟）  默认：5
//            设为 0 则每次刷新小组件都请求新图片
//            示例：5
// ============================================================

export default async function(ctx) {
  const apiUrl      = ctx.env.API_URL || 'https://v2.xxapi.cn/api/heisi?return=302';
  const cooldownMin = parseInt(ctx.env.COOLDOWN ?? '5');
  const cooldown    = Math.max(0, cooldownMin) * 60 * 1000;

  const family = ctx.widgetFamily;

  // 锁屏小组件提前返回
  if (family === 'accessoryRectangular' || family === 'accessoryCircular') {
    return { type: 'widget', children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }] };
  }
  if (family === 'accessoryInline') {
    return { type: 'widget', children: [{ type: 'text', text: '每日色图', maxLines: 1 }] };
  }

  const imgCacheKey = `setu_img_${family}`;
  const cooldownKey = `setu_cooldown_${family}`;

  const lastRequest = parseInt(ctx.storage.get(cooldownKey) || '0');
  const needFetch   = cooldown === 0 || (Date.now() - lastRequest) >= cooldown;

  if (!needFetch) {
    const cached = ctx.storage.getJSON(imgCacheKey);
    if (cached?.base64 && cached?.mime) {
      return buildWidget(cached.base64, cached.mime);
    }
  }

  // 请求新图片
  try {
    const resp = await ctx.http.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      },
      redirect: 'follow'
    });

    // 从响应头读取真实 MIME 类型，fallback 到 image/jpeg
    const contentType = resp.headers.get('content-type') || '';
    const mime = contentType.split(';')[0].trim() || 'image/jpeg';

    const buffer = await resp.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    if (cooldown > 0) {
      ctx.storage.set(cooldownKey, String(Date.now()));
    }
    ctx.storage.setJSON(imgCacheKey, { base64, mime });

    return buildWidget(base64, mime);

  } catch (e) {
    const cached = ctx.storage.getJSON(imgCacheKey);
    if (cached?.base64 && cached?.mime) {
      return buildWidget(cached.base64, cached.mime);
    }
    return buildErrorWidget(e.message || '请求失败');
  }
}

function buildWidget(base64, mime) {
  return {
    type: 'widget',
    padding: 0,
    backgroundImage: `data:${mime};base64,${base64}`,
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
