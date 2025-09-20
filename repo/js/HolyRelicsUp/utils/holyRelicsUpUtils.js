function info(msg, must = false,log_off=false) {
    if (log_off || must) {
        log.info(msg)
    }
}

function warn(msg, must = false,log_off=false) {
    if (log_off || must) {
        log.warn(msg)
    }
}

function debug(msg, must = false,log_off=false) {
    if (log_off || must) {
        log.debug(msg)
    }
}

function error(msg, must = false,log_off=false) {
    if (log_off || must) {
        log.error(msg)
    }
}

function throwError(msg) {
    notification.error(`${msg}`);
}

function openCaptureGameRegion() {
    return captureGameRegion()
}

function closeCaptureGameRegion(region) {
    region.Dispose()
}

function findByCaptureGameRegion(region, templateMatchObject) {
    return region.find(templateMatchObject)
}

function findMultiByCaptureGameRegion(region, templateMatchObject) {
    return region.findMulti(templateMatchObject)
}

function mTo(x, y) {
    moveMouseTo(x, y);
}

function recognitionObjectOcr(x, y, width, height) {
    return RecognitionObject.Ocr(x, y, width, height)
}

function downLeftButton() {
    leftButtonDown();
}

function upLeftButton() {
    leftButtonUp();
}

function moveByMouse(x, y) {
    moveMouseBy(x, y);
}

async function wait(ms = 1000) {
    // 等待300毫秒，确保按下操作生效
    await sleep(ms);
}

function downClick(x, y) {
    click(x, y);
}

/**
 * 检查资源是否存在
 * @param {Object} res - 需要检查的资源对象
 * @returns {Boolean} 返回资源是否存在的结果
 *                  true表示资源存在，false表示资源不存在
 */
function isExist(res) {
    return res.isExist() // 调用资源对象的isExist方法获取存在状态
}

this.holyRelicsUpUtils = {
    isExist,
    info,
    warn,
    debug,
    error,
    throwError,
    openCaptureGameRegion,
    closeCaptureGameRegion,
    findByCaptureGameRegion,
    findMultiByCaptureGameRegion,
    mTo,
    recognitionObjectOcr,
    downLeftButton,
    upLeftButton,
    moveByMouse,
    wait,
    downClick
};