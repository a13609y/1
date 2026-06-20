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

export default async function(ctx) {
  const apiKey   = ctx.env.API_KEY   || '';
  const r18      = ctx.env.R18       || '2';
  const keywords = ctx.env.KEYWORDS  || '';

  // 多标签随机选一个：用 | 分隔，过滤空项
  const tagList = keywords.split('|').map(t => t.trim()).filter(Boolean);
  const keyword = tagList.length > 0
    ? tagList[Math.floor(Math.random() * tagList.length)]
    : '';

  const family = ctx.widgetFamily;

  // 按各尺寸小组件的实际宽高比（宽/高）筛选图片，减少 cover 裁剪量
  // systemSmall  约 1:1  → 宽高比约 1.0
  // systemMedium 约 2:1  → 宽高比约 2.0（横图）
  // systemLarge  约 1:2  → 宽高比约 0.5（竖图）
  let aspectRatio;
  if (family === 'systemMedium') {
    aspectRatio = 'gt1.6lt2.4';    // 横图
  } else if (family === 'systemLarge' || family === 'systemExtraLarge') {
    aspectRatio = 'gt0.4lt0.65';   // 竖图，匹配 large 约 1:2 的比例
  } else {
    aspectRatio = 'gt0.8lt1.3';    // small：接近正方形
  }

  // 统一用 small 规格（540px 等比缩放，非方形裁剪），画质和体积平衡
  const imageSize = 'small';

  let imageBase64 = null;
  let picUrl = '';

  try {
    let url = `https://api.lolicon.app/setu/v2?r18=${r18}&num=1&size=${imageSize}&aspectRatio=${aspectRatio}`;
    if (apiKey)  url += `&apikey=${encodeURIComponent(apiKey)}`;
    if (keyword) url += `&tag=${encodeURIComponent(keyword)}`;

    const resp = await ctx.http.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });
    const obj = await resp.json();

    if (obj.error) throw new Error(obj.error);
    if (!obj.data || obj.data.length === 0) throw new Error('No data');

    picUrl = obj.data[0].urls?.[imageSize] || obj.data[0].urls?.original || '';

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

  // 锁屏小组件不显示图片
  if (family === 'accessoryRectangular') {
    return {
      type: 'widget',
      children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }]
    };
  }
  if (family === 'accessoryCircular') {
    return {
      type: 'widget',
      children: [{ type: 'image', src: 'sf-symbol:photo.artframe', width: 28, height: 28 }]
    };
  }
  if (family === 'accessoryInline') {
    return {
      type: 'widget',
      children: [{ type: 'text', text: '每日色图', maxLines: 1 }]
    };
  }

  // 主屏幕小组件：纯图片背景，无任何文字
  return {
    type: 'widget',
    backgroundImage: `data:image/jpeg;base64,${imageBase64}`,
    padding: 0,
    url: picUrl,
    children: []
  };
}
