// ==UserScript==
// @Name         节假日倒计时 × 每日美图
// @Platform     Egern
// @Type         generic
// @Author       merged
// ==/UserScript==

// ============================================================
// 环境变量说明（在 Egern 脚本 → Env 中填写）
// ============================================================
// ── 图片相关 ──
// API_KEY    可选  lolicon API Key
// R18        可选  0=非R18 / 1=R18 / 2=混合  默认：2
// KEYWORDS   可选  Pixiv 日文标签，多个用 | 分隔，随机取一个
//            示例：初音ミク|エミリア|雷電将軍
// BATCH      可选  每次请求图片数  默认：20（1~20）
// COOLDOWN   可选  API 请求冷却分钟  默认：5
// ============================================================

export default async function (ctx) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const family = ctx.widgetFamily || 'systemLarge';

  // ── 锁屏小组件提前返回 ──────────────────────────────────────────────────
  if (family === 'accessoryRectangular' || family === 'accessoryCircular') {
    return { type: 'widget', children: [{ type: 'image', src: 'sf-symbol:calendar', width: 28, height: 28 }] };
  }
  if (family === 'accessoryInline') {
    return { type: 'widget', children: [{ type: 'text', text: '节日倒计时', maxLines: 1 }] };
  }

  // ════════════════════════════════════════════════════════════
  // 1. 农历换算（寿星万年历，1900-2100）
  // ════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════
  // 2. 节气算法（VSOP87 简化，精确到分钟级）
  // ════════════════════════════════════════════════════════════
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
    const omega = 125.04 - 1934.136*T;
    const app = (L0+C) - 0.00569 - 0.00478*Math.sin(omega*Math.PI/180);
    return ((app % 360) + 360) % 360;
  }

  function JDToDate(JD) {
    const z=Math.floor(JD+0.5), f=JD+0.5-z;
    let A=z;
    if (z>=2299161){const a=Math.floor((z-1867216.25)/36524.25);A=z+1+a-Math.floor(a/4);}
    const B=A+1524,C=Math.floor((B-122.1)/365.25),D=Math.floor(365.25*C),E=Math.floor((B-D)/30.6001);
    const day=B-D-Math.floor(30.6001*E)+f;
    const month=E<14?E-1:E-13;
    return new Date(month>2?C-4716:C-4715, month-1, Math.floor(day));
  }

  function getSolarTermDate(year, termName) {
    const idx=solarTermNames.indexOf(termName); if(idx<0)return null;
    const degree=solarTermDegrees[idx];
    let JD=2451545.0+365.2422*(year-2000)+(degree/360)*365.2422;
    for(let i=0;i<50;i++){
      const T=(JD-2451545.0)/36525.0;
      let diff=degree-getSunLongitude(T);
      if(diff>180)diff-=360;if(diff<-180)diff+=360;
      if(Math.abs(diff)<0.0001)break;
      JD+=diff/360*365.2422;
    }
    return JDToDate(JD+8/24);
  }

  function getFathersDay(year) {
    const d=new Date(year,5,1); const dow=d.getDay();
    return new Date(year,5,(dow===0?1:8-dow)+14);
  }

  // ════════════════════════════════════════════════════════════
  // 3. 构建节日列表
  // ════════════════════════════════════════════════════════════
  function daysUntil(date) {
    if(!date)return -1;
    return Math.ceil((new Date(date.getFullYear(),date.getMonth(),date.getDate())-today)/86400000);
  }

  const items=[];
  function add(name,date){const d=daysUntil(date);if(d>=0)items.push({name,days:d});}

  for(const y of [now.getFullYear(), now.getFullYear()+1]){
    add("父亲节",  getFathersDay(y));
    add("建党节",  new Date(y,6,1));
    add("建军节",  new Date(y,7,1));
    add("教师节",  new Date(y,8,10));
    add("国庆节",  new Date(y,9,1));
    add("光棍节",  new Date(y,10,11));
    add("圣诞节",  new Date(y,11,25));
    add("跨年夜",  new Date(y,11,31));
    add("元旦",    new Date(y,0,1));
    add("情人节",  new Date(y,1,14));
    for(const t of ["夏至","小暑","大暑","立秋","处暑","白露","秋分",
                     "寒露","霜降","立冬","小雪","大雪","冬至","小寒","大寒","立春"])
      add(t, getSolarTermDate(y,t));
    add("七夕节",  lunarToSolar(y,7,7));
    add("中元节",  lunarToSolar(y,7,15));
    add("中秋节",  lunarToSolar(y,8,15));
    add("重阳节",  lunarToSolar(y,9,9));
  }

  const seen=new Set();
  const sorted=items
    .sort((a,b)=>a.days-b.days)
    .filter(item=>{if(seen.has(item.name))return false;seen.add(item.name);return true;});

  // ════════════════════════════════════════════════════════════
  // 4. 按组件尺寸决定布局
  // ════════════════════════════════════════════════════════════
  let columns, maxRows;
  if      (family==='systemSmall')      { columns=2; maxRows=3; }
  else if (family==='systemMedium')     { columns=3; maxRows=3; }
  else if (family==='systemExtraLarge') { columns=5; maxRows=8; }
  else                                   { columns=5; maxRows=6; }

  const visible = sorted.slice(0, columns * maxRows);

  // ════════════════════════════════════════════════════════════
  // 5. 获取背景图片（色图逻辑，完整保留）
  // ════════════════════════════════════════════════════════════
  const apiKey   = ctx.env.API_KEY  || '';
  const r18      = ctx.env.R18      || '2';
  const keywords = ctx.env.KEYWORDS || '';
  const batch    = Math.min(20, Math.max(1, parseInt(ctx.env.BATCH    || '20')));
  const cooldown = Math.max(1,            parseInt(ctx.env.COOLDOWN   || '5')) * 60 * 1000;

  const tagList  = keywords.split('|').map(t=>t.trim()).filter(Boolean);
  const keyword  = tagList.length>0 ? tagList[Math.floor(Math.random()*tagList.length)] : '';

  let aspectRatio;
  if      (family==='systemMedium')                             aspectRatio='gt1.6lt2.4';
  else if (family==='systemLarge'||family==='systemExtraLarge') aspectRatio='gt0.4lt0.65';
  else                                                          aspectRatio='gt0.8lt1.3';

  const imageSize   = (family==='systemSmall') ? 'small' : 'regular';
  const urlPoolKey  = `setu_urls_${family}`;
  const indexKey    = `setu_index_${family}`;
  const cooldownKey = `setu_cooldown_${family}`;
  const configKey   = `setu_config_${family}`;

  let urlPool=[];
  try{urlPool=JSON.parse(ctx.storage.get(urlPoolKey)||'[]');}catch(_){}
  let index=parseInt(ctx.storage.get(indexKey)||'0');

  // 冷却：距离上次请求API是否超过COOLDOWN分钟
  const lastRequest  = parseInt(ctx.storage.get(cooldownKey)||'0');
  const expired      = (Date.now()-lastRequest)>=cooldown;
  const configSig    = `${batch}|${r18}|${keyword}|${imageSize}|${aspectRatio}`;
  const configChanged= configSig!==(ctx.storage.get(configKey)||'');

  // 满足以下任一条件就重新请求API：
  // 1. 冷却时间到了
  // 2. 配置参数变了
  // 3. 图片池已经全部看完（index 超出池子）
  const poolExhausted = urlPool.length===0 || index>=urlPool.length;

  if(expired||configChanged||poolExhausted){
    for(let i=0;i<urlPool.length;i++) ctx.storage.delete(`setu_img_${family}_${i}`);
    try{
      const body={r18:parseInt(r18),num:batch,size:[imageSize],aspectRatio:[aspectRatio]};
      if(apiKey)  body.apikey=apiKey;
      if(keyword) body.tag=[[keyword]];
      const resp=await ctx.http.post('https://api.lolicon.app/setu/v2',{
        headers:{'Content-Type':'application/json','User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'},
        body:JSON.stringify(body)
      });
      const obj=await resp.json();
      if(obj.error)throw new Error(obj.error);
      if(!obj.data||obj.data.length===0)throw new Error('No data');
      const newUrls=obj.data.map(pic=>pic.urls?.[imageSize]||pic.urls?.original||'').filter(Boolean);
      if(newUrls.length>0){
        urlPool=newUrls; index=0;
        ctx.storage.set(urlPoolKey,JSON.stringify(urlPool));
        ctx.storage.set(indexKey,'0');
        // 只有真正调用了API才更新冷却时间戳
        ctx.storage.set(cooldownKey,String(Date.now()));
        ctx.storage.set(configKey,configSig);
      }
    }catch(e){
      if(urlPool.length===0) return buildFallbackWidget(visible,columns,maxRows,sorted);
    }
  }

  if(urlPool.length===0) return buildFallbackWidget(visible,columns,maxRows,sorted);

  // 确保 index 在范围内（容错）
  if(index>=urlPool.length) index=0;

  const picUrl    = urlPool[index];
  const nextIndex = (index+1)%urlPool.length;
  const nextUrl   = urlPool[nextIndex];
  // 每次打开都推进 index，实现每次都换图
  // 当 index 超出池子时，下次打开会触发重新请求API（poolExhausted）
  ctx.storage.set(indexKey,String(index+1));

  const imgCacheKey=`setu_img_${family}_${index}`;
  const imgCache=ctx.storage.getJSON(imgCacheKey);
  let base64;

  if(imgCache?.url===picUrl&&imgCache?.base64){
    base64=imgCache.base64;
  }else{
    try{
      base64=await downloadBase64(ctx,picUrl);
      ctx.storage.setJSON(imgCacheKey,{url:picUrl,base64});
    }catch(e){
      return buildFallbackWidget(visible,columns,maxRows,sorted);
    }
  }

  // 预下载下一张
  const nextCacheKey=`setu_img_${family}_${nextIndex}`;
  const nextCache=ctx.storage.getJSON(nextCacheKey);
  if(!nextCache||nextCache.url!==nextUrl){
    downloadBase64(ctx,nextUrl)
      .then(b64=>ctx.storage.setJSON(nextCacheKey,{url:nextUrl,base64:b64}))
      .catch(()=>{});
  }

  // ════════════════════════════════════════════════════════════
  // 6. 渲染：图片做背景，节日标签叠在上面
  // ════════════════════════════════════════════════════════════
  return {
    type: 'widget',
    backgroundImage: `data:image/jpeg;base64,${base64}`,
    padding: [10, 8],
    gap: 6,
    url: picUrl,
    children: [buildGrid(visible, columns, sorted)],
  };
}

