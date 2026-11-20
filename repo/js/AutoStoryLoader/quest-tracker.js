// 按完整任务名称选择并追踪。作为表达式加载，便于独立验证和复用。
(function () {
  "use strict";
  const REGIONS = {
    chrome: [35, 20, 710, 130],
    list: [70, 145, 685, 780],
    title: [810, 55, 990, 115],
    buttons: [1420, 900, 450, 150],
    detail: [810, 165, 1050, 730],
    footer: [30, 945, 730, 110],
    menu: [105, 370, 640, 430]
  };
  const normalize = value => String(value || "").normalize("NFKC")
    .replace(/[^\u3400-\u9fffA-Za-z0-9]/g, "").toLowerCase();
  const plain = value => String(value || "").replace(/\s/g, "");
  const buttonText = row => plain(row.text).replace(/^[\[【(（]?[VvFf][\]】)）]?|[\[【(（]?[VvFf][\]】)）]?$/g, "");
  const stopped = row => /^(取消追踪|停止追踪|已追踪|追踪中)$/.test(buttonText(row));
  const start = row => /^(追踪|追踪目标|追踪任务|开始追踪)$/.test(buttonText(row));
  function failure(message) {
    const error = new Error("任务追踪失败：" + message);
    error.questTracking = true;
    return error;
  }
  function joinRows(rows) {
    // OCR 可能把同一标题分为相邻文字框；保留原始行，并合并同一行片段。
    const result = rows.slice();
    const lines = [];
    for (const row of rows.slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
      const center = row.y + row.height / 2;
      let line = lines.find(item => Math.abs(item.center - center) <= Math.max(10, row.height / 2));
      if (!line) { line = { center, rows: [] }; lines.push(line); }
      line.rows.push(row);
    }
    for (const line of lines) {
      const sorted = line.rows.sort((a, b) => a.x - b.x);
      for (let i = 0; i < sorted.length; i++) {
        let merged = { ...sorted[i] };
        for (let j = i + 1; j < sorted.length; j++) {
          const next = sorted[j];
          const gap = next.x - merged.x - merged.width;
          if (gap < -3 || gap > 65) break;
          const top = Math.min(merged.y, next.y);
          merged = { ...merged, text: merged.text + next.text,
            width: next.x + next.width - merged.x, y: top,
            height: Math.max(merged.y + merged.height, next.y + next.height) - top };
          result.push(merged);
        }
      }
    }
    return result;
  }
  function matches(rows, target) {
    return joinRows(rows).filter(row => normalize(row.text) === target);
  }
  function candidateRows(rows, target) {
    const candidates = matches(rows, target);
    const unique = [];
    for (const row of candidates) {
      if (!unique.some(other => Math.abs(other.y - row.y) < 15)) unique.push(row);
    }
    return unique.sort((a, b) => a.y - b.y);
  }
  function trackingState(rows) {
    const joined = joinRows(rows);
    const tracked = joined.some(stopped);
    // 即使否定词与按钮文字没有成功拼合，也绝不把后半个「追踪」当成启动按钮。
    const negative = joined.some(row => /取消|停止/.test(plain(row.text)));
    const button = tracked || negative ? null : joined.filter(start)
      .sort((a, b) => b.text.length - a.text.length)[0];
    return { tracked, button };
  }
  const summary = rows => rows.map(row => row.text).join(" | ").slice(0, 400) || "（空）";
  const fingerprint = rows => rows.map(row => normalize(row.text)).filter(Boolean).join("|");

  function create(io, options) {
    const opts = options || {};
    const maxPages = opts.maxPages || 24;
    const timeoutMs = opts.timeoutMs || 120000;
    let deadline = 0;
    let expected = "";
    let displayName = "";
    const checkTime = () => {
      if (io.now() > deadline) throw failure("查找超时，已停止；请确认任务已接取、名称完整且当前分类包含该任务");
    };
    async function read(area) {
      checkTime();
      return await io.read(area);
    }
    async function journalObservation() {
      const chrome = await read("chrome");
      const title = await read("title");
      const buttons = await read("buttons");
      const footer = await read("footer");
      const header = joinRows(chrome).some(row => /^(任务|任务列表|全部任务|进行中的任务)(?:[0-9/（）()]+)?$/.test(plain(row.text)));
      const taskFooter = joinRows(footer).some(row => /传说任务|邀约事件|任务一览/.test(plain(row.text)));
      const state = trackingState(buttons);
      const hasTitle = title.some(row => normalize(row.text).length >= 2);
      // 派蒙菜单也有「任务」，但位于菜单格子里，不在 chrome 区域；
      // 未识别到页头时，要求任务详情标题 + 追踪按钮或任务页专属底栏。
      return { isJournal: header || (hasTitle && (state.tracked || !!state.button || taskFooter)),
        chrome, title, buttons, footer };
    }
    async function paimonTaskButton() {
      const rows = joinRows(await read("menu"));
      const labels = ["队伍配置", "背包", "角色", "成就", "商城", "好友"];
      const count = labels.filter(label => rows.some(row => plain(row.text) === label)).length;
      return count >= 3 ? rows.find(row => plain(row.text) === "任务") : null;
    }
    async function openJournal() {
      checkTime();
      let observation = await journalObservation();
      if (observation.isJournal) return;
      // 一次运行只触发一次打开动作；界面加载期间只读取，不再次按 J。
      let taskButton = await paimonTaskButton();
      if (!taskButton) {
        await io.returnMainUi();
        await io.sleep(600);
        observation = await journalObservation();
        if (observation.isJournal) return;
        taskButton = await paimonTaskButton();
      }
      if (taskButton) {
        io.info("识别到派蒙菜单，从菜单中的任务入口打开（仅一次）");
        await io.click(taskButton);
      } else {
        io.info("打开任务列表（仅一次）");
        await io.press("VK_J");
      }
      for (let i = 0; i < 12; i++) {
        await io.sleep(500);
        observation = await journalObservation();
        if (observation.isJournal) return;
      }
      io.info("任务界面识别：页头=" + summary(observation.chrome) + "；详情标题=" + summary(observation.title)
        + "；按钮=" + summary(observation.buttons) + "；底栏=" + summary(observation.footer));
      throw failure("未确认任务界面。页头=" + summary(observation.chrome) + "；标题=" + summary(observation.title)
        + "；按钮=" + summary(observation.buttons) + "。请查看日志中的界面识别结果");
    }
    async function selectAllIfVisible() {
      const chrome = await read("chrome");
      const all = chrome.find(row => /^(全部|全部任务)$/.test(plain(row.text)));
      if (all) {
        await io.click(all);
        await io.sleep(500);
      }
    }
    async function titleMatches() {
      return matches(await read("title"), expected).length > 0;
    }
    async function selectCandidate(rows) {
      const candidates = candidateRows(rows, expected);
      if (!candidates.length) return false;
      if (candidates.length > 2) throw failure("当前页存在超过两个同名条目，请手动区分后再运行");
      // 同名分组 + 同名子任务：按用户规则选择下面一项，不点击上方分组。
      const row = candidates[candidates.length - 1];
      if (candidates.length === 2) io.info("识别到两个同名条目，默认选择下面一项：" + displayName);
      // 列表只用于选中；必须再次核对右侧标题才能点击追踪按钮。
      await io.click(row);
      for (let i = 0; i < 3; i++) {
        await io.sleep(450);
        if (await titleMatches()) return true;
      }
      throw failure("选中后详情标题不匹配「" + displayName + "」，不会点击追踪。标题识别：" + summary(await read("title")));
    }
    async function findAndSelect() {
      // 即使右侧已显示同名标题，也先处理可见的两个同名条目，确保选择下面一项。
      let rows = await read("list");
      if (candidateRows(rows, expected).length > 1 && await selectCandidate(rows)) return;
      // J 通常保留上次选中任务，单一目标无需滚动。
      if (await titleMatches()) return;
      await selectAllIfVisible();
      rows = await read("list");
      if (await selectCandidate(rows)) return;
      // 从当前位置先向上找，抵达顶部后向下完整扫描；每次滚动均有上限。
      for (const direction of [1, -1]) {
        let previous = fingerprint(rows);
        let unchanged = 0;
        for (let page = 0; page < maxPages; page++) {
          checkTime();
          await io.scroll(direction * 5);
          await io.sleep(400);
          rows = await read("list");
          if (await selectCandidate(rows)) return;
          const current = fingerprint(rows);
          // 空 OCR 不作为到达列表边界的证据。
          unchanged = current && current === previous ? unchanged + 1 : 0;
          previous = current;
          if (unchanged >= 2) break;
          if (page === maxPages - 1 && direction === 1) {
            throw failure("向上滚动达到上限仍未确认列表顶部，请先手动滚动到顶部再运行");
          }
        }
      }
      throw failure("未找到「" + displayName + "」。请填写任务列表中的完整名称，并确认任务已接取、所在分组已展开");
    }
    async function selectedState() {
      if (!(await titleMatches())) return { matched: false, buttons: [] };
      const buttons = await read("buttons");
      return { matched: true, buttons, ...trackingState(buttons) };
    }
    async function verify() {
      // 单次操作模式：验证只能读取当前画面，不能重新打开、选中或追踪。
      for (let i = 0; i < 6; i++) {
        await io.sleep(450);
        if ((await selectedState()).tracked) return true;
      }
      const observation = await journalObservation();
      if (!observation.isJournal) {
        // 游戏可能在点击后自动离开任务页；没有状态证据时不能声称已确认成功。
        return false;
      }
      if (matches(observation.title, expected).length && trackingState(observation.buttons).tracked) return true;
      throw failure("点击后未确认「" + displayName + "」已追踪；可能有前置条件、角色占用或识别失败。不会重新打开或重复点击");
    }
    async function run(name) {
      displayName = String(name || "").trim();
      expected = normalize(displayName);
      if (!expected) throw failure("请填写任务完整名称");
      deadline = io.now() + timeoutMs;
      try {
        io.info("开始按名称追踪任务（单次操作版 1.4.1）：" + displayName);
        await openJournal();
        await findAndSelect();
        let state;
        for (let i = 0; i < 3; i++) {
          state = await selectedState();
          if (state.tracked || state.button) break;
          await io.sleep(400);
        }
        if (!state.matched) throw failure("详情标题已变化，停止操作");
        let verified = !!state.tracked;
        if (state.tracked) {
          io.info("目标任务已经处于追踪状态，保留现状");
        } else {
          if (!state.button) {
            throw failure("没有找到可用的追踪按钮。按钮：" + summary(state.buttons) + "；详情：" + summary(await read("detail")));
          }
          io.info("点击追踪按钮（仅一次）：" + displayName);
          await io.click(state.button);
          verified = await verify();
        }
        await io.returnMainUi();
        if (verified) {
          io.info("已确认追踪任务：" + displayName);
        } else {
          (io.warn || io.info)("已执行一次追踪操作，结果未核验：" + displayName + "。当前画面已无法确认任务详情，不再重开任务列表，继续后续流程");
        }
        return verified;
      } catch (error) {
        if (error && error.questTracking) throw error;
        throw failure(String(error && error.message || error));
      }
    }
    return { run };
  }

  function createBgi() {
    function read(area) {
      const image = captureGameRegion();
      try {
        const sx = image.width / 1920, sy = image.height / 1080;
        if (!(sx > 0) || !(sy > 0) || Math.abs(sx / sy - 1) > 0.01) {
          throw failure("目前支持 16:9 游戏画面，请检查分辨率");
        }
        const roi = REGIONS[area];
        const found = image.findMulti(RecognitionObject.ocr(
          Math.round(roi[0] * sx), Math.round(roi[1] * sy),
          Math.round(roi[2] * sx), Math.round(roi[3] * sy)));
        const rows = [];
        const count = typeof found.count === "number" ? found.count : found.length;
        for (let i = 0; i < count; i++) {
          const row = found[i];
          rows.push({ text: String(row.text), x: row.x / sx, y: row.y / sy,
            width: row.width / sx, height: row.height / sy });
        }
        return rows;
      } finally { image.dispose(); }
    }
    const tracker = create({
      now: () => Date.now(), read, sleep,
      info: message => log.info(message),
      warn: message => log.warn(message),
      returnMainUi: () => genshin.returnMainUi(),
      press: async key => {
        keyDown(key);
        try { await sleep(100); } finally { keyUp(key); }
      },
      click: row => click(Math.round(row.x + row.width / 2), Math.round(row.y + row.height / 2)),
      scroll: amount => { moveMouseTo(510, 540); verticalScroll(amount); }
    });
    return {
      run: async name => {
        const metrics = Array.from(getGameMetrics());
        setGameMetrics(1920, 1080, 1);
        try { return await tracker.run(name); }
        finally { setGameMetrics(metrics[0], metrics[1], metrics[2]); }
      }
    };
  }
  return { create, createBgi, normalize, matches, trackingState, REGIONS };
})();
