/**
 * 文本匹配工具
 * 编辑距离算法和字符串相似度计算
 */

/**
 * 计算两个字符串之间的编辑距离
 * @param {string} str1 - 第一个字符串
 * @param {string} str2 - 第二个字符串
 * @returns {number} 编辑距离
 */
export function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}

/**
 * 计算两个字符串的相似度（0~1）
 * @param {string} str1
 * @param {string} str2
 * @returns {number} 相似度
 */
export function calculateSimilarity(str1, str2) {
    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

/**
 * 获取最接近的匹配项
 * @param {string} target - 目标字符串
 * @param {string[]} candidates - 候选字符串列表
 * @param {number} threshold - 相似度阈值
 * @returns {string|null} 最接近的匹配项，未达阈值返回 null
 */
export function getClosestMatch(target, candidates, threshold = 0.6) {
    if (!candidates || candidates.length === 0) return null;
    let closest = candidates[0];
    let maxSimilarity = calculateSimilarity(target, closest);
    for (let i = 1; i < candidates.length; i++) {
        const similarity = calculateSimilarity(target, candidates[i]);
        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            closest = candidates[i];
        }
    }
    return maxSimilarity >= threshold ? closest : null;
}