// ── 构建标签网格 ─────────────────────────────────────────────────────────────
function buildGrid(visible, columns, sorted) {
  // 有图片背景时：标签用半透明白色背景+深色文字，紧急用半透明红色
  const urgentBg   = 'rgba(255,80,80,0.55)';
  const urgentText = '#FFFFFF';
  const normalBg   = 'rgba(255,255,255,0.45)';
  const normalText = '#1A1A1A';

  const rows = [];
  for(let i=0;i<visible.length;i+=columns) rows.push(visible.slice(i,i+columns));

  const rowChildren = rows.map(row => {
    const cells = row.map(item => {
      const isUrgent = sorted.indexOf(item) < 2;
      const label = item.days===0 ? `${item.name} 今天` : `${item.name} ${item.days}天`;
      return {
        type:'stack', direction:'row', alignItems:'center',
        backgroundColor: isUrgent ? urgentBg : normalBg,
        borderRadius:20, padding:[5,8], flex:1,
        children:[{
          type:'text', text:label,
          font:{size:'subheadline',weight:'medium'},
          textColor: isUrgent ? urgentText : normalText,
          maxLines:1, minScale:0.8, textAlign:'center', flex:1,
        }],
      };
    });
    while(cells.length<columns) cells.push({
      type:'stack',flex:1,backgroundColor:'rgba(0,0,0,0)',
      padding:[5,8],borderRadius:20,children:[],
    });
    return {type:'stack',direction:'row',alignItems:'center',gap:6,children:cells};
  });

  return {type:'stack',direction:'column',gap:6,children:rowChildren};
}

