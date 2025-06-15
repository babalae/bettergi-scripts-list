// 等待好友确认超时时间 25s
const WAIT_FRIEND_CONFIRM_TIMEOUT = 25 * 1000;
/**
 * 创建自适应 16:9 缩放的 OCR 对象
 * @param x X 坐标
 * @param y Y 坐标
 * @param w 宽度
 * @param h 高度
 */
function createAutoZoomOcr(x, y, w, h) {
    const ratio = genshin.scaleTo1080PRatio;
    return RecognitionObject.ocr(x * ratio, y * ratio, w * ratio, h * ratio);
}
/**
 * 是否在多人游戏中
 */
function inMultiplayerGame() {
    const gameRegion = captureGameRegion();
    const playerCountRegin = gameRegion.find(createAutoZoomOcr(340, 18, 53, 53));
    const playerCountText = playerCountRegin.text.trim().toLocaleLowerCase();
    return playerCountText.includes('p');
}
(async () => {
    try {
        const uid = settings.uid?.trim();
        if (!uid) {
            throw new Error('UID 不能为空');
        }
        if (inMultiplayerGame()) {
            throw new Error('正在多人游戏中，无法加入好友世界');
        }
        await genshin.returnMainUi();
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
        const levelRegin = gameRegion.find(createAutoZoomOcr(425, 445, 106, 37));
        const levelText = levelRegin.text.trim();
        if (!levelText.includes('冒险等阶')) {
            // 判断是否搜索的用户是否是自己
            const yourselfRegin = gameRegion.find(createAutoZoomOcr(660, 495, 601, 88));
            if (yourselfRegin.text.includes('其他玩家')) {
                throw new Error('不能使用自己的UID');
            }
            throw new Error('UID不存在');
        }
        const joinOrAddRegin = gameRegion.find(createAutoZoomOcr(1160, 800, 200, 54));
        const joinOrAddText = joinOrAddRegin.text.trim();
        if (joinOrAddText === '') {
            throw new Error("你的好友不在线");
        }
        else if (joinOrAddText === '申请加入') {
            log.info(`已经发起加入申请，等待好友同意`);
            joinOrAddRegin.click();
        }
        else {
            throw new Error('TA不是你的好友');
        }
        const startTime = new Date().getTime();
        const timeout = WAIT_FRIEND_CONFIRM_TIMEOUT + startTime;
        while (true) {
            // 等待好友回复
            const gameRegion = captureGameRegion();
            const requestRegin = gameRegion.find(createAutoZoomOcr(725, 195, 465, 45));
            const requestText = requestRegin.text.trim();
            if (requestText.endsWith('拒绝了多人游戏申请')) {
                throw new Error('好友拒绝了多人游戏');
            }
            if (inMultiplayerGame()) {
                log.info('成功加入好友世界');
                break;
            }
            if (new Date().getTime() > timeout) {
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
