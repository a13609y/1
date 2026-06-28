/**
 * ⛽ 全国实时油价小组件
 * 数据源：http://m.qiyoujiage.com/
 * 脚本作者：Egern 群友 tg://user?id=5122789128
 * 由 iBL3ND 二次修改后 Ai 再次修改
 * 
 * 🔧 功能特性：
 * - 支持全国所有省份和城市
 * - 标题自动显示当前填写的地区
 * - 实时显示 92/95/98 号汽油和柴油价格
 * - 深色模式自动适配
 * - 全 iPhone 机型适配
 * 
 * 📚 使用教程
 * ═══════════════════════════════════════════════════
 *
 * 1️⃣ 环境变量配置
 * ─────────────────────────────────────────────────
 * 在 Egern 小组件配置中添加：
 *
 * 名称：region
 * 值：省份/城市（拼音，用 / 分隔）
 *
 * 名称：SHOW_TREND
 * 值：true（显示调价趋势）或 false（不显示）
 *
 *
 * 2️⃣ 地区代码对照表
 * ─────────────────────────────────────────────────
 * 【直辖市】
 * • 北京：beijing  • 上海：shanghai
 * • 天津：tianjin  • 重庆：chongqing
 *
 * 【省份 - 省会城市】
 * • 广东：guangdong/guangzhou
 * • 江苏：jiangsu/nanjing
 * • 浙江：zhejiang/hangzhou
 * • 山东：shandong/jinan
 * • 河南：henan/zhengzhou
 * • 河北：hebei/shijiazhuang
 * • 四川：sichuan/chengdu
 * • 湖北：hubei/wuhan
 * • 湖南：hunan/changsha
 * • 安徽：anhui/hefei
 * • 福建：fujian/fuzhou
 * • 江西：jiangxi/nanchang
 * • 辽宁：liaoning/shenyang
 * • 陕西：shanxi-3/xian  ⚠️
 * • 海南：hainan/haikou
 * • 山西：shanxi-1/taiyuan  ⚠️
 * • 吉林：jilin/changchun
 * • 黑龙江：heilongjiang/haerbin
 * • 云南：yunnan/kunming
 * • 贵州：guizhou/guiyang
 * • 广西：guangxi/nanning
 * • 甘肃：gansu/lanzhou
 * • 青海：qinghai/xining
 * • 宁夏：ningxia/yinchuan
 * • 新疆：xinjiang/wulumuqi
 * • 西藏：xizang/lasa
 * • 内蒙古：neimenggu/huhehaote
 * • 也可以去 http://m.qiyoujiage.com/shanxi-3.shtml 查看自己省份拼音
 * ═══════════════════════════════════════════════════
 */