// ── 图片加载失败时的纯色降级（保留原有绿色风格） ────────────────────────────
function buildFallbackWidget(visible, columns, maxRows, sorted) {
  const urgentBg='#FFDEDE', urgentText='#E53935';
  const normalBg='#E0F7EA', normalText='#2E7D32';

  const rows=[];
  for(let i=0;i<visible.length;i+=columns) rows.push(visible.slice(i,i+columns));

  const rowChildren=rows.map(row=>{
    const cells=row.map(item=>{
      const isUrgent=sorted.indexOf(item)<2;
      const label=item.days===0?`${item.name} 今天`:`${item.name} ${item.days}天`;
      return{
        type:'stack',direction:'row',alignItems:'center',
        backgroundColor:isUrgent?urgentBg:normalBg,
        borderRadius:20,padding:[5,8],flex:1,
        children:[{type:'text',text:label,font:{size:'subheadline',weight:'medium'},
          textColor:isUrgent?urgentText:normalText,maxLines:1,minScale:0.8,textAlign:'center',flex:1}],
      };
    });
    while(cells.length<columns)cells.push({
      type:'stack',flex:1,backgroundColor:'rgba(0,0,0,0)',padding:[5,8],borderRadius:20,children:[],
    });
    return{type:'stack',direction:'row',alignItems:'center',gap:6,children:cells};
  });

  return{
    type:'widget',
    backgroundColor:{light:'#FFFFFF',dark:'#1C1C1E'},
    padding:[12,10],gap:6,
    children:rowChildren,
  };
}

// ── 下载图片转 base64 ────────────────────────────────────────────────────────
async function downloadBase64(ctx, url) {
  const imgResp=await ctx.http.get(url,{headers:{'Referer':'https://www.pixiv.net/'}});
  const buffer=await imgResp.arrayBuffer();
  const bytes=new Uint8Array(buffer);
  let binary='';
  for(let i=0;i<bytes.byteLength;i++) binary+=String.fromCharCode(bytes[i]);
  return btoa(binary);
}
