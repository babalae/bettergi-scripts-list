(async function () {
    // settings 的对象内容来自于 settings.json 文件生成的动态配置页面
    log.info('等待{time}秒', settings.t)
    timeset=1000*settings.t
    await sleep(timeset);
})();