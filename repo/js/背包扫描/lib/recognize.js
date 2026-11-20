import { CELLS, FAMILY_TRUST, HOST_CROP, STAR_BG } from "./config.js";  
import { hostCropMulti, bgrToGray as bgrToGrayHost } from "./util.js";
import { familyOf } from "./roster.js";
import { screenIsPlausible } from "./cursor.js";

 const TIER1_MIN_SCORE = 0.60;
import { pickThreeVariant, pickByHue, pickByMae6 } from "./identify.js";
import { MAE_REGION } from "./config.js";
import { MS_OFFSET_COUNT } from "./identify.js";
import { ncc, SPARKLE_MIN_HITS } from "./features.js";

 const TIER1_COARSE = 10;

 const TIER1_TOPK = 8;

 function downsampleGray(gray, gs, n) {
    const out = new Uint8Array(n * n);
    const step = gs / n;
    for (let by = 0; by < n; by++) {
        for (let bx = 0; bx < n; bx++) {
            let s = 0;
            for (let y = by * step; y < (by + 1) * step; y++) {
                const base = y * gs;
                for (let x = bx * step; x < (bx + 1) * step; x++) s += gray[base + x];
            }
            out[by * n + bx] = Math.round(s / (step * step));
        }
    }
    return out;
}

 function subCrop(src, w, h, x, y, cw, ch) {
    const out = new Uint8Array(cw * ch * 3);
    for (let yy = 0; yy < ch; yy++) {
        const sy = y + yy;
        if (sy < 0 || sy >= h) continue;
        const srow = (sy * w + x) * 3;
        const avail = Math.max(0, Math.min(cw, w - x));
        if (avail > 0) out.set(src.subarray(srow, srow + avail * 3), yy * cw * 3);
    }
    return out;
}

 function cropFrom(img, w, h, x, y, cw, ch) {
    const out = new Uint8Array(cw * ch * 3);
    for (let yy = 0; yy < ch; yy++) {
        const sy = y + yy;
        if (sy < 0 || sy >= h) continue;
        const src = (sy * w + x) * 3;
        const avail = Math.max(0, Math.min(cw, w - x));
        if (avail > 0) out.set(img.subarray(src, src + avail * 3), yy * cw * 3);
    }
    return out;
}

 function quantifyDown(bgr, w, h, n) {
    const out = new Uint8Array(n * n);
    const cw = w / n, ch = h / n;
    for (let by = 0; by < n; by++) {
        const y0 = Math.floor(by * ch), y1 = Math.max(y0 + 1, Math.floor((by + 1) * ch));
        for (let bx = 0; bx < n; bx++) {
            const x0 = Math.floor(bx * cw), x1 = Math.max(x0 + 1, Math.floor((bx + 1) * cw));
            let s = 0, c = 0;
            for (let y = y0; y < y1; y++) {
                const base = y * w;
                for (let x = x0; x < x1; x++) {
                    const i = (base + x) * 3;
                    s += 0.114 * bgr[i] + 0.587 * bgr[i + 1] + 0.299 * bgr[i + 2];
                    c++;
                }
            }
            out[by * n + bx] = c ? Math.max(0, Math.min(255, Math.round(s / c))) : 0;
        }
    }
    return out;
}

export function cellRects(y0) {
    const C = CELLS;
    const out = [];
    for (let i = 0; i < C.columns.length; i++) {
        const col = C.columns[i];
        const dL = col.l + C.digitInset, dR = col.r - C.digitInset;
        const tL = col.l + C.tplInset;
        const tB = y0 - C.tplBottomUp;
        out.push({
            col: i + 1, colL: col.l, colR: col.r,
            digit: { x: dL, y: y0 + C.digitTopRel, w: dR - dL + 1, h: C.digitBotRel - C.digitTopRel },
            tpl: { x: tL, y: tB - C.tplSize + 1, w: C.tplSize, h: C.tplSize }
        });
    }
    return out;
}

