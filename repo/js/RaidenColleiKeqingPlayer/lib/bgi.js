// Generated from 牌手共享. Edit layered source, not this standalone output.
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
  function costMarkerLayout(rects) {
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
    for (const seed of marks) {
      const row = marks.filter((m) => Math.abs(m.y - seed.y) <= 35).sort((a, b) => a.x - b.x),
        n = row.length;
      if (
        !handX[n] ||
        row.some((m, i) => Math.abs(m.x + 103 - handX[n][i]) > 32) ||
        row.some((m, i) => i > 0 && m.x - row[i - 1].x < 75) ||
        Math.max(...row.map((m) => m.y)) - Math.min(...row.map((m) => m.y)) > 35
      )
        continue;
      layouts.set(JSON.stringify(row.map((m) => [m.x, m.y])), {
        count: n,
        markers: row.map((m) => ({ x: m.x, y: m.y })),
        points: row.map((m) => m.x + 103),
      });
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
    if (
      assigned.some((a) => a.length !== 1) ||
      new Set(assigned.map((a) => a[0])).size !== numbers.length ||
      numbers.length !== layout.count
    )
      return null;
    return {
      count: layout.count,
      points: layout.points.slice(),
      markerYs: layout.markers.map((m) => m.y),
      costs: assigned.map((a) => a[0].value),
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
      own:s=>s.characters,enemy:s=>s.enemies,quicken:s=>s.quicken||null,support:s=>s.supportCounts||null};
    return Object.entries(fields).filter(([,read])=>JSON.stringify(read(before))!==JSON.stringify(read(after))).map(([name])=>name);
  }
  class BetterGIHost {
    constructor(options) {
      this.options = options;
      this.templates = new Map();
      this.roCache = new Map();
      // BetterGI LimitedFile accepts .log but rejects .jsonl. Contents remain one JSON object per line.
      this.path = "logs/run-" + new Date().toISOString().replace(/[:.]/g, "-") + ".log";
      this.snapshotNumber = 0;
      this.emptyHandProven = false;
      this.zeroDiceAllowed = false;
      this.expectedDice = null;
      this.gamblerMayAddDice = false;
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
      this.previewEvidence = new Set();
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
    choiceIn(f) {
      const header=TCG.norm(this.ocr(f,[700,155,520,130]));
      if(!header.includes("挑选卡牌") || !header.includes("请选择一张卡牌"))return null;
      // Native supplied 1920x1080 screenshot: names below the two cards at
      // y=742, cards centred at y=540. Anchor to exact OCR title rectangles,
      // not a fixed left/right preference or a guessed generic choice page.
      const rows=this.ocrRows(f,[450,705,1030,90]),options=[];
      for(const r of rows) {
        const card=TCG.identify(r.text);
        if(!card || !["shatterbolt","sharpkernel"].includes(card.id))continue;
        const point=[r.x+r.w/2,r.y+r.h/2-200];
        if(![r.x,r.y,r.w,r.h,...point].every(Number.isFinite) || r.w<=0 || r.h<=0 ||
            point[0]<450 || point[0]>1480 || point[1]<470 || point[1]>600)continue;
        options.push({id:card.id,point:mousePoint(...point),title:r.text});
      }
      return {phase:"choice",turn:"none",choiceKind:"thundergrass",options,
        recognized:options.length===2 && new Set(options.map(c=>c.id)).size===2};
    }
    async resolveChoice(before=null,memory=TCG.freshMemory()) {
      let stable=0,key="",last=null;
      for(let attempt=0;attempt<24;attempt++) {
        last=this.phase();
        if(last.phase!=="choice") {
          if(!this.choiceSession?.selected || !["board","pick","roll","settlement","result"].includes(last.phase) ||
              last.phase==="board" && !["user","enemy"].includes(last.turn)) {stable=0;key="";}
          else {
            const current=JSON.stringify([last.phase,last.turn,last.result]);stable=current===key?stable+1:1;key=current;
            if(stable>=2) {
              const session=this.choiceSession;this.choiceSession=null;
              this.invalidateHand("choice-generated-card-order-unknown");
              this.pendingChoiceCard={id:session.id,oldCount:session.oldCount};
              this.handCountHint=Number.isInteger(session.oldCount)?Math.min(10,session.oldCount+1):null;
              this.handFanReady=false;this.handNeedsReset=false;this.emptyHandProven=false;this.boardReady=false;
              this.trace("choice-resolved",{id:session.id,confirmationInputs:session.confirmed?1:0,phase:last.phase,turn:last.turn});
              return last;
            }
          }
        } else if(!this.choiceSession?.selected) {
          if(last.choiceKind!=="thundergrass" || !last.recognized) {stable=0;key="";}
          else {
            const id=TCG.blessingChoice(before||this.lastObservedState,memory),target=last.options.find(c=>c.id===id);
            const current=JSON.stringify([id,target?.point,last.options]);stable=current===key?stable+1:1;key=current;
            if(stable>=2 && target) {
              const oldCount=before?.hand?.length??this.handCache?.length??null;
              this.choiceSession={id,oldCount,selected:true,confirmed:false};
              this.clickAt(...target.point);this.trace("choice-selected",{id,point:target.point,proof:"two-stable-exact-card-labels-and-choice-header"});
              stable=0;key="";await sleep(500);
            }
          }
        } else if(!this.choiceSession.confirmed) {
          // The supplied screenshot has no confirm button before selection.
          // Allow immediate native resolution, or an explicit selected title
          // plus unique native confirm control; never blindly double-click.
          // Native 0.3.8 run: choice detail is in the left panel, unlike the
          // ordinary hand detail at x=311. Require that exact selected title
          // and the unique bottom confirm button, not a second card click.
          const preview=this.frame(f=>({title:TCG.identify(this.ocr(f,[45,115,360,50]))?.id,
            buttons:this.matches(f,"core/确定",[500,800,920,240])}));
          const matched=preview.title===this.choiceSession.id && preview.buttons.length===1;
          const current=matched?JSON.stringify(preview):"";stable=matched?(current===key?stable+1:1):0;key=current;
          if(stable>=2) {
            const b=preview.buttons[0];this.choiceSession.confirmed=true;
            const point=this.clickAt(b.x+b.w/2,b.y+b.h/2);this.trace("choice-confirm-clicked",{id:this.choiceSession.id,point});
            stable=0;key="";await sleep(500);
          }
        }
        if(attempt<23)await sleep(250);
      }
      const error=new Error("挑选卡牌状态未读清");
      error.code="TCG_CHOICE_RETRY";error.phase=last;throw error;
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
      if(p.phase!=="board"||p.turn!=="user") { this.boardReady=false; this.lastObservedAt=0; }
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
        if (TCG.norm(name) === TCG.norm(skillNames[who][skill]) && detail.includes(skillTypes[skill])) {
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
      const heading = this.ocr(f, [740, 123, 280, 44]);
      return TCG.characterName(name) >= 0 &&
        ["角色装备", "角色状态", "阵营出战状态"].includes(TCG.norm(heading))
        ? { name, heading }
        : null;
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
      this.captureEvidence("action-reroll-layout");
      throw new Error("战中重投等待超时：" + lastError);
    }
    skillFeeIn(f,action) {
      // Calibrated native preview fee row; identity is independently checked.
      // A normal-board skill icon or a cost from another card is never proof.
      const identity=this.skillPreviewIn(f).identity;
      if(identity?.who!==action.who || identity?.skill!==action.skill)return null;
      // Read the CURRENT action icon's die fee, not the nominal fee in the
      // left description. Native 1080P preview has Q energy in a separate
      // gold badge to the right: exclude it from this narrow numeric crop.
      const roi=action.skill==="Q"?[1780,1010,36,35]:action.skill==="E"?[1698,1010,36,35]:null;
      if(!roi)return null;
      const n=number(this.numericAt(f,roi,4)),nominal=action.skill==="Q"?(action.who===2?4:3):3;
      return n!==null&&n>=1&&n<=nominal?n:null;
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
        return {
          hp,
          dead: dead ? true : hp === null ? null : false,
          active: !dead && loweredValid && !conflict,
          aura,
          auraKnown: aura.length > 0 && aura.length <= 2,
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
    quickenIn(f) {
      // Saved native positives from Collei/Keqing, with separate native 1/2
      // badges. No extra UI input or OCR; absence/conflicts are UNKNOWN, not 0.
      const unknown={known:false,charges:null};
      const icons=this.matches(f,"quicken",[640,880,630,88],0.9,true);
      if(icons.length!==1)return unknown;
      const {x,y}=icons[0],roi=[x+25,y+17,24,32];
      const counts=[1,2].flatMap(n=>this.matches(f,"quicken_count"+n,roi,0.92,false).map(()=>n));
      return counts.length===1?{known:true,charges:counts[0]}:unknown;
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
          dice: dice.dice, diceKnown: phase.phase === "board" && (TCG.total(dice.dice) > 0 || this.zeroDiceAllowed), hand: null };
      });
    }
    boardExtrasIn(f,phase) { return {quicken:phase.phase==="board"?this.quickenIn(f):{known:false,charges:null}}; }
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
          const native = this.ocr(f, roi);
          const nativeCard = kind === "card" ? TCG.identify(native) : null;
          if (nativeCard && TCG.norm(native) !== TCG.norm(nativeCard.name)) {
            this.trace("title-exact-alias", {
              native,
              canonical: nativeCard.name,
              id: nativeCard.id,
              additionalInputs: 0,
            });
            return nativeCard.name;
          }
          const identified =
            kind === "character" ? TCG.characterName(native) >= 0 : !!TCG.identify(native);
          if (identified || !native) return native;
          const enlarged = this.numericAt(f, roi, 3);
          const recovered =
            kind === "character" ? TCG.characterName(enlarged) >= 0 : !!TCG.identify(enlarged);
          if (recovered) {
            this.trace("title-pixel-recovery", {
              roi,
              kind,
              native,
              enlarged,
              scale: 3,
              additionalInputs: 0,
            });
            return enlarged;
          }
          const proofKey = "unknown-title:" + TCG.norm(native);
          if (kind === "card" && !this.previewEvidence.has(proofKey)) {
            this.previewEvidence.add(proofKey);
            this.captureEvidence("unresolved-title");
          }
          return native;
        });
        reads.push(raw);
        const who = kind === "character" ? TCG.characterName(raw) : -1;
        const key = raw ? (who >= 0 ? "character:" + who : "title:" + TCG.norm(raw)) : "";
        const stable = !!key && key === previousKey;
        lastStable = stable ? raw : "";
        const matchesExpected = kind !== "character" || expected === null || who === expected;
        if (stable && matchesExpected) {
          if (!hover && !opening && !raw) this.handFanReady = false;
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
    }
    acceptHand(hand, reason) {
      this.handCache = TCG.indexedHand(hand);
      this.trace("hand-cache-updated", { reason, count: this.handCache.length });
    }
    costHandIn(f) {
      return this.memoFrame(f, "costHand", () => {
        const roi = [450, 750, 1310, 200];
        const matches = [
            ...this.matches(f, "hand_cost_neutral", roi, 0.9, false),
            ...this.matches(f, "hand_cost_element", roi, 0.9, false),
          ],
          layout = costMarkerLayout(matches);
        const unresolved = (reason, detail = {}) => {
          const key = "hand-cost-unresolved:" + reason;
          if (!this.previewEvidence.has(key)) {
            this.previewEvidence.add(key);
            const data = { reason, matches, layout, ...detail };
            // Preserve the actual failed frame, not a later settled screenshot.
            // At most one per failure kind per run; no normal-flow screenshots.
            if (typeof file.writeImageSync === "function" && (f.srcMat || f.SrcMat))
              try {
                data.screenshotPath = this.path.replace(
                  /\.log$/,
                  "-cost-unresolved-" + this.snapshotNumber++ + ".png",
                );
                file.writeImageSync(data.screenshotPath, f.srcMat ?? f.SrcMat);
              } catch (e) {
                data.snapshotError = String(e.message || e);
              }
            this.trace("hand-cost-unresolved", data);
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
          if (found.length > 1) return unresolved("ambiguous-digit", { marker: m, numbers });
          if (found.length === 1) continue;
          // Only missing locations: at most three local crops on the SAME frame.
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
            if (local.length > 1)
              return unresolved("ambiguous-digit", { marker: m, numbers, local });
            if (local.length === 1) {
              numbers.push(local[0]);
              recovered = true;
              break;
            }
          }
          if (!recovered)
            return unresolved("missing-digit", { marker: m, numbers, localRecoveryCalls });
        }
        const sample = costHandSample(layout, numbers);
        return sample
          ? { ...sample, localRecoveryCalls }
          : unresolved("unpaired-digit", { numbers });
      });
    }
    handSample(f) {
      this.lastCostSample = null;
      const count = this.handCountIn(f);
      return { count, cost: this.lastCostSample, source: this.lastHandCountSource };
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
        ) ||
        p.costs.some((x, i) => x !== q.costs[i])
      )
        return;
      this.handPositionProof = {
        count,
        points: q.points.slice(),
        costs: q.costs.slice(),
        revision: this.inputRevision,
        at: q.at,
      };
      this.trace("hand-cost-proof", {
        count,
        points: q.points,
        costs: q.costs,
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
      const cost = this.costHandIn(f);
      if (cost) {
        this.lastHandCountSource = "full-cost-layout";
        this.lastCostSample = { ...cost, revision: this.inputRevision, at: Date.now() };
        return cost.count;
      }
      // Grayscale rim gradient: usable-card gold glow must not change count.
      const layout = handLayoutCount(
        this.matches(f, "hand_rim", [500, 900, 1260, 135], 0.85, false).map((r) => r.x),
      );
      if (layout !== null) this.lastHandCountSource = "full-rim-layout";
      return layout;
    }
    recordHandLayout(count) {
      const key = "hand-layout:" + count;
      if (count >= 1 && count <= 4 && !this.previewEvidence.has(key)) {
        this.trace("hand-layout", { count });
        this.previewEvidence.add(key);
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
    async readHand(expected = this.handCountHint, evidence = null) {
      // Evidence passed here was obtained in this very observation, not an
      // estimated count or the previous action's projected hand.
      const n = evidence ? evidence.count : await this.handCount(expected);
      const hand = [];
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
      this.trace("hand-scan", { count: n, expected, reusedCount: !!evidence });
      for (let i = 0; i < n; i++) {
        const raw = await this.titleAt(points[i], 945, false, false, "card", null, true);
        const c = TCG.observedCard(raw, i);
        if (!c) {
          const error = new Error(
            "第 " + (i + 1) + " 张手牌卡名无法可靠读取：" + (raw || "OCR为空"),
          );
          error.code = "TCG_HAND_RETRY";
          throw error;
        }
        hand.push(c);
      }
      this.requireHandObservation(this.phase(), "before-hand-reset");
      await this.reset();
      this.handCountHint = null;
      return hand;
    }
    async observedHand(plan = null) {
      if (plan?.mode === "full") {
        this.invalidateHand("generated-drawn-or-replaced-card");
        return await this.readHand(plan.expectedCount ?? null);
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
          return await this.readHand();
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
          return await this.readHand();
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
        return await this.readHand(null,{count:n});
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
      return await this.readHand();
    }
    async settledBoard(pendingAction = false) {
      let previousKey = "", previousNormalHp = false, hpGapReads = 0, last = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        try { last = this.board(true); } catch (e) {
          if (e.code !== "TCG_DICE_RETRY") throw e;
          previousKey = ""; previousNormalHp = false; hpGapReads = 0;
          this.trace("board-settle-wait", {attempt, domain:"dice", error:String(e.message || e)});
          if (attempt < 11) await sleep(400);
          continue;
        }
        if (last.result || ["pick", "roll", "settlement", "choice"].includes(last.phase) || last.turn === "enemy") {
          this.releasePrecisionBoard("scene-exit");
          return {...last, hand:null};
        }
        const userBoard = last.phase === "board" && last.turn === "user";
        const hpGap = userBoard && [...(last.characters || []), ...(last.enemies || [])].some(
          c => c?.dead !== true && (!Number.isInteger(c?.hp) || c.hp < 1 || c.dead !== false));
        hpGapReads = hpGap ? hpGapReads + 1 : 0;
        const valid = userBoard && TCG.legalState({...last, hand:[]}) && TCG.enemyCount(last)!==null;
        let budgetValid = true;
        if (!pendingAction && userBoard) try { this.requireDiceBudget(last); } catch (e) { budgetValid = false; }
        const key = JSON.stringify([last.phase,last.turn,last.active,last.characters,last.dice,last.enemies,last.quicken || null]);
        if (valid && budgetValid && key === previousKey) {
          if (previousNormalHp && last.normalHpReadable === true) this.releasePrecisionBoard("two-stable-normal-hp-profiles");
          return {...last,nativeStability:{reads:2,key:TCG.boardKey({...last,hand:[]}),inputRevision:this.inputRevision}};
        }
        previousKey = valid && budgetValid ? key : "";
        previousNormalHp = valid && budgetValid && last.normalHpReadable === true;
        this.trace("board-settle-wait", {attempt,phase:last.phase,turn:last.turn,valid,budgetValid,hpGapReads});
        if (hpGapReads === 3 && !this.precisionBoard) {
          this.usePrecisionBoard("three-consecutive-user-hp-gaps");
          previousKey = ""; previousNormalHp = false;
        }
        if (attempt < 11) await sleep(400);
      }
      const error = new Error("行动页12次读取未稳定");
      error.code = "TCG_BOARD_RETRY"; throw error;
    }
    requireDiceBudget(state) {
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
          this.gamblerMayAddDice && state.active === gambler?.owner
            ? 2 * Math.min(gambler.remaining, defeats)
            : 0;
        if (extra !== 0 && !(extra > 0 && extra % 2 === 0 && extra <= refund)) {
          throw new Error(
            "骰子识别与已确认行动预算不符：预期 " +
              this.expectedDice +
              "，读取 " +
              TCG.total(state.dice),
          );
        }
      }
    }
    async observe(pendingAction = false, plan = null) {
      let hand = null;
      const scanBefore = this.handScanSerial;
      let resync = false;
      let reusableSettled=null,reusableSettledAt=0;
      for(let attempt=0;attempt<3;attempt++) {
        const settled=await this.settledBoard(true);
        if(settled.phase!=="board" || settled.turn!=="user")return {...settled,hand:null};
        if(!this.handNeedsReset && !this.handFanReady)this.boardReady=true;
        if (!pendingAction) try { this.requireDiceBudget(settled); } catch (e) {
          resync = true;
          this.trace("state-resync", { reason:"observation-budget", expectedDice:this.expectedDice, observedDice:TCG.total(settled.dice) });
        }
        const handReadStart=Date.now(),handInputRevision=this.inputRevision;
        if(plan?.mode==="remove" && plan.hand.length===0 && plan.action &&
            TCG.emptyHandEffect(plan.action,plan.before,settled,plan.transitionPassed===true)) {
          this.emptyHandProven=true;
          this.trace("empty-hand-proof",{action:plan.action,proof:"independent-native-effect"});
        }
        if(plan?.mode==="remove" && plan.hand.length===0 && !this.emptyHandProven)
          await this.proveEmptyHand(plan,settled);
        const effectProven = plan?.mode === "remove" && plan.action &&
          (TCG.removalEffect(plan.action, plan.before, settled) ||
           plan.action.type==="card"&&plan.action.id==="toss"&&plan.rerollConfirmed===true &&
           settled.active===plan.before.active && TCG.total(settled.dice)===TCG.total(plan.before.dice));
        try {
          const paidProven=this.paidRemovalProven(plan,settled);
          hand=await this.observedHand(effectProven || paidProven ? {...plan,effectProven,paidProven} : plan);
          if(this.pendingChoiceCard) {
            const {id,oldCount}=this.pendingChoiceCard;
            if(oldCount!==10 && !hand.some(c=>c.id===id)) {
              this.invalidateHand("selected-generated-card-not-yet-observed");
              const error=new Error("挑选结果尚未在实际手牌中出现");error.code="TCG_HAND_RETRY";throw error;
            }
            this.trace("choice-card-verified",{id,count:hand.length,overflowPossible:oldCount===10});this.pendingChoiceCard=null;
          }
          if(this.handScanSerial===scanBefore && this.inputRevision===handInputRevision && Date.now()-handReadStart<=700 &&
              !this.handFanReady && !this.handNeedsReset) { reusableSettled=settled; reusableSettledAt=handReadStart; }
          break;
        } catch(e) {
          if(e.code === "TCG_OBSERVATION_INTERRUPTED") return { ...e.phase, hand: null };
          if(e.code!=="TCG_HAND_RETRY" || attempt===2)throw e;
          this.trace("hand-read-deferred",{attempt,error:String(e.message||e)});
          if(attempt===1) {
            try {this.requireHandObservation(this.phase(),"before-hand-reanchor");}
            catch(interrupted) {
              if(interrupted.code==="TCG_OBSERVATION_INTERRUPTED")return {...interrupted.phase,hand:null};
              throw interrupted;
            }
            this.invalidateHand("two-unresolved-hand-observations");
            this.boardReady=false;await this.reset();await this.expand(false);
            this.trace("hand-reanchored",{attempt,maximumPerObservation:1,replayedAction:false});
          }
          await sleep(400);
        }
      }
      // Board snapshot comes after closing card-detail overlays.
      if(reusableSettled) {
        const state={...reusableSettled,hand,...(this.pendingHandEvidence?{handEvidence:this.pendingHandEvidence}:{})};
        if(!pendingAction&&resync)this.adoptObservedState(state,"observation-resync");
        if(!pendingAction)this.acceptHand(hand,"observed-stable-board");
        this.boardReady=true;this.lastObservedState=state;this.lastObservedAt=reusableSettledAt;
        this.lastObservedRevision=this.inputRevision;
        this.trace("board-snapshot-reused",{scope:"same-stable-observation-no-input",handCount:hand.length});
        return {...state,handRead:this.handScanSerial>scanBefore?"full":"cached",...(resync?{resynchronized:true}:{})};
      }
      let previousKey = "", last = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        try{last = this.board();}catch(e){
          if(e.code!=="TCG_DICE_RETRY")throw e;
          previousKey="";this.trace("board-read-wait",{attempt,error:String(e.message||e)});
          if(attempt<5)await sleep(300);continue;
        }
        if (last.result || ["pick", "roll", "settlement", "choice"].includes(last.phase) || last.turn === "enemy") {
          this.trace("observation-interrupted", { attempt, phase: last.phase, turn: last.turn });
          return { ...last, hand: null };
        }
        const state = { ...last, hand, ...(this.pendingHandEvidence?{handEvidence:this.pendingHandEvidence}:{}) };
        const key = JSON.stringify([last.phase, last.turn, last.active, last.dice, last.characters,last.enemies,last.quicken||null]);
        let budgetValid=true;
        if(!pendingAction)try{this.requireDiceBudget(state);}catch(e){budgetValid=false;}
        if (TCG.legalState(state) && TCG.enemyCount(state)!==null && key === previousKey) {
          if (!pendingAction && (!budgetValid || resync)) {
            this.adoptObservedState(state, "observation-resync");
            this.trace("state-resynced", { reason:"observation-budget", after:state });
          }
          if (!pendingAction) this.acceptHand(hand, "observed-stable-board");
          this.boardReady=true;
          this.lastObservedState=state;
          this.lastObservedAt=Date.now();this.lastObservedRevision=this.inputRevision;
          return { ...state, handRead: this.handScanSerial > scanBefore ? "full" : "cached",
            ...(!pendingAction && (!budgetValid || resync)?{resynchronized:true}:{}) };
        }
        previousKey = key;
        if (attempt < 5) await sleep(300);
      }
      this.trace("board-unstable", { last, pendingAction });
      // Preserve the already-read hand: another unstable board must NOT trigger
      // another hand scan. Recovery still requires a complete two-frame board.
      const settled=await this.settledBoard(true);
      if(settled.phase!=="board" || settled.turn!=="user")return {...settled,hand:null};
      const recovered={...settled,hand,...(this.pendingHandEvidence?{handEvidence:this.pendingHandEvidence}:{})};
      this.boardReady=true;
      this.lastObservedState=recovered;this.lastObservedAt=Date.now();this.lastObservedRevision=this.inputRevision;
      if(!pendingAction) {
        let budgetValid=true;try{this.requireDiceBudget(recovered);}catch(e){budgetValid=false;}
        if(!budgetValid || resync)this.adoptObservedState(recovered,"observation-resync");
        else this.acceptHand(hand,"observed-recovered-board");
      }
      return {...recovered,handRead:this.handScanSerial>scanBefore?"full":"cached"};
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
    async validateTeam() {
      const names = [];
      for (let i = 0; i < 3; i++) {
        await this.reset();
        const raw = await this.titleAt(charX[i], 720, false, false, "character", i);
        if (TCG.characterName(raw) !== i) throw new Error("角色顺序必须是雷电将军→柯莱→刻晴；第 " + (i + 1) + " 位实际读取：" + raw);
        names.push(TCG.team[i].name);
        this.trace("team-member", { index: i, raw, canonical: TCG.team[i].name });
      }
      await this.reset();
      this.trace("team", names);
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
      let selected = original.slice();
      const cards = [];
      const toggle = async (index) => {
        // First card's centre is covered by its own left detail panel.
        this.clickAt(startingXs[index] + 70, 540);
        await sleep(350);
        const observed = await this.openingSelections(startingXs);
        if (observed.some((value, i) => value !== (i === index ? !selected[i] : selected[i]))) {
          throw new Error("起手置换标记未证实，不重复点击第" + (index + 1) + "张牌");
        }
        selected = observed;
      };
      try {
        for (let i = 0; i < 5; i++) {
          const raw = await this.titleAt(startingXs[i] + 70, 540, true, false);
          const observed = await this.openingSelections(startingXs);
          if (observed.some((value, j) => value !== (j === i ? !selected[j] : selected[j]))) {
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
        const observed = await this.openingSelections(startingXs);
        selected = observed;
        for (let i = 0; i < 5; i++) if (selected[i] !== original[i]) await toggle(i);
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
      for (let i = 0; i < 5; i++) if (selected[i] !== final[i]) await toggle(i);
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
    paidRemovalProven(plan,state) {
      // Only ordinary paid statuses/equipment, never free, drawing, choice,
      // skill-casting or resource/healing cards. Last-card handling retains its
      // independent empty-hand proof. A projected fee or a drag is insufficient.
      const a=plan?.action,b=plan?.before,r=this.consumptionReceipt,stable=state?.nativeStability;
      if(plan?.mode!=="remove" || !Array.isArray(plan.hand) || plan.hand.length===0 ||
          a?.type!=="card" || !["lotus","mint","gambler","exile","tassel","raven","sword","shatterbolt","sharpkernel"].includes(a.id) ||
          !b?.hand || b.hand.length!==plan.hand.length+1 || b.hand[a.index]?.id!==a.id ||
          plan.transitionPassed===true || state?.phase!=="board" || state.turn!=="user" || state.active!==b.active ||
          stable?.reads!==2 || stable.inputRevision!==this.inputRevision || stable.key!==TCG.boardKey({...state,hand:[]}) ||
          !TCG.legalState({...state,hand:plan.hand}) || r?.inputSent!==true || r.nativeConfirmed!==true ||
          r.id!==a.id || r.index!==a.index || r.target!==(a.target??null) || r.beforeKey!==TCG.boardKey(b))return false;
      const expected=TCG.handPlan(a,b);
      if(expected.mode!=="remove" || JSON.stringify(expected.hand)!==JSON.stringify(TCG.indexedHand(plan.hand)))return false;
      const cost=TCG.size(TCG.byId[a.id].cost);
      return cost>0 && TCG.total(b.dice)-TCG.total(state.dice)===cost &&
        TCG.diceOrder.every(e=>(state.dice[e]||0)<=(b.dice[e]||0));
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
      throw new Error("阵亡换人长时间未取得完整出战证据");
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
      this.zeroDiceAllowed = false;
      this.expectedDice = 8;
      this.gamblerMayAddDice = false;
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
        const actualSpeed = TCG.norm(preview.speed);
        stable = matched ? (actualSpeed === previousSpeed ? stable + 1 : 1) : 0;
        previousSpeed = matched ? actualSpeed : null;
        if (stable >= 2) return { fast: actualSpeed === "快速行动", speed: actualSpeed };
        if (attempt < 5) await sleep(300);
      }
      throw new Error("切换确认页未核实横幅、控件与行动类型");
    }
    async cardConfirm(action, before=null) {
      await this.requireNoWarning();
      const type = TCG.byId[action.id].type;
      const foodPage = this.frame(f => ({banner:this.ocr(f,[740,510,450,65]),phase:this.phaseIn(f)}));
      const targetedBanners={food:["请选择一个角色食用料理"],legend:["请选择一个角色","对所选角色生效"],
        artifact:["请选择要装备圣遗物的角色","请选择一个角色装备圣遗物","请选择一个角色","对所选角色生效"],
        weapon:["请选择要装备武器的角色","请选择一个角色装备武器","请选择一个角色","对所选角色生效"]};
      if(type==="food"&&TCG.norm(foodPage.banner)==="请选择一个角色食用料理"&&
          (foodPage.phase.phase!=="unknown"||foodPage.phase.turn!=="none"))throw new Error("料理选人页面未核实");
      if(targetedBanners[type]?.includes(TCG.norm(foodPage.banner)) && foodPage.phase.phase==="unknown" && foodPage.phase.turn==="none"){
        if(!Number.isInteger(action.target)||action.target<0||action.target>2)throw new Error("卡牌目标不合法");
        const layout=type==="food"?"food":"targeted";
        if(type==="food") {
          // A visible banner alone may arrive before the selection input layer.
          // Observe readiness twice; do not drag or click the character again.
          if(before && !TCG.alive(before.characters?.[action.target]))throw new Error("料理目标未核实");
          await sleep(250);
          const ready=this.frame(f=>({banner:TCG.norm(this.ocr(f,[740,510,450,65])),phase:this.phaseIn(f)}));
          if(ready.banner!==TCG.norm(foodPage.banner)||ready.phase.phase!=="unknown"||ready.phase.turn!=="none")
            throw new Error("料理选人页面已改变，不发送选择");
        }
        const point=this.clickAt(charX[action.target],720);
        this.trace("card-target-clicked",{id:action.id,target:action.target,point,layout,banner:foodPage.banner});
        await sleep(500);let stable=0,key="";
        for(let attempt=0;attempt<6;attempt++){
          await this.requireNoWarning();
          const selected=this.frame(f=>({banner:TCG.norm(this.ocr(f,[740,510,450,65])),
            buttons:this.matches(f,"core/确定",[770,900,380,90]),rows:this.ocrRows(f,[770,900,380,90]),phase:this.phaseIn(f)}));
          // A direct native resolution is verified by confirm(), not assumed
          // successful here. Never send a second selection or a skill input.
          if(selected.phase.result || selected.phase.phase==="board" && selected.phase.turn==="user"){
            this.trace("card-target-resolved",{id:action.id,target:action.target,proof:"native-page-exit-only"});return;}
          const play=selected.rows.filter(r=>TCG.norm(r.text)==="打出手牌" || type==="food"&&TCG.norm(r.text)==="确定");
          const controls=selected.buttons.length?selected.buttons:play;
          const matched=selected.banner===TCG.norm(foodPage.banner)&&controls.length===1&&
            selected.phase.phase==="unknown"&&selected.phase.turn==="none";
          const current=matched?JSON.stringify([selected.banner,controls[0]]):"";
          stable=matched?(current===key?stable+1:1):0;key=current;
          this.trace("card-target-preview",{id:action.id,target:action.target,attempt,matched,...selected});
          if(stable>=2){const b=controls[0];const confirmPoint=this.clickAt(b.x+b.w/2,b.y+b.h/2);
            this.trace("card-confirm-clicked",{id:action.id,target:action.target,point:confirmPoint,layout});
            this.markNativeCardConfirmation(action,layout);
            await sleep(700);return;}
          if(attempt<5)await sleep(250);
        }
        if(type==="food")throw new Error("料理选人后未识别到唯一中央确定");
        this.captureEvidence("targeted-card-"+action.id);throw new Error("目标卡牌选人后确认页未核实");
      }
      // Native 星天之兆 opens a payment page with a CENTER button. Its detail
      // panel is gone and the right skill buttons are not the confirmation.
      const central = this.frame(f => {
        const roi = [770, 900, 380, 90];
        const text = this.ocr(f, roi), banner = this.ocr(f, [740, 510, 450, 65]);
        const targets = [];
        if (TCG.norm(text) === "打出手牌") {
          const started=Date.now();this.metrics.ocrCalls++;
          const rs=f.FindMulti(RecognitionObject.Ocr(...roi));
          for(let i=0;i<rs.count;i++) {
            const r=rs[i];
            if(TCG.norm(String(r.text??r.Text))==="打出手牌")targets.push({
              x:Number(r.x??r.X),y:Number(r.y??r.Y),w:Number(r.width??r.Width),h:Number(r.height??r.Height)});
          }
          this.metrics.ocrMs+=Date.now()-started;
        }
        return { text, banner, targets, phase:this.phaseIn(f) };
      });
      if (central.targets.length) {
        const card=TCG.byId[action.id],banner=TCG.norm(central.banner);
        const activeScope=["stars","voltage","calx","lost"].includes(action.id) && banner==="对我方出战角色生效";
        const namedEvent=["dice","draw","switch","energy","support","reroll","recovery"].includes(card.type) &&
          banner.startsWith("打出手牌") && TCG.identify(banner.slice(4))?.id===action.id;
        const talentWho=action.id==="penance"?2:action.id==="talent"?1:null;
        const activeTalent=talentWho!==null && action.target===talentWho && before?.active===talentWho &&
          TCG.alive(before.characters?.[talentWho]) && !before.characters[talentWho].frozen &&
          banner==="装备给出战中的"+TCG.norm(TCG.team[talentWho].name);
        if (central.targets.length !== 1 || !(action.target===null && (activeScope || namedEvent) || activeTalent) ||
            central.phase.phase !== "unknown" || central.phase.turn!=="none") {
          throw new Error("中央出牌确认页的卡牌类型/作用范围未核实");
        }
        const b = central.targets[0];
        // A talent is already selected on its active wearer. Confirm the
        // observed payment button once; the card itself invokes the skill.
        // Never add a target click or a separate skill cast here.
        let stable=1;
        for(let attempt=0;attempt<6;attempt++) {
          await sleep(250);await this.requireNoWarning();
          const current=this.frame(f=>({banner:TCG.norm(this.ocr(f,[740,510,450,65])),
            controls:this.ocrRows(f,[770,900,380,90]).filter(r=>TCG.norm(r.text)==="打出手牌"),phase:this.phaseIn(f)}));
          const c=current.controls[0],matched=current.banner===banner && current.controls.length===1 &&
            current.phase.phase==="unknown" && current.phase.turn==="none" &&
            Math.abs(c.x+c.w/2-b.x-b.w/2)<=3 && Math.abs(c.y+c.h/2-b.y-b.h/2)<=3;
          stable=matched?stable+1:0;
          this.trace("card-payment-preview",{id:action.id,attempt,matched,stable,...current});
          if(stable>=2)break;
          if(attempt===5)throw new Error("中央出牌确认控件未连续核实");
        }
        const point = this.clickAt(b.x+b.w/2,b.y+b.h/2);
        this.trace("card-confirm-clicked", { id:action.id, point, layout:"central", banner:central.banner });
        this.markNativeCardConfirmation(action,"central");
        await sleep(700);
        return;
      }
      if (action.target !== null && ["food", "artifact", "weapon", "wedge", "talent","legend"].includes(type)) {
        // Only click a target while the selected card is still displayed in its detail panel.
        const title = this.frame(f => this.ocr(f, [311, 115, 341, 50]));
        // A drag directly onto the intended character may already resolve the card.
        // In that case, issue no more input; the state verifier must prove acceptance.
        if (!title) return;
        if (TCG.identify(title)?.id !== action.id) throw new Error("出牌后的选目标页面未确认");
        this.clickAt(charX[action.target], 720);
        await sleep(500);
      }
      // Zero-cost untargeted events can resolve immediately. Never click a skill button
      // as a fallback confirmation for those events.
      const text = this.frame(f => this.ocr(f, [1550, 850, 360, 190]));
      if (/确认|使用|打出/.test(text) && !/无法|不足|不能/.test(text)) {
        const targets = this.frame(f => {
          const started=Date.now();this.metrics.ocrCalls++;
          const rs = f.FindMulti(RecognitionObject.Ocr(1550, 850, 360, 190));
          const out = [];
          for (let i = 0; i < rs.count; i++) {
            const r = rs[i];
            if (/^(确认|使用|打出)(卡牌)?$/.test(String(r.text ?? r.Text).replace(/\s/g, ""))) {
              out.push({ x: Number(r.x ?? r.X), y: Number(r.y ?? r.Y), w: Number(r.width ?? r.Width), h: Number(r.height ?? r.Height) });
            }
          }
          this.metrics.ocrMs+=Date.now()-started;return out;
        });
        if (targets.length !== 1) throw new Error("无法唯一识别出牌确认按钮");
        const b = targets[0];
        const point = this.clickAt(b.x + b.w / 2, b.y + b.h / 2);
        this.trace("card-confirm-clicked", { id: action.id, point });
        await sleep(700);
      }
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
      try {
        return await this.executeInput(action, before, memory);
      } catch (e) {
        this.consumptionReceipt = null;
        this.pendingHandEvidence = null;
        const nativeRejection = e.code === "TCG_NATIVE_REJECTION";
        if (!nativeRejection && !(action.type === "tune" && e.code === "TCG_TUNE_UNCONFIRMED"))
          throw e;
        // Dismiss the existing preview once. A missing tuning button is NOT a
        // rejection proof: Player must reread hand/resources before retrying.
        this.boardReady = false;
        await this.reset();
        const p = this.phase();
        if (p.phase !== "board" || p.turn !== "user") throw e;
        if (nativeRejection) e.code = "TCG_INPUT_REJECTED";
        throw e;
      }
    }
    async executeInput(action, before, memory) {
      if(action.type==="card") {
        const reason=TCG.cardInputError(before,action,memory);
        if(reason)throw new Error(reason);
      }
      if (action.type === "tune" && !before.hand.some(h => h.index===action.index && h.id===action.id && TCG.handCardKnown(h))) throw new Error("未核实身份的牌禁止调和");
      const inputPhase=this.phase();
      if(inputPhase.phase!=="board" || inputPhase.turn!=="user") {
        const error=new Error("执行前已不是我方回合");
        error.code="TCG_OBSERVATION_INTERRUPTED";error.phase={...inputPhase,hand:null};throw error;
      }
      if(!this.boardReady)await this.reset();else this.trace("hand-reset-skipped",{reason:"verified-clean-board-before-input"});
      await this.requireUnchangedBoard(before);
      if(action.type==="probe")return this.probeSkill(action,before,memory);
      if (action.type === "skill" && !TCG.skillLegal(before, action, memory)) throw new Error("技能资源/充能预检失败");
      const cost = action.type === "skill" ? TCG.size(TCG.skillCost(action.who, action.skill, memory,before)) :
        action.type === "switch" ? (memory.freeSwitch ? 0 : 1) :
        action.type === "card" ? TCG.size(TCG.byId[action.id].cost) : 0;
      this.expectedDice = action.type === "end" ? null : TCG.total(before.dice) - cost +
        (action.type === "card" ? (action.id === "woven" || action.id === "lost" ? 1 : action.id === "companion" ? 2 : 0) : 0);
      this.zeroDiceAllowed = this.expectedDice === 0;
      const wearer=action.type==="switch"?action.target:action.type==="skill"?action.who:
        action.type==="card"&&action.id==="wedge"?2:before.active;
      this.gamblerBudget=memory.artifactKinds?.[wearer]==="gambler" ?
        {owner:wearer,remaining:TCG.gamblerRemaining(memory,wearer),enemies:TCG.enemyCount(before)}:null;
      this.gamblerMayAddDice=!!this.gamblerBudget && this.gamblerBudget.remaining>0;
      this.boardReady=false;
      if (action.type === "skill" && action.who === 2 && action.skill === "E" && !before.hand.some(c => c.id === "wedge")) {
        this.emptyHandProven = false;
      }
      if (action.type === "card" || action.type === "tune") await this.inputHand(action,before,memory);
      else if(action.type==="skill") await this.inputSkill(action,before,memory,cost);
      else if(action.type==="switch") await this.inputSwitch(action,before,memory);
      else if(action.type==="end") await this.inputEnd();
      else throw new Error("禁止执行动作："+action.type);
      await sleep(1200);
    }
    async inputHand(action,before,memory) {
      await this.prepareHandInput(before.hand.length);
      const current = before.hand;
      const h = current.find(c => c.index === action.index);
      if (!h || h.id !== action.id) throw new Error("执行前重新核对卡名失败");
      if(!this.handFanReady)await this.expand();
      const x = this.handPoints(current.length)[action.index];
      const title = TCG.observedCard(await this.titleAt(x, 945, false, false, "card", null, true),action.index);
      if (title?.id !== action.id) await this.refreshHandBeforeInput("拖牌前最后一次卡名校验失败");
      if(this.phase().turn!=="user")throw new Error("拖牌前回合已改变");
      const targeted = action.type === "card" && action.target !== null;
      this.consumptionReceipt={id:action.id,index:action.index,target:action.target??null,
        beforeKey:TCG.boardKey(before),inputSent:false};
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
    async inputSkill(action,before,memory,cost) {
      const x = { NA: 1608, E: 1716, Q: 1824 }[action.skill];
      this.clickAt(x, 957);
      await sleep(900);
      await this.requireNoWarning();
      // This second click confirms the already-open skill, not a repeated attempt.
      const preview=await this.requireOpenedSkill(action,before,x,!!memory.thundergrassSupport);
      if(preview?.fee!==null && preview?.fee!==undefined) {
        this.expectedDice=TCG.total(before.dice)-preview.fee;
        this.zeroDiceAllowed=this.expectedDice===0;
        this.trace("skill-fee-budget",{who:action.who,skill:action.skill,nominal:cost,actual:preview.fee,
          expectedDice:this.expectedDice,source:"current-confirmed-preview"});
      }
      this.clickAt(x, 957);
      this.trace("skill-confirm-clicked", { who: action.who, skill: action.skill, point: [x, 957] });
    }
    async inputSwitch(action,before,memory) {
      if(!Number.isInteger(action.target) || action.target<0 || action.target>2 ||
          action.target===before.active || before.characters[action.target].dead!==false)throw new Error("切换目标非法");
      // Clicking the character opens its details. Verify its exact identity
      // before opening the payment overlay, without clicking that card again.
      const raw=await this.titleAt(charX[action.target],720,false,false,"character",action.target);
      if(TCG.characterName(raw)!==action.target)throw new Error("切换目标角色标题未核实");
      this.clickAt(1820, 958);
      await sleep(800);
      const preview=await this.requireSwitchPreview(action,memory);
      this.clickAt(1820, 958);
      this.trace("switch-confirm-clicked",{target:action.target,point:[1820,958],fast:preview.fast,predictedFast:memory.fastSwitch});
    }
    async inputEnd() {
      await this.clickButton("回合结束", [0, 0, 384, 1080]);
      if (this.phase().turn === "user") await this.clickButton("回合结束", [0, 0, 384, 1080]);
    }
    async prepareHandInput(expected) {
      this.requireHandObservation(this.phase(), "before-target-expand");
      // execute already normalized and verified the board; do not blank-click
      // a second time simply to raise the fan.
      await this.expand(false);
      // Known order/count comes from this session's confirmed hand. Look for
      // visible anomalies without the redundant 1–4-card boundary/title loop.
      let samples;
      try {
        samples = [this.frame((f) => this.handSample(f))];
        await sleep(120);
        samples.push(this.frame((f) => this.handSample(f)));
      } catch (e) {
        if (e.code !== "TCG_HAND_RETRY") throw e;
        await this.refreshHandBeforeInput("执行前手牌数量证据冲突");
        throw e;
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
    async confirm(action, before, memory=TCG.freshMemory()) {
      try { return await this.confirmPending(action,before,memory); }
      finally { this.consumptionReceipt=null;this.pendingHandEvidence=null; }
    }
    async confirmPending(action, before, memory=TCG.freshMemory()) {
      const deadline = Date.now() + 45000;
      let transition = false;
      let plan = action.type === "end" ? null : {...TCG.handPlan(action, before),action,before};
      while (Date.now() < deadline) {
        const p = this.phase();
        if (p.result) return { ...p, confirmed: true };
        if(p.phase==="choice") {
          try{await this.resolveChoice(before,memory);}catch(e){if(e.code!=="TCG_CHOICE_RETRY")throw e;
            this.trace("choice-deferred",{action,reason:e.message});await sleep(300);continue;}
          plan={mode:"full",action,before,expectedCount:this.handCountHint};continue;
        }
        if(p.phase==="roll" && action.type==="card" && action.id==="toss"){
          const proof=await this.actionReroll(before,memory);
          plan={...plan,rerollConfirmed:proof?.confirmations===2};continue;
        }
        if (p.turn === "enemy") transition = true;
        if (action.type === "end" && TCG.verify(action, before, p)) return { ...p, confirmed: true };
        if (p.phase === "pick") {
          // A forced replacement is an ordinary phase, not a lost-session
          // error. Preserve this session's memory, never replay the cast.
          const combat = ["skill", "switch", "end"].includes(action.type) ||
            action.type === "card" && ["talent", "wedge","penance"].includes(action.id);
          if(plan?.mode==="unchanged")this.acceptHand(plan.hand,"forced-pick-unchanged-action");
          else this.invalidateHand("forced-character-pick-hand-changing-action");
          this.trace("confirmation-forced-pick", { action, transition, confirmed:combat && transition });
          return { ...p, confirmed:combat && transition };
        }
        if (p.turn === "user") {
          let after;
          try {
          this.requireHandObservation(p, "before-confirm-reset");
          const preResetEvidence=await this.removalEvidenceBeforeReset(plan);
          // Hand-changing SKILLS also resolve without a hand overlay. Only a
          // genuine dirty hand/card input needs normalization before proof.
          if (!this.boardReady && (this.handNeedsReset || this.handFanReady)) await this.reset();
          if(preResetEvidence && this.inputRevision>=preResetEvidence.revision && this.inputRevision<=preResetEvidence.revision+1)
            plan={...plan,preResetEvidence:{...preResetEvidence,revision:this.inputRevision}};
          // observe owns stable board, hand and consumption proof; no separate
          // full proof board before its already-stable observation.
          after = await this.observe(true,plan?{...plan,transitionPassed:transition}:null);
          } catch (e) {
            if(["TCG_BOARD_RETRY","TCG_DICE_RETRY"].includes(e.code)) {
              this.trace("confirmation-read-deferred",{action,code:e.code,reason:String(e.message||e)});
              await sleep(400);continue;
            }
            if (e.code !== "TCG_OBSERVATION_INTERRUPTED") throw e;
            after = { ...e.phase, hand: null };
          }
          // readHand/observe can cross an actual turn transition. It returns
          // only phase metadata then, never a fabricated character/dice state.
          if(after.result)return {...after,confirmed:true};
          if(after.phase!=="board" || after.turn!=="user") {
            if(after.turn==="enemy")transition=true;
            this.trace("confirmation-deferred",{action,phase:after.phase,turn:after.turn});
            await sleep(450);continue;
          }
          const verified = TCG.verify(action, before, after, transition);
          let budgetMatches = true;
          try { this.requireDiceBudget(after); } catch (e) { budgetMatches = false; }
          if (verified && budgetMatches) {
            this.acceptHand(after.hand, "confirmed-" + (plan?.mode || "full"));
            return { ...after, confirmed: true };
          }
          // Board resources are independent of hand order. A verified action,
          // or a hand-preserving action, needs no second full hand scan.
          this.trace("state-resync", { action, verified, budgetMatches, expectedDice:this.expectedDice, observedDice:TCG.total(after.dice), reuseFullRead:after.handRead === "full" });
          if (!verified && plan?.mode!=="unchanged" && after.handRead !== "full") {
            // A verified consumption/count is useful candidate ordering, not
            // permission to skip the independent count/title checks below.
            const expectedCount=verified && Array.isArray(after.hand)?after.hand.length:null;
            this.invalidateHand("post-action-state-mismatch");
            this.emptyHandProven = false;
            after = await this.observe(true, { mode:"full",expectedCount });
          }
          if (after.result) return { ...after, confirmed:true };
          if (after.phase !== "board" || after.turn !== "user") {
            if (after.turn === "enemy") transition = true;
            this.trace("confirmation-deferred", { action, phase:after.phase, turn:after.turn });
            await sleep(450); continue;
          }
          if (!TCG.legalState(after)) throw new Error("完整重同步仍存在不可读状态");
          const recovered = TCG.verifyResynchronized(action, before, after, transition);
          this.adoptObservedState(after, "post-action-resync");
          this.trace("state-resynced", { action, confirmed:recovered, after });
          return { ...after, confirmed:recovered, resynchronized:true };
        }
        if (p.phase === "roll" && (["skill", "switch"].includes(action.type) || action.type==="card"&&["talent","penance","wedge"].includes(action.id)) && transition) {
          return { ...p, confirmed: true };
        }
        await sleep(450);
      }
      throw new Error("动作结果等待超时（45秒）");
    }
    adoptObservedState(state, reason) {
      if (!TCG.legalState(state)) throw new Error("重同步状态无效，不能作为下一动作基线");
      this.expectedDice = TCG.total(state.dice);
      this.zeroDiceAllowed = this.expectedDice === 0;
      this.gamblerMayAddDice = false;
      this.gamblerBudget = null;
      this.emptyHandProven = state.hand.length === 0;
      this.boardReady=true;
      this.lastObservedState=state;
      this.lastObservedAt=0;this.lastObservedRevision=-1;
      this.consumptionReceipt=null;this.pendingHandEvidence=null;
      this.acceptHand(state.hand, reason);
    }
    captureEvidence(label) {
      let saved = null;
      try {
        this.frame((f) => {
          saved = this.path.replace(/\.log$/, "-" + label + "-" + this.snapshotNumber++ + ".png");
          if (file.writeImageSync(saved, f.srcMat ?? f.SrcMat) === false)
            throw new Error("证据截图写入失败");
        });
      } catch (e) {
        this.trace("evidence-capture-failed", { label, reason: String(e.message || e) });
        return;
      }
      this.trace("evidence-captured", { label, path: saved });
    }
    snapshot(reason) {
      const data = { reason, capture: null, screenshotPath: null };
      try {
        // Diagnostic capture is raw and must work even when gameplay ROIs cannot.
        const f = captureGameRegion();
        try {
          data.capture = captureSize(f);
          const path = this.path.replace(/\.log$/, "-stop-" + this.snapshotNumber++ + ".png");
          if (file.writeImageSync(path, f.srcMat ?? f.SrcMat) === false)
            throw new Error("截图文件写入失败：" + path);
          data.screenshotPath = path;
        } finally {
          f.dispose();
        }
      } catch (e) {
        data.snapshotError = String(e.message || e);
        log.warn("诊断截图保存失败：" + data.snapshotError);
      }
      // A screenshot failure must not erase the original reason from the run log.
      try {
        this.trace("stop", data);
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
  root.TCGBetterGI = { BetterGIHost, handX, handLayoutCount, charX, number, captureSize, costMarkerLayout, costDigitRows, costNumbersAt, costHandSample, boardDifferences };
})(globalThis);