export default async function (ctx) {
  const regionParam = ctx.env.region || "hainan/haikou";
  const SHOW_TREND = (ctx.env.SHOW_TREND || "true").trim() !== "false";

  // ✅ 按文档：ctx.widgetFamily，值为 "systemSmall"
  const isSmall = ctx.widgetFamily === "systemSmall";

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const refreshTime = new Date(Date.now() + 6*60*60*1000).toISOString();

  const backgroundColor = { light: "#FFFFFF", dark: "#1C1C1E" };

  const COLORS = {
    primary:     { light: "#1A1A1A", dark: "#FFFFFF" },
    secondary:   { light: "#666666", dark: "#CCCCCC" },
    tertiary:    { light: "#999999", dark: "#888888" },
    card:        { light: "#F5F5F7", dark: "#2C2C2E" },
    cardBorder:  { light: "#E0E0E0", dark: "#3A3A3C" },
    p92:         { light: "#FF9F0A", dark: "#FFB347" },
    p95:         { light: "#FF6B35", dark: "#FF8A5C" },
    p98:         { light: "#FF3B30", dark: "#FF6B6B" },
    diesel:      { light: "#30D158", dark: "#5CD67D" },
    trend:       { light: "#2C2C2E", dark: "#FFFFFF" },
  };

  const CACHE_KEY = `qiyoujiage_oil_${regionParam}`;
  let prices = { p92:null, p95:null, p98:null, diesel:null };
  let regionName = "";
  let trendInfo  = "";
  let hasCache   = false;

  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (cached && cached.prices) {
      prices     = cached.prices;
      regionName = cached.regionName || "";
      trendInfo  = cached.trendInfo  || "";
      hasCache   = true;
    }
  } catch(_){}

  let fetchError = false;
  let errorMsg   = "";

  try {
    const resp = await ctx.http.get(`http://m.qiyoujiage.com/${regionParam}.shtml`, {
      headers: {
        'referer':    'http://m.qiyoujiage.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });

    if (resp.status !== 200) throw new Error(`HTTP ${resp.status}: 页面不存在`);

    const html = await resp.text();

    const titleMatch = html.match(/<title>([^_]+)_/);
    if (titleMatch?.[1]) {
      regionName = titleMatch[1].trim().replace(/(油价|实时|今日|最新|查询|价格)/g, '').trim();
    }

    const regPrice = /<dl>[\s\S]+?<dt>(.*油)<\/dt>[\s\S]+?<dd>(.*)\(元\)<\/dd>/gm;
    const priceList = [];
    let m = null;
    while ((m = regPrice.exec(html)) !== null) {
      if (m.index === regPrice.lastIndex) regPrice.lastIndex++;
      priceList.push({ name: m[1].trim(), value: m[2].trim() });
    }

    if (priceList.length >= 3) {
      const nameMap = {
        "92 号":"p92","92":"p92",
        "95 号":"p95","95":"p95",
        "98 号":"p98","98":"p98",
        "0 号":"diesel","柴油":"diesel"
      };
      prices = { p92:null, p95:null, p98:null, diesel:null };
      priceList.forEach(item => {
        const key = Object.keys(nameMap).find(k => item.name.includes(k));
        if (key) {
          const v = parseFloat(item.value);
          if (!isNaN(v)) prices[nameMap[key]] = v;
        }
      });

      if (SHOW_TREND) {
        const trendMatch = html.match(/<div class="tishi">[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<br\/>([\s\S]+?)<br\/>/);
        if (trendMatch?.length >= 3) {
          const datePart  = trendMatch[1].split('价')[1]?.slice(0, -2) || "";
          const valuePart = trendMatch[2];
          const dir       = (valuePart.includes('下调') || valuePart.includes('下跌')) ? '↓' : '↑';
          let amount = "";
          const allL = valuePart.match(/([\d\.]+)\s*元\/升/g);
          if (allL?.length >= 2) {
            amount = allL.map(p => p.match(/([\d\.]+)/)[1]).join('-');
          } else {
            const allT = valuePart.match(/([\d]+)\s*元(?:\/吨)?/g);
            if (allT?.length >= 2) amount = allT.map(p => p.match(/([\d]+)/)[1]).join('-') + '元/吨';
            else {
              const s = valuePart.match(/([\d\.]+)\s*元\/升/);
              if (s) amount = s[1] + '元/L';
            }
          }
          trendInfo = `${datePart}调整 ${dir} ${amount}`.trim();
        }
      }

      ctx.storage.setJSON(CACHE_KEY, { prices, regionName, trendInfo });
    } else {
      if (!hasCache) { fetchError = true; errorMsg = "解析失败"; }
    }
  } catch (e) {
    if (!hasCache) { fetchError = true; errorMsg = e.message; }
  }

  const titleText = regionName ? `${regionName}实时油价` : "实时油价";

  const rows = [
    { label:"92 号", price:prices.p92,    color:COLORS.p92    },
    { label:"95 号", price:prices.p95,    color:COLORS.p95    },
    { label:"98 号", price:prices.p98,    color:COLORS.p98    },
    { label:"柴油",  price:prices.diesel, color:COLORS.diesel },
  ].filter(r => r.price !== null);

  // ════════════════════════════════════════════════════════════
  // 小尺寸（systemSmall）专用布局（已去掉“实时”二字）
  // ════════════════════════════════════════════════════════════
  if (isSmall) {

    function priceRowSmall(row) {
      return {
        type: "stack",
        direction: "row",
        alignItems: "center",
        padding: [4, 8, 4, 8],
        backgroundColor: COLORS.card,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: COLORS.cardBorder,
        gap: 6,
        children: [
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            width: 36,
            height: 16,
            backgroundColor: { light: row.color.light + "22", dark: row.color.dark + "22" },
            borderRadius: 4,
            borderWidth: 0.5,
            borderColor: { light: row.color.light + "66", dark: row.color.dark + "66" },
            children: [{
              type: "text",
              text: row.label,
              font: { size: "caption2", weight: "bold" },
              textColor: row.color,
              textAlign: "center"
            }]
          },
          { type: "spacer" },
          {
            type: "text",
            text: row.price !== null ? row.price.toFixed(2) : "--",
            font: { size: "footnote", weight: "semibold" },
            textColor: COLORS.primary,
            textAlign: "right",
            maxLines: 1
          },
          {
            type: "text",
            text: "元",
            font: { size: "caption2" },
            textColor: COLORS.tertiary,
            maxLines: 1
          }
        ]
      };
    }

    return {
      type: "widget",
      padding: [10, 10, 8, 10],
      gap: 5,
      backgroundColor: backgroundColor,
      refreshAfter: refreshTime,
      children: [

        // ── 顶部：图标 + 标题 ──────────────────────────────────
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 4,
          children: [
            {
              type: "image",
              src: "sf-symbol:fuelpump.fill",
              width: 11,
              height: 11,
              color: COLORS.p92
            },
            {
              type: "text",
              // ✨ 修改处：这里去掉了“实时”两个字
              text: regionName ? `${regionName}油价` : "油价",
              font: { size: "caption2", weight: "semibold" },
              textColor: COLORS.secondary,
              maxLines: 1,
              minScale: 0.85
            },
            { type: "spacer" },
            // 刷新图标
            {
              type: "image",
              src: "sf-symbol:arrow.clockwise",
              width: 10,
              height: 10,
              color: { light: "#BBBBBB", dark: "#666666" }
            },
            {
              type: "text",
              text: timeStr,
              font: { size: "caption2" },
              textColor: { light: "#BBBBBB", dark: "#666666" },
              maxLines: 1
            }
          ]
        },

        // ── 调价趋势（标题正下方横排）────────────────────────────
        ...(SHOW_TREND && trendInfo ? [{
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [{
            type: "text",
            text: trendInfo,
            font: { size: "caption2" },
            textColor: { light: "#888888", dark: "#777777" },
            maxLines: 1,
            minScale: 0.8
          }]
        }] : []),

        // ── 价格列表区（flex:1 撑满剩余空间，内部竖排）──────────
        {
          type: "stack",
          direction: "column",
          flex: 1,
          gap: 4,
          children: rows.length > 0
            ? rows.map(priceRowSmall)
            : [{
                type: "stack",
                direction: "column",
                alignItems: "center",
                flex: 1,
                children: [
                  { type: "image", src: "sf-symbol:exclamationmark.triangle.fill", width: 18, height: 18, color: COLORS.p98 },
                  { type: "text", text: fetchError ? "获取失败" : "暂无数据", font: { size: "caption2" }, textColor: COLORS.secondary }
                ]
              }]
        },


      ]
    };
  }

  // ════════════════════════════════════════════════════════════
  // 中/大尺寸：原始逻辑完全不动（未作任何修改）
  // ════════════════════════════════════════════════════════════

  function priceCard(row) {
    return {
      type: "stack",
      direction: "column",
      alignItems: "center",
      flex: 1,
      padding: [8,4,8,4],
      backgroundColor: COLORS.card,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: COLORS.cardBorder,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          width: 44, height: 22,
          backgroundColor: { light: row.color.light + "28", dark: row.color.dark + "28" },
          borderRadius: 6,
          borderWidth: 0.5,
          borderColor: { light: row.color.light + "55", dark: row.color.dark + "55" },
          children: [{
            type: "text",
            text: row.label,
            font: { size: "caption2", weight: "bold" },
            textColor: row.color,
            textAlign: "center"
          }]
        },
        {
          type: "text",
          text: row.price !== null ? row.price.toFixed(2) : "--",
          font: { size: "title3", weight: "semibold" },
          textColor: COLORS.primary,
          textAlign: "center",
          maxLines: 1,
          minScale: 0.7
        }
      ]
    };
  }

  return {
    type: "widget",
    padding: [10,8,10,8],
    gap: 5,
    backgroundColor: backgroundColor,
    refreshAfter: refreshTime,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 4,
        padding: [0,4,0,4],
        children: [
          { type:"image", src:"sf-symbol:fuelpump.fill", width:13, height:13, color:COLORS.p92 },
          { type:"text", text:titleText, font:{size:"caption2",weight:"semibold"}, textColor:COLORS.secondary },
          { type:"spacer" },
          ...(SHOW_TREND && trendInfo ? [{
            type: "text",
            text: trendInfo,
            font: { size:"caption2" },
            textColor: COLORS.trend,
            textAlign: "right",
            maxLines: 1,
            minScale: 0.8
          }] : []),
          ...(fetchError ? [{
            type: "text", text: errorMsg, font: { size:"caption2" }, textColor: COLORS.p98
          }] : [])
        ].filter(Boolean)
      },
      rows.length > 0 ? {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        padding: [6,0,6,0],
        children: rows.map(priceCard)
      } : {
        type: "stack",
        direction: "column",
        alignItems: "center",
        padding: [20,10,20,10],
        children: [
          { type:"image", src:"sf-symbol:exclamationmark.triangle.fill", width:24, height:24, color:COLORS.p98 },
          { type:"text", text: fetchError?"数据获取失败":"暂无数据", font:{size:"body"}, textColor:COLORS.secondary }
        ]
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        padding: [0,4,0,4],
        children: [
          { type:"text", text:`${timeStr} 更新`, font:{size:"caption2"}, textColor:COLORS.tertiary },
          { type:"spacer" },
          { type:"text", text:"元/升", font:{size:"caption2"}, textColor:COLORS.tertiary }
        ]
      }
    ]
  };
}