export function recognizeScreen(img, w, h, zones, ctx) {
    const o = ctx || {};
    const isVariantDecoy = (typeof o.isVariantDecoy === "function") ? o.isVariantDecoy : null;
    const templates = o.templates || [];
    const rosterIndex = o.rosterIndex || null;
    const srcMatOfFrame = o.srcMat || null;
    const getCrop = (typeof o.getCrop === "function")
        ? o.getCrop
        : function (x, y, cw, ch) { return cropFrom(img, w, h, x, y, cw, ch); };
    const getPixel = (typeof o.getPixel === "function")
        ? o.getPixel
        : function (x, y) {
            if (!img || x < 0 || y < 0 || x >= w || y >= h) return null;
            const i = (y * w + x) * 3;
            return [img[i], img[i + 1], img[i + 2]];
        };
    const out = {
        ok: true, cells: [],
        screen: { plausible: true, meanScore: null, reason: "" }
    };
    if (typeof o.candTotal === "number") out.candTotal = o.candTotal;
    const byName = new Map();
    for (const t of templates) byName.set(t.name, t);
    const screenScores = [];
    const zoneList = Array.isArray(zones) ? zones : [];
    for (let zi = 0; zi < zoneList.length; zi++) {
        const zr = zoneList[zi];
        const y0 = (zr && typeof zr === "object") ? zr.y0 : zr;
        if (typeof y0 !== "number" || !isFinite(y0)) {
            continue;
        }
        const rects = cellRects(y0);
        const isLastZone = (zi === zoneList.length - 1);
        const occ = (isLastZone && typeof o.getOccupancy === "function")
            ? o.getOccupancy(y0)
            : null;
        for (const R of rects) {
            try {
            if (occ && occ[R.col - 1] && occ[R.col - 1].occupied === false) {
                out.cells.push({
                    screen: (typeof o.screenIndex === "number") ? o.screenIndex : null,
                    row: zi, col: R.col, y0: y0,
                    name: null, method: "empty", score: null,
                    uncertain: false, uncertainReason: null, note: "空位（该列无名牌带）", second: null, stage2: null,
                    count: null, countOk: false, countText: "", countScore: null,
                    countReason: "", countVia: "", countAmbiguous: false
                });
                continue;
            }
            const PAD = (typeof CELLS.tplPad === "number" && CELLS.tplPad > 0) ? CELLS.tplPad : 0;
            const padX = R.tpl.x - PAD, padY = R.tpl.y - PAD;
            const padW = R.tpl.w + 2 * PAD, padH = R.tpl.h + 2 * PAD;
            const FS = templates[0] && templates[0].featSize ? templates[0].featSize : 60;
            const FS_C = TIER1_COARSE;
            const TOPK = TIER1_TOPK;

            const hostOn = !!(HOST_CROP && HOST_CROP.enabled) && !!srcMatOfFrame;
            let crop = null, cropGray = null, cropC = null;
            let hostGot = null;
            if (hostOn) {
                const nb = (typeof HOST_CROP.bgrN === "number" && HOST_CROP.bgrN > 0) ? HOST_CROP.bgrN : 6;
                const bx = R.tpl.x - MS_PAD, by = R.tpl.y - MS_PAD;
                if (bx >= 0 && by >= 0 && bx + R.tpl.w <= w && by + R.tpl.h <= h) {
                    const sizes = [];
                    const push = function (v) { if (v > 0 && sizes.indexOf(v) < 0) sizes.push(v); };
                    push(FS); push(FS_C); push(nb);
                    const bgrPack = hostCropMulti(srcMatOfFrame, bx, by, R.tpl.w, R.tpl.h, sizes, false);
                    if (bgrPack) {
                        const g30 = bgrPack[FS];
                        const g10 = bgrPack[FS_C];
                        const bgrN = bgrPack[nb];
                        if (g30 && g30.length === FS * FS * 3
                            && g10 && g10.length === FS_C * FS_C * 3
                            && bgrN && bgrN.length === nb * nb * 3) {
                            cropGray = bgrToGrayHost(g30, FS);
                            cropC = bgrToGrayHost(g10, FS_C);
                            crop = bgrN;
                            hostGot = true;
                        } else {
                            hostGot = null;
                        }
                    }
                }
            }

            let cellBig = null;
            let cropBig = null;
            if (!hostGot) {
                if (PAD > 0) {
                    cropBig = getCrop(padX, padY, padW, padH);
                } else {
                    const bx = R.tpl.x - MS_PAD, by = R.tpl.y - MS_PAD;
                    if (bx >= 0 && by >= 0 && bx + MS_BIG <= w && by + MS_BIG <= h) {
                        cellBig = getCrop(bx, by, MS_BIG, MS_BIG);
                    }
                    cropBig = cellBig
                        ? (MS_PAD === 0 && MS_BIG === R.tpl.w
                            ? cellBig
                            : subCrop(cellBig, MS_BIG, MS_BIG, MS_PAD, MS_PAD, R.tpl.w, R.tpl.h))
                        : getCrop(padX, padY, padW, padH);
                }
                if (!cropBig) {
                    continue;
                }
                crop = (PAD > 0) ? subCrop(cropBig, padW, padH, PAD, PAD, R.tpl.w, R.tpl.h) : cropBig;
                cropGray = quantifyDown(crop, R.tpl.w, R.tpl.h, FS);
            }
            if (!templates.__coarseReady) {
                for (const t2 of templates) {
                    if (!t2 || t2.grayC || !t2.gray) continue;
                    const gs = Math.round(Math.sqrt(t2.gray.length));
                    if (gs >= FS_C && gs % FS_C === 0) {
                        t2.grayC = downsampleGray(t2.gray, gs, FS_C);
                    }
                }
                templates.__coarseReady = true;
            }
            const cropUse = crop;
            const cropGrayUse = cropGray;
            let hit = null;
            const coarseScores = [];
            for (let ti = 0; ti < templates.length; ti++) {
                const tpl = templates[ti];
                if (!tpl || !tpl.grayC) continue;
                if (isVariantDecoy && isVariantDecoy(tpl.name)) continue;   
                coarseScores.push({ i: ti, s: ncc(cropC, tpl.grayC) });
            }
            coarseScores.sort(function (a, b) { return b.s - a.s; });
            const topIdx = coarseScores.slice(0, TOPK);

            let best = null;
            let best2 = null;
            for (const e of topIdx) {
                const tpl = templates[e.i];
                if (!tpl || !tpl.gray) continue;
                const s = ncc(cropGrayUse, tpl.gray);
                if (!best || s > best.score) {
                    best2 = best;
                    best = { name: tpl.name, score: s, index: e.i };
                } else if (!best2 || s > best2.score) {
                    best2 = { name: tpl.name, score: s, index: e.i };
                }
            }
            hit = best;

            const coarseTop1 = topIdx.length > 0 ? topIdx[0].s : null;
            const coarseTop2 = topIdx.length > 1 ? topIdx[1].s : null;
            const coarseMargin = (coarseTop1 !== null && coarseTop2 !== null)
                ? Math.round((coarseTop1 - coarseTop2) * 10000) / 10000 : null;

            const cropAligned = cropUse;
            screenScores.push(hit ? hit.score : 0);
            const name1 = hit ? hit.name : null;
            const cell = {
                screen: (typeof o.screenIndex === "number") ? o.screenIndex : null,
                row: zi, col: R.col, y0: y0,
                name: name1, method: "argmax", score: hit ? Math.round(hit.score * 10000) / 10000 : null,
                coarseScore: (coarseTop1 === null) ? null : Math.round(coarseTop1 * 10000) / 10000,
                secondScore: (coarseTop2 === null) ? null : Math.round(coarseTop2 * 10000) / 10000,
                secondName: (topIdx.length > 1 && templates[topIdx[1].i]) ? templates[topIdx[1].i].name : null,
                margin: coarseMargin,
                decidedBy: null,
                riskFlag: null,   
                uncertain: false, uncertainReason: null, note: "", second: null, stage2: null,
                count: null, countOk: false, countText: "", countScore: null,
                countReason: "", countVia: "", countAmbiguous: false
            };
            if (!name1) {
                cell.uncertain = true;
                cell.uncertainReason = "NO_CANDIDATE";
                cell.note = "一级无候选";
                out.cells.push(cell);
                continue;
            }
            if (cell.score !== null && cell.score < TIER1_MIN_SCORE) {
                cell.uncertain = true;
                cell.uncertainReason = "NO_CANDIDATE";
                cell.note = "一级得分 " + cell.score + " < " + TIER1_MIN_SCORE;
                cell.weak = true;
                cell.weakName = name1;
                cell.name = null;
                out.cells.push(cell);
                continue;
            }
            const fam = rosterIndex ? familyOf(rosterIndex, name1) : { kind: null, fam: null };
            if (!fam.kind) {
                cell.decidedBy = "coarse";
            }
            if (fam.kind) {
                const r2 = secondStage(fam, cropAligned, R, y0, img, w, h, byName, o, getCrop, getPixel, cellBig, hit, srcMatOfFrame, null, MS_OFFSET_COUNT);
                cell.stage2 = r2;
cell.decidedBy = "family";
cell.decidedBy2 = (r2 && r2.decidedBy) ? r2.decidedBy : ((r2 && r2.method) ? ("secondStage:" + r2.method) : null);
                if (r2 && r2.riskFlag) cell.riskFlag = r2.riskFlag;
                if (r2 && r2.name) {
                    cell.name = r2.name;
                    cell.method = r2.method;
                    if (r2.garbage) {
                        cell.garbage = true;
                        cell.uncertain = true;
                        cell.uncertainReason = "GARBAGE_CELL";   
                    } else if (r2.uncertain) {
                        cell.uncertain = true;
                        const _nt = String(r2.note || "");
                        cell.uncertainReason = /缺|不可用|退化|失败|拿不到|全零/.test(_nt)
                            ? "DEGRADED_NO_EVIDENCE" : "FAMILY_UNDECIDED";
                    }
                    if (r2.note) cell.note = r2.note;
                } else if (r2 && r2.uncertain) {
                    cell.uncertain = true;
                    const _nt2 = String(r2.note || "");
                    cell.uncertainReason = /缺|不可用|退化|失败|拿不到|全零/.test(_nt2)
                        ? "DEGRADED_NO_EVIDENCE" : "FAMILY_UNDECIDED";
                    cell.note = r2.note || "二级判不出";
                }
            }
            out.cells.push(cell);
            } catch (_cellErr) {
                out.cellErrors = out.cellErrors || [];
                out.cellErrors.push({ row: zi, col: R.col, y0: y0,
                    msg: (_cellErr && _cellErr.message) ? _cellErr.message : String(_cellErr),
                    stack: (_cellErr && _cellErr.stack) ? String(_cellErr.stack).split("\n").slice(0, 4).join(" | ") : "" });
                out.cells.push({
                    screen: (typeof o.screenIndex === "number") ? o.screenIndex : null,
                    row: zi, col: R.col, y0: y0,
                    name: null, method: "cell-error", score: null,
                    uncertain: true, uncertainReason: "CELL_ERROR",
                    note: "单格异常：" + ((_cellErr && _cellErr.message) ? _cellErr.message : String(_cellErr)),
                    second: null, stage2: null,
                    count: null, countOk: false, countText: "", countScore: null,
                    countReason: "", countVia: "", countAmbiguous: false
                });
            }
        }
    }
    const pl = screenIsPlausible(screenScores);
    out.screen = pl;
    if (!pl.plausible) {
        for (const c of out.cells) {
            c.uncertain = true;
            c.note = (c.note ? c.note + "；" : "") + pl.reason;
        }
    }
    return out;
}

