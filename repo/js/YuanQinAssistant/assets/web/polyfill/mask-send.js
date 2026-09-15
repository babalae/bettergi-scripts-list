(function(){
    if(window.htmlMask) {
        if (!window.htmlMask.send) {
            window.htmlMask.send = function (url, data) {
                window.chrome.webview.postMessage(JSON.stringify({
                    url: url,
                    data: data
                }));
            };
        }
    }
})();
