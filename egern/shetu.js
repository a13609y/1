// ==UserScript==
// @Name         每日色图小组件
// @Platform     Egern
// @Type         generic
// @Author       Cuttlefish (改编为 Egern 版本)
// @WebURL       https://api.lolicon.app/#/setu
// @Attention    环境变量：API_KEY（你的 Lolicon API Key 可选，没有也可以留空）、R18（0：非R18图片，1：仅R18，图片2：混合，默认2）、KEYWORD（可选按标签筛选图片，可留空）
// ==/UserScript==

export default async function(ctx) {
  const apiKey  = ctx.env.API_KEY  || '';
  const r18     = ctx.env.R18      || '2';
  const keyword = ctx.env.KEYWORD  || '';

  const family = ctx.widgetFamily;

  // 按各尺寸小组件的实际宽高比筛选图片，减少 cover 裁剪量
  // small ≈ 1:1，medium ≈ 2:1，large ≈ 1:1 偏竖，锁屏不显示图
  let aspectRatio;
  if (family === 'systemMedium') {
    aspectRatio = 'gt1.6lt2.4';   // 横图
  } else if (family === 'systemLarge' || family === 'systemExtraLarge') {
    aspectRatio = 'gt0.6lt1.2';   // 偏竖或正方形
  } else {
    aspectRatio = 'gt0.8lt1.3';   // small：接近正方形
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
