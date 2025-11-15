
(async function () {
        try {
                // 判断你是否运行ABGI
                await http.request('GET', `http://localhost:8082/api/index`, null, null);     

                if (settings.selectScript == "开启录制") {
                        await http.request('POST', `http://localhost:8082/api/abgiObs/StartRecording`, null, null);
                } else if (settings.selectScript == "关闭录制") {
                        if (settings.rename == "") {
                                await http.request('POST', `http://localhost:8082/api/abgiObs/StopRecording`, null, null);
                                return;
                        };
                        const fileName = settings.rename;
                        await http.request('POST', `http://localhost:8082/api/abgiObs/StopRecording?videoName=${fileName}`, null, null);
                };
                return;          
        } catch (error) {
                log.error("你的ABGI未运行！！！")
        };
})();