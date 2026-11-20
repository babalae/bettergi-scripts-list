export const GRID = {
    cols: 8,
    rows: 4,
    cellOrigin: { x: 179.0, y: 196.5 },
    cellPitch: { x: 146.4, y: 175.0 }
};

export const PAGER = {
    ticksPerRow: 9.72,
    tickIntervalMs: 10,
    tickBatchForSleep: 5,
    correctionInterval: 15,
    correctionAtPage: 1,
    maxTicksPerTurn: 200,
    minSettleMs: 100,
    preScrollHoverMs: 10,
    hoverX: 1135,
    hoverAltX: 254,
    hoverRow: 2,
    turnRetryCount: 1
};

export const THUMB = {
    xBright: 1291,
    xDark: 1292,
    thr: 8,
    step: 5,
    top: { y0: 124, y1: 184, minHit: 4 },
    topArtifact: { y0: 181, y1: 211, minHit: 4 },
    bottom: { y0: 912, y1: 937, minHit: 5 },
    artifactTab: "圣遗物",
    hover: {
        x: 1288,
        y0: 918,
        y1: 937,
        step: 5,
        color: [216, 229, 236]
    }
};

export const CELLS = {
    probeX: 125,
    scanY0: 231,
    scanY1: 950,
    strictColor: [220, 229, 233],
    minZoneLen: 20,
    occupyXOffset: 9,
    columns: [
        { l: 117, r: 239 },
        { l: 264, r: 386 },
        { l: 410, r: 532 },
        { l: 557, r: 679 },
        { l: 703, r: 825 },
        { l: 849, r: 971 },
        { l: 996, r: 1118 },
        { l: 1142, r: 1264 }
    ],
    digitInset: 25,
    digitTopRel: 3,
    digitBotRel: 23,
    tplInset: 31,
    tplBottomUp: 25,
    tplSize: 60,
    tplPad: 0,
    settle: {
        timeoutMs: 1000,
        pollMs: 100,
        minZones: 4
    },
    bottomSettleMs: 500
};

export const DIGIT = {
    dir: "assets/背包扫描/物品数字",
    rounds: 3,
    maxThreshold: 0.95,
    minThreshold: 0.80,
    ocrThreshold: 0.85,
    maxDigits: 6,
    nmsOverlapPx: 2
};

export const TWIN = {
    enabled: true,
    clickSettleMs: 150,
    ocrThreshold: 0.5
};

export const RECORD = {
    root: "record"
};

export const SPECIAL = {
    featurePath: "assets/背包扫描/名单/特殊物品特征.json",
    tplSize: 60,
    featSize: 30,
    minScore: 0.85,
    tieMargin: 0.10,
    tieHueL1: 0.18,
    drag: {
        x: 1288,
        startY: 930,
        steps: [
            { dy: 5 },
            { dy: 5 },
            { dy: 5 },
            { dy: 5 },
            { dy: 5 }
        ],
        hoverDelayMs: 10,
        pressDelayMs: 20,
        stepGapMs: 10,
        settleMs: 1,
        verifyRetry: 5,
        preCheckDelayMs: 101
    },
    currency: {
        enabled: true,
        digitDir: "assets/背包扫描/摩拉数字",
        plusTpl: "assets/背包扫描/原石+.png",
        plusThreshold: 0.85,
        searchRect: { x: 183, y: 1007, w: 299, h: 25 },
        regions: [
            { name: "原石", dx0: -160, dx1: -30, y: 1007, h: 26 },
            { name: "摩拉", dx0: 115, dx1: 285, y: 1007, h: 26 }
        ],
        threshold: 0.92,
        maxGapPx: 6
    }
};

export const RESOLUTION = {
    baseW: 1920,
    baseH: 1080
};

export const FILTER = {
    enabled: true,
    tab: "食物",
    px: [
        { y: 1023, x: 177 },
        { y: 1028, x: 177 }
    ],
    color: [85, 66, 59],
    clearBtn: { x: 177, y: 1023, times: 3, gapMs: 50 },
    blankClick: { x: 500, y: 1020, times: 2, gapMs: 50 }
};

export const HOST_CROP = {
    enabled: true,
    bgrN: 6
};

export const BATCH1 = {
    USE_BULK_CROP: true,
    USE_COLUMN_PROBE: true
};

export const FAMILY_TRUST = {
    HUE_REL_FLOOR: 0.15,
    HUE_REL_RATIO: 2.0,

    DEGRADED_HIGH_SCORE: 0.99,

    enabled: true
};

export const RISK_FLAG = {
    M1_MARGIN_BELOW: 1.0,     
    M2_MIN_DIST_ABOVE: 12,    
    enabled: true             
};

export const STAR_BG = {
    dx: 8,
    dy: -10,
    minSat: 0.10,
    hueBands: [
        { lv: 4, min: 245, max: 300 },  
        { lv: 3, min: 190, max: 235 },  
        { lv: 2, min: 125, max: 175 },  
        { lv: 1, min: 15,  max: 75 }    
    ],
    methodName: "star-bg-hue"
};

export const MAE_REGION = {
    mode: "down",
    size: 6,
    offsetY: null,    
    offsetX: null,
    familyRegion: null
};

export const GARBAGE_MAE_FLOOR = 18;
