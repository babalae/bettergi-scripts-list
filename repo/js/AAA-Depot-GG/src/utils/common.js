/**
 * 零依赖工具。不 import 本项目任何模块（避免循环依赖）。
 * 内容：异常取文本、路径取文件名、.png 后缀增删、屏幕比例 → 像素换算。
 */

/** 异常（或任意值）转成可拼进日志的字符串 */
export function errorText(error) {
    if (error && error.message) {
        return error.message;
    }
    return String(error);
}

/** 比例 → 像素，四舍五入 */
export function ratioToPixel(ratio, size) {
    return Math.round(ratio * size);
}

/** 取路径最后一段，兼容 / 与 \ */
export function basename(pathLike) {
    const s = String(pathLike).replace(/\\/g, "/");
    const i = s.lastIndexOf("/");
    return i >= 0 ? s.slice(i + 1) : s;
}

/** 去掉结尾的 .png（忽略大小写） */
export function stripPng(name) {
    return String(name).replace(/\.png$/i, "");
}

/** 补上 .png（已带则不补） */
export function withPng(name) {
    const s = String(name);
    return /\.png$/i.test(s) ? s : `${s}.png`;
}

/**
 * 屏幕比例 → 绝对坐标。
 * 所有"点哪儿"的常量都写成 0~1 比例（见 constants.js 的 SCROLL_RATIO、TEMPLATE_DEFS.roi），
 * 运行时按真实分辨率换算 —— 换分辨率不必改数值。
 */
export function screenPoint(ratios, screen) {
    return {
        x: ratioToPixel(ratios.x, screen.width),
        y: ratioToPixel(ratios.y, screen.height)
    };
}
