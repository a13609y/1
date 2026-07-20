// YouTube 强制简体中文字幕 - 响应脚本（Egern 版）
// 原作者: @ZenmoFeiShi  原仓库: https://github.com/ZenmoFeiShi/Qx

const TAG = '[YT-ZH-Sub]';

export default async function(ctx) {
    const url = ctx.request.url;

    // 已经是中文字幕则跳过
    if (/[?&]tlang=zh/.test(url) || /[?&]lang=zh/.test(url)) {
        console.log(TAG + ' already zh, skip');
        return;
    }

    // 构造强制简体中文字幕 URL（加 tlang 和内部标记参数）
    const zhUrl = url + '&tlang=zh-Hans&_ytzhsub=1';

    // 复制请求头，去掉 Cookie 和 Host（避免子请求携带认证信息触发风控）
    const reqHeaders = {};
    for (const [k, v] of Object.entries(ctx.request.headers)) {
        const lk = k.toLowerCase();
        if (lk !== 'host' && lk !== 'cookie') {
            reqHeaders[k] = v;
        }
    }

    console.log(TAG + ' fetching zh subtitle: ' + zhUrl.substring(0, 120));

    try {
        const resp = await ctx.http.get(zhUrl, { headers: reqHeaders });
        const body = await resp.text();

        console.log(TAG + ' status=' + resp.status + ' bodyLen=' + (body ? body.length : 0));

        if (resp.status === 200 && body && body.length > 100) {
            console.log(TAG + ' replaced with zh subtitle');
            return { body };
        } else {
            console.log(TAG + ' fetch failed, keep original');
            return;
        }
    } catch (err) {
        console.log(TAG + ' fetch error: ' + (err.message || err));
        return;
    }
}
