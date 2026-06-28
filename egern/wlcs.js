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
    // 预热请求：1KB，建立 TCP 连接，让正式测速复用这条连接
    await ctx.http.get('https://speed.cloudflare.com/__down?bytes=1024', {
      headers: { 'Cache-Control': 'no-cache' },
      timeout: 10000
    });

    // 正式测速：连接已预热，计时更接近纯传输速度
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

  const nowISO = new Date().toISOString();

  // 通用背景色
  const bg = { light: '#FFFFFF', dark: '#1C1C1E' };
  // 次要文字色
  const subColor = { light: '#8E8E93', dark: '#636366' };
  // 主文字色
  const primaryColor = { light: '#1C1C1E', dark: '#F2F2F7' };

  // ── 顶部标题行 ──────────────────────────────────────
  const headerRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 5,
    children: [
      {
        type: 'image',
        src: `sf-symbol:${icon}`,
        width: isSmall ? 11 : 13,
        height: isSmall ? 11 : 13,
        color: color
      },
      {
        type: 'text',
        text: 'NET SPEED',
        font: { size: isSmall ? 9 : 10, weight: 'heavy' },
        textColor: subColor,
        maxLines: 1
      },
      { type: 'spacer' },
      {
        type: 'date',
        date: nowISO,
        format: 'time',
        font: { size: isSmall ? 9 : 10, weight: 'medium' },
        textColor: subColor
      }
    ]
  };

  // ── 速度数字块：数字极大，Mbps 置于数字正下方 ────────────
  const makeSpeedBlock = (numSize, unitSize) => ({
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
            font: { size: numSize, weight: 'heavy' },
            textColor: color,
            textAlign: 'center',
            maxLines: 1,
            minScale: 0.4
          },
          {
            type: 'text',
            text: 'Mbps',
            font: { size: unitSize, weight: 'semibold' },
            textColor: subColor,
            textAlign: 'center',
            maxLines: 1
          }
        ]
      },
      { type: 'spacer' }
    ]
  });

  // ── 底部详情行 ────────────────────────────────────────
  const detailRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 4,
    children: [
      {
        type: 'image',
        src: 'sf-symbol:speedometer',
        width: 10,
        height: 10,
        color: subColor
      },
      {
        type: 'text',
        text: `${speedData.mBs} MB/s`,
        font: { size: isSmall ? 'caption2' : 'footnote', weight: 'medium' },
        textColor: subColor,
        maxLines: 1
      },
      { type: 'spacer' },
      {
        type: 'image',
        src: 'sf-symbol:clock',
        width: 10,
        height: 10,
        color: subColor
      },
      {
        type: 'text',
        text: `${speedData.duration}s`,
        font: { size: isSmall ? 'caption2' : 'footnote', weight: 'medium' },
        textColor: subColor,
        maxLines: 1
      }
    ]
  };

  // ── 中号：左右分栏 ────────────────────────────────────
  if (isMedium) {
    return {
      type: 'widget',
      padding: [14, 16, 14, 16],
      gap: 8,
      backgroundColor: bg,
      children: [
        headerRow,
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          flex: 1,
          gap: 0,
          children: [
            // 左：超大速度数字
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
                          font: { size: 80, weight: 'heavy' },
                          textColor: color,
                          textAlign: 'center',
                          maxLines: 1,
                          minScale: 0.4
                        },
                        {
                          type: 'text',
                          text: 'Mbps',
                          font: { size: 14, weight: 'semibold' },
                          textColor: subColor,
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
              backgroundColor: { light: '#E5E5EA', dark: '#38383A' }
            },
            // 右：详情
            {
              type: 'stack',
              direction: 'column',
              flex: 1,
              gap: 14,
              padding: [0, 0, 0, 18],
              children: [
                { type: 'spacer' },
                {
                  type: 'stack',
                  direction: 'column',
                  gap: 3,
                  children: [
                    {
                      type: 'text',
                      text: 'THROUGHPUT',
                      font: { size: 9, weight: 'heavy' },
                      textColor: subColor,
                      maxLines: 1
                    },
                    {
                      type: 'text',
                      text: `${speedData.mBs} MB/s`,
                      font: { size: 'title3', weight: 'bold' },
                      textColor: primaryColor,
                      maxLines: 1
                    }
                  ]
                },
                {
                  type: 'stack',
                  direction: 'column',
                  gap: 3,
                  children: [
                    {
                      type: 'text',
                      text: 'TEST DURATION',
                      font: { size: 9, weight: 'heavy' },
                      textColor: subColor,
                      maxLines: 1
                    },
                    {
                      type: 'text',
                      text: `${speedData.duration}s`,
                      font: { size: 'title3', weight: 'bold' },
                      textColor: primaryColor,
                      maxLines: 1
                    }
                  ]
                },
                { type: 'spacer' }
              ]
            }
          ]
        }
      ]
    };
  }

  // ── 小号 / 大号：垂直布局 ─────────────────────────────
  // 小号 56，大号 90
  const numSize  = isSmall ? 56 : 90;
  const unitSize = isSmall ? 12 : 16;

  return {
    type: 'widget',
    padding: isSmall ? [10, 12, 10, 12] : [16, 18, 16, 18],
    gap: isSmall ? 4 : 8,
    backgroundColor: bg,
    children: [
      headerRow,
      { type: 'spacer' },
      makeSpeedBlock(numSize, unitSize),
      { type: 'spacer' },
      detailRow
    ]
  };
}