const MS_SIZE = 60;

function assertMaeConfig() {
    const M = MAE_REGION || {};
    const KNOWN = ["full", "down", "center", "family"];
    const mode = M.mode;
    if (mode !== undefined && mode !== null && KNOWN.indexOf(mode) < 0) {
        throw new Error("[启动断言] MAE_REGION.mode=\"" + mode + "\" 不是已知值，可选：" + KNOWN.join(" / "));
    }
    if (mode === "down") {
        const n = (M.size > 0) ? M.size : 8;
        if (MS_SIZE % n !== 0) {
            throw new Error(
                "[启动断言] MAE_REGION.size=" + n + " 不能整除 " + MS_SIZE + "。" +
                "宿主 Cv2.Resize(n, Area) 与 JS downAvg 只有在整除时才逐点等价；" +
                "非整除会让 OpenCV 走加权分配，与 downAvg 的 floor/ceil 块边界对不齐。" +
                "可选值：" + Array.from({ length: 12 }, function (_, i) { return i + 1; })
                    .filter(function (v) { return MS_SIZE % v === 0 && v > 1; }).join(" / "));
        }
    }
    if (mode === "center" || mode === "family") {
        const size = (M.size > 0) ? M.size : 30;
        if (size > MS_SIZE) {
            throw new Error("[启动断言] MAE_REGION.size=" + size + " 大于 " + MS_SIZE + "，无法裁剪。");
        }
        const x = (M.offsetX === null || M.offsetX === undefined) ? Math.floor((MS_SIZE - size) / 2) : M.offsetX;
        const y = (M.offsetY === null || M.offsetY === undefined) ? 5 : M.offsetY;
        if (x < 0 || y < 0 || x + size > MS_SIZE || y + size > MS_SIZE) {
            throw new Error(
                "[启动断言] MAE_REGION 区域 size=" + size + " 在 (" + x + "," + y + ") " +
                "超出 " + MS_SIZE + "×" + MS_SIZE + "。请修 config.js 的 MAE_REGION.offsetX/offsetY/size。");
        }
    }
    if (!(MS_OFFSET_COUNT > 0)) {
        throw new Error("[启动断言] identify.js 的 MS_OFFSETS 为空 ⇒ pickThreeVariant 候选恒为空。");
    }
    return true;
}
assertMaeConfig();
const MS_PAD = 0;
const MS_BIG = MS_SIZE + 2 * MS_PAD;

