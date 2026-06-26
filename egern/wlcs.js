// NetSpeed 小组件
// 测试网络下载速度

export default async function(ctx) {
  const MB = 3;
  const BYTES = MB * 1024 * 1024;
  const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${BYTES}`;
  const CACHE_KEY = 'netspeed_cache';

  let speedData = { mbps: 0, mBs: 0, duration: 0, timestamp: 0 };
  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (cached) speedData = cached;
  } catch(e) {}

  try {
    const startTime = Date.now();
    await ctx.http.get(SPEED_TEST_URL, {
      headers: { 'Cache-Control': 'no-cache' },
      timeout: 30000
    });
    const duration = (Date.now() - startTime) / 1000;
    const speedMBs = MB / duration;
    const speedMbps = speedMBs * 8;

    speedData = {
      mbps: parseFloat(speedMbps.toFixed(1)),
      mBs: parseFloat(speedMBs.toFixed(2)),
      duration: duration.toFixed(2),
      timestamp: Date.now()
    };

    ctx.storage.setJSON(CACHE_KEY, speedData);
  } catch(e) {}

  let icon = 'tortoise';
  let color = '#FF9500';

  if (speedData.mbps >= 50) {
    icon = 'bolt.fill';
    color = '#34C759';
  } else if (speedData.mbps >= 10) {
    icon = 'hare.fill';
    color = '#007AFF';
  }

  const isSmall  = ctx.widgetFamily === 'systemSmall';
  const isMedium = ctx.widgetFamily === 'systemMedium';

  // 进度条 flex 比例，参考 100 Mbps 为满格
  const progressFlex = Math.min(Math.max(speedData.mbps / 100, 0.05), 1);
  const remainFlex   = 1 - progressFlex;

  // 当前时间 ISO，供 date 元素使用
  const nowISO = new Date().toISOString();

  // ── 公共子组件 ──────────────────────────────────────

  // 顶部标题行
  const headerRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 4,
    children: [
      {
        type: 'image',
        src: `sf-symbol:${icon}`,
        width: isSmall ? 12 : 14,
        height: isSmall ? 12 : 14,
        color: color
      },
      {
        type: 'text',
        text: 'NetSpeed',
        font: { size: isSmall ? 'caption2' : 'caption1', weight: 'semibold' },
        textColor: color,
        maxLines: 1
      },
      { type: 'spacer' },
      {
        type: 'date',
        date: nowISO,
        format: 'time',
        font: { size: 'caption2' },
        textColor: { light: '#8E8E93', dark: '#8E8E93' }
      }
    ]
  };

  // 进度条
  const progressBar = {
    type: 'stack',
    direction: 'row',
    height: 4,
    gap: 0,
    children: [
      {
        type: 'stack',
        flex: progressFlex,
        height: 4,
        backgroundColor: color,
        borderRadius: 2
      },
      ...(remainFlex > 0 ? [{
        type: 'stack',
        flex: remainFlex,
        height: 4,
        backgroundColor: { light: '#E5E5EA', dark: '#48484A' },
        borderRadius: 2
      }] : [])
    ]
  };

  // 底部详情行
  const detailRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    children: [
      {
        type: 'text',
        text: `${speedData.mBs} MB/s`,
        font: { size: 'caption2' },
        textColor: { light: '#6B6B6B', dark: '#A1A1A6' },
        maxLines: 1
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: `${speedData.duration}s`,
        font: { size: 'caption2' },
        textColor: { light: '#6B6B6B', dark: '#A1A1A6' },
        maxLines: 1
      }
    ]
  };

  // 速度数字块：左右 spacer 夹住实现真正水平居中
  // 字号尽量大，minScale 兜底让系统自动缩小到放得下
  const makeSpeedBlock = (fontSize) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    children: [
      { type: 'spacer' },
      {
        type: 'stack',
        direction: 'column',
        alignItems: 'center',
        gap: 2,
        children: [
          {
            type: 'text',
            text: `${speedData.mbps}`,
            font: { size: fontSize, weight: 'bold' },
            textColor: color,
            textAlign: 'center',
            maxLines: 1,
            minScale: 0.5
          },
          {
            type: 'text',
            text: 'Mbps',
            font: { size: isSmall ? 'caption2' : 'footnote', weight: 'medium' },
            textColor: { light: '#6B6B6B', dark: '#A1A1A6' },
            textAlign: 'center',
            maxLines: 1
          }
        ]
      },
      { type: 'spacer' }
    ]
  });

  // ── 中号：左右分栏布局 ────────────────────────────────
  if (isMedium) {
    return {
      type: 'widget',
      padding: [14, 16, 14, 16],
      gap: 8,
      backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' },
      children: [
        headerRow,
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          flex: 1,
          gap: 0,
          children: [
            // 左：大数字，flex 等分
            {
              type: 'stack',
              direction: 'column',
              flex: 1,
              gap: 0,
              children: [
                { type: 'spacer' },
                {
                  type: 'stack',
                  direction: 'row',
                  alignItems: 'center',
                  children: [
                    { type: 'spacer' },
                    {
                      type: 'stack',
                      direction: 'column',
                      alignItems: 'center',
                      gap: 2,
                      children: [
                        {
                          type: 'text',
                          text: `${speedData.mbps}`,
                          font: { size: 60, weight: 'bold' },
                          textColor: color,
                          textAlign: 'center',
                          maxLines: 1,
                          minScale: 0.5
                        },
                        {
                          type: 'text',
                          text: 'Mbps',
                          font: { size: 'footnote', weight: 'medium' },
                          textColor: { light: '#6B6B6B', dark: '#A1A1A6' },
                          textAlign: 'center',
                          maxLines: 1
                        }
                      ]
                    },
                    { type: 'spacer' }
                  ]
                },
                { type: 'spacer' }
              ]
            },
            // 分隔线
            {
              type: 'stack',
              width: 1,
              backgroundColor: { light: '#E5E5EA', dark: '#48484A' }
            },
            // 右：详情，flex 等分
            {
              type: 'stack',
              direction: 'column',
              flex: 1,
              gap: 10,
              padding: [0, 0, 0, 16],
              children: [
                { type: 'spacer' },
                {
                  type: 'stack',
                  direction: 'row',
                  alignItems: 'center',
                  gap: 6,
                  children: [
                    {
                      type: 'image',
                      src: 'sf-symbol:speedometer',
                      width: 13,
                      height: 13,
                      color: { light: '#6B6B6B', dark: '#A1A1A6' }
                    },
                    {
                      type: 'text',
                      text: `${speedData.mBs} MB/s`,
                      font: { size: 'subheadline', weight: 'semibold' },
                      textColor: { light: '#3C3C43', dark: '#EBEBF5' },
                      maxLines: 1
                    }
                  ]
                },
                {
                  type: 'stack',
                  direction: 'row',
                  alignItems: 'center',
                  gap: 6,
                  children: [
                    {
                      type: 'image',
                      src: 'sf-symbol:clock',
                      width: 13,
                      height: 13,
                      color: { light: '#6B6B6B', dark: '#A1A1A6' }
                    },
                    {
                      type: 'text',
                      text: `${speedData.duration}s`,
                      font: { size: 'subheadline', weight: 'semibold' },
                      textColor: { light: '#3C3C43', dark: '#EBEBF5' },
                      maxLines: 1
                    }
                  ]
                },
                { type: 'spacer' },
                progressBar
              ]
            }
          ]
        }
      ]
    };
  }

  // ── 小号 / 大号：垂直布局 ────────────────────────────
  const speedFontSize = isSmall ? 40 : 64;

  return {
    type: 'widget',
    padding: isSmall ? [10, 12, 10, 12] : [16, 18, 16, 18],
    gap: isSmall ? 6 : 10,
    backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' },
    children: [
      headerRow,
      { type: 'spacer' },
      makeSpeedBlock(speedFontSize),
      { type: 'spacer' },
      progressBar,
      detailRow
    ]
  };
}
