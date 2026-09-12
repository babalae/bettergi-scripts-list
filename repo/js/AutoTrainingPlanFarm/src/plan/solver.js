// 材料齐集判断：系列分组、方向贪心、可合成数量约束枚举
import { canonicalName, levDistance } from "../core/common.js";

export function seriesKey(name) {
  const n = canonicalName(name);
  const di = n.indexOf("的");
  const zi = n.indexOf("之");
  let idx = -1;
  if (di > 0 && zi > 0) idx = Math.min(di, zi);
  else if (di > 0) idx = di;
  else if (zi > 0) idx = zi;
  return idx > 0 ? n.slice(0, idx) : n;
}

export function buildPlan(entries) {
  const items0 = entries.map(e => {
    const norm = canonicalName(e.material);
    return { entry: e, norm, series: seriesKey(norm) };
  });

  const keyClusters = [];
  for (const it of items0) {
    let cluster = keyClusters.find(c => levDistance(c.key, it.series) <= 1);
    if (!cluster) {
      cluster = { key: it.series };
      keyClusters.push(cluster);
    }
    it.groupKey = cluster.key;
  }

  const map = new Map();
  for (const it of items0) {
    if (!map.has(it.groupKey)) map.set(it.groupKey, []);
    map.get(it.groupKey).push(it);
  }

  const groups = [];
  const flat = [];
  let idx = 0;
  for (const [base, arr] of map) {
    // 一律按颜色定档：金1/紫2/蓝3/绿4；颜色失败按点击顺序兜底。
    // 不按“正好3个材料”特判：4档系列可能只缺 3 个，特判会整体错位
    arr.sort((a, b) =>
      ((a.entry.qualityRank || 99) - (b.entry.qualityRank || 99)) ||
      ((a.entry.orderRank || 99) - (b.entry.orderRank || 99))
    );
    arr.forEach((item, order) => {
      // 后缀按每个材料自己的系列名切，避免 OCR 错字导致后缀错位
      item.suffix = item.norm.slice(item.series.length).replace(/^[的之]/, "");
      item.localRank = Math.min(4, Math.max(1, Number(item.entry.qualityRank) || order + 1));
      item.entry.qualityRank = item.localRank;
      item.globalIdx = idx++;
      flat.push(item);
    });
    // 永远按4档权重链 27/9/3/1 计算
    groups.push({ base, items: arr, maxRank: 4 });
  }

  return { groups, flat };
}

export function directionalGreedy(h, need) {
  const n = h.length;
  const w = (i) => Math.pow(3, n - 1 - i);
  let carry = 0;
  let deficit = 0;
  const missing = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const avail = h[i] + carry;
    const gap = Math.max(0, need[i] - avail);
    if (gap > 0) {
      missing[i] = gap;
      deficit += gap * w(i);
      carry = 0;
    } else {
      carry = Math.floor((avail - need[i]) / 3); // 3低 → 1高
    }
  }
  return { deficit, missing };
}

export function solveUnknownMinDeficit(n, mask, knownHave, synthKnown, need) {
  const w = (i) => Math.pow(3, n - 1 - i);
  let best = null;

  function dfs(j, h, lowerA) {
    let cands;
    if (mask[j]) {
      cands = [knownHave[j]];
    } else if (j > 0 && mask[j - 1] && synthKnown[j - 1] !== null) {
      const c = (j === n - 1) ? 0 : Math.floor(lowerA / 3);
      const base = 3 * synthKnown[j - 1] - c;
      cands = [base, base + 1, base + 2].filter(v => v >= 0);
    } else {
      cands = [0, 1, 2];
    }

    for (const val of cands) {
      h[j] = val;
      const A = (j === n - 1) ? val : val + Math.floor(lowerA / 3);
      if (j > 0 && mask[j - 1] && synthKnown[j - 1] !== null && Math.floor(A / 3) !== synthKnown[j - 1]) continue;

      if (j === 0) {
        const r = directionalGreedy(h, need);
        let surplus = 0;
        if (r.deficit === 0) {
          let haveLow = 0;
          let needLow = 0;
          for (let i = 0; i < n; i++) {
            haveLow += h[i] * w(i);
            needLow += need[i] * w(i);
          }
          surplus = Math.max(0, haveLow - needLow);
        }
        if (best === null ||
            r.deficit < best.deficit ||
            (r.deficit === best.deficit && surplus > best.surplus)) {
          best = { deficit: r.deficit, missing: r.missing, surplus };
        }
      } else {
        dfs(j - 1, h, A);
      }
    }
  }

  dfs(n - 1, new Array(n).fill(0), 0);
  return best;
}

export function checkPlan(plan, counts) {
  let allOk = true;
  let totalDeficit = 0;
  let totalSurplus = 0;
  const groups = [];

  for (const g of plan.groups) {
    const n = g.maxRank;
    const need = new Array(n).fill(0);

    // 权重统一4档：index0(金)=27，index1(紫)=9，index2(蓝)=3，index3(绿)=1
    const weightOf = (i) => Math.pow(3, n - 1 - i);

    const mask = new Array(n).fill(false);
    const knownHave = new Array(n).fill(0);
    const synthKnown = new Array(n - 1).fill(null);

    for (const item of g.items) {
      const r = (item.localRank || 1) - 1;
      mask[r] = true;
      knownHave[r] += (Number(item.entry.have) || 0) + (Number(counts[item.globalIdx]) || 0);
      need[r] += Number(item.entry.need) || 0;
      if (r < n - 1) {
        const sc = Number(item.entry.synthCount) || 0;
        synthKnown[r] = sc > 0 ? sc : null;
      }
    }

    // 用「可合成数量」约束枚举库存组合，取最乐观解（缺口最小，其次剩余最多；宁可少刷）
    const solved = solveUnknownMinDeficit(n, mask, knownHave, synthKnown, need);
    let deficit;
    let surplus;
    let missing;
    if (solved === null) {
      log.warn("[合成补偿] 约束矛盾，放弃补偿，按已扫库存计算");
      const fb = directionalGreedy(knownHave, need);
      deficit = fb.deficit;
      missing = fb.missing;
      if (deficit === 0) {
        let haveLow = 0;
        let needLow = 0;
        for (let i = 0; i < n; i++) {
          haveLow += knownHave[i] * weightOf(i);
          needLow += need[i] * weightOf(i);
        }
        surplus = Math.max(0, haveLow - needLow);
      } else {
        surplus = 0;
      }
    } else {
      deficit = solved.deficit;
      surplus = solved.surplus;
      missing = solved.missing;
    }

    const ok = deficit === 0;
    if (!ok) allOk = false;
    totalDeficit += deficit;
    totalSurplus += surplus;
    groups.push({ base: g.base, ok, deficitLowUnits: deficit, surplusLowUnits: surplus, missing });
  }

  return {
    ok: allOk,
    deficitLowUnits: totalDeficit,
    surplusLowUnits: totalSurplus,
    groups
  };
}
