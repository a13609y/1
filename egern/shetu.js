// ==UserScript==
// @Name         每日色图小组件
// @Platform     Egern
// @Type         generic
// @Author       Cuttlefish (改编为 Egern 版本)
// @WebURL       https://api.lolicon.app/#/setu
// @Attention    环境变量：API_KEY（可选）、R18（0/1/2，0 非 r18，1 是 r18 2 是混合，默认2）
//               KEYWORDS：多个标签用竖线分隔，每次随机选一个
//               例如：初音ミク|エミリア|フォンテーヌ
// ==/UserScript==

// 每个尺寸各自维护历史记录，最多保留 HISTORY_MAX 条
const HISTORY_MAX = 50;

export default async function(ctx) {
  const apiKey   = ctx.env.API_KEY   || '';
  const r18      = ctx.env.R18       || '2';
  const keywords = ctx.env.KEYWORDS  || '';

  // 多标签随机选一个
  const tagList = keywords.split('|').map(t => t.trim()).filter(Boolean);
  const keyword = tagList.length > 0
    ? tagList[Math.floor(Math.random() * tagList.length)]
    : '';

  const family = ctx.widgetFamily;

  let aspectRatio;
  if (family === 'systemMedium') {
    aspectRatio = 'gt1.6lt2.4';
  } else if (family === 'systemLarge' || family === 'systemExtraLarge') {
    aspectRatio = 'gt0.4lt0.65';
  } else {
    aspectRatio = 'gt0.8lt1.3';
  }

  const imageSize = 'small';

  // 读取该尺寸的历史 pid 列表
  const historyKey = `setu_history_${family}`;
  let history = [];
  try { history = JSON.parse(ctx.storage.get(historyKey) || '[]'); } catch (_) {}

  let imageBase64 = null;
  let picUrl = '';

  try {
    // 一次多拉 20 张，从中找出没看过的
    const body = {
      r18: parseInt(r18),
      num: 20,
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

    // 优先选没看过的，实在全看过了就从历史最久远的里随机选
    const historySet = new Set(history);
    const fresh = obj.data.filter(p => !historySet.has(p.pid));
    const pool  = fresh.length > 0 ? fresh : obj.data;
    const pic   = pool[Math.floor(Math.random() * pool.length)];

    // 更新历史记录（队列，超出上限从头删）
    history = history.filter(id => id !== pic.pid);  // 去重
    history.push(pic.pid);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    ctx.storage.set(historyKey, JSON.stringify(history));

    picUrl = pic.urls?.[imageSize] || pic.urls?.original || '';

    const imgResp = await ctx.http.get(picUrl, {
      headers: { 'Referer': 'https://www.pixiv.net/' }
    });
    const buffer = await imgResp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    imageBase64 = btoa(binary);

  } catch (e) {
    return {
      type: 'widget',
      backgroundColor: '#1C1C1E',
      padding: 16,
      gap: 8,
      children: [
        { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', color: '#FF9F0A', width: 24, height: 24 },
        { type: 'text', text: '加载失败', font: { size: 'headline', weight: 'bold' }, textColor: '#FFFFFF' },
        { type: 'text', text: e.message || '请求失败', font: { size: 'caption1' }, textColor: '#FFFFFF88', maxLines: 3 }
      ]
    };
  }

  // 锁屏小组件
  if (family === 'accessoryRectangular') {
    return { type: 'widget', children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }] };
  }
  if (family === 'accessoryCircular') {
    return { type: 'widget', children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }] };
  }
  if (family === 'accessoryInline') {
    return { type: 'widget', children: [{ type: 'text', text: '每日色图', maxLines: 1 }] };
  }

  // 主屏幕小组件：纯图片，无文字
  return {
    type: 'widget',
    backgroundImage: `data:image/jpeg;base64,${imageBase64}`,
    padding: 0,
    url: picUrl,
    children: []
  };
}
