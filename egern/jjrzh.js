export default async function (ctx) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ─── 农历换算 1（寿星万年历 1900-2100） ────────────────────────────────────
  const springFestival = [
    [1900,1,31],[1901,2,19],[1902,2,8],[1903,1,29],[1904,2,16],[1905,2,4],[1906,1,25],[1907,2,13],[1908,2,2],[1909,1,22],
    [1910,2,10],[1911,1,30],[1912,2,18],[1913,2,6],[1914,1,26],[1915,2,14],[1916,2,3],[1917,1,23],[1918,2,11],[1919,2,1],
    [1920,2,20],[1921,2,8],[1922,1,28],[1923,2,16],[1924,2,5],[1925,1,25],[1926,2,13],[1927,2,2],[1928,1,23],[1929,2,10],
    [1930,1,30],[1931,2,17],[1932,2,6],[1933,1,26],[1934,2,14],[1935,2,4],[1936,1,24],[1937,2,11],[1938,1,31],[1939,2,19],
    [1940,2,8],[1941,1,27],[1942,2,15],[1943,2,5],[1944,1,25],[1945,2,13],[1946,2,2],[1947,1,22],[1948,2,10],[1949,1,29],
    [1950,2,17],[1951,2,6],[1952,1,27],[1953,2,14],[1954,2,3],[1955,1,24],[1956,2,12],[1957,1,31],[1958,2,18],[1959,2,8],
    [1960,1,28],[1961,2,15],[1962,2,5],[1963,1,25],[1964,2,13],[1965,2,2],[1966,1,21],[1967,2,9],[1968,1,30],[1969,2,17],
    [1970,2,6],[1971,1,27],[1972,2,15],[1973,2,3],[1974,1,23],[1975,2,11],[1976,1,31],[1977,2,18],[1978,2,7],[1979,1,28],
    [1980,2,16],[1981,2,5],[1982,1,25],[1983,2,13],[1984,2,2],[1985,2,20],[1986,2,9],[1987,1,29],[1988,2,17],[1989,2,6],
    [1990,1,27],[1991,2,15],[1992,2,4],[1993,1,23],[1994,2,10],[1995,1,31],[1996,2,19],[1997,2,7],[1998,1,28],[1999,2,16],
    [2000,2,5],[2001,1,24],[2002,2,12],[2003,2,1],[2004,1,22],[2005,2,9],[2006,1,29],[2007,2,18],[2008,2,7],[2009,1,26],
    [2010,2,14],[2011,2,3],[2012,1,23],[2013,2,10],[2014,1,31],[2015,2,19],[2016,2,8],[2017,1,28],[2018,2,16],[2019,2,5],
    [2020,1,25],[2021,2,12],[2022,2,1],[2023,1,22],[2024,2,10],[2025,1,29],[2026,2,17],[2027,2,6],[2028,1,26],[2029,2,13],
    [2030,2,3],[2031,1,23],[2032,2,11],[2033,1,31],[2034,2,19],[2035,2,8],[2036,1,28],[2037,2,15],[2038,2,4],[2039,1,24],
    [2040,2,12],[2041,2,1],[2042,1,22],[2043,2,10],[2044,1,30],[2045,2,17],[2046,2,6],[2047,1,26],[2048,2,14],[2049,2,2],
    [2050,1,23],[2051,2,11],[2052,2,1],[2053,2,19],[2054,2,8],[2055,1,28],[2056,2,15],[2057,2,4],[2058,1,24],[2059,2,12],
    [2060,2,2],[2061,1,21],[2062,2,9],[2063,1,29],[2064,2,17],[2065,2,5],[2066,1,26],[2067,2,14],[2068,2,3],[2069,1,23],
    [2070,2,11],[2071,1,31],[2072,2,19],[2073,2,7],[2074,1,27],[2075,2,15],[2076,2,5],[2077,1,24],[2078,2,12],[2079,2,2],
    [2080,1,22],[2081,2,9],[2082,1,29],[2083,2,17],[2084,2,6],[2085,1,26],[2086,2,14],[2087,2,3],[2088,1,24],[2089,2,10],
    [2090,1,30],[2091,2,18],[2092,2,7],[2093,1,27],[2094,2,15],[2095,2,5],[2096,1,25],[2097,2,12],[2098,2,1],[2099,1,21],
    [2100,2,9],
  ];
  const lunarInfo = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06aa0,0x0a6b6,0x056a0,0x02b60,0x09373,
    0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,
    0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,
    0x0f930,0x06952,0x0f2a0,0x0dc54,0x0b550,0x0b550,0x0d2a0,0x0ee93,0x0cab0,0x0a0b8,
    0x0eaa0,0x056a0,0x0cfb5,0x024b0,0x0eab4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,
    0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,
    0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,
    0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06aa0,0x0a6b6,0x056a0,0x02b60,
    0x09373,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,
    0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,
    0x052b0,0x0f930,0x06952,0x0f2a0,0x0dc54,0x0b550,0x0b550,0x0d2a0,0x0ee93,0x0cab0,
  ];

  function lunarToSolar(year, lunarMonth, lunarDay) {
    const idx = year - 1900;
    const sf = springFestival[idx];
    if (!sf) return null;
    const info = lunarInfo[idx];
    const leapMonth = (info >> 16) & 0xf;
    let days = 0;
    for (let m = 1; m < lunarMonth; m++) {
      days += (info >> (16 - m)) & 1 ? 30 : 29;
      if (m === leapMonth) days += (info >> 4) & 1 ? 30 : 29;
    }
    days += lunarDay - 1;
    const result = new Date(sf[0], sf[1] - 1, sf[2]);
    result.setDate(result.getDate() + days);
    return result;
  }

  // ─── 节气算法 ─────────────────────────────────────────────────────────────
  const solarTermNames = [
    "小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨",
    "立夏","小满","芒种","夏至","小暑","大暑","立秋","处暑",
    "白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至"
  ];
  const solarTermDegrees = [
    285,300,315,330,345,0,15,30,45,60,75,90,
    105,120,135,150,165,180,195,210,225,240,255,270
  ];

  function getSunLongitude(T) {
    const L0 = 280.46646 + 36000.76983*T + 0.0003032*T*T;
    const M  = 357.52911 + 35999.05029*T - 0.0001537*T*T;
    const Mr = M * Math.PI / 180;
    const C  = (1.914602 - 0.004817*T - 0.000014*T*T)*Math.sin(Mr)
             + (0.019993 - 0.000101*T)*Math.sin(2*Mr)
             + 0.000289*Math.sin(3*Mr);
    const app = L0 + C - 0.00569 - 0.00478*Math.sin((125.04-1934.136*T)*Math.PI/180);
    return ((app % 360) + 360) % 360;
  }

  function JDToDate(JD) {
    const z = Math.floor(JD+0.5), f = JD+0.5-z;
    let A = z;
    if (z >= 2299161) { const a=Math.floor((z-1867216.25)/36524.25); A=z+1+a-Math.floor(a/4); }
    const B=A+1524, C=Math.floor((B-122.1)/365.25);
    const D=Math.floor(365.25*C), E=Math.floor((B-D)/30.6001);
    const month=E<14?E-1:E-13;
    return new Date(month>2?C-4716:C-4715, month-1, Math.floor(B-D-Math.floor(30.6001*E)+f));
  }

  function getSolarTermDate(year, termName) {
    const idx = solarTermNames.indexOf(termName);
    if (idx < 0) return null;
    const degree = solarTermDegrees[idx];
    let JD = 2451545.0 + 365.2422*(year-2000) + (degree/360)*365.2422;
    for (let i = 0; i < 50; i++) {
      const T = (JD-2451545.0)/36525.0;
      let diff = degree - getSunLongitude(T);
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      if (Math.abs(diff) < 0.0001) break;
      JD += diff/360*365.2422;
    }
    return JDToDate(JD + 8/24);
  }

  function getFathersDay(year) {
    const d = new Date(year, 5, 1);
    const dow = d.getDay();
    return new Date(year, 5, (dow===0?1:8-dow)+14);
  }

  // ─── 构建节日列表 ─────────────────────────────────────────────────────────
  function daysUntil(date) {
    if (!date) return -1;
    return Math.ceil((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - today) / 86400000);
  }

  const items = [];
  function add(name, date) {
    const days = daysUntil(date);
    if (days >= 0) items.push({ name, days });
  }

  for (const y of [now.getFullYear(), now.getFullYear()+1]) {
    add("父亲节",  getFathersDay(y));
    add("建党节",  new Date(y, 6, 1));
    add("建军节",  new Date(y, 7, 1));
    add("教师节",  new Date(y, 8, 10));
    add("国庆节",  new Date(y, 9, 1));
    add("光棍节",  new Date(y, 10, 11));
    add("圣诞节",  new Date(y, 11, 25));
    add("跨年夜",  new Date(y, 11, 31));
    add("元旦",    new Date(y, 0, 1));
    add("情人节",  new Date(y, 1, 14));
    for (const t of ["夏至","小暑","大暑","立秋","处暑","白露","秋分",
                      "寒露","霜降","立冬","小雪","大雪","冬至","小寒","大寒","立春"]) {
      add(t, getSolarTermDate(y, t));
    }
    add("七夕节",  lunarToSolar(y, 7, 7));
    add("中元节",  lunarToSolar(y, 7, 15));
    add("中秋节",  lunarToSolar(y, 8, 15));
    add("重阳节",  lunarToSolar(y, 9, 9));
  }

  const seen = new Set();
  const sorted = items
    .sort((a, b) => a.days - b.days)
    .filter(item => { if (seen.has(item.name)) return false; seen.add(item.name); return true; });

  // ─── 按 widgetFamily 精确控制布局 ─────────────────────────────────────────
  const family = ctx.widgetFamily || "systemLarge";

  // nameSize: 节假日名称字号；daysSize: 距离天数字号（比名称小）
  const cfg = {
    systemSmall:      { cols: 2, rows: 3, nameSize: 11, daysSize: 9,  pad: [4, 6], gap: 3, wpad: [8, 6],   innerGap: 2 },
    systemMedium:     { cols: 4, rows: 3, nameSize: 11, daysSize: 9,  pad: [4, 6], gap: 3, wpad: [8, 6],   innerGap: 2 },
    systemLarge:      { cols: 5, rows: 6, nameSize: 12, daysSize: 10, pad: [5, 6], gap: 4, wpad: [10, 8],  innerGap: 2 },
    systemExtraLarge: { cols: 5, rows: 8, nameSize: 13, daysSize: 11, pad: [5, 8], gap: 5, wpad: [12, 10], innerGap: 3 },
  };
  const c = cfg[family] || cfg.systemLarge;

  const visible = sorted.slice(0, c.cols * c.rows);

  // ─── 渲染 ─────────────────────────────────────────────────────────────────
  const urgentBg   = "#FFDEDE", urgentText = "#E53935";
  const normalBg   = "#E0F7EA", normalText = "#2E7D32";
  const urgentSub  = "#EF9A9A", normalSub  = "#66BB6A";

  const rowDefs = [];
  for (let i = 0; i < visible.length; i += c.cols) rowDefs.push(visible.slice(i, i + c.cols));

  const rowChildren = rowDefs.map(row => {
    const cells = row.map(item => {
      const isUrgent = sorted.indexOf(item) < 2;
      const daysLabel = item.days === 0 ? "今天" : `还有${item.days}天`;

      return {
        type: "stack",
        // 每个格子：column 方向，名称在上，距离天数在下
        direction: "column",
        alignItems: "center",
        backgroundColor: isUrgent ? urgentBg : normalBg,
        borderRadius: 20,
        padding: c.pad,
        gap: c.innerGap,
        flex: 1,
        children: [
          {
            // 节假日名称：较大字号
            type: "text",
            text: item.name,
            font: { size: c.nameSize, weight: "medium" },
            textColor: isUrgent ? urgentText : normalText,
            maxLines: 1,
            minScale: 0.8,
            textAlign: "center",
          },
          {
            // 距离天数：较小字号，颜色稍浅
            type: "text",
            text: daysLabel,
            font: { size: c.daysSize, weight: "regular" },
            textColor: isUrgent ? urgentSub : normalSub,
            maxLines: 1,
            minScale: 0.8,
            textAlign: "center",
          },
        ],
      };
    });

    // 补空列
    while (cells.length < c.cols) cells.push({
      type: "stack",
      flex: 1,
      backgroundColor: "rgba(0,0,0,0)",
      padding: c.pad,
      borderRadius: 20,
      children: [],
    });

    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: c.gap,
      children: cells,
    };
  });

  return {
    type: "widget",
    backgroundColor: { light: "#FFFFFF", dark: "#1C1C1E" },
    padding: c.wpad,
    gap: c.gap,
    children: rowChildren,
  };
}
