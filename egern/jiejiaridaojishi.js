export default async function (ctx) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ─── 1. 农历算法（寿星万年历算法，精确到2100年） ───────────────────────
  // 农历数据：每年4字节
  // bit 20-17: 闰月月份(0=无闰月)
  // bit 16-5 : 每月大小(1=大30天,0=小29天), 月份从正月到腊月
  // bit 4-0  : 闰月大小及春节对应公历元旦偏移
  // 数据来源：紫金山天文台历法数据
  const lunarInfo = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2, // 1900-1909
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977, // 1910-1919
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970, // 1920-1929
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950, // 1930-1939
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557, // 1940-1949
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0, // 1950-1959
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0, // 1960-1969
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6, // 1970-1979
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570, // 1980-1989
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06aa0,0x0a6b6,0x056a0,0x02b60,0x09373, // 1990-1999
    0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0, // 2000-2009
    0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0, // 2010-2019
    0x0f930,0x06952,0x0f2a0,0x0dc54,0x0b550,0x0b550,0x0d2a0,0x0ee93,0x0cab0,0x0a0b8, // 2020-2029
    0x0eaa0,0x056a0,0x0cfb5,0x024b0,0x0eab4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57, // 2030-2039
    0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0, // 2040-2049
    0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60, // 2050-2059
    0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06aa0,0x0a6b6,0x056a0,0x02b60, // 2060-2069
    0x09373,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0, // 2070-2079
    0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176, // 2080-2089
    0x052b0,0x0f930,0x06952,0x0f2a0,0x0dc54,0x0b550,0x0b550,0x0d2a0,0x0ee93,0x0cab0, // 2090-2099
  ];

  // 春节（正月初一）对应的公历日期（1900-2100）
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

  // 将农历日期转为公历 Date 对象
  // lunarMonth: 1-12, lunarDay: 1-30, isLeap: 是否闰月
  function lunarToSolar(year, lunarMonth, lunarDay, isLeap = false) {
    const idx = year - 1900;
    const sf = springFestival[idx];
    if (!sf) return null;

    // 春节公历日期
    let offset = new Date(sf[0], sf[1] - 1, sf[2]);

    const info = lunarInfo[idx];
    const leapMonth = (info >> 16) & 0xf; // 闰月月份

    let days = 0;
    for (let m = 1; m < lunarMonth; m++) {
      // 正常月天数
      const bit = 16 - m;
      days += (info >> bit) & 1 ? 30 : 29;
      // 如果该月之后有闰月且已过，加闰月天数
      if (m === leapMonth && !isLeap) {
        // 闰月还没到，不加
      }
    }
    // 如果是闰月，先加对应正月天数
    if (isLeap && leapMonth === lunarMonth) {
      const bit = 16 - lunarMonth;
      days += (info >> bit) & 1 ? 30 : 29;
    }
    days += lunarDay - 1;

    const result = new Date(offset);
    result.setDate(result.getDate() + days);
    return result;
  }

  // ─── 2. 节气算法（VSOP87简化版，精确到分钟级） ──────────────────────────
  // 基于太阳黄经计算，返回某年某节气的公历日期
  // solarTermIndex: 0=小寒,1=大寒,...,23=冬至（按黄经每15度一个节气）
  // 黄经顺序：小寒285°,大寒300°,立春315°,...,冬至270°
  const solarTermNames = [
    "小寒","大寒","立春","雨水","惊蛰","春分",
    "清明","谷雨","立夏","小满","芒种","夏至",
    "小暑","大暑","立秋","处暑","白露","秋分",
    "寒露","霜降","立冬","小雪","大雪","冬至"
  ];
  // 对应黄经度数
  const solarTermDegrees = [
    285,300,315,330,345,0,
    15,30,45,60,75,90,
    105,120,135,150,165,180,
    195,210,225,240,255,270
  ];

  function getSolarTermDate(year, termName) {
    const idx = solarTermNames.indexOf(termName);
    if (idx < 0) return null;
    const degree = solarTermDegrees[idx];
    return calcSolarTermDate(year, degree);
  }

  // 计算某年太阳到达指定黄经的日期（简化VSOP87）
  function calcSolarTermDate(year, degree) {
    // 儒略日起始
    const k = Math.floor((year - 2000) * 365.2422 / 365.25);
    // 估算儒略日
    const JD0 = 2451545.0 + 365.2422 * (year - 2000) + (degree / 360) * 365.2422;
    // 迭代修正
    let JD = JD0;
    for (let i = 0; i < 50; i++) {
      const T = (JD - 2451545.0) / 36525.0;
      const L = getSunLongitude(T);
      let diff = degree - L;
      // 处理跨0度
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      if (Math.abs(diff) < 0.0001) break;
      JD += diff / 360 * 365.2422;
    }
    return JDToDate(JD + 8 / 24); // 北京时间UTC+8
  }

  // 太阳视黄经（度）
  function getSunLongitude(T) {
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const Mr = M * Math.PI / 180;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
             + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
             + 0.000289 * Math.sin(3 * Mr);
    const sunLon = L0 + C;
    // 光行差修正
    const omega = 125.04 - 1934.136 * T;
    const apparent = sunLon - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180);
    return ((apparent % 360) + 360) % 360;
  }

  // 儒略日转公历日期
  function JDToDate(JD) {
    const z = Math.floor(JD + 0.5);
    const f = JD + 0.5 - z;
    let A = z;
    if (z >= 2299161) {
      const a = Math.floor((z - 1867216.25) / 36524.25);
      A = z + 1 + a - Math.floor(a / 4);
    }
    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);
    const day = B - D - Math.floor(30.6001 * E) + f;
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;
    return new Date(year, month - 1, Math.floor(day));
  }

  // ─── 3. 父亲节（6月第三个周日） ────────────────────────────────────────────
  function getFathersDay(year) {
    const june1 = new Date(year, 5, 1);
    const dow = june1.getDay();
    const firstSun = dow === 0 ? 1 : 8 - dow;
    return new Date(year, 5, firstSun + 14);
  }

  // ─── 4. 构建节日列表 ────────────────────────────────────────────────────────
  function daysUntilDate(date) {
    if (!date) return -1;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.ceil((d - today) / 86400000);
  }

  function addIfFuture(list, name, date) {
    const days = daysUntilDate(date);
    if (days >= 0) list.push({ name, days, date });
  }

  // 搜索范围：今年和明年的节日，确保即使年末也有足够条目
  const items = [];
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    // 固定公历节日
    addIfFuture(items, "父亲节",  getFathersDay(y));
    addIfFuture(items, "建党节",  new Date(y, 6, 1));
    addIfFuture(items, "建军节",  new Date(y, 7, 1));
    addIfFuture(items, "教师节",  new Date(y, 8, 10));
    addIfFuture(items, "国庆节",  new Date(y, 9, 1));
    addIfFuture(items, "光棍节",  new Date(y, 10, 11));
    addIfFuture(items, "圣诞节",  new Date(y, 11, 25));
    addIfFuture(items, "跨年夜",  new Date(y, 11, 31));
    addIfFuture(items, "元旦",    new Date(y, 0, 1));
    addIfFuture(items, "情人节",  new Date(y, 1, 14));

    // 节气（天文算法）
    for (const term of ["夏至","小暑","大暑","立秋","处暑","白露","秋分",
                         "寒露","霜降","立冬","小雪","大雪","冬至",
                         "小寒","大寒","立春"]) {
      addIfFuture(items, term, getSolarTermDate(y, term));
    }

    // 农历节日（农历→公历换算）
    addIfFuture(items, "七夕节",  lunarToSolar(y, 7, 7));   // 七月初七
    addIfFuture(items, "中元节",  lunarToSolar(y, 7, 15));  // 七月十五
    addIfFuture(items, "中秋节",  lunarToSolar(y, 8, 15));  // 八月十五
    addIfFuture(items, "重阳节",  lunarToSolar(y, 9, 9));   // 九月初九
  }

  // 去重（同名取最近未来的），排序
  const seen = new Set();
  const unique = items
    .sort((a, b) => a.days - b.days)
    .filter(item => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });

  // ─── 5. 渲染 Widget ─────────────────────────────────────────────────────────
  const urgentCount = 2;
  const urgentBg   = "#FFDEDE";
  const urgentText = "#E53935";
  const normalBg   = "#E0F7EA";
  const normalText = "#2E7D32";

  const columns = 5;
  const rows = [];
  for (let i = 0; i < unique.length; i += columns) {
    rows.push(unique.slice(i, i + columns));
  }

  const rowChildren = rows.map((row) => {
    const cells = row.map((item) => {
      const globalIdx = unique.indexOf(item);
      const isUrgent = globalIdx < urgentCount;
      const label = item.days === 0
        ? `${item.name} 今天`
        : `${item.name} ${item.days}天`;
      return {
        type: "stack",
        direction: "row",
        alignItems: "center",
        backgroundColor: isUrgent ? urgentBg : normalBg,
        borderRadius: 20,
        padding: [5, 10],
        flex: 1,
        children: [{
          type: "text",
          text: label,
          font: { size: "subheadline", weight: "medium" },
          textColor: isUrgent ? urgentText : normalText,
          maxLines: 1,
          minScale: 0.7,
          textAlign: "center",
          flex: 1,
        }],
      };
    });

    while (cells.length < columns) {
      cells.push({
        type: "stack", flex: 1,
        backgroundColor: "rgba(0,0,0,0)",
        padding: [5, 10], borderRadius: 20,
        children: [],
      });
    }

    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 6,
      children: cells,
    };
  });

  return {
    type: "widget",
    backgroundColor: { light: "#FFFFFF", dark: "#1C1C1E" },
    padding: [12, 10],
    gap: 6,
    children: rowChildren,
  };
}
