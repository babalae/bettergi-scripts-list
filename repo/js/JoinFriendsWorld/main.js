// src/index.ts
function autoZoomOcr(x, y, w, h) {
  const ratio = genshin.scaleTo1080PRatio;
  return RecognitionObject.ocr(x * ratio, y * ratio, w * ratio, h * ratio);
}
function createTimer(timeout) {
  let time = Date.now();
  return Object.freeze({
    reStart() {
      time = Date.now();
    },
    isTimeout() {
      return Date.now() - time >= timeout;
    }
  });
}
async function isCoOpMode() {
  await genshin.returnMainUi();
  const gameRegion = captureGameRegion();
  const ocrRegion = gameRegion.find(autoZoomOcr(343, 22, 45, 45));
  gameRegion.dispose();
  const ocrText = ocrRegion.text.trim().toLocaleLowerCase();
  return ocrText.includes("p") || ocrText !== "";
}

// 等待好友确认超时时间 25s
const WAIT_FRIEND_CONFIRM_TIMEOUT = 25 * 1000;
(async () => {
    try {
        const uid = settings.uid?.trim();
        if (!uid) {
            throw new Error('UID 不能为空');
        }
        if (await isCoOpMode()) {
            throw new Error('正在多人游戏中，无法加入好友世界');
        }
        log.info(`尝试加入好友世界(UID: ${uid})`);
        // 打开好友列表
        keyPress('VK_O');
        await sleep(1000);
        // 打开添加好友
        click(960, 50);
        await sleep(1000);
        // 点击输入框，输入 UID，点击搜索
        click(960, 150);
        inputText(uid);
        click(1680, 150);
        await sleep(500);
        const gameRegion = captureGameRegion();
        // 尝试找到用户卡片的冒险等阶
        const levelRegin = gameRegion.find(autoZoomOcr(425, 445, 106, 37));
        const levelText = levelRegin.text.trim();
        if (!levelText.includes('冒险等阶')) {
            // 判断是否搜索的用户是否是自己
            const yourselfRegin = gameRegion.find(autoZoomOcr(660, 495, 601, 88));
            if (yourselfRegin.text.includes('其他玩家')) {
                gameRegion.dispose();
                throw new Error('不能使用自己的UID');
            }
            gameRegion.dispose();
            throw new Error('UID不存在');
        }
        const joinOrAddRegin = gameRegion.find(autoZoomOcr(1160, 800, 200, 54));
        const joinOrAddText = joinOrAddRegin.text.trim();
        gameRegion.dispose();
        if (joinOrAddText === '') {
            throw new Error('你的好友不在线');
        }
        else if (joinOrAddText === '申请加入') {
            log.info(`已经发起加入申请，等待好友同意`);
            joinOrAddRegin.click();
        }
        else {
            throw new Error('TA不是你的好友');
        }
        const timer = createTimer(WAIT_FRIEND_CONFIRM_TIMEOUT);
        while (true) {
            // 等待好友回复
            const gameRegion = captureGameRegion();
            const requestRegin = gameRegion.find(autoZoomOcr(725, 195, 465, 45));
            const requestText = requestRegin.text.trim();
            gameRegion.dispose();
            if (requestText.endsWith('拒绝了多人游戏申请')) {
                throw new Error('好友拒绝了多人游戏');
            }
            else if (requestText.startsWith('无法进入')) {
                throw new Error('无法进入好友世界');
            }
            else if (requestText.startsWith('世界主人暂忙')) {
                throw new Error('好友正在忙，无法加入');
            }
            if (await isCoOpMode()) {
                log.info('成功加入好友世界');
                break;
            }
            if (timer.isTimeout()) {
                throw new Error('请求超时');
            }
            await sleep(50);
        }
    }
    catch (error) {
        log.error(error.message);
        await genshin.returnMainUi();
    }
})();
