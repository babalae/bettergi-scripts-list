import { RESOLUTION } from "./config.js";

export function makeScaler(gameW, gameH) {
    const sx = gameW / RESOLUTION.baseW;
    const sy = gameH / RESOLUTION.baseH;
    return {
        scaleX: sx,
        scaleY: sy,
        gameW,
        gameH,
        x: (bx) => bx * sx,
        y: (by) => by * sy,
        xi: (bx) => Math.trunc(bx * sx),
        yi: (by) => Math.trunc(by * sy),
        rect: (r) => ({
            x: Math.trunc(r.x * sx),
            y: Math.trunc(r.y * sy),
            w: Math.trunc(r.w * sx),
            h: Math.trunc(r.h * sy)
        }),
        invX: (px) => (sx ? px / sx : px),
        invY: (py) => (sy ? py / sy : py),
        factorX: () => sx,
        factorY: () => sy,
        isBase: () => sx === 1 && sy === 1
    };
}

export function identityScaler() {
    return makeScaler(RESOLUTION.baseW, RESOLUTION.baseH);
}

export function clampRect(r, w, h) {
    const x0 = Math.max(0, Math.min(Math.floor(r.x), w));
    const y0 = Math.max(0, Math.min(Math.floor(r.y), h));
    const x1 = Math.max(0, Math.min(Math.ceil(r.x + r.w), w));
    const y1 = Math.max(0, Math.min(Math.ceil(r.y + r.h), h));
    if (x1 <= x0 || y1 <= y0) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
