(async function () {
    const towerPoints = [
        { x: 685, y: 510 }, // A 左柱点位，示例：{ x: 640, y: 720 }
        { x: 965, y: 510 }, // B 中柱点位，示例：{ x: 960, y: 720 }
        { x: 1245, y: 510 },  // C 右柱点位，示例：{ x: 1280, y: 720 }
    ];
    const towerNames = ["A", "B", "C"];
    const diskCount = parseDiskCount(settings.diskCount);
    const clickDelayMs = parseDelay(settings.clickDelayMs);
    const canClick = towerPoints.every(isValidPoint);
    const totalSteps = Math.pow(2, diskCount) - 1;

    log.info(`汉诺塔阶数：${diskCount}`);
    log.info(`最短步数：${totalSteps}`);

    await waitForStartKey("N");

    if (!canClick) {
        log.warn("三个柱子的点位尚未全部写入 towerPoints，将只输出移动步骤，不执行点击。");
    }

    let step = 0;

    async function move(disks, from, via, to) {
        if (disks <= 0) {
            return;
        }

        await move(disks - 1, from, to, via);
        step++;
        await executeMove(step, disks, from, to);
        await move(disks - 1, via, from, to);
    }

    async function executeMove(index, disk, from, to) {
        log.info(`第 ${index}/${totalSteps} 步：移动第 ${disk} 层，${from} -> ${to}`);

        if (!canClick) {
            return;
        }

        await clickPoint(towerPoints[towerNames.indexOf(from)]);
        await clickPoint(towerPoints[towerNames.indexOf(to)]);
    }

    async function clickPoint(point) {
        await click(point.x, point.y);
        await sleep(clickDelayMs);
    }

    await move(diskCount, "A", "B", "C");
    log.info("汉诺塔执行完成。");
})();

function parseDiskCount(value) {
    const count = parseInt(String(value || "3").trim(), 10);
    if (isNaN(count) || count < 1) {
        throw new Error("汉诺塔阶数必须是大于等于 1 的整数。");
    }
    if (count > 20) {
        throw new Error("阶数过大，点击步数会指数增长；请设置为 20 或以下。");
    }
    return count;
}

function parseDelay(value) {
    const delay = parseInt(String(value || "300").trim(), 10);
    if (isNaN(delay) || delay < 0) {
        return 300;
    }
    return delay;
}

function isValidPoint(point) {
    return point
        && typeof point.x === "number"
        && typeof point.y === "number"
        && !isNaN(point.x)
        && !isNaN(point.y);
}

async function waitForStartKey(key) {
    log.info(`请按 ${key} 开始汉诺塔。`);

    const hook = new KeyMouseHook();
    let started = false;

    try {
        await new Promise(function (resolve) {
            hook.OnKeyDown(function (keyCode) {
                if (!started && normalizeKey(keyCode) === normalizeKey(key)) {
                    started = true;
                    resolve();
                }
            }, true);
        });
    } finally {
        hook.dispose();
    }

    await sleep(200);
    log.info("已检测到开始按键，开始执行。");
}

function normalizeKey(key) {
    return String(key || "")
        .toUpperCase()
        .replace(/^VK_/, "")
        .replace(/^KEY_/, "");
}
