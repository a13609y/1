const TAG = '[YT-ZH-Sub]';

(function () {
    var url = $request.url;

    if (/[?&]tlang=zh/.test(url) || /[?&]lang=zh/.test(url)) {
        console.log(TAG + ' already zh, skip');
        $done({});
        return;
    }

    var zhUrl = url + '&tlang=zh-Hans&_ytzhsub=1';

    var headers = {};
    if ($request.headers) {
        var keys = Object.keys($request.headers);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k.toLowerCase() !== 'host') {
                headers[k] = $request.headers[k];
            }
        }
    }
    delete headers['Cookie'];
    delete headers['cookie'];

    console.log(TAG + ' fetching zh: ' + zhUrl.substring(0, 120));

    $httpClient.get({ url: zhUrl, headers: headers }, function (error, response, body) {
        if (error) {
            console.log(TAG + ' fetch error: ' + error);
            $done({});
            return;
        }

        var status = response.status || 0;
        console.log(TAG + ' fetch status=' + status + ' bodyLen=' + (body ? body.length : 0));

        if (status === 200 && body && body.length > 100) {
            console.log(TAG + ' replaced with zh subtitle');
            $done({ body: body });
        } else {
            console.log(TAG + ' fetch failed, keep original');
            $done({});
        }
    });
})();