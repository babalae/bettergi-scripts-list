// 自定义 basename 函数
function basename(filePath) {
    const lastSlashIndex = filePath.lastIndexOf('\\'); // 或者使用 '/'，取决于你的路径分隔符
    return filePath.substring(lastSlashIndex + 1);
}

(async function () {
    setGameMetrics(1920, 1080, 1); // 设置游戏分辨率
    await genshin.returnMainUi();
    keyPress("B"); await sleep(1000);

    // 定义图标文件夹路径
    const iconDir = "assets/icon";
    const pictureDir = "assets/Picture";

    const iconFilePaths = file.ReadPathSync(iconDir);
    const pictureFilePaths = file.ReadPathSync(pictureDir);

    const iconRecognitionObjects = [];
    for (const filePath of iconFilePaths) {
        const mat = file.readImageMatSync(filePath);
        if (mat.empty()) {
            log.error(`加载图标失败：${filePath}`);
            continue;
        }
        const recognitionObject = RecognitionObject.TemplateMatch(mat, 0, 0, 1920, 1080);
        iconRecognitionObjects.push({ name: basename(filePath), ro: recognitionObject });
    }

    const pictureRegions = [];
    for (const filePath of pictureFilePaths) {
        const mat = file.readImageMatSync(filePath);
        if (mat.empty()) {
            log.error(`加载图库失败：${filePath}`);
            continue;
        }
        pictureRegions.push({ name: basename(filePath), region: new ImageRegion(mat, 0, 0) });
    }

    const foundRegions = [];

    for (const picture of pictureRegions) {
        for (const icon of iconRecognitionObjects) {
            // 在图库中查找图标信息
            const foundRegion = picture.region.find(icon.ro);
            if (foundRegion.isExist()) {
                foundRegions.push({
                    pictureName: picture.name,
                    iconName: icon.name,
                    region: foundRegion
                });
            }
        }
    }

    for (const foundRegion of foundRegions) {

        const ra = captureGameRegion();
        const tolerance = 1; // 容错区间
        const iconMat = file.ReadImageMatSync(`assets/icon/${foundRegion.iconName}`);
        const recognitionObject = RecognitionObject.TemplateMatch(iconMat, foundRegion.region.x-tolerance, foundRegion.region.y-tolerance, foundRegion.region.width+2*tolerance, foundRegion.region.height+2*tolerance);
        recognitionObject.threshold = 0.85; // 设置识别阈值为 0.9
        const result = ra.find(recognitionObject);
        if (result.isExist() && result.x > 0 && result.y > 0) {
            // 获取图标的中心坐标并取整
            const x = Math.round(foundRegion.region.x + foundRegion.region.width / 2);
            const y = Math.round(foundRegion.region.y + foundRegion.region.height / 2);

            await click(x, y);
            log.info(`点击 ${foundRegion.iconName}成功，位置: (${x}, ${y})`);
            await sleep(500); // 等待一段时间
        } else {
            // 如果未找到图标，打印警告信息
            log.info(`未发现背包弹窗：${foundRegion.iconName}`);
        }
    ra.dispose();
    }

    const coords = [
        [670, 40], [660, 1010], [300, 1020],
        // [200, 150, 500], [200, 220, 500],
        [200, 300, 500, settings.autoSalvage3 === '否'],
        [200, 380, 500, settings.autoSalvage4 === '否'],
        [340, 1000], [1720, 1015], [1320, 756],
        [1840, 45, 1500], [1840, 45], [1840, 45]
    ];

    for (const coord of coords) {
        const [x, y, delay = 1000, condition = true] = coord; // 默认值处理
        if (condition) {
            click(x, y);
            await sleep(delay);
        }
    }
})();


