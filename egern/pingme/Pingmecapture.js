/*
  PingMe 参数抓取脚本（Egern http_request 脚本）
  作用：当 PingMe App 正常使用触发 queryBalanceAndBonus / checkIn 请求时，
        截获其请求头与 URL 参数，存入 ctx.storage 供签到脚本复用。
  用法：在 Profile.yaml 的 scriptings 中以 http_request 类型引入本脚本，
        match 规则匹配 api.pingmeapp.net 下的相关接口，并需开启 MITM。
  注意：本脚本只读取请求，不修改、不中止请求（不 return 任何值即为透传）。
*/

const STORAGE_KEY = 'pingme_capture';

export default async function (ctx) {
  const url = ctx.request.url;

  // 收集请求头（Headers 对象遵循 Fetch API，使用 forEach 遍历）
  const headers = {};
  ctx.request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // 解析 URL 上的原始查询参数（保留原始顺序/大小写，供重新签名使用）
  const queryString = (url.split('?')[1] || '').split('#')[0];
  const paramsRaw = {};
  queryString.split('&').forEach((pair) => {
    if (!pair) return;
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    paramsRaw[pair.slice(0, idx)] = pair.slice(idx + 1);
  });

  ctx.storage.setJSON(STORAGE_KEY, { headers, paramsRaw });

  // 不返回任何内容 -> 请求原样放行
}
