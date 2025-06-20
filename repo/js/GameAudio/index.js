// 声音滑动条起始 X 坐标
const VOLUME_START_X = 1440;
// 声音滑动条结束 X 坐标
const VOLUME_END_X = 1762;
// 可修改的音量
const VOLUMES = [
    {
        name: '主音量',
        volume: settings.mainVolume,
        y: 211,
    },
    {
        name: '音乐音量',
        volume: settings.musicVolume,
        y: 337,
    },
    {
        name: '语音音量',
        volume: settings.dialogueVolume,
        y: 403,
    },
    {
        name: '音效音量',
        volume: settings.sfxVolume,
        y: 470,
    },
];
/**
 * 设置音量
 * @param name 音量名称
 * @param volume 音量值
 * @param y 音量滑动条 Y 坐标
 */
function setVolume(name, volume, y) {
    if (volume === '不修改') {
        return;
    }
    log.info(`设置${name}: ${volume}`);
    const v = Number.parseInt(volume, 10);
    const step = (VOLUME_END_X - VOLUME_START_X) / 10;
    const x = Math.floor(VOLUME_START_X + step * v);
    click(x, y);
}
(async () => {
    try {
        const hasNewVolume = VOLUMES.find(v => v.volume !== '不修改');
        if (!hasNewVolume) {
            log.info('未设置新音量，退出');
            return;
        }
        await genshin.returnMainUi();
        keyPress('VK_ESCAPE');
        await sleep(1000);
        // 设置
        click(48, 822);
        await sleep(1000);
        // 声音
        click(180, 360);
        await sleep(1000);
        // 音量
        VOLUMES.forEach(v => setVolume(v.name, v.volume, v.y));
        await sleep(500);
    }
    catch (error) {
        log.error(error.message);
    }
    finally {
        await genshin.returnMainUi();
    }
})();
