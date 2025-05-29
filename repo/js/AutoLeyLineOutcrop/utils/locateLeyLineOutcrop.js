/**
 * 在地图上定位地脉花
 * @param {string} type - 地脉花类型
 * @returns {Promise<boolean>} 是否找到地脉花
 */
this.locateLeyLineOutcrop = 
async function (type) {
    await sleep(500); // 确保画面稳定
    await genshin.setBigMapZoomLevel(3.0);

    const iconPath = type === "蓝花（经验书）"
        ? "assets/icon/Blossom_of_Revelation.png"
        : "assets/icon/Blossom_of_Wealth.png";

    const flowerList = captureGameRegion().findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconPath)));

    if (flowerList && flowerList.count > 0) {
        currentFlower = flowerList[0];
        const flowerType = type === "蓝花（经验书）" ? "经验" : "摩拉";

        const center = genshin.getPositionFromBigMap();
        const mapZoomLevel = genshin.getBigMapZoomLevel();
        const mapScaleFactor = 2.361;

        leyLineX = (960 - currentFlower.x - 25) * mapZoomLevel / mapScaleFactor + center.x;
        leyLineY = (540 - currentFlower.y - 25) * mapZoomLevel / mapScaleFactor + center.y;

        log.info(`找到地脉花的坐标：(${leyLineX}, ${leyLineY})`);
        return true;
    } else {
        log.warn("未找到地脉花");
        return false;
    }
}