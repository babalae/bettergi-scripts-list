// src/index.ts
async function mouseSmoothMove(sx, sy, ex, ey, duration) {
  const steps = Math.max(Math.floor(duration / (1e3 / 60)), 20);
  const points = [];
  points.push([sx, sy]);
  for (let i = 1; i < steps - 1; i++) {
    const t = i / (steps - 1);
    const x = (1 - t) * sx + t * ex;
    const y = (1 - t) * sy + t * ey;
    points.push([x, y]);
  }
  points.push([ex, ey]);
  const interval = duration / steps;
  for (const [x, y] of points) {
    moveMouseTo(Math.floor(x), Math.floor(y));
    await sleep(Math.floor(interval));
  }
}
async function mouseSmoothDrag(sx, sy, ex, ey, duration) {
  moveMouseTo(sx, sy);
  leftButtonDown();
  await sleep(50);
  await mouseSmoothMove(sx, sy, ex, ey, duration - 300);
  await sleep(250);
  leftButtonUp();
}

// 最多尝试 2 次拖动屏幕
const DRAG_SCREEN_MAX = 2;
// 宠物与模板的对应关系
const PETS = [
    // TODO: 作者未拥有(lll￢ω￢)，待有缘人补充
    // { name: "迷你仙灵·薄红", file: "" },
    // { name: "迷你仙灵·露草", file: "" },
    // { name: "嫣朵拉", file: "" },
    { name: '迷你仙灵·苔绿', file: 'assets/moss.png' },
    { name: '迷你仙灵·紫苑', file: 'assets/viola.png' },
    { name: '迷你仙灵·郁金', file: 'assets/curcuma.png' },
    { name: '迷你仙灵·璨光', file: 'assets/brilliance.png' },
    { name: '魔瓶镇灵·利露帕尔', file: 'assets/liloupar.png' },
    { name: '斯露莎', file: 'assets/sorush.png' },
    { name: '初诞灵焰', file: 'assets/firstborn_firesprite.png' },
    { name: '柔柔小章', file: 'assets/itty_bitty_octobaby.png' },
    { name: '缥锦机关·留云', file: 'assets/damasked_device.png' },
    { name: '「式小将」', file: 'assets/shiki_koshou.png' },
];
/**
 * 装备宠物
 * @param pet 宠物
 */
async function equipPet(pet) {
    // 宠物识别 低精度
    const petRo = RecognitionObject.templateMatch(file.readImageMatSync(pet.file));
    petRo.threshold = 0.9;
    // 开启 3 通道识别区分 迷你仙灵 系列
    petRo.use3Channels = true;
    for (let i = 0; i < DRAG_SCREEN_MAX; i++) {
        // 移开鼠标
        moveMouseTo(0, 0);
        await sleep(100);
        const gameRegion = captureGameRegion();
        const petRegion = gameRegion.find(petRo);
        if (!petRegion.isExist()) {
            gameRegion.dispose();
            // 未找到宠物，尝试拖动屏幕
            await mouseSmoothDrag(1200, 890, 1200, 186, 2000);
            continue;
        }
        petRegion.click();
        await sleep(1000);
        // 提升精度
        petRo.threshold = 0.97;
        const equipRegion = gameRegion.find(petRo);
        gameRegion.dispose();
        if (!equipRegion.isExist()) {
            // 装备宠物
            click(1690, 1015);
            await sleep(1000);
        }
        return log.info(`已装备：${pet.name}`);
    }
    throw new Error(`未识别到宠物：${pet.name}`);
}
/**
 * 卸下宠物
 */
async function removePet() {
    const pets = PETS.map((pet) => {
        const ro = RecognitionObject.templateMatch(file.readImageMatSync(pet.file));
        ro.threshold = 0.97;
        ro.use3Channels = true;
        return { ...pet, ro };
    });
    for (let i = 0; i < DRAG_SCREEN_MAX; i++) {
        // 移开鼠标
        moveMouseTo(0, 0);
        await sleep(100);
        const gameRegion = captureGameRegion();
        for (const pet of pets) {
            const petRegion = gameRegion.find(pet.ro);
            if (!petRegion.isExist()) {
                continue;
            }
            petRegion.click();
            await sleep(1000);
            click(1690, 1015);
            await sleep(1000);
            return log.info(`已卸下宠物：${pet.name}`);
        }
        gameRegion.dispose();
        await mouseSmoothDrag(1200, 890, 1200, 186, 2000);
    }
    log.warn('未找到装备中的宠物');
}
(async () => {
    try {
        const name = settings.name;
        const mode = settings.mode;
        if (!name && mode === '装备') {
            throw new Error('请先设置宠物名称');
        }
        if (mode === '装备') {
            log.info(`尝试装备：${name}`);
        }
        else if (mode === '卸下') {
            log.info('尝试卸下宠物');
        }
        // 切回主界面
        await genshin.returnMainUi();
        // 打开背包
        keyPress('VK_B');
        await sleep(1000);
        // 移动到小道具栏
        moveMouseTo(1055, 50);
        leftButtonClick();
        await sleep(1000);
        if (mode === '装备') {
            await equipPet(PETS.find(pet => pet.name === name));
        }
        else if (mode === '卸下') {
            await removePet();
        }
    }
    catch (error) {
        log.error(error.message);
    }
    finally {
        await genshin.returnMainUi();
    }
})();
