(async function () {

    log.info('前往稻妻合成台，“那位莱特不行，他冲刺比其他成男角色远”（成男角色：钟离，公子，凯亚，迪卢克等）');

    async function captureCrystalfly(locationName, x, y, num) {
        log.info('前往 {name}', locationName);
        await genshin.tp(x, y);
        await sleep(5000);
        let filePath = `assets/${locationName}.json`;
        await keyMouseScript.runFile(filePath);
    }

    await captureCrystalfly('稻妻合成台', -4402.56, -3052.88);
})();