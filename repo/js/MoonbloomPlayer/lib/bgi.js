// Generated from 牌手共享. Edit layered source, not this standalone output.
// Common host assembled from the maintained fragments. Deck rules are overrides.
(function (root) {
  "use strict";
  const elements = ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo", "Omni"];
  const handX = {
    1: [1120],
    2: [1019, 1222],
    3: [914, 1117, 1322],
    4: [812, 1013, 1216, 1424],
    5: [719, 913, 1115, 1319, 1528],
    6: [614, 811, 1012, 1216, 1423, 1625],
    7: [635, 799, 961, 1117, 1279, 1438, 1603],
    8: [605, 751, 893, 1042, 1177, 1325, 1471, 1618],
    9: [587, 716, 847, 976, 1103, 1225, 1352, 1492, 1634],
    10: [570, 690, 810, 930, 1050, 1170, 1290, 1410, 1530, 1650],
  };
  const charX = [750, 960, 1175];
  function costMarkerLayout(rects, measuredCount = null) {
    if (
      !rects.length ||
      rects.some(
        (r) =>
          ![r.x, r.y, r.w, r.h].every(Number.isFinite) ||
          r.w !== 10 ||
          r.h !== 30 ||
          r.x < 450 ||
          r.x > 1750 ||
          r.y < 750 ||
          r.y > 920,
      )
    )
      return null;
    const groups = [];
    for (const r of rects.slice().sort((a, b) => a.x - b.x || a.y - b.y)) {
      const near = groups.find((g) => Math.abs(r.x - g[0].x) <= 14 && Math.abs(r.y - g[0].y) <= 10);
      if (near) near.push(r);
      else groups.push([r]);
    }
    // FindMulti has no confidence scalar. Deterministic rectangle-group means
    // keep this identical to saved-pixel validation, without invented scores.
    const marks = groups.map((g) => ({
        x: g.reduce((s, m) => s + m.x, 0) / g.length,
        y: g.reduce((s, m) => s + m.y, 0) / g.length,
      })),
      layouts = new Map();
    // Optional count is a current-frame native rim measurement, never a
    // projected/cache count. It binds the whole fan before artwork is filtered.
    if (measuredCount !== null && (!Number.isInteger(measuredCount) || !handX[measuredCount]))
      return null;
    for (const seed of marks) {
      const band = marks.filter((m) => Math.abs(m.y - seed.y) <= 35).sort((a, b) => a.x - b.x);
      // Crowded 5–10-card rows have a calibrated grid even when the badge/rim
      // is hidden. Interior artwork peaks do not add cards. Low-count fans
      // retain their native rim binding and the original whole-row route.
      const counts=measuredCount!==null?[measuredCount]:[...new Set([band.length,5,6,7,8,9,10])];
      for(const candidateCount of counts){
      if(!handX[candidateCount])continue;
      let row = band;
      if (measuredCount !== null || candidateCount>=5) {
        row = handX[candidateCount].map((x) => {
          const choices = band.filter((m) => Math.abs(m.x + 103 - x) <= 32)
            .sort((a, b) => Math.abs(a.x + 103 - x) - Math.abs(b.x + 103 - x));
          // No invented confidence: equal geometric fits remain ambiguous.
          return choices.length && (choices.length === 1 ||
            Math.abs(choices[0].x + 103 - x) < Math.abs(choices[1].x + 103 - x))
            ? choices[0] : null;
        });
        if (row.some((m) => !m) || new Set(row).size !== candidateCount) continue;
      }
      const n = row.length;
      if (
        !handX[n] ||
        row.some((m, i) => Math.abs(m.x + 103 - handX[n][i]) > 32) ||
        row.some((m, i) => i > 0 && m.x - row[i - 1].x < 75) ||
        Math.max(...row.map((m) => m.y)) - Math.min(...row.map((m) => m.y)) > 35 ||
        // An inner artwork subrow cannot conceal outer markers above it.
        // A same-frame measured count bounds the final card by its native rim,
        // not by its left cost corner: artwork inside that card is not a new slot.
        // Without independent count keep the stricter outer-marker conflict.
        marks.some((m) => m.y <= Math.max(...row.map((r) => r.y)) &&
          (m.x < row[0].x - 32 || m.x > (measuredCount === null
            ? row[n - 1].x + 32 : handX[n][n - 1] + 95)))
      )
        continue;
      layouts.set(JSON.stringify(row.map((m) => [m.x, m.y])), {
        count: n,
        measuredCount,
        markers: row.map((m) => ({ x: m.x, y: m.y })),
        points: row.map((m) => m.x + 103),
      });
      }
    }
    return layouts.size === 1 ? [...layouts.values()][0] : null;
  }
  function costDigitRows(rows) {
    // Repeated zeroes are separate rectangles. Never deduplicate by text,
    // normalize O/D to 0/1, or interpret any cost value as a card identity.
    return rows
      .filter(
        (r) =>
          /^\d{1,2}$/.test(r.text) &&
          [r.x, r.y, r.w, r.h].every(Number.isFinite) &&
          r.w > 0 &&
          r.h > 0,
      )
      .map((r) => ({ value: Number(r.text), x: r.x + r.w / 2, y: r.y + r.h / 2 }));
  }
  function costNumbersAt(marker, numbers) {
    return numbers.filter(
      (r) => Math.abs(r.x - marker.x - 28) <= 16 && Math.abs(r.y - marker.y - 15) <= 18,
    );
  }
  function costHandSample(layout, numbers) {
    if (!layout) return null;
    const assigned = layout.markers.map((m) => costNumbersAt(m, numbers));
    // Without an independent count, an extra number can be the missing outer
    // card of a shorter apparent row. Preserve that real layout conflict.
    if(layout.measuredCount===null&&numbers.some(n=>!assigned.some(a=>a.includes(n))&&
      (n.x<layout.markers[0].x+12||n.x>layout.markers.at(-1).x+44)))return null;
    // Geometry is already bound to native evidence. One missing/ambiguous digit
    // invalidates that slot's price, not the row, positions or other prices.
    const costs = assigned.map(a => a.length === 1 &&
      assigned.filter(other => other.includes(a[0])).length === 1 ? a[0].value : null);
    return {
      count: layout.count,
      points: layout.points.slice(),
      markerYs: layout.markers.map((m) => m.y),
      costs,
    };
  }
  function handLayoutCount(edges) {
    // Entire low-count layout, not a matching subset of a larger hand. Extra
    // interior rim matches are harmless; any edge outside the fan rejects it.
    const candidates = [];
    for (let n = 1; n <= 4; n++) {
      const xs = handX[n];
      if (
        edges.length &&
        edges.every((x) => x >= xs[0] - 120 && x <= xs[n - 1] + 130) &&
        xs.every((c) => edges.some((x) => Math.abs(x - c - 95) <= 32))
      )
        candidates.push(n);
    }
    return candidates.length === 1 ? candidates[0] : null;
  }
  const enemyHpXs = { 1: [856], 2: [751, 962], 3: [646, 856, 1066], 4: [541, 751, 961, 1171] };
  // Verified skill names from DSTCG's repository card dictionary. The native
  // skill/payment preview hides the usual turn marker; it is not an unknown
  // board. Require BOTH the exact skill name and its type, not merely a panel.
  const skillNames = TCG.team.map(c => c.skills);
  const skillTypes = { NA: "普通攻击", E: "元素战技", Q: "元素爆发" };
  // This asset is the tooltip ABOVE the control, not its clickable area.
  // Use it only as a scene marker. First-pick confirmation uses the official
  // character-card path, not the separate tooltip/control geometry.
  const pickLabelROI = [1730, 820, 190, 100];
  const number = (text) =>
    /^\d{1,2}$/.test(String(text).trim()) ? Number(String(text).trim()) : null;
  function captureSize(f) {
    const width = Number(f.width ?? f.Width),
      height = Number(f.height ?? f.Height);
    return {
      width: Number.isInteger(width) && width > 0 ? width : null,
      height: Number.isInteger(height) && height > 0 ? height : null,
    };
  }
  function requireCaptureSize(size) {
    if (size.width !== 1920 || size.height !== 1080) {
      throw new Error(
        "仅支持真实游戏捕获区 1920×1080；实际读取 " +
          (size.width ?? "未知") +
          "×" +
          (size.height ?? "未知") +
          "。请将游戏窗口设为1920×1080",
      );
    }
  }
  function mousePoint(x, y) {
    // ClearScript binds Click/MoveMouseTo to Action<int,int>. Odd-sized template
    // and OCR rectangles have half-pixel centers; do not pass them to the host.
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= 1920 || y >= 1080) {
      throw new Error("鼠标坐标无效或超出1920×1080：(" + x + "," + y + ")");
    }
    const point = [Math.round(x), Math.round(y)];
    if (point[0] >= 1920 || point[1] >= 1080) throw new Error("鼠标坐标取整后超出1920×1080");
    return point;
  }
  function boardDifferences(before, after) {
    const fields={active:s=>s.active,dice:s=>TCG.diceOrder.map(e=>s.dice?.[e]||0),
      own:s=>s.characters,enemy:s=>s.enemies,quicken:s=>s.quicken||null,support:s=>s.supportCounts||null,
      eye:s=>s.eye||null,dendroCore:s=>s.dendroCore||null};
    return Object.entries(fields).filter(([,read])=>JSON.stringify(read(before))!==JSON.stringify(read(after))).map(([name])=>name);
  }
  class BetterGIHost {
    constructor(options) {
      this.options = options;
      this.templates = new Map();
      this.roCache = new Map();
      // BetterGI LimitedFile accepts .log but rejects .jsonl. Contents remain one JSON object per line.
      this.path = "logs/run-" + new Date().toISOString().replace(/[:.]/g, "-") + ".log";
      this.emptyHandProven = false;
      this.expectedDice = null;
      this.gamblerBudget = null;
      this.hpReadKeys = new Map();
      this.diceReadKeys = new Map();
      this.handFanReady = false;
      this.handNeedsReset = false;
      this.handCountHint = null;
      this.handCache = null;
      this.handScanSerial = 0;
      this.precisionBoard = false;
      this.forcedPickSession = null;
      this.boardReady = false;
      this.choiceSession = null;
      this.pendingChoiceCard = null;
      this.lastObservedState = null;
      this.tossSession = null;
      this.diagnosticKeys = new Set();
      this.frameMemo = null;
      this.metrics = {frames:0,captureMs:0,frameWorkMs:0,ocrCalls:0,ocrMs:0,memoHits:0};
      this.inputRevision = 0;
      this.lastCostSample = null;
      this.handPositionProof = null;
      this.lastObservedAt = 0;
      this.lastObservedRevision = -1;
      this.consumptionReceipt = null;
      this.pendingHandEvidence = null;
      file.createDirectory("logs");
    }
    clickAt(x, y) {
      const point = mousePoint(x, y);
      this.boardReady = false;
      click(point[0], point[1]);
      this.inputRevision++;
      this.handPositionProof = null;
      return point;
    }
    moveTo(x, y) {
      const point = mousePoint(x, y);
      moveMouseTo(point[0], point[1]);
      return point;
    }
    trace(event, data) {
      const text = JSON.stringify({ at: new Date().toISOString(), event, data });
      if (!file.writeTextSync(this.path, text + "\n", true))
        throw new Error("无法写入对局日志：" + this.path);
    }
    frame(fn) {
      const started = Date.now(),
        previousMemo = this.frameMemo;
      const f = captureGameRegion();
      const captured = Date.now();
      this.metrics.frames++;
      this.metrics.captureMs += captured - started;
      this.frameMemo = new WeakMap();
      try {
        requireCaptureSize(captureSize(f));
        return fn(f);
      } finally {
        this.metrics.frameWorkMs += Date.now() - captured;
        this.frameMemo = previousMemo;
        f.dispose();
      }
    }
    memoFrame(f, key, read) {
      if (!this.frameMemo) return read();
      let cache = this.frameMemo.get(f);
      if (!cache) {
        cache = new Map();
        this.frameMemo.set(f, cache);
      }
      if (cache.has(key)) {
        this.metrics.memoHits++;
        return cache.get(key);
      }
      const value = read();
      cache.set(key, value);
      return value;
    }
    metricSnapshot() {
      return { ...this.metrics };
    }
    metricDelta(before) {
      return Object.fromEntries(
        Object.keys(this.metrics).map((k) => [k, this.metrics[k] - (before?.[k] || 0)]),
      );
    }
    async waitForCapture() {
      // Give an in-progress window transition a bounded chance to settle.
      // No OCR, templates, or game input until two native 1080P frames agree.
      let stable = 0,
        last = { width: null, height: null },
        lastKey = "";
      for (let attempt = 0; attempt < 20; attempt++) {
        const f = captureGameRegion();
        try {
          last = captureSize(f);
        } finally {
          f.dispose();
        }
        const key = JSON.stringify(last);
        if (key !== lastKey) {
          this.trace("capture-size", { ...last, attempt });
          lastKey = key;
        }
        stable = last.width === 1920 && last.height === 1080 ? stable + 1 : 0;
        if (stable >= 2) {
          this.trace("capture-ready", last);
          return;
        }
        if (attempt < 19) await sleep(300);
      }
      requireCaptureSize(last);
      throw new Error("游戏捕获尺寸未稳定为1920×1080");
    }
    ocr(f, roi) {
      const key = "ocr/" + roi.join(",");
      return this.memoFrame(f, key, () => {
        if (!this.roCache.has(key)) this.roCache.set(key, RecognitionObject.Ocr(...roi));
        const started = Date.now();
        this.metrics.ocrCalls++;
        const r = f.Find(this.roCache.get(key));
        const value = r.isExist() ? String(r.text ?? r.Text ?? "").trim() : "";
        this.metrics.ocrMs += Date.now() - started;
        return value;
      });
    }
    ocrRows(f, roi) {
      return this.memoFrame(f, "ocrRows/" + roi.join(","), () => {
        const key = "ocr/" + roi.join(",");
        if (!this.roCache.has(key)) this.roCache.set(key, RecognitionObject.Ocr(...roi));
        const started = Date.now();
        this.metrics.ocrCalls++;
        const rs = f.FindMulti(this.roCache.get(key)),
          out = [];
        for (let i = 0; i < rs.count; i++) {
          const r = rs[i];
          out.push({
            text: String(r.text ?? r.Text ?? "").trim(),
            x: Number(r.x ?? r.X),
            y: Number(r.y ?? r.Y),
            w: Number(r.width ?? r.Width),
            h: Number(r.height ?? r.Height),
          });
        }
        this.metrics.ocrMs += Date.now() - started;
        return out;
      });
    }
    
    
    matches(f, asset, roi, threshold = 0.88, useColor = false) {
      const key = asset + "/" + roi.join(",") + "/" + threshold + "/" + useColor;
      return this.memoFrame(f, "matches/"+key, () => {
      if (!this.roCache.has(key)) {
        if (!this.templates.has(asset)) {
          const mat = file.readImageMatSync("assets/" + asset + ".png");
          if (mat.empty()) { mat.dispose(); throw new Error("缺少模板：" + asset); }
          this.templates.set(asset, mat);
        }
        const ro = RecognitionObject.TemplateMatch(this.templates.get(asset), ...roi);
        ro.threshold = threshold;
        ro.Use3Channels = useColor;
        this.roCache.set(key, ro);
      }
      const found = f.FindMulti(this.roCache.get(key));
      const results = [];
      for (let i = 0; i < found.count; i++) {
        const r = found[i];
        // Copy managed scalar data while the source image is still alive.
        results.push({ x: Number(r.x ?? r.X), y: Number(r.y ?? r.Y),
          w: Number(r.width ?? r.Width), h: Number(r.height ?? r.Height) });
      }
      return results;
      });
    }
    has(f, asset, roi, threshold) {
      return this.matches(f, asset, roi, threshold).length > 0;
    }
    button(asset, roi = [0, 540, 1920, 540]) {
      return this.frame((f) => this.matches(f, "core/" + asset, roi)[0] || null);
    }
    async clickButton(asset, roi) {
      if (asset === "出战角色") throw new Error("出战角色模板是提示文字，不是按钮");
      const b = this.button(asset, roi);
      if (!b) throw new Error("没有识别到按钮：" + asset);
      const point = this.clickAt(b.x + b.w / 2, b.y + b.h / 2);
      this.trace("button-clicked", { asset, point });
      await sleep(550);
    }
    phaseIn(f) {
      // Native victory animation starts around y=500 before moving upward.
      // The old y=101..482 crop missed that exact terminal frame (20:11).
      const result = this.ocr(f, [763, 101, 394, 600]);
      if (/对局胜利/.test(result)) return { phase: "result", result: "win", turn: "none" };
      if (/对局失败/.test(result)) return { phase: "result", result: "lose", turn: "none" };
      const title = this.ocr(f, [844, 167, 232, 65]);
      if (title.includes("初始手牌")) return { phase: "opening", turn: "none" };
      if (title.includes("重投骰子")) return { phase: "roll", turn: "none" };
      if(TCG.norm(title)==="挑选卡牌")return this.choiceIn(f) ||
        {phase:"choice",turn:"none",choiceKind:"unknown",options:[],recognized:false};
      // A hover tooltip is not a persistent scene marker. During defeat picks
      // it vanishes when the cursor moves onto the selected character.
      // Exclude the player-name row; saved native pixels passed 9 shifted/
      // brightness variants at native scale. No additional detail clicks.
      const pickPrompt=TCG.norm(this.ocr(f,[138,1020,280,48]));
      if (/^(请选择|选择)出战角色/.test(pickPrompt) || this.has(f, "core/出战角色", pickLabelROI)) return { phase: "pick", turn: "none" };
      if (this.has(f, "core/回合结算阶段", [0, 0, 384, 1080])) return { phase: "settlement", turn: "none" };
      // Native action banners can coexist with the user-turn icon, while HP,
      // generated cards and the hand-count badge are still animating.
      const banner = TCG.norm(this.ocr(f, [700, 508, 580, 65]));
      if (["我方行动", "对方行动", "行动阶段", "回合开始"].includes(banner)) return { phase: "transition", turn: "none" };
      const user = this.has(f, "user_turn", [64, 518, 33, 42], 0.9);
      const enemy = this.has(f, "enemy_turn", [64, 518, 33, 42], 0.9);
      const opponent = this.has(f, "core/对方行动中", [0, 0, 384, 1080]);
      if (user && !enemy && !opponent) return { phase: "board", turn: "user" };
      if (enemy && !user || opponent) return { phase: "board", turn: "enemy" };
      const choice=this.choiceIn(f);
      if(choice)return choice;
      return { phase: "unknown", turn: "none" };
    }
    phase() {
      const p=this.frame(f=>this.phaseIn(f));
      if(p.phase!=="board"||p.turn!=="user") { this.boardReady=false; this.lastObservedAt=0; this.preparedHandInput=null; }
      return p;
    }
    async admitFreshActionBoard() {
      // Read-only admission, before reset/hand expansion/any game input.
      // User declaration covers hidden history; visible checks are necessary,
      // not a claim that we can infer all past zero-cost actions from pixels.
      let previous = "", last = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        try { last = this.board(); } catch (e) {
          if (!["TCG_DICE_RETRY", "TCG_BOARD_RETRY"].includes(e.code)) throw e;
          previous = ""; await sleep(300); continue;
        }
        if (last.result || !["board", "unknown", "transition"].includes(last.phase)) throw new Error("行动页开局检查期间页面改变");
        const valid = TCG.freshActionBoard(last);
        const key = valid ? JSON.stringify([last.phase, last.turn, last.active, TCG.diceOrder.map(e => last.dice[e] || 0), last.characters]) : "";
        if (valid && key === previous) {
          this.trace("fresh-action-entry-accepted", { active: last.active, dice: last.dice,
            characters: last.characters, proof: "explicit-user-declaration-and-two-stable-visible-opening-boards", historyRestored: false });
          return last;
        }
        previous = key;
        if (attempt < 7) await sleep(300);
      }
      throw new Error("当前行动牌桌不符合新开局未行动条件");
    }
    skillPreviewIn(f) {
      // Native E preview read "神变·恶曜开眼\n3" with the old tall ROI.
      // Exclude the cost row instead of deleting arbitrary digits from OCR.
      const name = this.ocr(f, [135, 122, 238, 42]);
      const detail = this.ocr(f, [70, 210, 320, 85]);
      const candidates = [];
      for (let who = 0; who < skillNames.length; who++) for (const skill of ["NA", "E", "Q"]) {
        const names = [skillNames[who][skill], ...(TCG.team[who].skillAliases?.[skill] || [])];
        if (names.some(title => TCG.norm(name) === TCG.norm(title)) && detail.includes(skillTypes[skill])) {
          candidates.push({ who, skill });
        }
      }
      return { name, detail, identity: candidates.length === 1 ? candidates[0] : null };
    }
    async requireSkillPreview(action, feeProbe=false, readFee=false) {
      let stable = 0, last = null, fee = null, feeStable = 0, absent = true, missing = true;
      for (let attempt = 0; attempt < 6; attempt++) {
        last = this.frame(f => ({ ...this.skillPreviewIn(f), phase: this.phaseIn(f),
          fee: readFee && !feeProbe && ["E","Q"].includes(action.skill) ? this.skillFeeIn(f,action) : null }));
        const matched = last.identity?.who === action.who && last.identity?.skill === action.skill &&
          ["unknown", "board"].includes(last.phase.phase) && last.phase.turn !== "enemy";
        this.trace("skill-preview", { attempt, matched, ...last });
        absent=absent && this.emptySkillPreview(last);
        missing=missing && (this.emptySkillPreview(last) || this.characterSkillPreview(last));
        stable = matched ? stable + 1 : 0;
        feeStable = matched && last.fee!==null ? last.fee===fee ? feeStable+1 : 1 : 0;
        fee = last.fee;
        if (stable >= 2) { if(!feeProbe)await this.requireNoWarning();
          return { fee:feeStable>=2?fee:null }; }
        if (attempt < 5) await sleep(250);
      }
      const error=new Error("技能确认页未核实目标技能：" + (last?.name || "空标题"));
      if(absent)error.code="TCG_SKILL_PREVIEW_ABSENT";
      else if(missing)error.code="TCG_SKILL_PREVIEW_CHARACTER";
      throw error;
    }
    emptySkillPreview(p) {
      return (
        !p.identity &&
        ![p.name, p.nativeName, p.enlargedName, p.detail, p.aliasDetail].some((v) =>
          TCG.norm(v || ""),
        ) &&
        p.phase?.phase === "board" &&
        p.phase.turn === "user"
      );
    }
    characterSkillPreview(p) {
      const names = [p.name, p.nativeName, p.enlargedName].map((v) => TCG.norm(v || ""));
      const named = names.filter(Boolean);
      return (
        !p.identity &&
        !TCG.norm(p.detail || "") &&
        !TCG.norm(p.aliasDetail || "") &&
        named.length > 0 &&
        named.every((name) => name === named[0] && TCG.characterName(name) >= 0) &&
        p.phase?.phase === "board" &&
        p.phase.turn === "user"
      );
    }
    characterOverviewIn(f) {
      // Native 17:18: the character overview has a role title, not a skill title.
      // Its right-hand section varies with equipment/statuses. Read this only
      // on a failed preview, never in the normal two-frame skill-confirm path.
      const name = this.ocr(f, [311, 115, 341, 50]);
      const who = TCG.characterName(name);
      if (who < 0) return null;
      const heading = this.ocr(f, [740, 123, 280, 44]);
      if (["角色装备", "角色状态", "阵营出战状态"].includes(TCG.norm(heading))) return { name, heading };
      const text = TCG.norm(this.ocr(f, [350, 210, 300, 270]));
      const skills = Object.values(TCG.team[who].skills).filter(skill => text.includes(TCG.norm(skill)));
      return skills.length >= 2 ? { name, heading: "角色技能", skills } : null;
    }
    async dismissCharacterOverview(reason) {
      // Only an unreadable board calls this. A payment/choice/unknown page is
      // never a blank-click opportunity; a persistent panel gets one attempt.
      if (this.overviewClearRevision === this.inputRevision) return false;
      const read = () => this.frame(f => {
        const phase = this.phaseIn(f);
        return { phase, panel: phase.phase === "board" && phase.turn === "user"
          ? this.characterOverviewIn(f) : null };
      });
      const first = read();
      if (!first.panel) return false;
      const revision = this.inputRevision;
      await sleep(120);
      const second = read();
      if (!second.panel || this.inputRevision !== revision ||
          TCG.norm(first.panel.name) !== TCG.norm(second.panel.name) ||
          TCG.norm(first.panel.heading) !== TCG.norm(second.panel.heading) ||
          JSON.stringify(first.panel.skills || []) !== JSON.stringify(second.panel.skills || [])) return false;
      const point = this.clickAt(1190, 545);
      this.overviewClearRevision = this.inputRevision;
      this.moveTo(1555, 545);
      this.trace("character-overview-dismissed", { reason, panel: second.panel, point });
      await sleep(300);
      return true;
    }
    async requireOpenedSkill(action, before, x, readFee = false, feeProbe = false) {
      try {
        return await this.requireSkillPreview(action, feeProbe, readFee);
      } catch (error) {
        if (!["TCG_SKILL_PREVIEW_ABSENT", "TCG_SKILL_PREVIEW_CHARACTER"].includes(error.code)) throw error;
        let overview = null;
        if (error.code === "TCG_SKILL_PREVIEW_CHARACTER") {
          overview = this.frame(f => {
            const preview = {...this.skillPreviewIn(f), phase:this.phaseIn(f)};
            if (!this.emptySkillPreview(preview) && !this.characterSkillPreview(preview)) return null;
            const panel = this.characterOverviewIn(f);
            if (panel && this.characterSkillPreview(preview) && TCG.characterName(panel.name) !==
                TCG.characterName(preview.name || preview.nativeName || preview.enlargedName)) return null;
            return panel;
          });
          if (!overview) throw error;
          this.trace("skill-preview-overview", {...overview, feeProbe, recoveryLimit:1});
          this.boardReady=false;await this.reset();
        }
        // Reopen only an absent first-click preview, never an already sent skill.
        // Two fresh full boards must prove all resources/characters unchanged;
        // a fresh empty-detail sample also guards against a late-arriving panel.
        for (let sample = 0; sample < 2; sample++) {
          let board;
          try { board = this.board(); }
          catch (unsettled) {
            if (unsettled.code !== "TCG_DICE_RETRY") throw unsettled;
            const changed = new Error("技能详情缺失且骰子未读清，重新观察而不补点");
            changed.code = "TCG_STATE_REFRESH";
            throw changed;
          }
          if (
            board.phase !== "board" ||
            board.turn !== "user" ||
            !board.diceKnown ||
            boardDifferences(before, board).length !== 0
          ) {
            const changed = new Error("技能详情缺失且牌桌已变化，重新观察而不补点");
            changed.code = "TCG_STATE_REFRESH";
            throw changed;
          }
          if (sample === 0) await sleep(300);
        }
        const stillEmpty = this.frame((f) => ({
          ...this.skillPreviewIn(f),
          phase: this.phaseIn(f),
        }));
        if (!this.emptySkillPreview(stillEmpty)) throw error;
        await this.requireNoWarning();
        this.trace("skill-preview-reopen", {
          who: action.who,
          skill: action.skill,
          proof: overview ? "verified-overview-reset-two-unchanged-boards-and-empty-details" :
            "two-unchanged-boards-and-empty-details",
          feeProbe,
          limit: 1,
        });
        this.clickAt(x, 957);
        await sleep(1200);
        return this.requireSkillPreview(action, feeProbe, readFee);
      }
    }
    diceIn(f, roll = false, expectedRollCount = 8, actionLayout = false) {
      const inAction = roll && (actionLayout || expectedRollCount !== 8);
      const roi = inAction
        ? [320, 280, 1280, 560]
        : roll
          ? [553, 330, 819, 411]
          : [1848, 177, 38, 737];
      // BetterGI0.66.0 uses COLOR dice assets and thresholds0.73/0.7,
      // not DSTCG gray crops at0.9. Keep the two asset/mode pairs together.
      const threshold = roll ? 0.73 : 0.7;
      let items = [];
      for (const e of elements) {
        for (const r of this.matches(
          f,
          "dice/Native" + (roll ? "Roll" : "Main") + e,
          roi,
          threshold,
          true,
        )) {
          const [x, y] = mousePoint(r.x + r.w / 2, r.y + r.h / 2);
          items.push({ element: e, x, y });
        }
      }
      const fail = (reason) => {
        this.trace("dice-read", { roll, roi, threshold, color: true, items, error: reason });
        const error = new Error(reason);
        error.code = "TCG_DICE_RETRY";
        throw error;
      };
      if (!roll) {
        const groups = [];
        for (const item of items) {
          const group = groups.find((g) =>
            g.some((d) => Math.hypot(d.x - item.x, d.y - item.y) < 14),
          );
          if (group) group.push(item);
          else groups.push([item]);
        }
        items = groups.map((group) => {
          if (group.length === 1) return group[0];
          // Official0.66 compares scores across templates before suppressing
          // overlaps. FindMulti exposes positions only: bound each score via
          // six threshold probes in this slot. A fixed0.8 loses real0.783 dice.
          const localROI = [1848, Math.max(177, Math.min(...group.map((d) => d.y)) - 22), 38, 48];
          const ranked = [];
          for (const e of new Set(group.map((d) => d.element))) {
            let low = 0.7,
              high = 1,
              best = group.find((d) => d.element === e);
            for (let probe = 0; probe < 6; probe++) {
              const threshold = (low + high) / 2;
              const hits = this.matches(f, "dice/NativeMain" + e, localROI, threshold, true)
                .map((r) => {
                  const [x, y] = mousePoint(r.x + r.w / 2, r.y + r.h / 2);
                  return { element: e, x, y };
                })
                .filter((d) => group.some((g) => Math.hypot(g.x - d.x, g.y - d.y) < 14));
              if (hits.length === 1) {
                low = threshold;
                best = hits[0];
              } else high = threshold;
            }
            ranked.push({ ...best, low, high });
          }
          ranked.sort((a, b) => b.low - a.low);
          // Keep the official0.7 threshold. Margin0.03 is over six times the
          // probe interval0.0046875; near ties still cannot be classified.
          const accepted = ranked[0].low - ranked[1].high >= 0.03;
          this.trace("dice-conflict-recheck", {
            group,
            roi: localROI,
            probes: 6,
            ranked,
            minScore: 0.7,
            minMargin: 0.03,
            accepted,
          });
          if (!accepted) fail("同一骰子跨模板分数复核后仍不唯一或分差不足，停止");
          const { element, x, y } = ranked[0];
          return { element, x, y };
        });
      }
      // Reject ambiguous classifications instead of double-counting an Omni die.
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          if (Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y) < 14)
            fail("同一骰子被多模板识别，停止");
        }
      const dice = Object.fromEntries(
        elements.map((e) => [e, items.filter((d) => d.element === e).length]),
      );
      if (items.length > 16 || (roll && items.length !== expectedRollCount))
        fail("骰子识别数量异常：" + items.length);
      if (inAction) items.sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x));
      if (roll && !inAction) {
        // Counting8 alone could hide a missing slot plus a side-face duplicate.
        const slots = new Set();
        for (const die of items) {
          const col = Math.floor((die.x - roi[0]) / (roi[2] / 4));
          const row = die.y < 540 ? 0 : 1;
          if (col < 0 || col > 3 || die.y < roi[1] || die.y >= roi[1] + roi[3])
            fail("重投骰子位置超出已验证的八格布局");
          die.slot = row * 4 + col;
          if (slots.has(die.slot))
            fail("重投骰子位置重复：第 " + (die.slot + 1) + " 格；不能用重复命中凑八颗");
          slots.add(die.slot);
        }
        if (slots.size !== 8) fail("重投骰子八个位置未识别完整");
        items.sort((a, b) => a.slot - b.slot);
      }
      const key = JSON.stringify(items),
        domain = inAction ? "action-roll" : roll ? "roll" : "main";
      if (this.diceReadKeys.get(domain) !== key) {
        this.diceReadKeys.set(domain, key);
        this.trace("dice-read", { roll, roi, threshold, color: true, items, dice });
      }
      return { dice, items };
    }
    async readRollDice() {
      let previousKey = "",
        observed = null,
        lastError = "骰子尚未稳定";
      for (let attempt = 0; attempt < 12; attempt++) {
        const p = this.phase();
        if (p.phase !== "roll" && p.phase !== "unknown")
          throw new Error("稳定识别骰子前已离开投骰页");
        if (p.phase === "roll") {
          try {
            observed = this.frame((f) => this.diceIn(f, true));
            const key = JSON.stringify(observed.items.map((d) => [d.slot, d.element]));
            this.trace("roll-dice-wait", {
              attempt,
              stable: key === previousKey,
              count: observed.items.length,
            });
            if (key === previousKey) return observed;
            previousKey = key;
            lastError = "八颗骰子的分类尚未取得连续两帧一致";
          } catch (e) {
            if (e.code !== "TCG_DICE_RETRY") throw e;
            previousKey = "";
            lastError = String(e.message || e);
            this.trace("roll-dice-wait", { attempt, stable: false, error: lastError });
          }
        } else previousKey = "";
        if (attempt < 11) await sleep(500);
      }
      throw new Error("重投骰子识别12次未稳定：" + lastError);
    }
    async actionReroll(before, memory = TCG.freshMemory()) {
      const count = TCG.total(before.dice);
      if (count < 1 || count > 16) throw new Error("战中重投的真实骰数无效");
      const goal = TCG.actionRerollGoal(before, memory);
      if (!this.tossSession)
        this.tossSession = {
          sent: 0,
          expected: 2,
          selection: null,
          wanted: goal?.element || TCG.team[before.active].element,
          transitioned: false,
          previousDice: null,
          blankReady: false,
          blankSent: false,
        };
      const session = this.tossSession,
        counterROI = [700, 835, 520, 65];
      let stable = 0,
        key = "",
        lastTrace = "",
        lastError = "重投页面尚未稳定";
      for (let attempt = 0; attempt < 60; attempt++) {
        let page;
        try {
          page = this.frame((f) => {
            const phase = this.phaseIn(f);
            if (phase.phase !== "roll") return { phase };
            const text = this.ocr(f, counterROI),
              remaining = TCG.rerollCounter(text);
            const blank = remaining === null && TCG.norm(text) === "";
            return {
              phase,
              text,
              remaining,
              blank,
              blankHeader: blank
                ? TCG.norm(this.ocr(f, [844, 167, 232, 65])) === "重投骰子" &&
                  TCG.norm(this.ocr(f, [700, 230, 520, 50])) === "请选择要重投的骰子"
                : false,
              buttons: this.matches(f, "core/确定", [500, 900, 920, 150]),
              dice:
                !session.selection &&
                (remaining === session.expected ||
                  (blank && session.sent === 1) ||
                  (session.blankSent && session.sent === 2 && remaining === 1))
                  ? this.diceIn(f, true, count, true)
                  : null,
            };
          });
        } catch (e) {
          if (e.code !== "TCG_DICE_RETRY") throw e;
          lastError = e.message;
          stable = 0;
          key = "";
          await sleep(300);
          continue;
        }
        const p = page.phase;
        if (session.sent > 0 && p.phase !== "roll") session.transitioned = true;
        if (p.result || (p.phase === "board" && p.turn === "user" && session.sent >= 2)) {
          const current = JSON.stringify([p.phase, p.turn, p.result]);
          stable = current === key ? stable + 1 : 1;
          key = current;
          if (stable >= 2) {
            this.trace("action-reroll-resolved", {
              count,
              confirmations: session.sent,
              wanted: session.wanted,
            });
            this.tossSession = null;
            return { confirmations: 2, inputConfirmations: session.sent };
          }
          await sleep(300);
          continue;
        }
        const traceKey = JSON.stringify([p.phase, page.remaining, page.text, page.buttons?.length]);
        if (traceKey !== lastTrace) {
          this.trace("action-reroll-page", {
            phase: p.phase,
            remaining: page.remaining,
            text: page.text,
            expected: session.expected,
            count,
            wanted: session.wanted,
          });
          lastTrace = traceKey;
        }
        const diceKey = page.dice ? JSON.stringify(page.dice.items) : null;
        const blankOK =
          page.blank &&
          page.blankHeader &&
          session.sent === 1 &&
          (session.blankReady ||
            session.transitioned ||
            (diceKey !== null && diceKey !== session.previousDice));
        // A counterless page may be either the second selection or an interim
        // acknowledgement. Only an explicit subsequent "1" permits a third
        // button confirmation; never repeat a counterless page after sending it.
        const countedOK =
          (page.remaining === session.expected && session.sent < 2) ||
          (session.blankSent && session.sent === 2 && page.remaining === 1);
        if (
          p.phase !== "roll" ||
          !(countedOK || blankOK) ||
          page.buttons.length !== 1 ||
          session.sent >= 3
        ) {
          lastError = page.remaining === null ? "战中重投次数未识别" : "战中重投页面未就绪";
          stable = 0;
          key = "";
          await sleep(300);
          continue;
        }
        const current = JSON.stringify([page.remaining, page.buttons, page.dice?.items]);
        stable = current === key ? stable + 1 : 1;
        key = current;
        if (stable < 2) {
          await sleep(300);
          continue;
        }
        if (!session.selection) {
          const bad = page.dice.items.filter(
            (d) => d.element !== session.wanted && d.element !== "Omni",
          );
          // Persist selection BEFORE any input. A delayed OCR/control cannot
          // cause a second click to toggle the same die back off.
          session.blankReady = blankOK;
          session.selection = {
            remaining: page.remaining,
            selected: bad.length,
            diceKey,
            blank: blankOK,
          };
          for (const die of bad) {
            this.clickAt(die.x, die.y);
            await sleep(120);
          }
          stable = 0;
          key = "";
          await sleep(250);
          continue;
        }
        // Fresh same-frame phase, exact counter and unique control after dice
        // selection. Empty OCR retries read-only; no selection replay.
        const b = page.buttons[0];
        this.clickAt(b.x + b.w / 2, b.y + b.h / 2);
        session.sent++;
        session.expected = page.remaining === null ? 0 : page.remaining - 1;
        const selected = session.selection.selected;
        session.previousDice = session.selection.diceKey;
        session.blankSent ||= session.selection.blank;
        session.selection = null;
        session.blankReady = false;
        session.transitioned = false;
        this.trace("action-reroll-confirmed", {
          remaining: page.remaining,
          selected,
          count,
          wanted: session.wanted,
        });
        stable = 0;
        key = "";
        await sleep(1000);
      }
      this.trace("action-reroll-layout", { reason: lastError });
      const error = new Error("战中重投等待超时：" + lastError);
      error.code = "TCG_DICE_RETRY";
      throw error;
    }
    
    async probeSkill(action,before,memory) {
      if(action.who!==before.active)throw new Error("费用检视只能用于当前角色");
      const x={NA:1608,E:1716,Q:1824}[action.skill];
      this.clickAt(x,957);await sleep(800);await this.requireOpenedSkill(action,before,x,false,true);
      let fee=null,last=null,stable=0;
      for(let i=0;i<4;i++){
        const n=this.frame(f=>this.skillFeeIn(f,action));stable=n!==null&&n===last?stable+1:1;last=n;
        if(n!==null&&stable>=2){fee=n;break;}await sleep(180);
      }
      // A fee probe NEVER casts. Cancel, then prove unchanged real resources.
      this.boardReady=false;await this.reset();await this.requireUnchangedBoard(before);
      if(!memory.probeKeys.includes(action.key))memory.probeKeys.push(action.key);
      memory.costEvidence=fee===null?null:{source:"native-skill-preview",key:TCG.boardKey(before),
        who:action.who,skill:action.skill,n:fee};
      this.trace("skill-fee-probed",{who:action.who,skill:action.skill,fee,unchanged:true,castInputs:0});
      return {...before,confirmed:false,probed:true};
    }
    numericAt(f, roi, scale) {
      return this.memoFrame(f, "numeric/" + roi.join(",") + "/" + scale, () => {
        let crop = null,
          resized = null,
          region = null;
        try {
          crop = f.DeriveCrop(...roi);
          resized = crop.SrcMat.Resize(
            new OpenCvSharp.OpenCvSharp.Size(roi[2] * scale, roi[3] * scale),
          );
          region = new ImageRegion(resized, 0, 0);
          return this.ocr(region, [0, 0, roi[2] * scale, roi[3] * scale]);
        } finally {
          if (region) region.dispose();
          else if (resized) resized.dispose();
          if (crop) crop.dispose();
        }
      });
    }
    enlargedOcrRows(f, roi, scale) {
      return this.memoFrame(f, "enlargedRows/" + roi.join(",") + "/" + scale, () => {
        let crop = null,
          resized = null,
          region = null;
        try {
          crop = f.DeriveCrop(...roi);
          resized = crop.SrcMat.Resize(
            new OpenCvSharp.OpenCvSharp.Size(roi[2] * scale, roi[3] * scale),
          );
          region = new ImageRegion(resized, 0, 0);
          return this.ocrRows(region, [0, 0, roi[2] * scale, roi[3] * scale]).map((r) => ({
            text: r.text,
            x: roi[0] + r.x / scale,
            y: roi[1] + r.y / scale,
            w: r.w / scale,
            h: r.h / scale,
          }));
        } finally {
          if (region) region.dispose();
          else if (resized) resized.dispose();
          if (crop) crop.dispose();
        }
      });
    }
    hpAt(f, x, y) {
      // V4's detector returns no boxes for the native 58x40 HP ROIs.
      // Keep the native capture/coordinates; enlarge only the numeric crop.
      // Exact ROIs and scale were checked on the saved 17:06 native frame.
      // Recovery profile adds horizontal context, not overlapping vertical HP
      // slots. Saved-pixel 11-HP stress test: wide4=9/9, original=7/9.
      const roi = this.precisionBoard ? [x + 2, y, 56, 40] : [x + 8, y, 44, 40];
      const raw = this.numericAt(f, roi, this.precisionBoard ? 4 : 3);
      if (number(raw) !== null || !this.precisionBoard) return raw;
      // Same-frame, read-only retry with vertical context. Saved 1-HP / empty
      // regions were stress-tested; no cached-health or digit substitution.
      return this.numericAt(f, [x, y - 6, 62, 52], 4);
    }
    diceCountIn(f) {
      // Official MyDiceCountRect. A missing badge is unknown, never zero.
      const raw = this.numericAt(f, [68, 642, 25, 31], 4),
        count = number(raw);
      return count !== null && count <= 16 ? count : null;
    }
    usePrecisionBoard(reason) {
      if (this.precisionBoard) return;
      this.precisionBoard = true;
      this.trace("board-recovery", {
        reason,
        hpROI: ["x+2", "y", 56, 40],
        hpScale: 4,
        diceBadgeCrossCheck: true,
      });
    }
    releasePrecisionBoard(reason) {
      if (!this.precisionBoard) return;
      this.precisionBoard = false;
      this.trace("board-recovery-complete", { reason, nextHpScale: 3, diceBadgeCrossCheck: true });
    }
    normalHpProfileIn(f, characters, enemies) {
      // Downgrade only when the ordinary crops independently reproduce the
      // accepted HP and raised/lowered positions in this SAME native frame.
      // Read only the accepted enemy layout, not all four layout candidates.
      if (
        !Array.isArray(characters) ||
        characters.length !== 3 ||
        !Array.isArray(enemies) ||
        !enemyHpXs[enemies.length] ||
        TCG.enemyCount({ enemies }) === null
      )
        return false;
      const at = (x, raisedY, loweredY, c, raised) => {
        if (c.dead === true) return true;
        if (!TCG.alive(c) || typeof raised !== "boolean") return false;
        const a = number(this.numericAt(f, [x + 8, raisedY, 44, 40], 3)),
          b = number(this.numericAt(f, [x + 8, loweredY, 44, 40], 3));
        return raised ? a === c.hp && b === null : b === c.hp && a === null;
      };
      return (
        characters.every((c, i) => at(enemyHpXs[3][i], 600, 640, c, c.raised)) &&
        enemies.every((c, i) => at(enemyHpXs[enemies.length][i], 170, 212, c, !c.active))
      );
    }
    characterIn(f, who, enemy = false, enemyLayoutCount = 3, readAura = false) {
      const count = enemy ? enemyLayoutCount : 3;
      const hpXs = enemy ? enemyHpXs[count] : enemyHpXs[3];
      const hpX = hpXs[who];
      const rawRaised = this.hpAt(f, hpX, enemy ? 170 : 600);
      const rawLowered = this.hpAt(f, hpX, enemy ? 212 : 640);
      const raised = number(rawRaised),
        lowered = number(rawLowered);
      const stateX = hpX + 17;
      const stateY = enemy ? 105 : 545;
      const dead = this.has(f, "disable", [stateX, stateY, 167, 382], 0.9);
      // NPC/modified character cards can start above 10 (native current match
      // shows two 11-HP opponents). Do not turn every such slot into unknown.
      // This bounds a two-digit observation, not an assumed enemy max HP.
      const maxHp = enemy
        ? 99
        : TCG.team[who].maxHp +
          (this.memory?.extraMaxHp?.[who] || 0) +
          (this.selectedSoup === "maxhp" && this.currentAction?.target === who ? 1 : 0);
      const validHp = (value) => value !== null && value >= 1 && value <= maxHp;
      const raisedValid = validHp(raised),
        loweredValid = validHp(lowered);
      // Two positions containing numbers is not proof of either HP or active slot.
      const conflict = raisedValid && loweredValid;
      const hp = dead ? 0 : conflict ? null : raisedValid ? raised : loweredValid ? lowered : null;
      const key = JSON.stringify([rawRaised, rawLowered, dead, hp]);
      const slotKey = (enemy ? "enemy" + count + "/" : "own") + who;
      if (this.hpReadKeys.get(slotKey) !== key) {
        this.hpReadKeys.set(slotKey, key);
        this.trace("hp-read", {
          side: enemy ? "enemy" : "own",
          index: who,
          rois: this.precisionBoard
            ? [
                [hpX + 2, enemy ? 170 : 600, 56, 40],
                [hpX + 2, enemy ? 212 : 640, 56, 40],
              ]
            : [
                [hpX + 8, enemy ? 170 : 600, 44, 40],
                [hpX + 8, enemy ? 212 : 640, 44, 40],
              ],
          scale: this.precisionBoard ? 4 : 3,
          raw: [rawRaised, rawLowered],
          hp,
          dead,
          conflict,
        });
      }
      if (enemy) {
        // Positive aura matches only. Missing templates do NOT prove no aura.
        const aura = readAura && !dead ? this.auraIn(f, hpX, loweredValid ? 212 : 170) : [];
        const frozen=!dead&&this.has(f,"state/StateFreeze",[stateX,stateY,167,382],0.9);
        return {
          hp,
          dead: dead ? true : hp === null ? null : false,
          active: !dead && loweredValid && !conflict,
          aura,
          auraKnown: aura.length > 0 && aura.length <= 2,
          frozen: frozen?true:null,
        };
      }
      const cx = [812, 1022, 1233][who];
      const charged = this.matches(f, "charge", [cx, 612, 32, 180], 0.86).length;
      const empty = this.matches(f, "uncharge", [cx, 612, 32, 180], 0.86).length;
      const energy = charged + empty === TCG.team[who].maxEnergy ? charged : null;
      const statusROI = [stateX, stateY, 167, 382];
      const frozen =
        this.has(f, "state/StateFreeze", statusROI, 0.9) ||
        ["角色状态_冻结", "角色状态_冻结2", "角色状态_水泡"].some((name) =>
          this.has(f, "core/" + name, statusROI, 0.9),
        );
      return {
        hp,
        dead: dead ? true : hp === null ? null : false,
        energy: dead ? 0 : energy,
        frozen,
        raised: !dead && raisedValid && !conflict,
      };
    }
    enemiesIn(f) {
      // Defeated cards may remain in their slots OR disappear and recenter.
      // Every slot needs positive live HP or an explicit death-template match,
      // with exactly one lowered LIVING active card.
      // Ambiguous/partial layouts remain unknown; they never become deaths.
      const observations = [],
        candidates = [];
      // These four native layouts already have calibrated HP geometry. Do not
      // silently crop a four-opponent mode to the configured default of three.
      for (let count = 1; count <= 4; count++) {
        const cards = Array.from({ length: count }, (_, i) =>
          this.characterIn(f, i, true, count, false),
        );
        const row = { count, cards, xs: enemyHpXs[count] };
        observations.push(row);
        if (
          cards.every((c) => TCG.alive(c) || (c.dead === true && c.hp === 0 && !c.active)) &&
          cards.filter((c) => TCG.alive(c) && c.active).length === 1
        )
          candidates.push(row);
      }
      // Placeholder shape is not an observed enemy count or strategy setting.
      const unknown = () =>
        Array.from({ length: 3 }, () => ({ hp: null, dead: null, active: null }));
      if (!candidates.length) return unknown();
      const best = candidates.sort((a, b) => b.count - a.count)[0];
      // Three vs one and four vs two overlap at inner HP positions. Accept a
      // smaller candidate only as the EXACT same subset, not a second team.
      for (const row of candidates.slice(1))
        for (let i = 0; i < row.count; i++) {
          const j = best.xs.findIndex((x) => Math.abs(x - row.xs[i]) <= 12);
          if (
            j < 0 ||
            row.cards[i].hp !== best.cards[j].hp ||
            row.cards[i].dead !== best.cards[j].dead ||
            row.cards[i].active !== best.cards[j].active
          )
            return unknown();
        }
      // A temporarily unreadable outer card must not shrink a 4-card team to
      // its readable middle pair (or a 3-card team to its middle card).
      for (const row of observations.filter((r) => r.count > best.count))
        if (
          row.cards.some(
            (c, i) =>
              (TCG.alive(c) || c.dead === true) &&
              !best.xs.some((x) => Math.abs(x - row.xs[i]) <= 12),
          )
        )
          return unknown();
      return best.cards.map((c, i) => {
        const aura = c.dead === true ? [] : this.auraIn(f, best.xs[i], c.active ? 212 : 170);
        return { ...c, aura, auraKnown: aura.length > 0 && aura.length <= 2 };
      });
    }
    auraIn(f, hpX, hpY) {
      // Only the strip above this card, not its artwork/statuses. Official
      // 15px glyphs score 0.824 on the saved Hydro frame; 0.9 rejected it.
      const roi = [hpX + 60, hpY - 70, 95, 62],
        hits = [];
      for (const element of ["Cryo", "Hydro", "Pyro", "Electro", "Dendro"])
        for (const r of this.matches(f, "state/State" + element, roi, 0.8, true))
          hits.push({ ...r, element });
      if (
        hits.some((a, i) =>
          hits
            .slice(i + 1)
            .some((b) => a.element !== b.element && Math.hypot(a.x - b.x, a.y - b.y) < 15),
        )
      )
        return [];
      const aura = [...new Set(hits.map((h) => h.element))];
      return aura.length <= 2 ? aura : [];
    }
    
    board(actionOnly = false, pickTransition = false) {
      return this.frame(f => {
        const phase = this.phaseIn(f);
        // A terminal screen has no character/dice/hand UI. Do not run board
        // readers first and discover the result only after they have failed.
        if (phase.result) return { ...phase, hand: null };
        if(pickTransition && !["pick","board"].includes(phase.phase))return {...phase,hand:null};
        if(actionOnly && (phase.phase!=="board" || phase.turn!=="user"))return {...phase,hand:null};
        const characters = [0, 1, 2].map(i => this.characterIn(f, i));
        const actives = characters.map((c, i) => c.raised && !c.dead ? i : -1).filter(i => i >= 0);
        const dice = this.diceIn(f);
        const badgeCount=phase.phase==="board" && phase.turn==="user" ? this.diceCountIn(f) : null;
        if(badgeCount!==null && badgeCount!==TCG.total(dice.dice)) {
          this.trace("dice-count-mismatch",{badgeCount,templateCount:TCG.total(dice.dice),dice:dice.dice});
          const error=new Error("实际骰数徽标与元素模板不一致");
          error.code="TCG_DICE_RETRY";throw error;
        }
        const enemies=this.enemiesIn(f);
        const normalHpReadable=this.precisionBoard ? this.normalHpProfileIn(f,characters,enemies) : true;
        return { ...phase, normalHpReadable, pickSelection:phase.phase==="pick"?this.pickSelectionIn(f):null, characters, active: actives.length === 1 ? actives[0] : null,
          enemies, ...this.boardExtrasIn(f,phase),
          // Observation truth is independent of the predicted action budget.
          dice: dice.dice, diceKnown: phase.phase === "board" && (TCG.total(dice.dice) > 0 || badgeCount === 0),
          diceObservation: { badge: badgeCount, templates: TCG.total(dice.dice) }, hand: null };
      });
    }
    observationIssues(state) {
      const issues = [];
      if (state.phase !== "board") issues.push("phase");
      if (state.turn !== "user") issues.push("turn");
      if (state.diceKnown !== true) issues.push("dice");
      if (!Number.isInteger(state.active) || !TCG.alive(state.characters?.[state.active])) issues.push("active");
      if (!Array.isArray(state.characters) || state.characters.length !== 3) issues.push("own");
      else state.characters.forEach((c, i) => {
        if (c?.dead === true) return;
        if (!TCG.alive(c)) issues.push(`own[${i}].hp`);
        if (!Number.isInteger(c?.energy) || c.energy < 0 || c.energy > TCG.team[i].maxEnergy) issues.push(`own[${i}].energy`);
        if (typeof c?.frozen !== "boolean") issues.push(`own[${i}].status`);
      });
      if (TCG.enemyCount(state) === null) issues.push("enemy");
      if (!issues.length && !TCG.legalState({ ...state, hand: [] })) issues.push("board-rules");
      return issues;
    }
    finishObservation(state, pendingAction, handRead, observedAt = Date.now()) {
      if (!TCG.legalState(state) || TCG.enemyCount(state) === null) {
        const error = new Error("完整观察仍有未知字段：" + this.observationIssues(state).join("、"));
        error.code = "TCG_BOARD_RETRY"; throw error;
      }
      let resynchronized = false;
      if (!pendingAction) {
        if (!this.diceBudgetMatches(state)) {
          this.trace("state-resync", { reason: "observation-budget", expectedDice: this.expectedDice, observedDice: TCG.total(state.dice) });
          this.adoptObservedState(state, "observation-resync"); resynchronized = true;
          this.trace("state-resynced", { reason: "observation-budget", after: state });
        }
        if (!resynchronized) this.acceptHand(state.hand, "observed-stable-board");
      }
      this.boardReady = true; this.lastObservedState = state; this.lastObservedAt = observedAt;
      this.lastObservedRevision = this.inputRevision;
      return { ...state, handRead, ...(resynchronized ? { resynchronized: true } : {}) };
    }
    async observedResourceProof(state) {
      if (!TCG.legalState(state) || this.autoRisk || this.handNeedsReset || this.handFanReady) return null;
      const revision = this.inputRevision, count = TCG.total(state.dice);
      for (let attempt = 0; attempt < 2; attempt++) {
        let sample;
        try { sample = this.frame(f => {
          const phase = this.phaseIn(f);
          if (phase.phase !== "board" || phase.turn !== "user") return phase;
          return { ...phase, dice: this.diceIn(f).dice, badge: this.diceCountIn(f) };
        }); } catch (e) { if (e.code === "TCG_DICE_RETRY") return null; throw e; }
        if (sample.phase !== "board" || sample.turn !== "user" || sample.badge !== count ||
            !TCG.diceOrder.every(e => (sample.dice?.[e] || 0) === (state.dice[e] || 0)) ||
            TCG.total(sample.dice) !== count || this.inputRevision !== revision) return null;
        if (attempt === 0) await sleep(120);
      }
      const proof = { kind: "two-fresh-element-and-count-frames", count, stableReads: 2, revision };
      this.trace("resource-native-proof", { ...proof, expectedDice: this.expectedDice, attributedEffect: null });
      return proof;
    }
    
    async reset() {
      if (this.boardReady && !this.handNeedsReset && !this.handFanReady) {
        this.trace("hand-reset-skipped", { reason: "already-clean-board" });
        return;
      }
      this.handFanReady = false;
      this.clickAt(1190, 545);
      this.moveTo(1555, 545);
      await sleep(300);
      this.handNeedsReset = false;
      this.boardReady = true;
      this.trace("hand-reset", {});
    }
    async expand(resetFirst = true) {
      // The native control is a toggle. Card selection does not close the fan;
      // never click that control again while the same layout remains ready.
      if (this.handFanReady) {
        this.trace("hand-expand-skipped", { reason: "fan-already-ready" });
        return;
      }
      if (resetFirst && !this.boardReady) await this.reset();
      this.clickAt(967, 1041);
      await sleep(600);
      this.moveTo(1791, 917);
      await sleep(100);
      this.handFanReady = true;
      this.handNeedsReset = true;
      this.trace("hand-expanded", { resetFirst });
    }
    requireHandObservation(phase = this.phase(), stage = "hand") {
      // Details may legitimately hide the turn icon (unknown). Only positive
      // phase evidence interrupts observation; unreadable titles on a stable
      // board remain genuine errors, never converted into a fabricated win.
      if (
        phase.result ||
        ["pick", "roll", "settlement", "transition", "choice", "automatic"].includes(phase.phase) ||
        phase.turn === "enemy"
      ) {
        this.handFanReady = false;
        const error = new Error("读牌期间页面变化：" + phase.phase + "/" + phase.turn);
        error.code = "TCG_OBSERVATION_INTERRUPTED";
        error.phase = { ...phase, hand: null };
        this.trace("hand-phase-interrupted", { stage, ...phase });
        throw error;
      }
    }
    titleIn(f, roi, kind = "card", names = null) {
      const native = this.ocr(f, roi);
      const identify = text => names ? names.some(name => TCG.norm(name) === TCG.norm(text)) :
        kind === "character" ? TCG.characterName(text) >= 0 : !!TCG.identify(text);
      const card = kind === "card" ? TCG.identify(native) : null;
      if (card && TCG.norm(native) !== TCG.norm(card.name)) {
        this.trace("title-exact-alias", { native, canonical:card.name, id:card.id, additionalInputs:0 });
        return card.name;
      }
      if (identify(native) || !native) return native;
      const enlarged = this.numericAt(f, roi, 3);
      if (identify(enlarged)) {
        this.trace("title-pixel-recovery", { roi, kind, native, enlarged, scale:3, additionalInputs:0 });
        return enlarged;
      }
      const key = "unknown-title:" + TCG.norm(native);
      if (kind !== "character" && !this.diagnosticKeys.has(key)) {
        this.diagnosticKeys.add(key);
        this.trace("unresolved-title", { kind, roi, native, enlarged });
      }
      return native;
    }
    async inspectHandCard(action, x) {
      const raw = await this.titleAt(x, 945, false, false, "card", null, true);
      if (!raw) {
        // No title is not a conflicting identity. No action was submitted;
        // restore the view and retry this slot through the state owner.
        this.requireHandObservation(this.phase(), "missing-input-title");
        await this.reset();
        const error = new Error("目标手牌标题暂未读到，保留身份后重试目标槽");
        error.code = "TCG_STATE_REFRESH";
        throw error;
      }
      if (TCG.observedCard(raw, action.index)?.id !== action.id)
        await this.refreshHandBeforeInput("目标手牌卡名校验失败，重新核对手牌");
    }
    takePreparedHandInput(action, before) {
      const prepared = this.preparedHandInput;
      this.preparedHandInput = null;
      const inspecting = action.type === "probe" && action.scope === "card";
      if (!prepared || !(inspecting || action.type === "card" || action.type === "tune") ||
          !inspecting && (prepared.id !== action.id || prepared.index !== action.index) ||
          prepared.revision !== this.inputRevision || Date.now() - prepared.at > 5000 ||
          prepared.beforeKey !== TCG.boardKey(before)) return null;
      const count = this.frame(f => {
        this.requireHandObservation(this.phaseIn(f), "after-card-inspection");
        return this.nativeHandCountIn(f);
      });
      if (count !== null && count !== before.hand.length) return null;
      this.trace("hand-input-inspection-reused", { id:action.id, index:action.index,
        viewOnly:inspecting, additionalInputs:0 });
      return inspecting ? { ...prepared, viewOnly:true } : prepared;
    }
    async titleAt(
      x,
      y,
      opening = false,
      hover = false,
      kind = "card",
      expected = null,
      watchPhase = false,
    ) {
      if (watchPhase) this.requireHandObservation(this.phase(), "before-title-input");
      if (!opening && kind === "card") this.selectedCostProof = this.handPositionProof;
      if (hover) this.moveTo(x, y);
      else this.clickAt(x, y);
      // Official DSTCG getHandMsg clicks consecutive titles on one raised fan.
      // A hand-card click is not evidence of collapse. An empty/unstable title
      // leaves layout unknown and is normalized before any further toggle.
      if (!hover && !opening) this.handNeedsReset = true;
      if (!hover && (opening || kind === "character")) this.handFanReady = false;
      await sleep(350);
      const roi = opening ? [58, 112, 339, 53] : [311, 115, 341, 50];
      const reads = [];
      let previousKey = "",
        lastStable = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        const raw = this.frame((f) => {
          if (watchPhase) this.requireHandObservation(this.phaseIn(f), "title-sampling");
          const title = this.titleIn(f, roi, kind);
          // Use the already captured stable title frame for optional deck facts.
          // Normal decks have no facts reader and perform no additional OCR.
          if (!opening && kind === "card" && previousKey === "title:" + TCG.norm(title)) {
            const card = TCG.identify(title);
            if (card) this.readSelectedCardFacts?.(f, card, x);
          }
          return title;
        });
        reads.push(raw);
        const who = kind === "character" ? TCG.characterName(raw) : -1;
        const key = raw ? (who >= 0 ? "character:" + who : "title:" + TCG.norm(raw)) : "";
        const stable = !!key && key === previousKey;
        lastStable = stable ? raw : "";
        const matchesExpected = kind !== "character" || expected === null || who === expected;
        if (stable && matchesExpected) {
          this.trace("title-read", {
            point: [x, y],
            roi,
            kind,
            expected,
            reads,
            stable: true,
            matchesExpected: true,
          });
          return raw;
        }
        previousKey = key;
        if (attempt < 5) await sleep(150);
      }
      this.trace("title-read", {
        point: [x, y],
        roi,
        kind,
        expected,
        reads,
        stable: !!lastStable,
        matchesExpected: false,
      });
      if (!hover && !opening) this.handFanReady = false;
      // A stable wrong character remains wrong; preserve its raw title for the error.
      return kind === "character" ? lastStable : "";
    }
    invalidateHand(reason) {
      if (this.handCache !== null)
        this.trace("hand-cache-invalidated", { reason, count: this.handCache.length });
      this.handCache = null;
      this.handCountHint = null;
      this.handPositionProof = null;
      if (this.confirmationSession) this.confirmationSession.handObservation = null;
    }
    acceptHand(hand, reason) {
      this.handCache = TCG.indexedHand(hand);
      this.trace("hand-cache-updated", { reason, count: this.handCache.length });
    }
    handCostMarkersIn(f, roi) {
      return ["hand_cost_neutral", "hand_cost_element", "hand_cost_dendro", "hand_cost_electro", "hand_cost_matching"]
        .flatMap(asset => this.matches(f, asset, roi, .9, false));
    }
    handCostLayoutIn(f, nativeCount = null) {
      return this.memoFrame(f, "costLayout:" + nativeCount, () => {
        const measured = nativeCount ?? (this.handFanReady ? this.memoFrame(f, "hand/rim-count", () =>
          handLayoutCount(this.matches(f, "hand_rim", [500, 900, 1260, 135], 0.85, false).map(r => r.x))) : null);
        return costMarkerLayout(this.handCostMarkersIn(f, [450, 750, 1310, 200]), measured);
      });
    }
    handPriceIn(f, marker) {
      const cost = number(this.numericAt(f, [Math.round(marker.x + 12), Math.round(marker.y - 5), 36, 42], 4));
      return cost !== null ? { cost, reads: 1 } : {
        cost: number(this.numericAt(f, [Math.round(marker.x), Math.round(marker.y - 30), 60, 90], 4)), reads: 2,
      };
    }
    costHandIn(f, nativeCount = null) {
      return this.memoFrame(f, "costHand:" + nativeCount, () => {
        const roi = [450, 750, 1310, 200];
        const matches = this.handCostMarkersIn(f, roi), layout = this.handCostLayoutIn(f, nativeCount);
        const unresolved = (reason, detail = {}) => {
          const key = "hand-cost-unresolved:" + reason;
          if (!this.diagnosticKeys.has(key)) {
            this.diagnosticKeys.add(key);
            this.trace("hand-cost-unresolved", { reason, matches, layout, nativeCount, ...detail });
          }
          return null;
        };
        if (!layout) return unresolved("geometry");
        const yy = Math.floor(
          Math.max(750, Math.min(840, Math.min(...layout.markers.map((m) => m.y)) - 40)),
        );
        const numbers = costDigitRows(this.enlargedOcrRows(f, [470, yy, 1290, 110], 3));
        let localRecoveryCalls = 0;
        for (const m of layout.markers) {
          const found = costNumbersAt(m, numbers);
          if (found.length > 1) { unresolved("ambiguous-digit", { marker: m, numbers }); continue; }
          if (found.length === 1 && found[0].value < 10) continue;
          if (found.length === 1) {
            // Whole-row OCR can concatenate neighbouring strokes (native 1→11).
            // Verify only this digit in its tight crop; legal two-digit prices
            // are retained, never clamped to the printed card cost.
            numbers.splice(numbers.indexOf(found[0]),1);
            const value=number(this.numericAt(f,[Math.round(m.x+12),Math.round(m.y-5),36,42],4));
            localRecoveryCalls++;
            if(value!==null)numbers.push({...found[0],value});
            continue;
          }
          // The tight crop also reads zeroes that a broad OCR row drops.
          // Use the same numeric ROI as selected/folded prices before wider rows.
          const digit=number(this.numericAt(f,[Math.round(m.x+12),Math.round(m.y-5),36,42],4));
          localRecoveryCalls++;
          if(digit!==null){numbers.push({value:digit,x:m.x+28,y:m.y+15});continue;}
          // Only missing locations: at most three wider crops on the SAME frame.
          // No clicks, title expansion, guessed values, or unbounded ROI search.
          let recovered = false;
          for (const [dx, dy, w, h] of [
            [0, -30, 60, 90],
            [8, -18, 44, 68],
            [-4, -30, 68, 90],
          ]) {
            const local = costNumbersAt(
              m,
              costDigitRows(
                this.enlargedOcrRows(f, [Math.floor(m.x + dx), Math.floor(m.y + dy), w, h], 4),
              ),
            );
            localRecoveryCalls++;
            if (local.length > 1) {
              numbers.push(...local);
              unresolved("ambiguous-digit", { marker: m, numbers, local });
              recovered = true;
              break;
            }
            if (local.length === 1) {
              numbers.push(local[0]);
              recovered = true;
              break;
            }
          }
          if (!recovered)
            unresolved("missing-digit", { marker: m, numbers, localRecoveryCalls });
        }
        const sample = costHandSample(layout, numbers);
        return { ...sample, localRecoveryCalls };
      });
    }
    selectedCardCostIn(f, x) {
      const roi = [Math.round(x - 125), 750, 80, 140];
      const marks = this.handCostMarkersIn(f, roi)
        .filter(m => Math.abs(m.x + 103 - x) <= 32).sort((a,b) => a.y - b.y);
      if (!marks.length) return null;
      const m = marks[0];
      const read = this.handPriceIn(f, m);
      let cost = read.cost;
      if (read.reads > 1) {
        this.trace("selected-cost-retry", { point:x, cost, additionalInputs:0 });
      }
      if (cost === null) {
        const p = this.selectedCostProof, age = p ? Date.now() - p.at : Infinity;
        const index = p ? p.points.indexOf(x) : -1;
        if (p && this.inputRevision === p.revision + 1 && age >= 0 && age <= 5000 && TCG.known(p.costs[index])) {
          cost = p.costs[index];
          this.trace("selected-cost-reused", { index, cost, proof:"two-native-cost-frames-before-selection", additionalInputs:0 });
        }
      }
      if (cost === null) this.trace("selected-cost-unread", { point:x, marker:m });
      return cost;
    }
    handSample(f, priceIndex = null) {
      this.lastCostSample = null;
      const count = this.handCountIn(f);
      let cost = this.lastCostSample;
      // Quantity/positions need corners, not every digit. Only the impending
      // target gets a price proof on these same preselection frames.
      if (count > 0 && this.handFanReady) {
        const layout = this.handCostLayoutIn(f, count);
        if (layout) {
          cost = { ...costHandSample(layout, []), revision: this.inputRevision, at: Date.now() };
          if (priceIndex !== null && priceIndex < count)
            cost.costs[priceIndex] = this.handPriceIn(f, layout.markers[priceIndex]).cost;
        }
      }
      return { count, cost, source: this.lastHandCountSource };
    }
    foldedHandCostsIn(f, layout) {
      // The same native digits (including green prices), on an already bound
      // folded row. A missing price does not invalidate any card identity.
      const numbers=costDigitRows(this.enlargedOcrRows(f,[430,965,1050,70],3));
      const costs=layout.slots.map(({marker})=>{
        const found=costNumbersAt(marker,numbers);
        if(found.length===1&&found[0].value<10)return found[0].value;
        if(found.length>1)return null;
        return number(this.numericAt(f,[marker.x+12,marker.y-5,36,42],4));
      });
      return {costs,source:"native-folded-cost-markers"};
    }
    publishHandPositions(samples, count) {
      this.handPositionProof = null;
      if (samples.length < 2 || !this.handFanReady) return;
      const [a, b] = samples.slice(-2),
        p = a.cost,
        q = b.cost;
      if (
        !p ||
        !q ||
        a.count !== count ||
        b.count !== count ||
        p.count !== count ||
        q.count !== count ||
        p.revision !== this.inputRevision ||
        q.revision !== this.inputRevision ||
        p.points.length !== count ||
        q.points.length !== count ||
        p.costs.length !== count ||
        q.costs.length !== count ||
        p.markerYs.length !== count ||
        q.markerYs.length !== count ||
        [p, q].some(
          (s) => !Number.isFinite(s.at) || Date.now() - s.at < 0 || Date.now() - s.at > 5000,
        ) ||
        p.points.some(
          (x, i) =>
            !Number.isFinite(x) || !Number.isFinite(q.points[i]) || Math.abs(x - q.points[i]) > 8,
        ) ||
        p.markerYs.some(
          (y, i) =>
            !Number.isFinite(y) ||
            !Number.isFinite(q.markerYs[i]) ||
            Math.abs(y - q.markerYs[i]) > 8,
        )
      )
        return;
      this.handPositionProof = {
        count,
        points: q.points.slice(),
        costs: q.costs.map((cost, i) => cost === p.costs[i] ? cost : null),
        revision: this.inputRevision,
        at: q.at,
      };
      this.trace(this.handPositionProof.costs.some(TCG.known)?"hand-cost-proof":"hand-position-proof", {
        count,
        points: q.points,
        costs: this.handPositionProof.costs,
        stableReads: 2,
        localRecoveryCalls: q.localRecoveryCalls,
        additionalInputs: 0,
      });
    }
    handPoints(count) {
      const p = this.handPositionProof,
        age = p ? Date.now() - p.at : Infinity;
      return p &&
        p.count === count &&
        p.revision === this.inputRevision &&
        age >= 0 &&
        age <= 5000 &&
        this.handFanReady
        ? p.points.slice()
        : (handX[count] || []).slice();
    }
    handCountIn(f) {
      this.lastCostSample = null;
      this.lastHandCountSource = null;
      const counts = [];
      for (let n = 5; n <= 10; n++)
        if (this.has(f, "num/Hand" + n, [1463, 700, 439, 124], 0.92)) counts.push(n);
      if (counts.length > 1) {
        const error = new Error("手牌数量模板相互冲突：" + JSON.stringify(counts));
        error.code = "TCG_HAND_RETRY";
        throw error;
      }
      if (counts.length === 1) {
        this.lastHandCountSource = "native-badge";
        return counts[0];
      }
      const n = number(this.ocr(f, [1730, 700, 170, 124]));
      if (n !== null && n <= 10) {
        this.lastHandCountSource = "native-badge";
        return n;
      }
      if (!this.handFanReady) return null;
      const layout = this.handCostLayoutIn(f);
      if (layout) {
        // An unbound row still checks outer numeric evidence. No per-slot
        // digit recovery is needed just to establish quantity/positions.
        const y=Math.floor(Math.max(750,Math.min(840,Math.min(...layout.markers.map(m=>m.y))-40))),
          numbers=layout.measuredCount===null?costDigitRows(this.enlargedOcrRows(f,[470,y,1290,110],3)):[],
          sample=costHandSample(layout,numbers);
        if(sample){
          this.lastHandCountSource = "full-cost-layout";
          this.lastCostSample = { ...sample, revision: this.inputRevision, at: Date.now() };
          return layout.count;
        }
      }
      // Grayscale rim gradient: usable-card gold glow must not change count.
      const rimCount = this.memoFrame(f, "hand/rim-count", () => handLayoutCount(
        this.matches(f, "hand_rim", [500, 900, 1260, 135], 0.85, false).map((r) => r.x),
      ));
      if (rimCount !== null) this.lastHandCountSource = "full-rim-layout";
      return rimCount;
    }
    recordHandLayout(count) {
      const key = "hand-layout:" + count;
      if (count >= 1 && count <= 4 && !this.diagnosticKeys.has(key)) {
        this.trace("hand-layout", { count });
        this.diagnosticKeys.add(key);
      }
    }
    async handCount(expected = null) {
      this.requireHandObservation(this.phase(), "before-hand-expand");
      if (!this.handFanReady) await this.expand();
      const readCount = () =>
        this.frame((f) => {
          // The fan's count badge is transient. Collect consecutive read-only
          // count frames quickly; full phase OCR between them can outlive it.
          // A fresh phase guard follows the bounded sampling BEFORE any input.
          return this.handSample(f);
        });
      const reads = [],
        samples = [];
      let previous = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const sample = readCount(),
          result =
            Number.isInteger(sample.count) && sample.count >= 0 && sample.count <= 10
              ? sample.count
              : null;
        reads.push(result);
        samples.push(sample);
        if (result !== null && result === previous) {
          this.requireHandObservation(this.phase(), "hand-count-resolved");
          this.publishHandPositions(samples, result);
          if (this.emptyHandProven && result > 0) {
            this.emptyHandProven = false;
            this.invalidateHand("visible-cards-after-empty-hand");
          }
          this.trace("hand-count", { count: result, reads });
          this.recordHandLayout(result);
          return result;
        }
        previous = result;
        // Recycle/discount and drawn-card animations can outlast the transient
        // badge. Keep the same raised fan and wait read-only, rather than
        // immediately toggling it. The normal two-clean-frame path is unchanged.
        if (attempt < 7) await sleep(attempt < 3 ? 120 : 300);
      }
      this.requireHandObservation(this.phase(), "hand-count-unresolved");
      const knownCounts = [...new Set(reads.filter((n) => n !== null))];
      if (knownCounts.length > 0) {
        const error = new Error(
          (knownCounts.length > 1 ? "手牌计数复读不稳定：" : "手牌计数未得到连续证据：") +
            JSON.stringify(reads),
        );
        error.code = "TCG_HAND_RETRY";
        throw error;
      }
      // Missing badge/rim evidence is never a guessed zero or a reason to
      // click candidate positions. Retry read-only on the same raised fan.
      if (this.emptyHandProven) return 0;
      const error = new Error("无法确认手牌数量");
      error.code = "TCG_HAND_RETRY";
      throw error;
    }
    async readHandTitles(cards, points, scan = { titles: 0 }) {
      for (let i = 0; i < cards.length; i++) if (!cards[i]) {
        scan.titles++;
        const raw = await this.titleAt(points[i], 945, false, false, "card", null, true);
        const card = TCG.observedCard(raw, i);
        if (!card || scan.titleCandidates?.[i] && !scan.titleCandidates[i].includes(card.id)) {
          const error = new Error("第 " + (i + 1) + " 张手牌卡名无法可靠读取：" + (raw || "OCR为空"));
          error.code = "TCG_HAND_RETRY";
          throw error;
        }
        cards[i] = card;
      }
    }
    async readHand(expected = this.handCountHint, evidence = null, scan = { titles: 0 }) {
      // Evidence passed here was obtained in this very observation, not an
      // estimated count or the previous action's projected hand.
      const n = evidence ? evidence.count : await this.handCount(expected);
      // This scratch list belongs to one observe() call: no submitted action,
      // phase transition or next round can inherit it. A changed native count
      // replaces it; a failed title alone does not erase successful slots.
      if (scan.cards && scan.cards.length !== n) scan.titleCandidates = null;
      const hand = scan.cards?.length === n ? scan.cards : Array(n).fill(null);
      scan.cards = hand;
      // Establish the expanded fan once. Selecting a card only raises that
      // card; it does not require resetting/re-expanding the whole hand.
      if (n > 0 && !this.handFanReady) {
        this.requireHandObservation(this.phase(), "before-scan-expand");
        await this.expand();
      }
      this.handScanSerial++;
      // Copy all positions before the first title click invalidates the proof.
      // Selection raises one card but does not reorder the rest of this fan.
      const points = this.handPoints(n);
      await this.prepareHandObservation?.(n);
      this.trace("hand-scan", { count: n, expected, reusedCount: !!evidence });
      await this.fillHandArtwork?.(hand, scan);
      await this.readHandTitles(hand, points, scan);
      const observed = this.finishHandObservation ? this.finishHandObservation(hand, scan) : hand;
      this.requireHandObservation(this.phase(), "before-hand-reset");
      await this.reset();
      this.handCountHint = null;
      return observed;
    }
    async observedHand(plan = null, scan = { titles: 0 }) {
      if (plan?.mode === "full") {
        const session = this.confirmationSession,
          observed = session?.handObservation;
        if (observed && observed.revision === this.inputRevision) {
          session.handObservation = null;
          const count = this.frame(f => {
            this.requireHandObservation(this.phaseIn(f), "before-pending-hand-reuse");
            return this.handCountIn(f);
          });
          if (count === null || count === observed.hand.length) {
            session.handObservation = observed;
            this.trace("hand-full-read-reused", { count: observed.hand.length, visibleCount: count,
              proof: "completed-native-read-in-same-pending-action", additionalInputs: 0 });
            return TCG.indexedHand(observed.hand);
          }
        }
        scan.retainedHand = plan.retainedHand;
        scan.retainedVariantFamilies = plan.retainedVariantFamilies;
        scan.settling = true;
        this.invalidateHand("generated-drawn-or-replaced-card");
        const hand = await this.readHand(plan.expectedCount ?? null, null, scan);
        if (session) session.handObservation = { hand: TCG.indexedHand(hand), revision: this.inputRevision };
        return hand;
      }
      if (plan?.mode === "remove") {
        const proof = plan.preResetEvidence,
          receipt = this.consumptionReceipt;
        const age = proof ? Date.now() - proof.at : Infinity;
        if (
          proof &&
          receipt?.inputSent &&
          plan.action?.type === "card" &&
          proof.beforeKey === TCG.boardKey(plan.before) &&
          proof.id === plan.action.id &&
          proof.index === plan.action.index &&
          proof.target === (plan.action.target ?? null) &&
          proof.beforeKey === receipt.beforeKey &&
          proof.id === receipt.id &&
          proof.index === receipt.index &&
          proof.target === receipt.target &&
          proof.count === plan.hand.length &&
          proof.stableReads >= 2 &&
          proof.revision === this.inputRevision &&
          age >= 0 &&
          age <= 5000 &&
          !this.handFanReady &&
          !this.handNeedsReset
        ) {
          const count = this.frame((f) => this.handCountIn(f));
          if (count === null || count === proof.count) {
            this.trace("hand-incremental", {
              mode: "remove",
              count: proof.count,
              proof: "two-native-counts-before-single-reset",
            });
            return TCG.indexedHand(plan.hand);
          }
          this.invalidateHand("unexpected-count-after-pre-reset-proof");
          return await this.readHand(null, null, scan);
        }
        if (plan.effectProven || plan.paidProven) {
          // The settled board proves consumption independently. A visible count
          // disagreement still forces a real scan; unreadable badge is not zero.
          const count = this.frame(f => this.handCountIn(f));
          if (count === null || count === plan.hand.length) {
            this.trace("hand-incremental", { mode:"remove", count:plan.hand.length,
              proof:plan.paidProven?"confirmed-paid-card-two-stable-boards":"independent-native-effect", visibleCount:count });
            return TCG.indexedHand(plan.hand);
          }
          this.emptyHandProven = false;
          this.invalidateHand("unexpected-post-effect-count");
          return await this.readHand(null, null, scan);
        }
        // Publishing the projected list requires native count evidence first.
        // The independent resource/HP/energy effect is still checked by confirm.
        if (plan.hand.length === 0 && this.emptyHandProven) {
          this.trace("hand-incremental", { mode:"remove", count:0, proof:"independent-empty-hand-effect" });
          return TCG.indexedHand(plan.hand);
        }
        const n = await this.handCount(plan.hand.length);
        if (n === plan.hand.length) {
          this.requireHandObservation(this.phase(), "before-incremental-reset");
          await this.reset();
          this.trace("hand-incremental", { mode:"remove", count:n, proof:"native-count" });
          return TCG.indexedHand(plan.hand);
        }
        this.invalidateHand("unexpected-post-action-count");
        return await this.readHand(null,{count:n},scan);
      }
      const cached = plan?.mode === "unchanged" ? plan.hand : this.handCache;
      if (cached !== null && cached !== undefined) {
        // Read-only anomaly detector, not a proof that a missing badge is zero.
        // All real card/tune inputs check visible anomalies and exact target title.
        const count = this.frame(f => this.handCountIn(f));
        if (count === null || count === cached.length) {
          this.trace("hand-cache-reused", { count:cached.length, mode:plan?.mode || "cached", visibleCount:count });
          return TCG.indexedHand(cached);
        }
        this.invalidateHand("unexpected-visible-count");
      }
      return await this.readHand(null, null, scan);
    }
    async settledBoard(_pendingAction = false, firstBoard = null) {
      // A failed hand read or completed choice can leave cards/details raised.
      // Normalize at the full-board boundary, never OCR obscured HP in a loop.
      if (this.handFanReady || this.handNeedsReset) {
        const phase = this.phase();
        if (phase.phase !== "board" || phase.turn !== "user") return { ...phase, hand: null };
        await this.reset();
        firstBoard = null;
      }
      this.prepareBoardObservation?.();
      let previous = "", stableReads = 0, stableSince = 0, hpGapReads = 0, previousNormalHp = false;
      let last = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        try { last = attempt === 0 && firstBoard ? firstBoard : this.board(true); }
        catch (e) {
          if (e.code !== "TCG_DICE_RETRY") throw e;
          previous = ""; stableReads = 0; hpGapReads = 0; previousNormalHp = false;
          this.trace("board-settle-wait", { attempt, missing: ["dice"], reason: e.message });
          if (attempt < 11) await sleep(400);
          continue;
        }
        if (last.result || ["pick", "roll", "settlement", "choice"].includes(last.phase) || last.turn === "enemy") {
          this.releasePrecisionBoard("scene-exit");
          return { ...last, hand: null };
        }
        const issues = this.observationIssues(last);
        const hpGap = last.phase === "board" && last.turn === "user" &&
          [...(last.characters || []), ...(last.enemies || [])].some(c => c?.dead !== true && !TCG.alive(c));
        hpGapReads = hpGap ? hpGapReads + 1 : 0;
        if (hpGapReads === 1 && await this.dismissCharacterOverview("board-hp-gap")) {
          previous = ""; stableReads = 0; hpGapReads = 0; previousNormalHp = false;
          continue;
        }
        const key = JSON.stringify([last.phase, last.turn, last.active, last.characters, last.dice,
          last.enemies, last.quicken || null, last.supportCounts || null,last.eye||null,last.dendroCore||null]);
        if (!issues.length) {
          if (key === previous) stableReads++;
          else { stableReads = 1; stableSince = Date.now(); }
          if (stableReads >= (this.autoRisk ? 4 : 2) && (!this.autoRisk || Date.now() - stableSince >= 1200)) {
            if (this.autoRisk) this.trace("automatic-settled", { active: last.active, proof: "quiet-native-board-not-status-ocr" });
            this.autoRisk = false;
            if (previousNormalHp && last.normalHpReadable === true) this.releasePrecisionBoard("two-stable-normal-hp-profiles");
            return { ...last, nativeStability: { reads: stableReads, key: TCG.boardKey({ ...last, hand: [] }), inputRevision: this.inputRevision } };
          }
        } else stableReads = 0;
        previous = issues.length ? "" : key;
        previousNormalHp = !issues.length && last.normalHpReadable === true;
        this.trace("board-settle-wait", { attempt, phase: last.phase, turn: last.turn,
          valid: issues.length === 0, missing: issues, hpGapReads });
        if (hpGapReads === 3 && !this.precisionBoard) {
          this.usePrecisionBoard("three-consecutive-user-hp-gaps");
          previous = ""; stableReads = 0; previousNormalHp = false;
        }
        if (attempt < 11) await sleep(400);
      }
      const missing = last ? this.observationIssues(last) : ["capture"];
      const error = new Error("行动页12次读取未稳定" + (missing.length ? "：" + missing.join("、") : ""));
      error.code = "TCG_BOARD_RETRY"; error.missing = missing;
      throw error;
    }
    diceBudgetMatches(state) {
      if (this.expectedDice !== null && state.phase === "board" && state.turn === "user") {
        const extra = TCG.total(state.dice) - this.expectedDice;
        const gambler = this.gamblerBudget,
          afterCount = TCG.enemyCount(state);
        // Gambler refunds require actual defeats while its wearer is active,
        // and can never exceed the remaining match-wide uses. An arbitrary
        // +2/+4/+6 resource discrepancy is not evidence that this effect fired.
        const defeats =
          gambler?.enemies !== null && gambler?.enemies !== undefined && afterCount !== null
            ? Math.max(0, gambler.enemies - afterCount)
            : 0;
        const refund =
          gambler?.remaining > 0 && state.active === gambler.owner
            ? 2 * Math.min(gambler.remaining, defeats)
            : 0;
        return extra === 0 || extra > 0 && extra % 2 === 0 && extra <= refund;
      }
      return true;
    }
    requireDiceBudget(state) {
      if (!this.diceBudgetMatches(state))
        throw new Error("骰子识别与已确认行动预算不符：预期 " + this.expectedDice + "，读取 " + TCG.total(state.dice));
    }
    async observe(pendingAction = false, plan = null) {
      // The first fresh action-only board already contains its phase. Reuse it
      // as the first stable sample instead of a separate full phase capture.
      // No cross-frame HP caching; subsequent samples and auto quiet windows stay.
      const p = this.initialObservationBoard?.() || null;
      if (p && (p.phase !== "board" || p.turn !== "user")) return { ...p, hand: null };
      let hand = null;
      const scanBefore = this.handScanSerial;
      const handScan = { titles: 0 };
      let reusableSettled = null,
        reusableSettledAt = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        const settled = await this.settledBoard(true, attempt === 0 ? p : null);
        if (settled.phase !== "board" || settled.turn !== "user") return { ...settled, hand: null };
        if (!this.handNeedsReset && !this.handFanReady) this.boardReady = true;
        const handReadStart = Date.now(),
          handInputRevision = this.inputRevision;
        if (
          plan?.mode === "remove" &&
          plan.hand.length === 0 &&
          plan.action &&
          TCG.emptyHandEffect(
            plan.action,
            plan.before,
            { ...settled, selectedSoup: this.selectedSoup },
            plan.transitionPassed === true,
          )
        ) {
          this.emptyHandProven = true;
          this.trace("empty-hand-proof", {
            action: plan.action,
            proof: "independent-native-effect",
            transition: plan.transitionPassed === true,
          });
        }
        if (plan?.mode === "remove" && plan.hand.length === 0 && !this.emptyHandProven)
          await this.proveEmptyHand(plan, settled);
        const effectProven =
          plan?.mode === "remove" &&
          plan.action &&
          (TCG.removalEffect(plan.action, plan.before, settled) ||
            (plan.action.type === "card" &&
              plan.action.id === "toss" &&
              plan.rerollConfirmed === true &&
              settled.active === plan.before.active &&
              TCG.total(settled.dice) === TCG.total(plan.before.dice)));
        try {
          const paidProven = this.paidRemovalProven?.(plan, settled) === true;
          hand = await this.observedHand(effectProven || paidProven ? { ...plan, effectProven, paidProven } : plan, handScan);
          if(this.handScanSerial===scanBefore&&this.refreshHandFacts)
            hand=this.refreshHandFacts(hand);
          if (this.pendingChoiceCard) {
            const { id, oldCount } = this.pendingChoiceCard;
            if (oldCount !== 10 && !hand.some((c) => c.id === id)) {
              handScan.cards = null;
              this.invalidateHand("selected-generated-card-not-yet-observed");
              const error = new Error("挑选结果尚未在实际手牌中出现");
              error.code = "TCG_HAND_RETRY";
              throw error;
            }
            this.trace("choice-card-verified", {
              id,
              count: hand.length,
              overflowPossible: oldCount === 10,
            });
            this.pendingChoiceCard = null;
          }
          if (
            this.inputRevision === handInputRevision &&
            Date.now() - handReadStart <= 700 &&
            !this.handFanReady &&
            !this.handNeedsReset
          ) {
            if(this.handScanSerial>scanBefore){
              const phase=this.phase();
              if(phase.result||phase.phase!=="board"||phase.turn!=="user")return {...phase,hand:null};
            }
            reusableSettled = settled;
            reusableSettledAt = handReadStart;
          }
          break;
        } catch (e) {
          if (e.code === "TCG_OBSERVATION_INTERRUPTED") return { ...e.phase, hand: null };
          if (e.code !== "TCG_HAND_RETRY" || attempt === 2) throw e;
          this.trace("hand-read-deferred", { attempt, error: String(e.message || e) });
          if (attempt === 1) {
            // A genuine second failed observation, not every normal scan.
            // Re-anchor once, then require new evidence; never resend a card.
            try {
              this.requireHandObservation(this.phase(), "before-hand-reanchor");
            } catch (interrupted) {
              if (interrupted.code === "TCG_OBSERVATION_INTERRUPTED")
                return { ...interrupted.phase, hand: null };
              throw interrupted;
            }
            this.invalidateHand("two-unresolved-hand-observations");
            this.boardReady = false;
            await this.reset();
            this.trace("hand-reanchored", {
              attempt,
              maximumPerObservation: 1,
              replayedAction: false,
            });
          }
          await sleep(400);
        }
      }
      const handRead = this.handScanSerial > scanBefore ||
        plan?.mode === "full" && this.confirmationSession?.handObservation?.revision === this.inputRevision
        ? "full" : "cached";
      // Board snapshot comes after closing card-detail overlays.
      if (reusableSettled) {
        const state = { ...reusableSettled, hand, ...(this.pendingHandEvidence ? { handEvidence: this.pendingHandEvidence } : {}) };
        this.trace("board-snapshot-reused", {
          scope: "same-settled-observation-no-input",
          handCount: hand.length,
        });
        return this.finishObservation(state, pendingAction, handRead, reusableSettledAt);
      }
      let previousKey = "",
        last = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          last = this.board();
        } catch (e) {
          if (e.code !== "TCG_DICE_RETRY") throw e;
          previousKey = "";
          this.trace("board-read-wait", { attempt, error: String(e.message || e) });
          if (attempt < 5) await sleep(300);
          continue;
        }
        if (
          last.result ||
          ["pick", "roll", "settlement", "choice"].includes(last.phase) ||
          last.turn === "enemy"
        ) {
          this.trace("observation-interrupted", { attempt, phase: last.phase, turn: last.turn });
          return { ...last, hand: null };
        }
        const state = { ...last, hand, ...(this.pendingHandEvidence ? { handEvidence: this.pendingHandEvidence } : {}) };
        const key = JSON.stringify([
          last.phase,
          last.turn,
          last.active,
          last.dice,
          last.characters,
          last.enemies,
          last.supportCounts,
          last.quicken || null,
          last.eye || null,
          last.dendroCore || null,
        ]);
        if (TCG.legalState(state) && TCG.enemyCount(state) !== null && key === previousKey) {
          return this.finishObservation(state, pendingAction, handRead);
        }
        previousKey = key;
        if (attempt < 5) await sleep(300);
      }
      this.trace("board-unstable", { last, pendingAction });
      // Preserve the already-read hand: another unstable board must NOT trigger
      // another hand scan. Recovery still requires a complete two-frame board.
      const settled = await this.settledBoard(true);
      if (settled.phase !== "board" || settled.turn !== "user") return { ...settled, hand: null };
      const recovered = { ...settled, hand, ...(this.pendingHandEvidence ? { handEvidence: this.pendingHandEvidence } : {}) };
      return this.finishObservation(recovered, pendingAction, handRead);
    }
    async proveEmptyHand(plan,settled) {
      const receipt=this.consumptionReceipt,a=plan?.action,b=plan?.before;
      if(plan?.mode!=="remove" || plan.hand.length!==0 || b?.hand?.length!==1 || !a ||
          !receipt?.inputSent || receipt.beforeKey!==TCG.boardKey(b) || receipt.id!==a.id ||
          receipt.index!==a.index || receipt.target!==(a.target??null) ||
          settled.phase!=="board" || settled.turn!=="user")return false;
      if(!this.handFanReady)await this.expand(false);
      let stable=0;
      for(let attempt=0;attempt<3;attempt++) {
        const p=this.frame(f=>({phase:this.phaseIn(f),count:this.handCountIn(f),
          empty:this.has(f,"hand_empty",[1003,928,504,124],0.97,false)}));
        const matched=p.phase.phase==="board"&&p.phase.turn==="user"&&p.empty&&(p.count===null||p.count===0);
        stable=matched?stable+1:0;
        this.trace("empty-hand-native",{attempt,matched,stable,count:p.count,phase:p.phase});
        if(p.count>0)return false;
        if(stable>=2) {
          const proof={kind:"native-empty-fan",stableReads:stable,sourceCount:1,...receipt};
          if(!TCG.emptyHandEffect(a,b,{...settled,handEvidence:proof},false))return false;
          this.pendingHandEvidence=proof;this.emptyHandProven=true;
          this.handFanReady=false;this.handNeedsReset=false;this.boardReady=true;
          this.trace("empty-hand-proof",{action:a,proof,netDice:TCG.total(settled.dice)-TCG.total(b.dice)});
          return true;
        }
        if(attempt<2)await sleep(180);
      }
      return false;
    }
    
    async confirmOpening(data) {
      if (this.phase().phase !== "opening") throw new Error("确认起手前页面已改变");
      this.moveTo(1791, 860);
      await sleep(150);
      await this.clickButton("确定", [720, 880, 480, 140]);
      // Confirm exactly once, then prove progression; no blind double-click.
      let stable = 0,
        previous = "";
      for (let attempt = 0; attempt < 40; attempt++) {
        const p = this.phase();
        const accepted = ["pick", "roll"].includes(p.phase);
        stable = accepted ? (p.phase === previous ? stable + 1 : 1) : 0;
        if (p.phase !== previous || attempt === 0)
          this.trace("opening-confirm-wait", { attempt, phase: p.phase });
        previous = p.phase;
        if (stable >= 2) {
          this.trace("opening-confirmed", { ...data, phase: p.phase });
          return p;
        }
        if (!["opening", "unknown", "transition", "pick", "roll"].includes(p.phase))
          throw new Error("起手确认后出现意外页面：" + p.phase);
        if (attempt < 39) await sleep(400);
      }
      throw new Error("初始手牌确认未生效：未进入稳定的选人或掷骰页");
    }
    async opening() {
      const startingXs = [383, 665, 960, 1248, 1535];
      if (TCG.openingSetting(this.options.mulligan) === "全部保留") {
        await this.confirmOpening({
          policy: "confirm-current",
          reason: "keep-setting",
          selectedByScript: [],
        });
        return;
      }
      // User and native tests confirmed hover does not reveal these titles.
      // One click reads a title AND toggles replacement; track the actual
      // marker, then adjust only the final mismatches. No hover probe.
      const original = await this.openingSelections(startingXs);
      let selected = original.slice(), pendingInspection = null;
      const cards = [];
      const recordInput = (index, purpose, observed) => {
        const verified = !!observed && observed.every((value, i) => value === (i === index ? !selected[i] : selected[i]));
        this.trace("opening-card-input", {index, purpose, before:selected[index], after:observed?.[index]??null, verified});
        return verified;
      };
      const toggle = async (index, purpose) => {
        // First card's centre is covered by its own left detail panel.
        this.clickAt(startingXs[index] + 70, 540);
        await sleep(350);
        let observed;
        try { observed = await this.openingSelections(startingXs); }
        catch (error) { recordInput(index, purpose, null); throw error; }
        if (!recordInput(index, purpose, observed)) {
          throw new Error("起手置换标记未证实，不重复点击第" + (index + 1) + "张牌");
        }
        selected = observed;
      };
      try {
        for (let i = 0; i < 5; i++) {
          pendingInspection = i;
          const raw = await this.titleAt(startingXs[i] + 70, 540, true, false);
          let observed;
          try { observed = await this.openingSelections(startingXs); }
          catch (error) { recordInput(i, "inspect-unknown", null); pendingInspection = null; throw error; }
          const verified = recordInput(i, "inspect-unknown", observed); pendingInspection = null;
          if (!verified) {
            throw new Error("起手读牌后的置换标记不符，不猜测选择状态");
          }
          selected = observed;
          const c = TCG.observedCard(raw, i);
          if (!c) throw new Error("第" + (i + 1) + "张初始牌标题未读清，不自动确认开局");
          cards.push(c);
          this.trace("opening-title-method", { index: i, method: "click", selectionChanged: true });
        }
      } catch (error) {
        // Recover only when the actual marker can still be read. Do not
        // confirm a game whose initial cards or selected replacements are unknown.
        let observed;
        try { observed = await this.openingSelections(startingXs); }
        catch (failure) { if(pendingInspection!==null)recordInput(pendingInspection,"inspect-unknown",null); throw failure; }
        if(pendingInspection!==null)recordInput(pendingInspection,"inspect-unknown",observed);
        selected = observed;
        for (let i = 0; i < 5; i++) if (selected[i] !== original[i]) await toggle(i, "rollback");
        throw error;
      }
      this.trace("opening", cards);
      const context = TCG.openingContext({});
      const plan = TCG.openingPlan(cards, original, context);
      this.openingCards = plan.keep;
      const wanted = plan.replace;
      this.trace("opening-plan", {
        cards,
        keep: cards.filter((h) => !wanted[h.index]).map((h) => h.id),
        replace: cards.filter((h) => wanted[h.index]).map((h) => h.id),
        replaceIndices: wanted.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
        duplicateWeaponIndices: plan.duplicateWeapons,
        context,
      });
      const final = wanted;
      // Settle kept inspection marks first; no undo after final replacements start.
      for (let i = 0; i < 5; i++) if (selected[i] && !final[i]) await toggle(i, "reconcile");
      for (let i = 0; i < 5; i++) if (!selected[i] && final[i]) await toggle(i, "reconcile");
      this.moveTo(1791, 860);
      this.trace("opening-selection-verified", {
        original,
        selected,
        proof: "two-stable-native-replace-labels-per-input",
      });
      await this.confirmOpening({
        policy: "known-priority",
        selectedByScript: selected.map((s, i) => (s ? i : -1)).filter((i) => i >= 0),
      });
    }
    async openingSelections(xs) {
      let previous = "",
        stable = 0;
      for (let attempt = 0; attempt < 8; attempt++) {
        const observation = this.frame((f) => ({
          phase: this.phaseIn(f).phase,
          labels: xs.map((x) => TCG.norm(this.ocr(f, [x - 100, 730, 200, 60]))),
        }));
        if (observation.phase !== "opening") throw new Error("起手置换检查期间页面改变");
        if (observation.labels.some((t) => t !== "" && t !== "替换")) {
          previous = "";
          stable = 0;
        } else {
          const key = JSON.stringify(observation.labels);
          stable = key === previous ? stable + 1 : 1;
          previous = key;
          if (stable >= 2) return observation.labels.map((t) => t === "替换");
        }
        await sleep(200);
      }
      throw new Error("初始牌置换标记未稳定");
    }
    async removalEvidenceBeforeReset(plan) {
      const r = this.consumptionReceipt,
        a = plan?.action,
        b = plan?.before;
      // Ordinary consumption only. Draw/recycle/talent and the final-card
      // empty-fan branch keep their existing independent native proofs.
      if (
        plan?.mode !== "remove" ||
        plan.hand.length === 0 ||
        a?.type !== "card" ||
        !r?.inputSent ||
        r.beforeKey !== TCG.boardKey(b) ||
        r.id !== a.id ||
        r.index !== a.index ||
        r.target !== (a.target ?? null) ||
        !this.handFanReady
      )
        return null;
      const revision = this.inputRevision;
      let stable = 0,
        last = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const p = this.frame((f) => {
          const phase = this.phaseIn(f);
          return {
            ...phase,
            count: phase.phase === "board" && phase.turn === "user" ? this.handCountIn(f) : null,
          };
        });
        if (p.phase !== "board" || p.turn !== "user" || this.inputRevision !== revision)
          return null;
        stable =
          p.count === plan.hand.length && p.count === last
            ? stable + 1
            : p.count === plan.hand.length
              ? 1
              : 0;
        last = p.count;
        if (attempt === 0) await sleep(120);
      }
      this.trace("hand-pre-reset-proof", {
        id: a.id,
        count: last,
        expected: plan.hand.length,
        stableReads: stable,
        additionalInputs: 0,
      });
      return stable >= 2
        ? { ...r, count: last, stableReads: stable, at: Date.now(), revision }
        : null;
    }
    
    markNativeCardConfirmation(action,layout) {
      const r=this.consumptionReceipt;
      if(r?.inputSent===true && r.id===action.id && r.index===action.index && r.target===(action.target??null)) {
        r.nativeConfirmed=true;r.confirmationLayout=layout;
      }
    }
    firstPickObservation() {
      // Read the already-opened target title and phase from ONE fresh frame.
      // No startup inspection of all roles and no extra character-detail click.
      return this.frame((f) => {
        const p = this.phaseIn(f);
        return {
          ...p,
          selectedTarget:
            p.phase === "pick" ? TCG.characterName(this.ocr(f, [311, 115, 341, 50])) : null,
        };
      });
    }
    async pick(target, first = true) {
      if (!Number.isInteger(target) || target < 0 || target >= charX.length) throw new Error("出战角色索引无效");
      if(!first)return this.pickForced(target);
      if (this.phase().phase !== "pick") throw new Error("当前不是出战页");
      this.clickAt(charX[target], 720);
      this.trace("pick-target-clicked", { target, name:TCG.team[target].name, first, point:[charX[target],720] });
      await sleep(500);
      // A preselected card can confirm on the FIRST click (native 11:07 run).
      // Otherwise ChooseFirst uses the same card again, but only after positive
      // selected-target evidence. Never send a second input to a roll/board.
      let confirmationSent = false, selectionStable = 0;
      let stable = 0, lastKey = "", last = { phase: "unknown", turn: "none" };
      for (let attempt = 0; attempt < 60; attempt++) {
        last = this.firstPickObservation();
        if (last.phase === "pick" && !confirmationSent && last.selectedTarget === target) {
          if (++selectionStable >= 2) {
            this.trace("pick-selected", { target, name:TCG.team[target].name, first, proof:"exact-target-title-on-pick-page" });
            this.clickAt(charX[target], 720);
            confirmationSent = true;
            this.trace("pick-confirm-clicked", { target, first, point:[charX[target],720], method:"official-character-card" });
            this.moveTo(1555, 860);
            selectionStable = 0; stable = 0; lastKey = "";
            await sleep(500);
            continue;
          }
        } else selectionStable = 0;
        let accepted = last.phase === "roll" || !!last.result;
        if (last.phase === "board" && ["user", "enemy"].includes(last.turn)) {
          try { last = this.board(); } catch (e) {
            if (!["TCG_BOARD_RETRY", "TCG_DICE_RETRY"].includes(e.code)) throw e;
            stable = 0; lastKey = ""; await sleep(400); continue;
          }
          accepted = last.phase === "board" && ["user", "enemy"].includes(last.turn) && last.active === target &&
            TCG.total(last.dice) > 0 && TCG.legalState({ ...last, turn: "user", hand: [] });
        }
        const key = JSON.stringify([last.phase, last.turn, last.result, last.active, last.characters,
          last.dice ? TCG.diceOrder.map(e => last.dice[e] || 0) : null]);
        stable = accepted ? key === lastKey ? stable + 1 : 1 : 0;
        if (key !== lastKey) this.trace("pick-wait", { target, first, attempt, phase: last.phase, turn: last.turn });
        lastKey = key;
        if (stable >= 2) { this.trace("pick-confirmed", { target, first, phase:last.phase, turn:last.turn,
          characterInputs:confirmationSent ? 2 : 1, method:"official-character-card" }); return last; }
        if (!["pick","unknown","transition","settlement","roll","board","result"].includes(last.phase)) {
          throw new Error("首次出战后出现意外页面：" + last.phase);
        }
        if (attempt < 59) await sleep(400);
      }
      throw new Error("出战角色确认未生效：未进入投骰页或完整稳定牌桌；最后页面 " + last.phase);
    }
    pickSelectionIn(f) {
      // Native forced selection can leave ALL character cards lowered. The
      // selected card opens its exact identity and a dedicated selection banner.
      return {
        who: TCG.characterName(this.ocr(f, [311, 115, 341, 50])),
        banner: TCG.norm(this.ocr(f, [700, 508, 580, 65])),
      };
    }
    async pickForced(target) {
      // Official Character.SwitchWhenTakenOut selects and confirms on the
      // character card itself. Do not reuse first-pick tooltip/icon geometry.
      if(this.forcedPickSession)target=this.forcedPickSession.target;
      if(!this.forcedPickSession) {
        const initial=this.board(false, true);
        if(initial.result)return initial;
        if(initial.phase!=="pick" || !TCG.alive(initial.characters?.[target])) {
          const e=new Error("强制换人局面尚未核实");e.code="TCG_PICK_RETRY";throw e;
        }
        this.clickAt(charX[target],720);
        this.forcedPickSession={target,confirmed:false};
        this.trace("forced-pick-selected",{target,name:TCG.team[target].name});
        await sleep(500);
      }
      let confirmed=this.forcedPickSession.confirmed,stable=0,key="",last=null,selectionStable=0;
      for(let attempt=0;attempt<40;attempt++) {
        try{last=this.board(false, true);}catch(e){
          if(!["TCG_DICE_RETRY","TCG_BOARD_RETRY"].includes(e.code))throw e;
          stable=0;key="";selectionStable=0;
          this.trace("forced-pick-read-deferred",{target,attempt,code:e.code});await sleep(400);continue;
        }
        if(last.result){this.forcedPickSession=null;return last;}
        const c=last.characters?.[target];
        const selected=last.pickSelection?.who===target &&
          ["请选择一位角色出战","请选择一个角色出战"].includes(last.pickSelection.banner);
        if(last.phase==="pick" && TCG.alive(c) && (c.raised===true || selected) && !confirmed) {
          // Positive selected-card evidence; exactly one confirmation input.
          selectionStable++;
          if(selectionStable>=2) {
            this.clickAt(charX[target],720);confirmed=true;this.forcedPickSession.confirmed=true;
            this.trace("forced-pick-confirm-clicked",{target,point:[charX[target],720],method:"official-character-card",
              proof:selected?"exact-target-title-and-pick-banner":"raised-living-target"});
          }
          stable=0;key="";
        } else if(last.phase==="board" && ["user","enemy"].includes(last.turn) &&
            last.active===target && TCG.alive(c)) {
          selectionStable=0;
          const next=JSON.stringify([last.phase,last.turn,last.active]);
          stable=next===key?stable+1:1;key=next;
          if(stable>=2) {
            this.trace("forced-pick-confirmed",{target,phase:last.phase,turn:last.turn,confirmationInputs:confirmed?1:0});
            this.forcedPickSession=null;
            if (last.enemies?.some(e => e.dead !== true &&
                (!Number.isInteger(e.hp) || e.dead !== false)) &&
                await this.dismissCharacterOverview("forced-pick-handoff"))
              return this.board(false, true);
            return last;
          }
        } else if(["settlement","choice","roll"].includes(last.phase)) {
          // End-phase damage can require a replacement BEFORE remaining summons,
          // a blessing choice, and next-round dice. Hand off the stable native
          // phase; it is not proof of the target's final active/alive state.
          // A preselected target can finish on the FIRST card click. Native
          // phase exit is enough to transfer page ownership, never to assert
          // a cast, card consumption, or an unobserved active character.
          selectionStable=0;
          const next=JSON.stringify(["handoff",last.phase,last.turn]);
          stable=next===key?stable+1:1;key=next;
          if(stable>=2) {
            this.trace("forced-pick-handoff",{target,attempt,phase:last.phase,turn:last.turn,
              selectionInputs:1,confirmationInputs:confirmed?1:0,
              proof:"selection-input-and-two-stable-native-phase-exit-frames"});
            this.forcedPickSession=null;
            return {phase:last.phase,turn:last.turn};
          }
        } else {
          stable=0;key="";selectionStable=0;
          if(confirmed && last.phase==="pick" && c?.dead===true) {
            this.trace("forced-pick-defeated-again",{target});this.forcedPickSession=null;return last;
          }
          if(["opening","roll"].includes(last.phase))throw new Error("阵亡换人出现非预期起手/投骰页");
        }
        this.trace("forced-pick-wait",{target,attempt,phase:last.phase,turn:last.turn,confirmationSent:confirmed});
        await sleep(400);
      }
      const error = new Error("阵亡换人长时间未取得完整出战证据");
      error.code = "TCG_PICK_RETRY";
      throw error;
    }
    async roll(memory, { allowInitialPick = false } = {}) {
      // Only a first roll can lead to the still-pending first character pick.
      const mayPick = allowInitialPick && memory.round === 0;
      if (this.phase().phase !== "roll") throw new Error("当前不是投骰页");
      const observed = await this.readRollDice();
      if (this.phase().phase !== "roll") throw new Error("选择骰子前页面已改变");
      const plan = TCG.rerollPlan(observed.items, memory, memory.openingContext || {});
      const keep = plan.elements;
      for (let i = 0; i < observed.items.length; i++)
        if (!plan.indices.includes(i)) {
          const die = observed.items[i];
          this.clickAt(die.x, die.y);
          await sleep(130);
        }
      this.trace("reroll-plan", plan);
      if (this.phase().phase !== "roll") throw new Error("重投确认前已离开投骰页");
      await this.clickButton("确定");
      let stable = 0,
        lastKey = "",
        last = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        last = this.phase();
        const accepted =
          !!last.result ||
          (last.phase === "board" && ["user", "enemy"].includes(last.turn)) ||
          (mayPick && last.phase === "pick");
        const key = JSON.stringify([last.phase, last.turn, last.result]);
        stable = accepted ? (key === lastKey ? stable + 1 : 1) : 0;
        if (key !== lastKey)
          this.trace("roll-wait", { attempt, phase: last.phase, turn: last.turn });
        lastKey = key;
        if (stable >= 2) break;
        if (last.phase === "opening" || (last.phase === "pick" && !mayPick))
          throw new Error("重投确认后出现意外页面：" + last.phase);
        if (attempt < 29) await sleep(500);
      }
      if (stable < 2) throw new Error("重投确认未生效；最后页面 " + last.phase);
      TCG.nextRound(memory);
      const nextCount = this.handCache === null ? null : Math.min(10, this.handCache.length + 2);
      this.invalidateHand("new-round-draw-order-unknown");
      this.handCountHint = nextCount; // Common round draw is a candidate, not proof.
      this.handFanReady = false;
      this.handNeedsReset = false;
      this.boardReady = false;
      this.emptyHandProven = false; // Round draw adds two known cards (before deck exhaustion).
      this.consumptionReceipt = null;
      this.lastObservedAt = 0;
      this.lastObservedRevision = -1;
      this.expectedDice = 8;
      this.gamblerBudget = null;
      this.trace("round", { round: memory.round, keep });
      return last;
    }
    async drag(x, y, toX, toY) {
      // Validate BOTH endpoints before any movement or button press.
      const start = mousePoint(x, y), end = mousePoint(toX, toY);
      this.moveTo(start[0], start[1]);
      await sleep(120);
      leftButtonDown();
      this.inputRevision++;
      try {
        for (let i = 1; i <= 15; i++) {
          this.moveTo(start[0] + (end[0] - start[0]) * i / 15, start[1] + (end[1] - start[1]) * i / 15);
          await sleep(20);
        }
      } finally { leftButtonUp(); }
      await sleep(550);
    }
    warnings() {
      return this.frame((f) => ({
        lack: this.has(f, "core/元素骰子不足", [960, 0, 960, 1080]),
        text: this.ocr(f, [1490, 790, 410, 250]),
      }));
    }
    cardPaymentControlsIn(f) {
      // OCR Find returns only its first item, which may be a key hint. Read
      // complete native rows; confirmation still requires a unique exact label.
      return this.ocrRows(f, [770, 900, 380, 90]).filter(
        (row) => TCG.norm(row.text) === "打出手牌",
      );
    }
    async requireNoWarning() {
      const warning = this.warnings();
      if (warning.lack || /无法|不足|不能|充能未满/.test(warning.text)) {
        const e = new Error("游戏拒绝动作：" + warning.text);
        e.code = "TCG_NATIVE_REJECTION";
        throw e;
      }
    }
    async requireSwitchPreview(action, memory) {
      // Native normal switching has NO bottom action label. Only the fast
      // status displays 快速行动; absence alone never identifies this overlay.
      const expectedSpeed = memory.fastSwitch ? "快速行动" : "";
      let stable = 0,
        previousSpeed = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        await this.requireNoWarning();
        const preview = this.frame((f) => ({
          phase: this.phaseIn(f),
          banner: this.ocr(f, [700, 508, 580, 65]),
          control: this.ocr(f, [1720, 835, 195, 75]),
          speed: this.ocr(f, [850, 972, 260, 60]),
        }));
        this.requireHandObservation(preview.phase, "switch-preview");
        const matched =
          preview.phase.phase === "unknown" &&
          preview.phase.turn === "none" &&
          TCG.norm(preview.banner) === "将所选角色切换为出战角色" &&
          TCG.norm(preview.control) === "切换角色" &&
          ["", "快速行动"].includes(TCG.norm(preview.speed));
        this.trace("switch-preview", {
          attempt,
          target: action.target,
          expectedSpeed,
          matched,
          ...preview,
        });
        if (preview.phase.phase === "board" && preview.phase.turn === "user" &&
            TCG.norm(preview.banner) === "元素骰子不足") {
          const error = new Error("游戏拒绝动作：" + preview.banner);
          error.code = "TCG_NATIVE_REJECTION";
          throw error;
        }
        const actualSpeed = TCG.norm(preview.speed);
        stable = matched ? (actualSpeed === previousSpeed ? stable + 1 : 1) : 0;
        previousSpeed = matched ? actualSpeed : null;
        if (stable >= 2) return { fast: actualSpeed === "快速行动", speed: actualSpeed };
        if (attempt < 5) await sleep(300);
      }
      throw new Error("切换确认页未核实横幅、控件与行动类型");
    }
    
    async requireUnchangedBoard(before) {
      // Dice maps are unordered and zero entries may be omitted. Compare
      // resources semantically, not by host dictionary insertion order.
      const keyOf=s=>JSON.stringify([s.active,TCG.diceOrder.map(e=>s.dice?.[e]||0),s.characters,s.enemies,s.quicken||null,s.supportCounts||null]);
      const expected=keyOf(before);let stable=0,last=null;
      const recent=this.preInputBoardClean() && this.lastObservedState && keyOf(this.lastObservedState)===expected &&
        this.lastObservedRevision===this.inputRevision && Date.now()-this.lastObservedAt<=1500 && !this.autoRisk;
      for(let attempt=0;attempt<6;attempt++) {
        try{last=this.board();}catch(e){
          if(e.code!=="TCG_DICE_RETRY")throw e;
          stable=0;this.trace("execution-board-wait",{attempt,error:String(e.message||e)});
          if(attempt<5)await sleep(300);continue;
        }
        if(last.phase!=="board" || last.turn!=="user") {
        const error=new Error("执行前页面/回合已变化");
          error.code=last.phase==="unknown" ? "TCG_STATE_REFRESH" : "TCG_OBSERVATION_INTERRUPTED";
          error.phase={...last,hand:null};this.boardReady=false;throw error;
        }
        const matched=keyOf(last)===expected;stable=matched?stable+1:0;
        this.trace("execution-board-wait",{attempt,matched,stable,active:last.active,dice:last.dice,changed:matched?[]:boardDifferences(before,last)});
        if(stable>=2 || recent&&attempt===0&&matched)return last;
        if(attempt<5)await sleep(300);
      }
      const error = new Error("执行前牌桌已变化或六次读取未稳定匹配");
      error.code = "TCG_STATE_REFRESH";
      throw error;
    }
    preInputBoardClean() { return this.boardReady; }
    async execute(action, before, memory) {
      this.consumptionReceipt = null;
      this.pendingHandEvidence = null;
      this.currentAction = action;
      try {
        return await this.executeInput(action, before, memory);
      } catch (e) {
        this.consumptionReceipt = null;
        this.pendingHandEvidence = null;
        const nativeRejection = e.code === "TCG_NATIVE_REJECTION";
        if (!nativeRejection && !(action.type === "tune" && e.code === "TCG_TUNE_UNCONFIRMED"))
          throw e;
        if (nativeRejection) e.code = "TCG_INPUT_REJECTED";
        // Dismiss the existing preview once. A missing tuning button is NOT a
        // rejection proof: Player must reread hand/resources before retrying.
        this.boardReady = false;
        await this.reset();
        throw e;
      } finally {
        this.currentAction = null;
      }
    }
    
    async inputHand(action,before,memory,prepared=null) {
      const sourceCount=prepared?prepared.sourceCount:await this.prepareHandInput(before.hand.length,
        action.type==="card"&&this.checkCardInput?action.index:null);
      const current = before.hand;
      const h = current.find(c => c.index === action.index);
      if (!h || h.id !== action.id) throw new Error("执行前重新核对卡名失败");
      if(!this.handFanReady)await this.expand();
      const x = prepared?prepared.x:this.handPoints(current.length)[action.index];
      if (!prepared) await this.inspectHandCard(action, x);
      await this.checkCardInput?.(action,before,x,memory);
      if(this.phase().turn!=="user")throw new Error("拖牌前回合已改变");
      const targeted = action.type === "card" && action.target !== null;
      this.consumptionReceipt={id:action.id,index:action.index,target:action.target??null,
        beforeKey:TCG.boardKey(before),inputSent:false,
        ...(sourceCount?{sourceCountProof:sourceCount}:{})};
      await this.drag(x, 945, action.type === "tune" ? 1867 : targeted ? charX[action.target] : x,
        action.type === "tune" ? 518 : targeted ? 720 : 595);
      this.consumptionReceipt.inputSent=true;
      if (action.type === "tune") await this.confirmTune();
      else await this.cardConfirm(action,before);
    }
    async confirmTune() {
      for (let attempt = 0; attempt < 3; attempt++) {
        await this.requireNoWarning();
        const b = this.button("元素调和");
        if (b) {
          const point = this.clickAt(b.x + b.w / 2, b.y + b.h / 2);
          this.trace("button-clicked", { asset: "元素调和", point });
          await sleep(550);
          return;
        }
        if (attempt < 2) await sleep(300);
      }
      const error = new Error("调和确认按钮未读清，核对实际手牌与骰子后再选择");
      error.code = "TCG_TUNE_UNCONFIRMED";
      throw error;
    }
    
    async inputSwitch(action,before,memory) {
      if (!Number.isInteger(action.target) || action.target < 0 || action.target > 2 ||
          action.target === before.active || before.characters[action.target].dead !== false)
        throw new Error("切换目标非法");
      // Opening details verifies the target before the payment overlay.
      const raw = await this.titleAt(charX[action.target], 720, false, false, "character", action.target, true);
      this.requireHandObservation(this.phase(), "before-switch-payment");
      if (TCG.characterName(raw) !== action.target) throw new Error("切换目标角色标题未核实");
      this.clickAt(1820, 958);
      await sleep(800);
      const preview = await this.requireSwitchPreview(action, memory);
      this.clickAt(1820, 958);
      this.trace("switch-confirm-clicked", {
        target: action.target,
        point: [1820, 958],
        fast: preview.fast,
        predictedFast: memory.fastSwitch,
      });
    }
    async inputEnd() {
      await this.clickButton("回合结束", [0, 0, 384, 1080]);
      if (this.phase().turn === "user") await this.clickButton("回合结束", [0, 0, 384, 1080]);
    }
    async prepareHandInput(expected, priceIndex = null) {
      this.requireHandObservation(this.phase(), "before-target-expand");
      // execute already normalized and verified the board; do not blank-click
      // a second time simply to raise the fan.
      await this.expand(false);
      // Known order/count comes from this session's confirmed hand. Look for
      // visible anomalies without the redundant 1–4-card boundary/title loop.
      let samples;
      try {
        samples = [this.frame((f) => this.handSample(f, priceIndex))];
        await sleep(120);
        samples.push(this.frame((f) => this.handSample(f, priceIndex)));
      } catch (e) {
        if (e.code !== "TCG_HAND_RETRY") throw e;
        await this.refreshHandBeforeInput("执行前手牌数量证据冲突");
      }
      const reads = samples.map((s) => s.count);
      this.requireHandObservation(this.phase(), "before-target-title");
      this.trace("hand-input-check", {
        expected, reads, sources: samples.map((s) => s.source), boundaryProbe: false,
      });
      if (reads.some((n) => n !== null && n !== expected)) {
        await this.refreshHandBeforeInput("执行前手牌张数已变化");
      }
      this.publishHandPositions(samples, expected);
      // Reuse the existing read-only count frames; no extra hand expansion.
      if (reads[0] !== null && reads[0] === reads[1]) this.recordHandLayout(reads[0]);
      // Layout sources already validate every slot, expected spacing and extra
      // edges/markers. A single raw hit or two unreadable samples is NOT proof.
      return reads.every((n) => n === expected) &&
        samples.every((s) => s.source === samples[0].source) &&
        ["native-badge", "full-cost-layout", "full-rim-layout"].includes(samples[0].source)
        ? { count: expected, stableReads: 2, source: samples[0].source } : null;
    }
    async refreshHandBeforeInput(reason) {
      this.invalidateHand(reason);
      this.requireHandObservation(this.phase(), "before-cache-refresh-reset");
      await this.reset();
      const error = new Error(reason);
      error.code = "TCG_HAND_REFRESH";
      throw error;
    }
    async confirm(action, before, memory = TCG.freshMemory()) {
      let pending = false;
      try { return await this.confirmPending(action, before, memory); }
      catch (e) {
        pending = ["TCG_CONFIRMATION_RETRY", "TCG_BOARD_RETRY", "TCG_DICE_RETRY", "TCG_HAND_RETRY"].includes(e.code);
        throw e;
      }
      finally {
        if (!pending) {
          this.confirmationSession = null;
          this.consumptionReceipt = null;
          this.pendingHandEvidence = null;
        }
      }
    }
    async confirmPending(action, before, memory = TCG.freshMemory()) {
      const key = TCG.actionKey(action) + "/" + TCG.boardKey(before);
      if (this.confirmationSession && this.confirmationSession.key !== key)
        throw new Error("上一个动作仍待确认，禁止提交另一动作");
      const session = this.confirmationSession || { key, transition: false,
        plan: action.type === "end" ? null : { ...TCG.handPlan(action, before, memory), action, before } };
      this.confirmationSession = session;
      const deadline = Date.now() + 45000;
      const combat = ["skill", "switch", "end"].includes(action.type) ||
        action.type === "card" && ["talent", "wedge", "penance"].includes(action.id);
      while (Date.now() < deadline) {
        const p = this.phase();
        if (p.result) return { ...p, confirmed: true };
        if (p.turn === "enemy" || ["choice", "roll", "pick", "settlement"].includes(p.phase))
          session.handObservation = null;
        if (this.choiceSession || p.phase === "choice") {
          session.handObservation = null;
          try { await this.resolveChoice(before, memory); }
          catch (e) { if (e.code !== "TCG_CHOICE_RETRY") throw e;
            this.trace("choice-deferred", { action, reason: e.message }); await sleep(300); continue; }
          // A verified payment/target exit is not a generated-card choice.
          // Keep simple removal only when this action owns the completed exit.
          const receipt = this.choiceReceipt;
          if (!(session.plan?.mode === "remove" && receipt?.origin === session.key &&
              receipt.exited === true && ["payment", "target"].includes(receipt.kind)))
            session.plan = { mode: "full", action, before, expectedCount: this.handCountHint,
              retainedHand: session.plan?.retainedHand,retainedVariantFamilies:session.plan?.retainedVariantFamilies };
          continue;
        }
        if (action.type === "card" && action.id === "toss" && (this.tossSession || p.phase === "roll")) {
          const proof = await this.actionReroll(before, memory);
          session.plan = { ...session.plan, rerollConfirmed: proof?.confirmations === 2 }; continue;
        }
        if (p.turn === "enemy") session.transition = true;
        if (action.type === "end" && TCG.verify(action, before, p)) return { ...p, confirmed: true };
        // End-turn confirmation is a phase transition, not a hand effect.
        // While its animation still reports our board, keep the same submitted
        // session; no full observation, hand invalidation or second click.
        if (action.type === "end" && p.phase === "board" && p.turn === "user") { await sleep(450); continue; }
        if (p.phase === "pick") {
          if (session.plan?.mode === "unchanged") this.acceptHand(session.plan.hand, "forced-pick-unchanged-action");
          else this.invalidateHand("forced-character-pick-hand-changing-action");
          const independent = combat && !session.transition && await this.forcedActionProof(action, before);
          const confirmed = combat && (session.transition || independent);
          this.trace("confirmation-forced-pick", { action, transition: session.transition, independent, confirmed });
          return { ...p, confirmed };
        }
        if (p.turn === "user") {
          let after;
          try {
            this.requireHandObservation(p, "before-confirm-reset");
            const receipt = await this.removalEvidenceBeforeReset(session.plan);
            if (!this.boardReady && (this.handNeedsReset || this.handFanReady)) await this.reset();
            if (receipt && this.inputRevision >= receipt.revision && this.inputRevision <= receipt.revision + 1)
              session.plan = { ...session.plan, preResetEvidence: { ...receipt, revision: this.inputRevision } };
            after = await this.observe(true, session.plan ? { ...session.plan, transitionPassed: session.transition } : null);
          } catch (e) {
            if (["TCG_BOARD_RETRY", "TCG_DICE_RETRY", "TCG_HAND_RETRY"].includes(e.code)) {
              this.trace("confirmation-read-deferred", { action, code: e.code, missing: e.missing, reason: e.message });
              await sleep(400); continue;
            }
            if (e.code !== "TCG_OBSERVATION_INTERRUPTED") throw e;
            after = { ...e.phase, hand: null };
          }
          if (after.result) return { ...after, confirmed: true };
          if (after.phase !== "board" || after.turn !== "user") {
            if (after.turn === "enemy" || ["choice", "roll", "pick", "settlement"].includes(after.phase))
              session.handObservation = null;
            if (after.turn === "enemy") session.transition = true;
            this.trace("confirmation-deferred", { action, phase: after.phase, turn: after.turn });
            await sleep(450); continue;
          }
          const verified = TCG.verify(action, before, after, session.transition);
          const budgetMatches = this.diceBudgetMatches(after);
          if (verified && budgetMatches) {
            this.acceptHand(after.hand, "confirmed-" + (session.plan?.mode || "full"));
            return { ...after, ...this.confirmationExtras?.(), confirmed: true };
          }
          if (!budgetMatches && !await this.observedResourceProof(after)) {
            this.trace("budget-reconciliation-wait", { action, expectedDice: this.expectedDice,
              observedDice: TCG.total(after.dice), missing: ["native-dice-count-proof"] });
            await sleep(400); continue;
          }
          this.trace("state-resync", { action, verified, budgetMatches, expectedDice: this.expectedDice,
            observedDice: TCG.total(after.dice), reuseFullRead: after.handRead === "full" });
          if (!verified && session.plan?.mode !== "unchanged" && after.handRead !== "full") {
            this.invalidateHand("post-action-state-mismatch"); this.emptyHandProven = false;
            after = await this.observe(true, { mode: "full", expectedCount: null });
          }
          if (after.result) return { ...after, confirmed: true };
          if (after.phase !== "board" || after.turn !== "user") {
            if (after.turn === "enemy") session.transition = true;
            await sleep(450); continue;
          }
          if (!TCG.legalState(after)) {
            await sleep(400); continue;
          }
          const confirmed = TCG.verifyResynchronized(action, before, after, session.transition);
          this.adoptObservedState(after, "post-action-resync");
          this.trace("state-resynced", { action, confirmed, after });
          return { ...after, ...this.confirmationExtras?.(), confirmed, resynchronized: true };
        }
        if (p.phase === "roll" && combat) return { ...p, confirmed: session.transition };
        await sleep(450);
      }
      const error = new Error("动作仍待核实，保留本次输入并继续观察");
      error.code = "TCG_CONFIRMATION_RETRY";
      throw error;
    }
    async forcedActionProof(action, before) {
      // Death/energy reset is not proof of a cast. Preserve deck verification,
      // but require two fresh identical frames and a positive resource effect.
      if (action.type !== "skill") return false;
      const revision = this.inputRevision;
      let previous = "";
      for (let i = 0; i < 2; i++) {
        let after;
        try { after = this.board(); }
        catch (e) { if (["TCG_BOARD_RETRY", "TCG_DICE_RETRY"].includes(e.code)) return false; throw e; }
        const caster = after.characters?.[action.who], oldCaster = before.characters?.[action.who];
        const paid = after.diceKnown===true&&before.diceKnown===true&&TCG.total(after.dice) < TCG.total(before.dice);
        const charged = TCG.alive(caster) && Number.isInteger(caster.energy) &&
          Number.isInteger(oldCaster?.energy) && caster.energy > oldCaster.energy;
        if (after.phase !== "pick" || this.inputRevision !== revision || !(paid || charged)) return false;
        const key = JSON.stringify([after.phase, after.characters, after.dice, after.enemies]);
        if (i === 1) return key === previous;
        previous = key;
        await sleep(120);
      }
      return false;
    }
    adoptObservedState(state, reason) {
      if (!TCG.legalState(state)) throw new Error("重同步状态无效，不能作为下一动作基线");
      this.expectedDice = TCG.total(state.dice);
      this.gamblerBudget = null;
      this.emptyHandProven = state.hand.length === 0;
      this.boardReady=true;
      this.lastObservedState=state;
      this.lastObservedAt=0;this.lastObservedRevision=-1;
      this.consumptionReceipt=null;this.pendingHandEvidence=null;
      this.acceptHand(state.hand, reason);
    }
    reportStop(reason) {
      // Preserve the original stop even if its final log write fails.
      try {
        this.trace("stop", { reason });
      } catch (e) {
        log.warn("停止日志保存失败：" + e.message);
      }
    }
    dispose() {
      const gray = new Set();
      for (const ro of this.roCache.values()) {
        const mat = ro.templateImageGreyMat ?? ro.TemplateImageGreyMat;
        if (mat && !gray.has(mat)) {
          gray.add(mat);
          mat.dispose();
        }
      }
      for (const mat of this.templates.values()) mat.dispose();
      this.templates.clear();
      this.roCache.clear();
    }
  }
  root.TCGBetterGI = { BetterGIHost, handX, handLayoutCount, charX, number, mousePoint, captureSize, costMarkerLayout, costDigitRows, costNumbersAt, costHandSample, boardDifferences };
})(globalThis);
(function(root){
  "use strict";
  const T=root.TCG,Base=root.TCGBetterGI.BetterGIHost,{charX,number}=root.TCGBetterGI;
  const targetBanners={weapon:["请选择要装备法器的角色","请选择要装备武器的角色","请选择一个角色装备武器"],
    artifact:["请选择要装备圣遗物的角色","请选择一个角色装备圣遗物"],
    food:["请选择一个角色食用料理"],return:["请选择一个装备了武器的角色"],
    ...T.targetedCardBanners};
  function attachmentFacts(rows,cost,card,statusRows=rows){
    const texts=rows.map(r=>T.norm(r.text)),status=statusRows.map(r=>T.norm(r.text)),
      heading=status.findIndex(t=>t==="附着效果状态"||t==="附着状态");
    const unknown={source:"unknown",reduction:null,increase:null,empowered:null,noTuning:null,effectless:null};
    const visibleType=texts.some(t=>["事件牌","装备牌","支援牌"].includes(t));
    const modifiers=status.filter(t=>/^(费用降低|费用增加|赋能|不可调和|无效化)/.test(t));
    if(heading<0&&(!visibleType||modifiers.length||!card||cost!==T.size(card.cost)))return unknown;
    if(heading>=0&&!modifiers.length)return unknown;
    const facts={source:"native",reduction:0,increase:0,empowered:false,noTuning:false,effectless:false};
    for(const text of heading<0?[]:status.slice(heading+1)){
      const match=/^(费用降低|费用增加)(?:层数)?(\d+)?$/.exec(text);
      if(match){const key=match[1]==="费用降低"?"reduction":"increase";
        facts[key]=match[2]?Number(match[2]):null;facts[key+"Present"]=true;}
      if(text==="赋能")facts.empowered=true;
      if(text==="不可调和")facts.noTuning=true;
      if(text==="无效化")facts.effectless=true;
    }
    return facts;
  }
  function combatConfirmation(action,before){
    return action.type==="card"&&action.id==="seed"?
      {...action,type:"skill",who:before.active,skill:"NA",cardAction:action}:action;
  }
  class MoonHost extends Base{
    constructor(options){super(options);this.choiceReceipt=null;this.pendingGeneratedChoice=null;this.choiceDetails=[];
      this.cardDetails=new Map();this.feeSample=null;this.factPoints=[];}
    async prepareHandObservation(count){
      this.cardDetails.clear();this.feeSample=null;
      this.factPoints=this.handPoints(count);
      if(count>0&&!this.handFanReady){
        this.feeSample=this.frame(f=>{
          this.requireHandObservation(this.phaseIn(f),"folded-card-costs");
          const layout=this.collapsedLayoutIn(f);
          if(layout.status!=="readable"||layout.count!==count)return null;
          return this.foldedHandCostsIn(f,layout);
        });
        return;
      }
      if(count>0)this.feeSample=this.handPositionProof?.revision===this.inputRevision&&
        this.handPositionProof.count===count&&this.handPositionProof.costs.some(Number.isInteger)&&
        Date.now()-this.handPositionProof.at<=5000?
        this.handPositionProof:this.frame(f=>{
        this.requireHandObservation(this.phaseIn(f),"current-card-costs");
        return this.costHandIn(f,count);
      });
    }
    finishHandObservation(hand,scan={}){
      return hand.map(h=>{
        const current=this.cardWithFacts(h,this.factPoints[h.index]);
        if(current.attachments.source==="native")return current;
        const prior=(scan.retainedHand||[]).filter(c=>c.id===h.id);
        // Same-name duplicates may carry different attachments. Only a unique
        // retained card, or identical facts for every copy, proves this slot.
        if(!prior.length||prior.length!==hand.filter(c=>c.id===h.id).length||
          prior.some(c=>c.currentCost!==current.currentCost||c.attachments?.source!=="native"||
            JSON.stringify(c.attachments)!==JSON.stringify(prior[0].attachments)))return current;
        return {...current,attachments:prior[0].attachments,canTune:prior[0].canTune};
      });
    }
    refreshHandFacts(hand){
      if(this.handFanReady||this.handNeedsReset||!hand.some(h=>T.currentCost(h)===null))return hand;
      return this.frame(f=>{
        this.requireHandObservation(this.phaseIn(f),"changed-card-costs");
        const layout=this.collapsedLayoutIn(f);
        if(layout.status!=="readable"||layout.count!==hand.length)return hand;
        const sample=this.foldedHandCostsIn(f,layout),changed=[];
        const current=hand.map(h=>{
          if(T.currentCost(h)!==null||!Number.isInteger(sample.costs[h.index]))return h;
          changed.push(h.index);
          return {...h,currentCost:sample.costs[h.index],costSource:sample.source};
        });
        if(changed.length)this.trace("hand-costs-refreshed",{indices:changed,source:sample.source,inputs:0});
        return current;
      });
    }
    cardWithFacts(h,x){
      const detail=this.cardDetails.get(x),selected=detail?.id===h.id;
      const cost=selected?detail.cost:this.feeSample?.costs[h.index]??null;
      return {...h,currentCost:cost,costSource:cost===null?"unknown":selected?"native-selected-card-cost":this.feeSample?.source||"native-expanded-cost-markers",
        attachments:selected?detail.attachments:{source:"unknown",empowered:null},canTune:selected&&detail.canTune};
    }
    readSelectedCardFacts(f,card,x){
      const cost=this.selectedCardCostIn(f,x),a=this.currentAction,
        prior=a?.id===card.id?this.handCache?.[a.index]:null,
        retain=prior?.id===card.id&&Math.abs(this.handPoints(this.handCache.length)[a.index]-x)<=8&&
          prior.currentCost===cost&&T.cardFactsKnown(prior,a.requirement),
        attachments=retain?prior.attachments:attachmentFacts(
          this.ocrRows(f,[270,165,510,700]),cost,card,this.ocrRows(f,[680,100,355,620]));
      this.cardDetails.set(x,{id:card.id,cost,attachments,
        canTune:attachments.source==="native"&&!attachments.noTuning&&!["branch","choice-option"].includes(card.type)&&card.id!=="bloom"});
    }
    async checkCardInput(a,before,x,memory){
      if(a.type!=="card"&&a.type!=="tune")return;
      const prior=before.hand[a.index],observed=this.cardWithFacts(prior,x);
      const current={...before,hand:before.hand.map((h,i)=>i===a.index?observed:h)};
      if(a.type==="card"&&observed.currentCost===null){
        // A readable folded digit must not repeatedly reopen a selected digit
        // that just failed. Reuse the existing fact-bound probe suppression;
        // real price/hand effects already invalidate it at their normal owner.
        for(const h of [prior,observed,{...observed,currentCost:prior.currentCost}]){
          const key=T.cardProbeKey(current,h);
          if(!memory.probeKeys.includes(key))memory.probeKeys.push(key);
        }
      }
      before.hand[a.index]=observed;
      if(a.type==="tune"?observed.canTune!==true||
        a.element!==(observed.attachments.empowered?"Omni":T.team[before.active].element):
        observed.currentCost!==prior.currentCost||T.cardInputError(current,a,memory)){
        // Only this slot changed. Preserve identities and other native facts;
        // the existing state-refresh owner will replan without re-reading the fan.
        this.acceptHand(current.hand,"selected-card-facts-changed");
        await this.reset();
        const e=Error("目标手牌当前费用或附着变化，按实际信息重新决策");e.code="TCG_STATE_REFRESH";throw e;
      }
      this.trace("card-payment-facts",{id:a.id,index:a.index,currentCost:observed.currentCost,
        attachedCost:T.attachedCost(observed),printedCost:T.size(T.byId[a.id].cost),attachments:observed.attachments});
    }
    async probeCard(a,before,memory,prepared=null){
      const sourceCount=prepared?prepared.sourceCount:await this.prepareHandInput(before.hand.length,a.index),points=this.handPoints(before.hand.length);
      const after={...before,hand:before.hand.slice(),probed:true,confirmed:false};
      let request=a,observed,x,inspected=false,reads=0;
      do {
        x=points[request.index];
        const prior=after.hand[request.index],cost=this.handPositionProof?.costs[request.index];
        if(Number.isInteger(cost)&&T.cardFactsKnown({...prior,currentCost:cost},request.requirement)){
          observed={...prior,currentCost:cost,costSource:"native-expanded-cost-markers"};inspected=false;
        }else{
          await this.inspectHandCard(request,x);observed=this.cardWithFacts(prior,x);inspected=true;
        }
        after.hand[request.index]=observed;reads++;
        if(!T.cardFactsKnown(observed,request.requirement)){
          const key=T.cardProbeKey(after,observed,request.requirement);
          memory.probeKeys.push(request.key);if(key!==request.key)memory.probeKeys.push(key);
        }
        this.acceptHand(after.hand,"card-facts-probed");
        this.trace("card-facts-probed",{id:request.id,index:request.index,currentCost:observed.currentCost,
          attachments:observed.attachments,dependency:request.dependency,batchRead:reads});
        request=a.dependency!==undefined?T.dependencyProbes(after,memory).find(p=>p.dependency===a.dependency):null;
      }while(request);
      if(inspected&&sourceCount){
        // Inspection changes no game resources. The next card probe may reuse
        // this fan; only the same-slot play/tune may reuse its selected identity.
        this.preparedHandInput={id:observed.id,index:observed.index,x,sourceCount,
          beforeKey:T.boardKey(after),revision:this.inputRevision,at:Date.now()};
      }else{await this.reset();await this.requireUnchangedBoard(before);}
      this.trace("card-probe-completed",{reads,fanRetained:!!this.preparedHandInput});
      return after;
    }
    boardExtrasIn(){return {choiceReceipt:this.choiceReceipt};}
    skillFeeIn(f,a){
      const roi=a.skill==="Q"?[1780,1010,36,35]:a.skill==="E"?[1698,1010,36,35]:null;
      return roi?number(this.numericAt(f,roi,4)):null;
    }
    choiceIn(f){
      const header=T.norm(this.ocr(f,[700,155,520,130]));
      if(!header.includes("挑选卡牌")||!header.includes("请选择一张卡牌"))return null;
      const options=[];
      for(const r of this.ocrRows(f,[150,705,1620,90])){
        if(!r.text||![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<=0||r.h<=0)continue;
        const point=[Math.round(r.x+r.w/2),Math.round(r.y+r.h/2-200)];
        if(point[0]<150||point[0]>1770||point[1]<470||point[1]>650)continue;
        const detail=this.choiceDetails.find(d=>d.title===r.text&&Math.abs(d.point[0]-point[0])<=8),
          card=detail?T.byId[detail.id]:T.identify(r.text);
        options.push({id:card?.id||null,name:card?.name||null,title:r.text,point,inspected:!!detail});
      }
      options.sort((a,b)=>a.point[0]-b.point[0]);
      const ids=options.map(o=>o.id),source=this.confirmationSession?.plan?.action?.id,
        meditation=source==="meditation"&&ids.length===3&&ids.filter(Boolean).every(id=>T.byId[id].type==="technique")&&
          options.every((o,i)=>i===0||o.point[0]-options[i-1].point[0]>200),
        kind=ids.length===2&&ids.every(id=>["sanctify","disperse"].includes(id))?"sand":
        ids.length===2&&ids.every(id=>["overgrow","amrita"].includes(id))?"bloom":
        ids.length===4&&ids.every(id=>T.byId[id]?.type==="choice-option")?"adventure":
        ids.length===3&&ids.every(id=>T.byId[id]?.type==="technique")||
          meditation&&ids.some(Boolean)&&options.every(o=>o.id||o.inspected)?"meditation":"unknown";
      const inspectable=meditation&&options.some(o=>!o.id&&!o.inspected);
      return {phase:"choice",turn:"none",choiceKind:kind,options,
        recognized:kind!=="unknown"&&new Set(ids.filter(Boolean)).size===ids.filter(Boolean).length,inspectable};
    }
    async resolveChoice(before=null,memory=this.memory){
      let stable=0,key="",last=null;
      for(let attempt=0;attempt<24;attempt++){
        last=this.phase();const session=this.choiceSession;
        if(session&&!session.origin)session.origin=this.confirmationSession?.key||null;
        if(session?.kind==="payment"&&session.confirmed&&last.phase==="choice"){
          // Payment is finished; the same pending action now owns the native choice.
          // Do not require an intermediate board frame or resend the payment.
          this.choiceSession=null;stable=0;key="";continue;
        }
        if(session?.kind==="inspect"){
          const title=last.phase==="choice"?this.frame(f=>this.titleIn(f,[45,115,360,50])):"",card=T.identify(title);
          if(title!==session.title){session.title=title;this.trace("choice-title-observed",{title,id:card?.id||null,point:session.option.point});}
          const sameSlot=last.options?.some(o=>o.title===session.option.title&&Math.abs(o.point[0]-session.option.point[0])<=8);
          const next=sameSlot&&card?.type==="technique"?card.id:"";
          stable=next&&next===key?stable+1:next?1:0;key=next;
          if(stable>=2){this.choiceDetails.push({...session.option,id:card.id});this.choiceSession=null;
            this.trace("choice-title-read",{title:card.name,point:session.option.point});stable=0;key="";}
          else if(sameSlot&&!next&&++session.misses>=3){
            this.choiceDetails.push({...session.option,id:null});this.choiceSession=null;
            this.trace("choice-option-unresolved",{title,point:session.option.point,reason:"bounded-title-inspection"});
            stable=0;key="";
          }
          if(attempt<23)await sleep(250);continue;
        }
        const exited=session&&(session.selected||session.confirmed)&&["board","pick","roll","settlement","result"].includes(last.phase)&&
          (last.phase!=="board"||["user","enemy"].includes(last.turn));
        if(exited){
          const next=JSON.stringify([last.phase,last.turn,last.result]);stable=next===key?stable+1:1;key=next;
          if(stable>=2){
            this.choiceSession=null;this.choiceDetails=[];this.choiceReceipt={origin:session.origin,id:session.id,kind:session.kind,exited:true};
            if(["bloom","meditation"].includes(session.kind))this.pendingGeneratedChoice={id:session.id,oldCount:session.oldCount};
            if(session.kind==="bloom")memory.bloomResolved=true;
            if(session.kind==="sand")memory.branch=T.fact(session.id,"native-choice-exit");
            if(session.kind==="adventure"){
              if(memory.adventureMap)memory.supports=memory.supports.filter(id=>id!==memory.adventureMap);
              memory.adventureMap=session.id;memory.supports.push(session.id);
            }
            this.invalidateHand("moon-choice-result");this.handFanReady=false;this.handNeedsReset=true;this.boardReady=false;this.emptyHandProven=false;
            this.trace("choice-resolved",{...this.choiceReceipt,confirmationInputs:session.confirmed?1:0});return last;
          }
        }else if(session?.kind==="payment"){
          const preview=this.frame(f=>({banner:T.norm(this.ocr(f,[740,510,450,65])),
            controls:this.cardPaymentControlsIn(f),phase:this.phaseIn(f)}));
          const matched=preview.phase.phase==="unknown"&&preview.phase.turn==="none"&&
            preview.controls.length===1&&T.nativeCardScope(session.action,preview.banner,before);
          const next=matched?JSON.stringify([preview.banner,preview.controls]):"";
          stable=next&&next===key?stable+1:next?1:0;key=next;
          if(stable>=2&&!session.confirmed){session.confirmed=true;const c=preview.controls[0];
            this.clickAt(c.x+c.w/2,c.y+c.h/2);this.markNativeCardConfirmation(session.action,"central");
            stable=0;key="";await sleep(500);}
        }else if(session?.kind==="target"){
          const preview=this.frame(f=>{
            const native={banner:T.norm(this.ocr(f,[600,510,720,65])),
              phase:this.phaseIn(f),controls:this.cardPaymentControlsIn(f),buttons:this.matches(f,"core/确定",[770,900,380,90])};
            const key="target-unresolved:"+session.id+":"+session.selected;
            const controls=native.controls.length?native.controls:native.buttons;
            if(!session.confirmed&&(!targetBanners[T.byId[session.id].type].includes(native.banner)||
                session.selected&&controls.length!==1)&&!this.diagnosticKeys.has(key)){
              this.diagnosticKeys.add(key);
              this.trace("card-target-unresolved",{id:session.id,target:session.target,selected:session.selected,...native});
            }
            return native;
          });
          // The submitted card already owns this target session. Native equipment
          // pages have no title panel, including after the character is selected.
          const matched=preview.phase.phase==="unknown"&&preview.phase.turn==="none"&&
            targetBanners[T.byId[session.id].type].includes(preview.banner);
          const controls=preview.controls.length?preview.controls:preview.buttons;
          // Native control rectangles can move by a pixel between captures.
          // Stable page semantics authorize input; the latest unique control
          // supplies its coordinate, never an old rectangle.
          const next=matched?JSON.stringify([preview.banner,preview.phase.phase,preview.phase.turn,controls.length]):"";
          stable=next&&next===key?stable+1:next?1:0;key=next;
          if(stable>=2&&!session.selected){session.selected=true;this.clickAt(charX[session.target],720);
            this.trace("card-target-clicked",{id:session.id,target:session.target,banner:preview.banner});stable=0;key="";await sleep(500);}
          else if(stable>=2&&session.selected&&!session.confirmed&&controls.length===1){
            session.confirmed=true;const c=controls[0];this.clickAt(c.x+c.w/2,c.y+c.h/2);
            this.markNativeCardConfirmation(session.action,"targeted");stable=0;key="";await sleep(500);
          }
        }else if(session&&!session.confirmed&&["choice","unknown"].includes(last.phase)){
          const preview=this.frame(f=>({id:T.identify(this.titleIn(f,[45,115,360,50]))?.id,
            buttons:this.matches(f,"core/确定",[500,800,920,240])}));
          const matched=preview.id===session.id&&preview.buttons.length===1,next=matched?JSON.stringify(preview):"";
          stable=next&&next===key?stable+1:next?1:0;key=next;
          if(stable>=2){session.confirmed=true;const c=preview.buttons[0];this.clickAt(c.x+c.w/2,c.y+c.h/2);stable=0;key="";await sleep(500);}
        }else if(!session&&last.phase==="choice"&&last.recognized){
          const origin=this.confirmationSession?.plan?.action,
            ranked=T.generatedChoices(last.options.filter(o=>o.id),before||this.lastObservedState,memory,origin?T.realAction(origin):null),
            id=ranked[0]?.id,target=last.options.find(o=>o.id===id);
          const next=target?JSON.stringify([id,last.choiceKind,last.options.map(o=>[o.id,Math.round(o.point[0]/20)])]):"";
          stable=next&&next===key?stable+1:next?1:0;key=next;
          if(stable>=2){this.choiceSession={id,kind:last.choiceKind,origin:this.confirmationSession?.key||null,selected:true,confirmed:false,
              oldCount:this.frame(f=>this.nativeHandCountIn(f))};
            const inspected=this.choiceDetails.at(-1),reuse=inspected?.id===id&&Math.abs(inspected.point[0]-target.point[0])<=8;
            if(!reuse)this.clickAt(...target.point);
            this.trace("choice-selected",{id,kind:last.choiceKind,reusedInspection:reuse,candidates:ranked});stable=0;key="";await sleep(500);}
        }else if(!session&&last.phase==="choice"&&last.inspectable){
          const option=last.options.find(o=>!o.id&&!o.inspected),next=JSON.stringify([option.title,Math.round(option.point[0]/20)]);
          stable=next===key?stable+1:1;key=next;
          if(stable>=2){this.choiceSession={kind:"inspect",option,misses:0,origin:this.confirmationSession.key};
            this.clickAt(...option.point);this.trace("choice-inspect",{title:option.title,point:option.point});stable=0;key="";await sleep(500);}
        }else{stable=0;key="";}
        if(attempt<23)await sleep(250);
      }
      const e=Error("月绽放选择页尚未完成，保留已发送输入");e.code="TCG_CHOICE_RETRY";e.phase=last;throw e;
    }
    async observe(...args){
      const state=await super.observe(...args);
      if(this.pendingGeneratedChoice&&Array.isArray(state.hand)){
        const id=this.pendingGeneratedChoice.id,present=state.hand.some(h=>h.id===id),overflowPossible=this.pendingGeneratedChoice.oldCount===10;
        if(!present&&!overflowPossible){const e=Error("选择结果尚未出现在实际手牌中");e.code="TCG_HAND_RETRY";throw e;}
        this.choiceReceipt={...this.choiceReceipt,generatedPresent:present,overflowPossible};this.pendingGeneratedChoice=null;
        this.trace("choice-card-verified",{id,present,overflowPossible});
      }
      return {...state,choiceReceipt:this.choiceReceipt};
    }
    async cardConfirm(a,before){
      await this.requireNoWarning();const p=this.phase();if(p.phase==="choice")return;
      const type=T.byId[a.id].type;
      if(targetBanners[type]){
        this.choiceSession={kind:"target",id:a.id,target:a.target,action:a,origin:null,selected:false,confirmed:false};return;
      }
      if(p.result||p.phase==="board"&&p.turn==="user")return;
      // The drag has already been submitted. The existing choice owner completes
      // payment when its native scope/control is readable; never drag the card again.
      this.choiceSession={kind:"payment",id:a.id,action:a,origin:null,selected:true,confirmed:false};
    }
    async executeInput(a,before,memory){
      const phase=this.phase();if(phase.phase!=="board"||phase.turn!=="user"){
        const e=Error("执行前页面改变");e.code="TCG_OBSERVATION_INTERRUPTED";e.phase=phase;throw e;}
      const prepared=this.takePreparedHandInput(a,before);
      if(!prepared){if(!this.boardReady)await this.reset();await this.requireUnchangedBoard(before);}
      if(a.type==="probe")return a.scope==="card"?this.probeCard(a,before,memory,prepared):this.probeSkill(a,before,memory);
      if(a.type==="card"){
        const reason=T.cardInputError(before,a,memory);if(reason)throw Error(reason);
      }
      if(a.type==="skill"&&!T.skillLegal(before,a,memory))throw Error("技能资源或真实充能不足");
      // Random refunds and modified costs are adopted from observation, not Raiden's fixed prediction.
      this.expectedDice=null;this.gamblerBudget=null;this.choiceReceipt=null;this.choiceDetails=[];this.boardReady=false;
      if(a.type==="card"||a.type==="tune")await this.inputHand(a,before,memory,prepared);
      else if(a.type==="skill")await this.inputSkill(a,before,memory,T.size(T.skillCost(a.who,a.skill,memory,before)));
      else if(a.type==="switch")await this.inputSwitch(a,before,memory);
      else if(a.type==="end")await this.inputEnd();
      else throw Error("未支持的月绽放动作："+a.type);
      await sleep(1200);
    }
    async inputTechnique(a,before,memory){
      // Fourth skill slot at 1920x1080. The slot is only an opening attempt:
      // exact native title/type AND a stable actual price authorize the cast.
      // No reopen/cast is sent when this uncalibrated page fails verification.
      const x=1500,def=T.techniques[a.technique];
      this.clickAt(x,957);await sleep(900);
      let previous="",preview=null,stable=0;
      for(let i=0;i<6;i++){
        await this.requireNoWarning();
        preview=this.frame(f=>{
          return {name:this.ocr(f,[135,122,238,42]),detail:this.ocr(f,[70,210,320,85]),
            fee:number(this.numericAt(f,[x-18,1010,36,35],4)),phase:this.phaseIn(f)};
        });
        const matches=T.norm(preview.name)===T.norm(def.name)&&preview.detail.includes("特技")&&
          preview.fee!==null&&["board","unknown"].includes(preview.phase.phase)&&preview.phase.turn!=="enemy";
        const key=matches?JSON.stringify([preview.name,preview.detail,preview.fee]):"";
        stable=key&&key===previous?stable+1:matches?1:0;previous=key;
        this.trace("technique-preview",{id:a.technique,matched:matches,attempt:i,...preview});
        if(stable>=2)break;
        if(i<5)await sleep(250);
      }
      if(stable<2){
        // This is an unavailable action, not proof that the game rejected payment.
        // Suppress it for this round and let the existing refresh owner replan.
        T.rejectAction(memory,a);await this.reset();
        const e=Error("特技原生标题/类型/费用未核实，本回合改用其他合法动作");e.code="TCG_STATE_REFRESH";throw e;
      }
      const planned=T.size(T.skillCost(a.who,"T",memory,before));
      if(preview.fee!==planned){
        memory.costEvidence={source:"native-technique-preview",key:T.boardKey(before),who:a.who,technique:a.technique,n:preview.fee};
        await this.reset();const e=Error("特技实际费用变化，按真实费用重选动作");e.code="TCG_STATE_REFRESH";throw e;
      }
      this.clickAt(x,957);this.trace("skill-confirm-clicked",{who:a.who,skill:"T",technique:a.technique,fee:preview.fee});
    }
    async inputSkill(a,before,memory){
      if(a.skill==="T")return this.inputTechnique(a,before,memory);
      const x={NA:1608,E:1716,Q:1824}[a.skill];this.clickAt(x,957);await sleep(900);
      await this.requireNoWarning();await this.requireOpenedSkill(a,before,x,true);
      this.clickAt(x,957);this.trace("skill-confirm-clicked",{who:a.who,skill:a.skill});
    }
    adoptObservedState(state,reason){super.adoptObservedState(state,reason);this.expectedDice=null;this.gamblerBudget=null;}
    async confirm(a,before,m){return super.confirm(combatConfirmation(a,before),before,m);}
    async forcedActionProof(a,before){return super.forcedActionProof(combatConfirmation(a,before),before);}
  }
  root.TCGBetterGI={...root.TCGBetterGI,BetterGIHost:MoonHost};
  root.TCGMoonUI={attachmentFacts,combatConfirmation};
})(globalThis);
