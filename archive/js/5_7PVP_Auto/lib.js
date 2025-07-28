//eval(file.readTextSync("lib.js"));


const width = genshin.width;
const height = genshin.height;

function clickf(x, y) {
    click(Math.round(width * x), Math.round(height * y));
}
function movetof(x, y) {
    moveMouseTo(Math.round(width * x), Math.round(height * y));
}
function get_config(name, defval) {
    let t = settings[name];
    return typeof (t) === 'undefined' ? defval : t;
}
function get_config_int(name, defval) {
    return parseInt(get_config(name, defval), 10);
}


class OCRError extends Error {
    constructor(message, options) { super(message, options); }
}


setGameMetrics(genshin.width, genshin.height, 1); // 设置游戏窗口大小和DPI
function test1() {
    log.info(`窗口大小： ${genshin.width} * ${genshin.height}`);
    let a = captureGameRegion();
    log.info(`截图：x=${a.x} y=${a.y} w=${a.width} h=${a.height} l=${a.left} t=${a.top} r=${a.right} b=${a.bottom}`);
}
const global_region = captureGameRegion();
//test1();

function template(filename, x, y, w, h, center = true) {
    if (center) { x = x - w / 2; y = y - h / 2; }
    return RecognitionObject.TemplateMatch(file.ReadImageMatSync(filename), 1920 * x, 1080 * y, 1920 * w, 1080 * h);
    //return RecognitionObject.TemplateMatch(file.ReadImageMatSync(filename), genshin.width * x, genshin.height * y, genshin.width * w, genshin.height * h);
}
function template_ocr(x, y, w, h, center = true) {
    if (center) { x = x - w / 2; y = y - h / 2; }
    return RecognitionObject.Ocr(1920 * x, 1080 * y, 1920 * w, 1080 * h);
}

function draw_obj(obj, name = "test") {
    const r = obj.RegionOfInterest;
    let s = global_region.deriveCrop(r.x, r.y, r.width, r.height);
    s.DrawSelf(name);
}

async function match_click(obj, desc, click = true, timeout = 15000) {
    draw_obj(obj, "match");
    await sleep(1000);
    const start = Date.now();
    let x = 1;
    while (Date.now() - start < timeout) {
        let result = captureGameRegion().Find(obj);
        await sleep(800);
        if (result.isExist()) {
            result.drawSelf("match_found");
            if (click) {
                result.click();
                log.info(`成功识别并点击 ${desc}，耗时${Date.now() - start}ms`);
            } else {
                log.info(`成功识别到 ${desc}，耗时${Date.now() - start}ms`);
            }
            return result;
        }
        log.info(`第${x}次识别并点击 ${desc} 失败，耗时${Date.now() - start}ms`);
        x++;
        await sleep(1000);
    }
    throw new OCRError(`等待超时，未找到目标 ${desc}`);
}

async function ocr_click(obj, desc, click = true, timeout = 15000) {
    draw_obj(obj, "ocr");
    await sleep(1000);
    const start = Date.now();
    let x = 1;
    while (Date.now() - start < timeout) {
        let results = captureGameRegion().findMulti(obj);
        if (results.Count != 1) {
            log.warn(`搜索到${results.Count}个结果（预期为1个）`);
        }
        await sleep(800);
        if (results.Count == 1) {
            results[0].drawSelf("ocr_found");
            if (click) {
                results[0].click();
                log.info(`成功Ocr识别并点击 ${desc}， 耗时${Date.now() - start}ms`);
            } else {
                log.info(`成功Ocr识别到 ${desc}， 耗时${Date.now() - start}ms`)
            }
            return results[0];
        }
        log.info(`第${x}次Ocr识别并点击 ${desc} 失败，耗时${Date.now() - start}ms`);
        x++;
        await sleep(1000);
    }
    throw new OCRError(`等待超时，未找到Ocr目标 ${desc}`);
}
