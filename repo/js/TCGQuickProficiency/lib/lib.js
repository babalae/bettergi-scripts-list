/**
 * @author Ayaka-Main
 * @link   https://github.com/Patrick-Ze
 * @description 提供一些通用性的功能函数。使用方法: 将此文件放在脚本目录下的 lib 文件夹中，然后在你的脚本开头处执行下面这行:
   eval(file.readTextSync("lib/lib.js"));
 */

/**
 * 将路径分割为目录和文件名
 * @param {string} path - 文件完整路径
 * @returns {[string, string]} 返回数组，第一个元素是目录路径，第二个是文件名
 * @example
 * const [dir, file] = splitPath('稻妻\\绯樱绣球\\06-绯樱绣球-神里屋敷-10个.json'); // ['稻妻\\绯樱绣球', '06-绯樱绣球-神里屋敷-10个.json']
 */
function splitPath(path) {
    const normalizedPath = path.replace(/\\/g, "/");
    const lastSlashIndex = normalizedPath.lastIndexOf("/");
    if (lastSlashIndex === -1) {
        return [".", path];
    }
    const dir = path.slice(0, lastSlashIndex);
    const file = path.slice(lastSlashIndex + 1);
    return [dir, file];
}

function fileExists(fullPath) {
    const [dirpath, filename] = splitPath(fullPath);
    const normalizedPath = fullPath.replaceAll("/", "\\");
    const files = Array.from(file.ReadPathSync(dirpath));
    return files.includes(normalizedPath);
}

/**
 * 重写内置函数，解决每次读取不存在的文件时必然出现的、不可抑制的Error消息问题
 *
 * 该问题由于 [PR#2412](https://github.com/babalae/better-genshin-impact/pull/2412) 导致，
 * 并且[看起来也不会修复](https://github.com/babalae/better-genshin-impact/issues/2474)
 */
function readTextSync(fullPath) {
    if (fileExists(fullPath)) {
        return file.readTextSync(fullPath);
    } else {
        throw new Error("FileNotFound: " + fullPath);
    }
}
