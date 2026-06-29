// NetSpeed 小组件（Ai 更改 v2）
// 测试网络下载速度
//
// 环境变量（在 Egern UI 小组件设置里添加）：
//
//   名称：REFRESH_INTERVAL
//   值：  测速冷却时间（分钟），不填或填 0 = 每次刷新都测速
//         例如填 5 = 5 分钟内用缓存，超过才重新测
//
//   名称：SPEED_MB
//   值：  测速文件大小（MB），不填默认 3
//         例如填 10 = 下载 10MB 进行测速（结果更准但更费流量）
//
//   注：换节点 / 换网络会自动忽略冷却时间强制重测

export default async function(ctx) {
  // 测速间隔（分钟），从环境变量读取，0 = 每次刷新都测速
  const REFRESH_INTERVAL_MIN = Math.max(0, parseFloat(ctx.env.REFRESH_INTERVAL) || 0);

  const MB = Math.max(1, parseFloat(ctx.env.SPEED_MB) || 3);
  const BYTES = MB * 1024 * 1024;
  const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${BYTES}`;
  const WARMUP_URL = 'https://speed.cloudflare.com/__down?bytes=1048576';
  const CACHE_KEY = 'netspeed_cache';

  // 读取缓存
  let speedData = { mbps: 0, mBs: 0, duration: 0, timestamp: 0, fingerprint: '' };
  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (cached) speedData = cached;
  } catch(e) {}

  const elapsed = (Date.now() - (speedData.timestamp || 0)) / 1000 / 60;
  const intervalExpired = REFRESH_INTERVAL_MIN === 0 || elapsed >= REFRESH_INTERVAL_MIN;

  // 查询出口 IP：轮询多个地址，避免缓存问题
  const IP_URLS = [
    'http://eth0.me',
    'http://ip.tyk.nu',
    'http://checkip.amazonaws.com',
    'http://ipecho.net/ip',
  ];
  const IP_INDEX_KEY = 'netspeed_ip_index';
  let ipIndex = 0;
  try { ipIndex = (ctx.storage.getJSON(IP_INDEX_KEY) || 0) % IP_URLS.length; } catch(e) {}
  ctx.storage.setJSON(IP_INDEX_KEY, (ipIndex + 1) % IP_URLS.length);

  let outboundIP = '';
  try {
    const resp = await ctx.http.get(IP_URLS[ipIndex], { headers: { 'Cache-Control': 'no-cache' }, timeout: 5000 });
    const raw = (await resp.text()).trim();
    const match = raw.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
    outboundIP = match ? match[1] : '';
  } catch(e) {}

  // 网络指纹：Wi-Fi BSSID + 出口 IP，任意一项变化视为换节点/换网络
  const fingerprint = [ctx.device.wifi.bssid || '', outboundIP].join('|');
  const networkChanged = fingerprint !== (speedData.fingerprint || '');
  const shouldTest = networkChanged || intervalExpired;


  if (shouldTest) try {
    // 预热请求：1MB，建立 TCP 连接，让正式测速复用这条连接
    await ctx.http.get(WARMUP_URL, {
      headers: { 'Cache-Control': 'no-cache' },
      timeout: 10000
    });

    // 正式测速：连接已预热，测速 1 次
    const t1Start = Date.now();
    await ctx.http.get(SPEED_TEST_URL, { headers: { 'Cache-Control': 'no-cache' }, timeout: 30000 });
    const duration = (Date.now() - t1Start) / 1000;
    const speedMBs = MB / duration;
    const speedMbps = speedMBs * 8;

    speedData = {
      mbps: parseFloat(speedMbps.toFixed(1)),
      mBs: parseFloat(speedMBs.toFixed(2)),
      duration: duration.toFixed(2),
      timestamp: Date.now(),
      fingerprint
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

  const lastTestISO = speedData.timestamp ? new Date(speedData.timestamp).toISOString() : new Date().toISOString();

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
      isSmall ? {
        type: 'stack',
        direction: 'column',
        alignItems: 'end',
        gap: 1,
        children: [
          {
            type: 'text',
            text: '测速时间',
            font: { size: 9, weight: 'medium' },
            textColor: subColor,
            maxLines: 1
          },
          {
            type: 'date',
            date: lastTestISO,
            format: 'time',
            font: { size: 9, weight: 'medium' },
            textColor: subColor
          }
        ]
      } : {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 3,
        children: [
          {
            type: 'text',
            text: '测速时间',
            font: { size: 10, weight: 'medium' },
            textColor: subColor,
            maxLines: 1
          },
          {
            type: 'date',
            date: lastTestISO,
            format: 'time',
            font: { size: 10, weight: 'medium' },
            textColor: subColor
          }
        ]
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