function regionOf(reg) {
    if (!reg || !(reg.size > 0)) return null;
    const size = reg.size;
    const ox = (reg.x === null || reg.x === undefined) ? Math.floor((MS_SIZE - size) / 2) : reg.x;
    const oy = (reg.y === null || reg.y === undefined) ? Math.floor((MS_SIZE - size) / 2) : reg.y;
    if (ox < 0 || oy < 0 || ox + size > MS_SIZE || oy + size > MS_SIZE) {
        throw new Error(
            "[MAE_REGION 配置越界] 区域 size=" + size + " 在 (" + ox + "," + oy + ") " +
            "超出 " + MS_SIZE + "×" + MS_SIZE + " 边界。请检查 config.js 的 " +
            "MAE_REGION.offsetX / offsetY / size（mode = " + String(reg.mode || "center") + "）。");
    }
    return { size: size, x: ox, y: oy };
}

function downAvg(raw, rawW, x0, y0, n) {
    const out = new Uint8Array(n * n * 3);
    const k = MS_SIZE / n;
    for (let y = 0; y < n; y++) {
        const ys = y0 + Math.floor(y * k);
        const ye = Math.min(y0 + MS_SIZE, y0 + Math.ceil((y + 1) * k));
        for (let x = 0; x < n; x++) {
            const xs = x0 + Math.floor(x * k);
            const xe = Math.min(x0 + MS_SIZE, x0 + Math.ceil((x + 1) * k));
            let r = 0, g = 0, b = 0, c = 0;
            for (let yy = ys; yy < ye; yy++) {
                let i = (yy * rawW + xs) * 3;
                for (let xx = xs; xx < xe; xx++) {
                    b += raw[i]; g += raw[i + 1]; r += raw[i + 2];
                    i += 3;
                    c++;
                }
            }
            if (!c) continue;
            const o = (y * n + x) * 3;
            out[o] = (b / c) | 0; out[o + 1] = (g / c) | 0; out[o + 2] = (r / c) | 0;
        }
    }
    return out;
}

