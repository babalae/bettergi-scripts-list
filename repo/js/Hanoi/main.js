import { findImg } from "../../../packages/utils/tool";
import question from "./assets/imgs/question.png";
import head from "./assets/imgs/head.png";

(async function () {
    setGameMetrics(1920, 1080, 1);

    const diskMap = { "简单": 3, "普通": 5, "困难": 7 };
    const diskCount = diskMap[settings.difficulty] || 3;
    const clickDelayMs = parseDelay(settings.clickDelayMs);

    await findImg(question, 0, 0, 1920, 1080, 600000, 50);
    await sleep(50);

    const region = captureGameRegion();
    const towerPoints = [];
    try {
        const results = region.findMulti(RecognitionObject.TemplateMatch(head));
        for (let i = 0; i < results.count; i++) {
            towerPoints.push({ x: results[i].x + 12, y: results[i].y + 100 });
        }
    } finally {
        region.dispose();
    }
    towerPoints.sort((a, b) => a.x - b.x);

    if (towerPoints.length !== 3) {
        log.error(`柱子数量不符: ${towerPoints.length}`);
        return;
    }

    log.info(`汉诺塔阶数: ${diskCount}`);

    await sleep(200);

    const towerNames = ["A", "B", "C"];
    let step = 0;

    async function move(disks, from, via, to) {
        if (disks <= 0) return;
        await move(disks - 1, from, to, via);
        step++;
        await executeMove(disks, from, to);
        await move(disks - 1, via, from, to);
    }

    async function executeMove(disks, from, to) {
        const fromPt = towerPoints[towerNames.indexOf(from)];
        const toPt = towerPoints[towerNames.indexOf(to)];
        await click(fromPt.x, fromPt.y);
        if (step === 1) {
            await sleep(50);
            await click(fromPt.x, fromPt.y);
        }
        await sleep(clickDelayMs);
        await click(toPt.x, toPt.y);
        await sleep(clickDelayMs);
    }

    await move(diskCount, "A", "B", "C");
})();

function parseDelay(value) {
    const delay = parseInt(String(value || "50").trim(), 10);
    if (isNaN(delay) || delay < 0) {
        return 50;
    }
    return delay;
}
