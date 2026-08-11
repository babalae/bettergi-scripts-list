/**
 * 文本处理工具
 * 提供文本清理、人名提取等文本处理函数
 */

/**
 * 清理文本（去除标点符号和特殊字符）
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
export function cleanText(text) {
    if (!text) return "";
    return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").trim();
}

/**
 * 从文本中提取人名
 * @param {string} text - 包含人名的文本
 * @returns {string|null} 提取到的人名，未找到返回 null
 */
export function extractName(text) {
    // (.+?)\S+ 故意只捕首字: 下游用 .includes() 子串匹配, 任务文本可能带人名后缀("询问艾琳关于X"), 贪婪捕获反而会让 includes 失配
    const patterns = [
        /与(.+?)对话/,
        /与(.+?)一起/,
        /同(.+?)交谈/,
        /向(.+?)打听/,
        /向(.+?)回报/,
        /向(.+?)报告/,
        /给(.+?)听/,
        /陪同(.+?)\S+/,
        /找到(.+?)\S+/,
        /询问(.+?)\S+/,
        /拜访(.+?)\S+/,
        /寻找(.+?)\S+/,
        /告诉(.+?)\S+/,
        /带(.+?)去\S+/,
        /跟随(.+?)\S+/,
        /协助(.+?)\S+/,
        /请教(.+?)\S+/,
        /拜托(.+?)\S+/,
        /委托(.+?)\S+/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
}
