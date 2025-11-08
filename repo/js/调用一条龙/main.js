
(async function () {
        

        try {
                // 判断你是否运行ABGI
                const exitABGI = await http.request('GET', `http://localhost:8082/api/index`, null, null);
                log.debug(`ABGI状态: ${JSON.stringify(exitABGI.body)}`);
        } catch (error) {
                log.error("ABGI未运行");
                return;
        };
        const listResp = await http.request('POST',"http://localhost:8082/api/oneLong/startOneLong",`${settings.oneDragonName}`,null);
})();