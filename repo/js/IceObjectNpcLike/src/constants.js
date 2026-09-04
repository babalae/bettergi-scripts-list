export const PATHS = {
    restore: "Assets/Pathing/00-恢复热能-至冬-七天神像.json",
    pointDirectory: "Assets/Pathing",
    point09FromPoint07: "Assets/Pathing/09-冰造物点赞-至冬-车站台子-备用路线-2赞.json"
};

export const POINT_FILE_PATTERN = /^(\d{2})-冰造物点赞-(?!.*备用路线).+-\d+赞\.json$/i;
export const LIKE_TAG_PATTERN = /^(?:点赞|likes?)\s*[:：=＝]\s*(\d+)\s*$/i;

export const ORDER_BY_POINT = "按 Point 编号";
export const ORDER_BY_LIKES = "高点赞优先";
export const HIGH_YIELD_ONLY = "高收益精简（6赞及以上）";
export const HIGH_YIELD_MIN_LIKES = 6;

// 只改变镜头俯仰，不改变 orientation 已经确定的水平朝向。
export const CAMERA_PITCH_CLAMP_Y = -10000;

export const DEFAULT_TIMINGS = {
    pathSettleDelay: 1000,
    restoreDelay: 1500,
    cameraClampPassDelay: 100,
    cameraClampSettleDelay: 150,
    cameraSettleDelay: 400,
    fourKExtraTDelay: 800,
    enterCreationDelay: 500,
    firstLikeDelay: 800,
    selectObjectDelay: 500,
    deleteDelay: 400,
    secondLikeDelay: 800,
    finalDeleteDelay: 400,
    exitCreationDelay: 500
};

export const DEFAULT_CAMERA = {
    x: 0,
    pitchFromTop: 7500,
    clampPasses: 4
};