function makeShiftFn(big, reg) {
    const isDown = !!(reg && reg.down && reg.size > 0);
    const n = isDown ? reg.size : 0;
    if (isDown && big && big.side === n && big.raw && big.raw.length === n * n * 3) {
        return function (ox, oy) {
            if (ox !== 0 || oy !== 0) return null;   
            return big.raw;
        };
    }
    const rg = isDown ? null : regionOf(reg);
    const size = rg ? rg.size : MS_SIZE;
    const rx = rg ? rg.x : 0;
    const ry = rg ? rg.y : 0;
    return function (ox, oy) {
        const x0 = MS_PAD + ox, y0b = MS_PAD + oy;
        if (x0 < 0 || y0b < 0 || x0 + MS_SIZE > MS_BIG || y0b + MS_SIZE > MS_BIG) return null;
        if (isDown) return downAvg(big.raw, MS_BIG, x0, y0b, n);
        const out = new Uint8Array(size * size * 3);
        for (let y = 0; y < size; y++) {
            const src = ((y0b + ry + y) * MS_BIG + x0 + rx) * 3;
            const dst = y * size * 3;
            const rowBytes = size * 3;
            for (let i = 0; i < rowBytes; i++) out[dst + i] = big.raw[src + i];
        }
        return out;
    };
}

