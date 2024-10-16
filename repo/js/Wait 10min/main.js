(async function () {
    setGameMetrics(1920, 1080, 2);
    await sleep(10000); // 转换时间单位，从20ms到秒
    log.info("等待了10秒");
})();