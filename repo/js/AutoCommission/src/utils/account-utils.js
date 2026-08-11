import { THRESHOLDS } from "../config/index.js";
import { loadGlobalConfig } from "../loaders/global-config.js";
import { calculateSimilarity } from "../recognition/text-similarity.js";

let cachedCurrentUid = "";

function digitsOnly(value) {
    return String(value ?? "").replace(/\D/g, "");
}

function normalizeUidCandidates(candidates) {
    return Array.from(new Set((candidates || []).map(digitsOnly).filter(Boolean)));
}

export function getConfiguredUids() {
    return normalizeUidCandidates(loadGlobalConfig().uids || []);
}

export function matchUidCandidate(recognizedUid, candidates) {
    let bestUid = "";
    let bestSimilarity = -1;

    for (const candidate of normalizeUidCandidates(candidates)) {
        const similarity = calculateSimilarity(recognizedUid, candidate);
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestUid = candidate;
        }
    }

    return {
        uid: bestSimilarity > THRESHOLDS.UID ? bestUid : "",
        bestUid,
        bestSimilarity,
    };
}

export async function getCurrentUid(options = {}) {
    if (cachedCurrentUid) {
        return cachedCurrentUid;
    }

    const knownUids = normalizeUidCandidates(options.knownUids || []);

    let rawUid;
    try {
        rawUid = await genshin.uid();
    } catch (error) {
        log.error("获取当前UID失败: {error}", error.message);
        return "";
    }

    const recognizedUid = digitsOnly(rawUid);
    if (!recognizedUid) {
        log.error("未识别到有效UID: {raw}", rawUid);
        return "";
    }

    const configuredUids = getConfiguredUids();
    if (configuredUids.length > 0) {
        const match = matchUidCandidate(recognizedUid, configuredUids);
        if (!match.uid) {
            log.error(
                "UID识别结果不可信: {recognized}，最接近配置UID: {candidate}，相似度: {similarity}，需要 > {threshold}",
                recognizedUid,
                match.bestUid || "无",
                match.bestSimilarity.toFixed(3),
                THRESHOLDS.UID
            );
            return "";
        }

        log.debug("当前UID: {uid}，识别值: {recognized}，相似度: {similarity}",
            match.uid,
            recognizedUid,
            match.bestSimilarity.toFixed(3));
        cachedCurrentUid = match.uid;
        return match.uid;
    }

    if (knownUids.length > 0) {
        const match = matchUidCandidate(recognizedUid, knownUids);
        if (match.uid) {
            log.debug("当前UID匹配到已有账号槽: {uid}，识别值: {recognized}，相似度: {similarity}",
                match.uid,
                recognizedUid,
                match.bestSimilarity.toFixed(3));
            cachedCurrentUid = match.uid;
            return match.uid;
        }
        log.info("当前UID未匹配到已有账号槽，使用识别值创建/读取账号槽: {uid}", recognizedUid);
    } else {
        log.debug("当前UID: {uid}", recognizedUid);
    }

    cachedCurrentUid = recognizedUid;
    return recognizedUid;
}
