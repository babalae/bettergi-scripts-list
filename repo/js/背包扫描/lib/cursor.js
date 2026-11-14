const SCREEN_MIN_MEAN_SCORE = 0.85;

export function screenIsPlausible(scores, opts) {
    const o = opts || {};
    const thr = (typeof o.minMean === "number") ? o.minMean : SCREEN_MIN_MEAN_SCORE;
    const arr = Array.isArray(scores) ? scores.filter(function (v) { return typeof v === "number"; }) : [];
    if (!arr.length) return { plausible: false, meanScore: null, reason: "没有有效得分" };
    let s = 0;
    for (const v of arr) s += v;
    const mean = s / arr.length;
    return {
        plausible: mean >= thr,
        meanScore: Math.round(mean * 10000) / 10000,
        reason: (mean >= thr) ? "" : ("整屏平均得分 " + mean.toFixed(3) + " < " + thr + " —— 疑似非本页签内容屏")
    };
}
