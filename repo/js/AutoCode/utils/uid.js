import {checkVersion} from "./version";

const genshinJson = {
    width: 1920,//genshin.width,
    height: 1080,//genshin.height,
}


function saveOnlyNumber(str) {
    str = str ? str : '';
    // 使用正则表达式匹配字符串中的所有数字
    // \d+ 匹配一个或多个数字
    // .join('') 将匹配到的数字数组连接成一个字符串
    // parseInt 将连接后的字符串转换为整数
    return parseInt(str.match(/\d+/g).join(''));
}

export async function ocrUID() {

    let manifest = {};
    let manifest_json = "manifest.json";
    manifest = JSON.parse(file.readTextSync(manifest_json));
    const version = getVersion();
    const check_version = manifest.min_bgi_version && checkVersion(version, manifest.min_bgi_version)

    if (!check_version){
        const uid = await genshin.uid()
        return uid
    }

    let uid_json = {
        x: 1683,
        y: 1051,
        width: 234,
        height: 28,
    }
    let recognitionObjectOcr = RecognitionObject.Ocr(uid_json.x, uid_json.y, uid_json.width, uid_json.height);
    let region3 = captureGameRegion()
    try{
        let res = region3.find(recognitionObjectOcr);
        log.info(`[OCR识别UID]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
        //只保留数字
        let uid
        try {
            uid = saveOnlyNumber(res.text)
        } catch (e) {
            log.warn(`UID未设置`)
            uid = 0
        }
        log.info(`[OCR识别UID]识别结果: {uid}`, uid);

        return uid
    }finally {
        // region3.dispose()
        ImageRegionSafe.safeDispose(region3)
    }
}