function secondStage(fam, crop, R, y0, img, w, h, byName, o, getCrop, getPixel, cellBig, hit, srcMat, hostSmall, shiftOffsetCount) {
    const kind = fam.kind;
    const f = fam.fam;
    if (kind === "threeVariant") {
        const t = {};
        for (const v of f.variants) {
            const e = byName.get(v);
            if (e) {
                const slot = (v === f.variants[0]) ? "odd" : ((v === f.variants[1]) ? "normal" : "deli");
                t[slot] = { name: v, bgr: e.bgr };
            }
        }
        if (!t.normal || !t.normal.bgr) {
            return { method: "desat", name: null, uncertain: true,
                note: "族内「普通」模板未保留像素（特征文件未重新生成？）" };
        }
        const spark = (function () {
            const pts = [];
            for (let dy = -77; dy <= -75; dy++) {
                for (let dx = 19; dx <= 21; dx++) {
                    const pxv = getPixel(R.colL + dx, y0 + dy);
                    pts.push(pxv ? pxv[2] : -1);
                }
            }
            const cnt = pts.filter(function (v) { return v === 255; }).length;
            return { hit: cnt >= SPARKLE_MIN_HITS, count: cnt, rSum: 0, reason: "" };
        })();
        const needBig = (shiftOffsetCount > 1);
        const bigCrop = cellBig ? { raw: cellBig, w: MS_BIG, h: MS_BIG } : (!needBig ? null : (function () {
            const sx = R.tpl.x - MS_PAD;
            const sy = R.tpl.y - MS_PAD;
            if (sx < 0 || sy < 0 || sx + MS_BIG > w || sy + MS_BIG > h) return null;
            const raw = getCrop(sx, sy, MS_BIG, MS_BIG);
            if (!raw) return null;
            return { raw: raw, w: MS_BIG, h: MS_BIG };
        })());
        const cropSide = (crop && crop.length % 3 === 0) ? Math.round(Math.sqrt(crop.length / 3)) : 0;
        const cropIsTight = cropSide > 0 && cropSide * cropSide * 3 === crop.length;
        const maeReg = (function () {
            const M = MAE_REGION || {};
            if (M.mode === "down") {
                const n = M.size > 0 ? M.size : 8;
                return { down: true, size: n };
            }
            if (M.mode !== "center" && M.mode !== "family") return null;
            const size = M.size > 0 ? M.size : 30;
            let x = (M.offsetX === null || M.offsetX === undefined)
                ? Math.floor((MS_SIZE - size) / 2) : M.offsetX;
            let y = (M.offsetY === null || M.offsetY === undefined) ? 5 : M.offsetY;
            if (M.mode === "family" && M.familyRegion && f.base && M.familyRegion[f.base]) {
                const fr = M.familyRegion[f.base];
                if (Array.isArray(fr) && fr.length >= 2) { x = fr[0]; y = fr[1]; }
            }
            return { size: size, x: x, y: y };
        })();
        const modeAllowsSmall = !!(maeReg && maeReg.down === true);
        const smallShift = (!needBig && cropIsTight && modeAllowsSmall)
            ? { raw: crop, side: cropSide } : null;
        const smallBlockedByMode = (!needBig && cropIsTight && !modeAllowsSmall);
        const r3 = pickThreeVariant(crop, R.tpl.w, R.tpl.h, R.colL, y0, t, {
            fullBgr: img, fullW: w, fullH: h,
            sparkleOverride: spark,
            compareB: !!o.compareDesatB,
            region: maeReg,
            shiftFn: bigCrop
                ? makeShiftFn(bigCrop, maeReg)
                : (smallShift ? makeShiftFn(smallShift, maeReg) : null)
        });
        if (smallBlockedByMode && r3 && typeof r3 === "object") {
            const modeName = (MAE_REGION && MAE_REGION.mode) ? String(MAE_REGION.mode) : "unknown";
            const Q = String.fromCharCode(34);
            r3.note = (r3.note ? r3.note + "；" : "") +
                "[配置警告] MAE_REGION.mode = " + modeName + " 不支持小图直通" +
                "（需为 down）⇒ 本格已禁用宿主小图通道，走 60×60 回退路径";
            r3.smallBlockedByMode = modeName;
        }
        const nt = fam.nestedTwin;
        if (nt && r3 && r3.name && f.variants[2] === r3.name) {
            const clickSet = o.twinClick;
            const userHasTwin = (clickSet === null || clickSet === undefined)
                ? true
                : (typeof clickSet.has === "function" && clickSet.has(nt.base));
            if (!userHasTwin) {
                r3.method = "detail-skip";
                r3.note = (r3.note ? r3.note + "；" : "") +
                    "配置未勾选该同图料理 ⇒ 不做孪生点击，直接判「" + r3.name + "」";
                return r3;
            }
            return { method: "detail", name: r3.name, uncertain: false,
                needsClick: true, regionReady: !!(nt.detail && nt.detail.regionReady),
                family: nt.base, detail: nt.detail,
                variants: (nt.variants || []).slice(),
                provisional: r3.name,
                note: "判定为美味版 ⇒ 需点开详情区分「" + nt.variants[0] + "」与「" + nt.variants[1] + "」" };
        }
        return r3;
    }

    if (kind === "sameShape") {
        const famHists = [];
        const famGray = [];
        for (const v of f.variants) {
            const e = byName.get(v);
            if (e && e.hist) famHists.push({ name: v, hist: e.hist });
            if (e && e.gray) famGray.push({ name: v, gray: e.gray });
        }
        const maeRes = pickByMae6(f.variants, crop, byName, MAE_REGION);
        if (maeRes) {
            return maeRes;                    
        }

        if (famHists.length < 2) {
            const ftA = FAMILY_TRUST || {};
            const highThr = (typeof ftA.DEGRADED_HIGH_SCORE === "number") ? ftA.DEGRADED_HIGH_SCORE : 0.99;
            const trustOnA = (ftA.enabled !== false);
            const argScore = (hit && typeof hit.score === "number") ? hit.score : null;
            const inFam = !!(hit && Array.isArray(f.variants) && f.variants.indexOf(hit.name) >= 0);
            if (trustOnA && argScore !== null && argScore > highThr && inFam) {
                return {
                    method: "hue",
                    name: hit.name,
                    uncertain: false,
                    highConfidence: true,
                    degradedFamily: f.variants.slice(),
                    note: "族内色相特征不足 2 个（退化），但一级得分 " +
                        (Math.round(argScore * 10000) / 10000) + " > " + highThr +
                        " 且识别名属本族成员 ⇒ 采信"
                };
            }
            return { method: "hue", name: null, uncertain: true,
                note: "族内可用色相特征不足 2 个（退化），退回一级" };
        }
        let small = crop;
        let smallW = R.tpl.w;
        let smallH = R.tpl.h;
        const hueNeed = (MS_SIZE * MS_SIZE * 3);
        if (HOST_CROP && HOST_CROP.enabled && srcMat && (!crop || crop.length !== hueNeed)) {
            const bx3 = R.tpl.x - MS_PAD, by3 = R.tpl.y - MS_PAD;
            if (bx3 >= 0 && by3 >= 0 && bx3 + R.tpl.w <= w && by3 + R.tpl.h <= h) {
                const pk3 = hostCropMulti(srcMat, bx3, by3, R.tpl.w, R.tpl.h, [MS_SIZE], false);
                if (pk3 && pk3[MS_SIZE] && pk3[MS_SIZE].length === hueNeed) {
                    small = pk3[MS_SIZE];
                    smallW = MS_SIZE;
                    smallH = MS_SIZE;
                }
            }
        }
        const hueReady = !!(small && small.length === smallW * smallH * 3 && smallW === MS_SIZE);
        const FS2 = (famGray[0] && famGray[0].gray) ? Math.round(Math.sqrt(famGray[0].gray.length)) : 0;
        let fallback = null;
        if (FS2 >= 4 && famGray.length >= 2) {
            let cropFeat = null;
            if (HOST_CROP && HOST_CROP.enabled && srcMat && FS2 > 0) {
                const bx2 = R.tpl.x - MS_PAD, by2 = R.tpl.y - MS_PAD;
                if (bx2 >= 0 && by2 >= 0 && bx2 + R.tpl.w <= w && by2 + R.tpl.h <= h) {
                    const pk = hostCropMulti(srcMat, bx2, by2, R.tpl.w, R.tpl.h, [FS2], true);
                    if (pk && pk[FS2] && pk[FS2].length === FS2 * FS2) cropFeat = pk[FS2];
                }
            }
            if (!cropFeat) {
                const side = Math.round(Math.sqrt(crop.length / 3));
                cropFeat = (side > 0 && side * side * 3 === crop.length)
                    ? quantifyDown(crop, side, side, FS2) : null;
            }
            if (cropFeat) fallback = { cropGray: cropFeat, famGray: famGray };
        }
        const hueRes = pickByHue(small, smallW, smallH, famHists, { fallback: fallback });
        if (hueRes && !hueReady) {
            hueRes.hueDegradedReason = hueRes.hueDegradedReason || "crop 非 60×60 彩色（宿主通道未取到全分辨率）";
        } else if (hueRes) {
            hueRes.hueOk = true;
        }
        return hueRes;
    }

    if (kind === "potionColor") {
        const dy = (typeof f.dy === "number") ? f.dy : -55;
        const maxDist = (typeof f.maxDist === "number") ? f.maxDist : 30;
        const cx = Math.round((R.colL + R.colR) / 2);
        const py = y0 + dy;
        const res = {
            method: "potionColor", name: null, uncertain: false,
            note: "", hue: null, sat: null, px: null, margin: null
        };
        const pv = getPixel(cx, py);
        if (!pv) {
            res.uncertain = true;
            res.note = "单点取色失败 (x=" + cx + ", y=" + py + ")";
            return res;
        }
        res.px = [pv[0], pv[1], pv[2]];
        const B = pv[0], G = pv[1], Rr = pv[2];
        const mx = Math.max(Rr, G, B), mn = Math.min(Rr, G, B), d = mx - mn;
        if (mx === 0 || d === 0) {
            res.uncertain = true;
            res.note = "单点无彩色（BGR " + B + "," + G + "," + Rr + "）⇒ 判不出颜色";
            return res;
        }
        let hue;
        if (mx === Rr) hue = ((G - B) / d) % 6;
        else if (mx === G) hue = (B - Rr) / d + 2;
        else hue = (Rr - G) / d + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
        res.hue = Math.round(hue * 10) / 10;
        const sat = (mx - mn) / mx;
        res.sat = Math.round(sat * 1000) / 1000;
        const r3 = function (v) { return Math.round(v * 10) / 10; };
        const scored = [];
        for (const v of f.variants) {
            let dh = Math.abs(hue - v.hue);
            if (dh > 180) dh = 360 - dh;
            const dsat = Math.abs(sat - v.sat) * 180;
            scored.push({ name: v.name, dh: dh, ds: dsat, dist: dh + dsat });
        }
        scored.sort(function (a, b) { return a.dist - b.dist; });
        const best = scored[0], second = scored[1];
        res.margin = second ? r3(second.dist - best.dist) : null;
        if (best.dist > maxDist) {
            res.uncertain = true;
            res.note = "单点色距 " + r3(best.dist) + " > " + maxDist +
                "（色相 " + res.hue + "° 饱和 " + res.sat + "）⇒ 不硬猜";
            return res;
        }
        res.name = best.name;
        res.note = "单点色：色相 " + res.hue + "° / 饱和 " + res.sat +
            " ⇒ " + best.name + "（距 " + r3(best.dist) +
            (res.margin !== null ? "，领先 " + res.margin : "") + "）";
        return res;
    }
    if (kind === "pointColor") {
        const dy = (typeof f.dy === "number") ? f.dy : -70;
        const tol = (typeof f.tol === "number") ? f.tol : 20;
        const cx = Math.round((R.colL + R.colR) / 2);
        const py = y0 + dy;
        const res = {
            method: "pointColor", name: null, uncertain: false,
            note: "", hue: null, px: null, margin: null
        };
        const pv = getPixel(cx, py);
        if (!pv) {
            res.uncertain = true;
            res.note = "单点取色失败 (x=" + cx + ", y=" + py + ")";
            return res;
        }
        res.px = [pv[0], pv[1], pv[2]];
        const B = pv[0], G = pv[1], Rr = pv[2];
        const mx = Math.max(Rr, G, B), mn = Math.min(Rr, G, B), d = mx - mn;
        if (mx === 0 || d === 0) {
            res.uncertain = true;
            res.note = "单点无彩色（BGR " + B + "," + G + "," + Rr + "）⇒ 判不出颜色";
            return res;
        }
        let hue;
        if (mx === Rr) hue = ((G - B) / d) % 6;
        else if (mx === G) hue = (B - Rr) / d + 2;
        else hue = (Rr - G) / d + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
        res.hue = Math.round(hue * 10) / 10;

        const scored = [];
        for (const v of f.variants) {
            let dx = Math.abs(hue - v.hue);
            if (dx > 180) dx = 360 - dx;
            scored.push({ name: v.name, d: dx });
        }
        scored.sort(function (a, b) { return a.d - b.d; });
        const best = scored[0];
        res.margin = (scored.length > 1) ? Math.round((scored[1].d - best.d) * 10) / 10 : null;
        res.bestDist = Math.round(best.d * 10) / 10;

        if (best.d > tol) {
            res.uncertain = true;
            res.note = "色相 " + res.hue + "° 距最近色「" + best.name + "」" +
                res.bestDist + "° > 容差 " + tol + "° ⇒ 判不出";
            return res;
        }
        res.name = best.name;
        res.note = "单点色相 " + res.hue + "° ⇒ " + best.name +
            "（距 " + res.bestDist + "°，容差 " + tol + "°）";
        return res;
    }
    if (kind === "starTier") {
        const res = {
            name: null, method: "star",
            decidedBy: (STAR_BG && STAR_BG.methodName) || "star-bg-hue",
            level: null, count: -1, bgPx: null, bgWhy: "",
            uncertain: false, note: ""
        };
        let hue = null, sat = null;
        let pos = -1;
        try {
            const bx = R.colL + ((typeof STAR_BG.dx === "number") ? STAR_BG.dx : 8);
            const by = y0 + ((typeof STAR_BG.dy === "number") ? STAR_BG.dy : -10);
            const p = getPixel(bx, by);
            if (!p || p.length < 3) {
                res.bgWhy = "取不到底色像素（越界或通道不可用）";
            } else {
                const b = p[0], g = p[1], r = p[2];
                res.bgPx = [r, g, b];
                const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
                sat = (mx === 0) ? 0 : d / mx;
                if (sat < STAR_BG.minSat) {
                    res.bgWhy = "底色未取到稀有度色（饱和度 " + (Math.round(sat * 1000) / 1000) + " < " + STAR_BG.minSat + "）";
                } else {
                    let h = 0;
                    if (mx === r) h = ((g - b) / d) % 6;
                    else if (mx === g) h = (b - r) / d + 2;
                    else h = (r - g) / d + 4;
                    h *= 60;
                    if (h < 0) h += 360;
                    hue = Math.round(h * 10) / 10;
                    const band = (STAR_BG.hueBands || []).find(function (bd) { return hue >= bd.min && hue < bd.max; });
                    if (!band) {
                        res.bgWhy = "底色色相 " + hue + "° 不在任何档位区间";
                    } else if (band.lv === 1) {
                        res.bgWhy = "底色命中金档 " + hue + "°，但名单无金档变体";
                    } else {
                        res.level = band.lv;
                        pos = (band.lv === 4) ? 0 : (band.lv === 3) ? 1 : 2;
                    }
                }
            }
        } catch (e2) {
            res.bgWhy = "底色判定异常：" + ((e2 && e2.message) ? e2.message : e2);
        }
        if (pos >= 0) {
            if (!f || !Array.isArray(f.variants) || f.variants.length !== 3) {
                res.uncertain = true;
                res.note = "底色档位 " + res.level + "★ 但名单变体数 ≠ 3，无法定位变体";
                return res;
            }
            res.name = f.variants[pos];
            res.note = "底色 RGB " + res.bgPx.join(",") +
                "（hue " + hue + "°，sat " + (Math.round(sat * 1000) / 1000) + "）⇒ " + res.level + "★";
        } else {
            res.uncertain = true;
            res.note = "底色未取到稀有度色" +
                (res.bgWhy ? "（" + res.bgWhy + "）" : "") +
                (res.bgPx ? "；RGB " + res.bgPx.join(",") : "") +
                " ⇒ 按不确定处理（无 starLevel 兜底）";
        }
        return res;
    }
    if (kind === "twin") {
        const ready = !!(f.detail && f.detail.regionReady);
        const clickSet = o.twinClick;
        const userHasTwin = (clickSet === null || clickSet === undefined)
            ? true
            : (typeof clickSet.has === "function" && clickSet.has(f.base));
        const normalName = (f.variants && f.variants.length) ? f.variants[0] : null;
        if (!userHasTwin) {
            return { method: "detail-skip", name: normalName, uncertain: !normalName,
                needsClick: false, regionReady: ready, family: f.base,
                detail: f.detail, variants: (f.variants || []).slice(),
                note: "配置未勾选该同图料理 ⇒ 不做孪生点击，直接判「" + normalName + "」" };
        }
        return { method: "detail", name: null, uncertain: true,
            needsClick: ready, regionReady: ready, family: f.base,
            detail: f.detail, variants: (f.variants || []).slice(),
            note: ready
                ? "孪生族需点开详情 OCR（在 scan 层执行）"
                : "孪生族「" + f.base + "」的详情区域缺失或为全零（孪生族的详情区域本应都已填好，请检查 assets/背包扫描/名单/变体族.json 的「详情.区域」）—— 本格不点击、不判变体" };
    }
    return { method: "?", name: null, uncertain: true, note: "未知二级类型：" + kind };
}
