
(async function () {
        const api_key = settings.apiKey;
        try {
                // 判断你是否运行ABGI
                const exitABGI = await http.request('GET', `http://localhost:8082/api/index`, null, JSON.stringify({ "api_key": api_key }));
                log.debug(`ABGI状态: ${JSON.stringify(exitABGI.body)}`);
        } catch (error) {
                log.error("情况一：ABGI未运行");
                log.error("情况二：未在通用配置里启用HTTP权限");
                return;
        };



        // 调用ABGI接口
        if (settings.selectTask !== "") {
                const exitABGI = await http.request('POST', `http://localhost:8082/api/taskCron/AtOnceRun?type=${settings.selectTask}&data=${settings.inputText}`, null, JSON.stringify({"api_key": api_key}));
                log.debug(`ABGI状态: ${JSON.stringify(exitABGI.body)}`);
        };

        
})();
