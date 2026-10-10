import { CAMERA_PITCH_CLAMP_Y, DEFAULT_CAMERA } from "../constants.js";
import { readDelay, readInteger, readTTransitionDelay } from "./config.js";
import { runPointPath } from "./pathing.js";

async function applyPointCameraOffset(point, xOverrides, pitchOverrides) {
    const clampPasses = readInteger(
        "cameraClampPasses",
        DEFAULT_CAMERA.clampPasses,
        1,
        20
    );
    const clampPassDelay = readDelay("cameraClampPassDelay");

    log.info(
        `[${point.name}] 固定镜头垂直基准：向上推 ${clampPasses} 次，` +
        `间隔 ${clampPassDelay}ms（保留 orientation 水平朝向）`
    );
    for (let pass = 0; pass < clampPasses; pass += 1) {
        moveMouseBy(0, CAMERA_PITCH_CLAMP_Y);
        if (pass + 1 < clampPasses) {
            await sleep(clampPassDelay);
        }
    }
    await sleep(readDelay("cameraClampSettleDelay"));

    const defaultX = readInteger("defaultCameraOffsetX", DEFAULT_CAMERA.x, -10000, 10000);
    const defaultPitch = readInteger(
        "defaultCameraPitchFromTop",
        DEFAULT_CAMERA.pitchFromTop,
        0,
        10000
    );
    const x = Object.prototype.hasOwnProperty.call(xOverrides, point.number)
        ? xOverrides[point.number]
        : defaultX;
    const pitchFromTop = Object.prototype.hasOwnProperty.call(pitchOverrides, point.number)
        ? pitchOverrides[point.number]
        : defaultPitch;

    log.info(`[${point.name}] 应用镜头标定：水平 x=${x}，从垂直上限向下 y=${pitchFromTop}`);
    if (x !== 0) {
        moveMouseBy(x, 0);
    }
    if (pitchFromTop !== 0) {
        moveMouseBy(0, pitchFromTop);
    }
    await sleep(readDelay("cameraSettleDelay"));
}

async function exitCreationMode(point) {
    log.info(`[${point.name}] 按 T 退出冰造物界面`);
    keyPress("VK_T");
    await sleep(readDelay("exitCreationDelay"));
    log.info(`[${point.name}] 已回到正常游戏状态`);
}

async function doIceObjectCycle(point) {
    const label = point.name;

    log.info(`[${label}] 第一次放置：进入造物模式`);
    keyPress("VK_T");
    await sleep(readTTransitionDelay("enterCreationDelay"));

    leftButtonClick();
    log.info(`[${label}] 第一次放置完成，等待 NPC 点赞`);
    await sleep(readDelay("firstLikeDelay"));
    log.info(`[${label}] 第一次点赞安全等待完成`);

    log.info(`[${label}] 删除第一次造物`);
    keyPress("VK_T");
    await sleep(readTTransitionDelay("selectObjectDelay"));

    leftButtonClick();
    log.info(`[${label}] 第一次造物已删除`);
    await sleep(readDelay("deleteDelay"));

    log.info(`[${label}] 第二次放置`);
    leftButtonClick();
    await sleep(readDelay("secondLikeDelay"));
    log.info(`[${label}] 第二次点赞安全等待完成`);

    log.info(`[${label}] 最终删除第二次造物`);
    keyPress("VK_T");
    await sleep(readTTransitionDelay("selectObjectDelay"));

    leftButtonClick();
    await sleep(readDelay("finalDeleteDelay"));
    log.info(`[${label}] 最终删除动作完成（未进行视觉校验）`);

    await exitCreationMode(point);
    log.info(`[${label}] 完成`);
}

export async function runPoint(point, xOverrides, pitchOverrides) {
    await runPointPath(point);
    log.info(`[${point.name}] 已到达固定工位，orientation 完成`);

    await sleep(readDelay("pathSettleDelay"));
    await applyPointCameraOffset(point, xOverrides, pitchOverrides);
    await doIceObjectCycle(point);
}
