/// <reference path="bettergi.d.ts" />
(async function () {
  // ============================================================
  // 砺行修远 · 按进度领奖 v2.0（含奖励名自检）
  // 1) 星期闸门：勾选的星期才执行
  // 2) 进度：勾“手动指定进度”用填的 N/8，否则图像识别
  // 3) 1~7 档：只点第 N 档那一个节点
  // 4) 8/8：点中央宝箱 → 连点右下角 UID 直到弹窗消失、回到活动页
  //          → 再点左下“砺行复礼”宝箱
  // ============================================================

  const cfg = (typeof settings !== "undefined" && settings) ? settings : {};

  function toArr(v) { if (!v) return []; try { return Array.from(v); } catch (e) { return []; } }
  function num(v, d) { const n = parseInt(String(v), 10); return isNaN(n) ? d : n; }

  const openAuto = cfg.openMenuAutomatically !== false;
  const entryMode = String(cfg.entryMode || "F5快捷键");
  const debug = cfg.debugMode === true;
  const clickDelay = Math.max(200, num(cfg.clickDelayMs, 900));
  const blankX = num(cfg.blankX, 1770);
  const blankY = num(cfg.blankY, 940);

  const nodeCoords = String(cfg.nodeCoords ||
    "1068,525;1155,665;1275,702;1422,695;1550,595;1605,470;1525,350")
    .split(";").map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; })
    .map(function (s) { const p = s.split(","); return { x: parseInt(p[0], 10), y: parseInt(p[1], 10) }; });

  const chestX = num(cfg.chestX, 1330);          // 8/8 第 1 次点击：中央宝箱
  const chestY = num(cfg.chestY, 430);
  const giftChestX = num(cfg.giftChestX, 575);   // 8/8 关弹窗后：砺行复礼宝箱
  const giftChestY = num(cfg.giftChestY, 790);
  const uidX = num(cfg.uidClickX, 1775);         // 右下角 UID 区域
  const uidY = num(cfg.uidClickY, 1052);
  const uidMaxClicks = Math.max(2, num(cfg.uidClickMax, 8));

  // 1/8 → 8/8 每档预期奖励名（用于点完后的自检；用 | 分隔同义写法）
  const tierNames = String(cfg.tierNames ||
    "精锻用魔矿;智识之冕;大英雄的经验;祝圣之霜;摩拉;启圣之尘;祝圣精华;命之座")
    .split(";").map(function (s) { return s.trim(); });

  // ---------------- 0. 星期闸门 ----------------
  const WEEK_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const CN_TO_NUM = { "周日": 0, "周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5, "周六": 6,
                      "日": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6 };

  function parseWeekdayList(raw) {
    const arr = toArr(raw);
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const s = String(arr[i]).trim();
      let v = -1;
      if (CN_TO_NUM[s] !== undefined) v = CN_TO_NUM[s];
      else if (/^\d$/.test(s)) v = parseInt(s, 10);
      else if (s.length >= 2 && CN_TO_NUM[s.substr(1)] !== undefined) v = CN_TO_NUM[s.substr(1)];
      if (v >= 0 && v <= 6 && out.indexOf(v) === -1) out.push(v);
    }
    return out;
  }

  if (cfg.enableWeekdayLimit === true) {
    const days = parseWeekdayList(cfg.runWeekdays);
    const today = new Date().getDay();
    if (days.length === 0) {
      log.warn("星期限制已开但一个星期都没勾，本次跳过。请在自定义配置里勾上要跑的星期。");
      return;
    }
    log.info("星期检查：今天 {0}（{1}），允许 {2}", WEEK_NAMES[today], today,
      days.map(function (d) { return WEEK_NAMES[d]; }).join("、"));
    if (days.indexOf(today) === -1) {
      log.info("今天不在允许执行的星期内，跳过本次任务。");
      return;
    }
  }

  const page = new BvPage();
  let successCount = 0;
  let clickCount = 0;

  function cnt(list) { if (!list) return 0; return typeof list.Count === "number" ? list.Count : list.length; }
  function txt(r) { return (r && r.Text) ? String(r.Text) : ""; }
  function ocr() { return page.ocr(); }

  function findByText(list, kw) {
    const out = [];
    for (let i = 0; i < cnt(list); i++) if (txt(list[i]).indexOf(kw) !== -1) out.push(list[i]);
    return out;
  }
  function dumpOcr(list, tag) {
    if (!debug) return;
    log.info("==== OCR[{0}] 共 {1} 条 ====", tag, cnt(list));
    for (let i = 0; i < Math.min(cnt(list), 40); i++)
      log.info("[{0}] \"{1}\" ({2},{3}) {4}x{5}", i, txt(list[i]), list[i].X, list[i].Y, list[i].Width, list[i].Height);
  }

  function ocrProgress() {
    const list = ocr();
    dumpOcr(list, "进度识别");
    for (let i = 0; i < cnt(list); i++) {
      const m = txt(list[i]).match(/(\d+)\s*\/\s*8/);
      if (m) { const v = parseInt(m[1], 10); if (v >= 0 && v <= 8) return v; }
    }
    const bar = findByText(list, "完成进度");
    if (bar.length > 0) {
      const bx = bar[0].X, by = bar[0].Y;
      for (let i = 0; i < cnt(list); i++) {
        const r = list[i];
        if (Math.abs(r.Y - by) < 60 && Math.abs(r.X - bx) < 300) {
          const m = txt(r).match(/(\d+)\s*\/\s*8/);
          if (m) return parseInt(m[1], 10);
        }
      }
    }
    return -1;
  }

  // 任何弹窗（物品详情 / 命之座激活 / 命星获取）
  function popupOpen(list) {
    const l = list || ocr();
    return findByText(l, "当前拥有").length > 0 ||
           findByText(l, "限时活动奖励").length > 0 ||
           findByText(l, "角色天赋素材").length > 0 ||
           findByText(l, "命之座").length > 0;
  }
  // 活动页是否可见（第三张图那种状态）
  function onActivityPage(list) {
    const l = list || ocr();
    return findByText(l, "砺行复礼").length > 0 ||
           findByText(l, "完成进度").length > 0 ||
           findByText(l, "砺行修远").length > 0;
  }
  function isDetailPopup() { return popupOpen(); }
  function isSuccessToast() { return findByText(ocr(), "领取成功").length > 0; }

  // 点完之后看弹窗里是不是该档说的那个奖励，确认点对了位置
  function verifyTierName(tier) {
    const name = tierNames[tier - 1];
    if (!name) return true;
    const list = ocr();
    const parts = String(name).split("|");
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (p && findByText(list, p).length > 0) {
        log.info("奖励校验 {0}/8：命中『{1}』", tier, p);
        return true;
      }
    }
    log.warn("奖励校验 {0}/8：没看到『{1}』，可能点位或进度与预期不符", tier, name);
    return false;
  }

  async function closePopup() {
    page.click(blankX, blankY);
    await sleep(600);
    if (isDetailPopup()) { page.click(blankX - 40, blankY - 60); await sleep(500); }
  }

  async function clickAndHandle(x, y, label) {
    page.click(x, y);
    await sleep(clickDelay);
    if (cnt(ocr()) === 0) {          // 卡顿时画面还没刷新，多等一下再看
      log.info("{0}：点击后画面还没出字，多等 0.7 秒", label);
      await sleep(700);
    }
    clickCount++;
    if (isSuccessToast()) {
      successCount++;
      log.info("{0}：领取成功", label);
      await sleep(600);
      if (isDetailPopup()) await closePopup();
      return true;
    }
    if (isDetailPopup()) {
      log.info("{0}：弹出物品/命座详情（已领过或该档未达成）", label);
      return false;
    }
    log.info("{0}：无弹窗", label);
    return false;
  }

  // 连点右下角 UID，连续两次确认“弹窗没了 + 活动页在”才停（抗卡顿）
  async function clearByUidClicks(tag) {
    let stable = 0;
    for (let i = 1; i <= uidMaxClicks; i++) {
      page.click(uidX, uidY);
      await sleep(600);

      let list = ocr();
      if (cnt(list) === 0) {
        log.info("UID 点击第 {0} 次：OCR 没读到内容（可能卡顿），等 0.8 秒重试", i);
        await sleep(800);
        list = ocr();
      }

      const open = popupOpen(list);
      const onPage = onActivityPage(list);
      log.info("UID 点击第 {0} 次：弹窗{1}，活动页{2}", i, open ? "仍在" : "已消失", onPage ? "可见" : "不可见");

      if (!open && onPage) {
        stable++;
        if (stable >= 2) {
          log.info("{0}：连续 2 次确认已回到活动页，停止点击 UID", tag);
          return true;
        }
        await sleep(800);   // 多看一帧，避免某一帧看着干净就误停
      } else if (cnt(list) === 0) {
        // 读不到内容时不算干净，也不算脏，保持现状继续点
      } else {
        stable = 0;
      }
    }
    log.warn("{0}：点了 {1} 次 UID 仍未稳定回到活动页", tag, uidMaxClicks);
    return false;
  }

  // ---------------- 1. 回主界面 ----------------
  log.info("[1/5] 返回主界面");
  await genshin.returnMainUi();
  await sleep(600);

  // ---------------- 2. 打开活动一览 ----------------
  if (openAuto) {
    log.info("[2/5] 打开活动一览，方式：{0}", entryMode);
    let opened = onActivityPage();
    if (!opened) {
      for (let i = 0; i < 3 && !opened; i++) {
        if (entryMode === "ESC菜单") {
          keyPress("ESCAPE");
          await sleep(1000);
          const entry = findByText(ocr(), "活动").filter(function (r) {
            const t = txt(r);
            return t === "活动" || (t.indexOf("活动") !== -1 && t.indexOf("活动一览") === -1 && t.indexOf("活动说明") === -1);
          });
          if (entry.length > 0) {
            page.click(entry[0].X + entry[0].Width / 2, entry[0].Y + entry[0].Height / 2);
            await sleep(clickDelay);
          }
        } else {
          keyPress("F5");
        }
        await sleep(1400);
        opened = onActivityPage();
        if (!opened) log.info("第 {0} 次未检测到活动一览，重试", i + 1);
      }
    } else {
      log.info("已在活动一览页，跳过打开");
    }
    if (!opened) {
      log.error("打不开活动一览：请确认游戏在主界面且有焦点，或关闭【自动打开】后手动停在该页再运行。");
      return;
    }
  }

  // ---------------- 3. 进入砺行修远 ----------------
  log.info("[3/5] 选中砺行修远");
  let actEntered = false;
  for (let i = 0; i < 3 && !actEntered; i++) {
    const hits = findByText(ocr(), "砺行修远");
    if (hits.length > 0) {
      let target = hits[0];
      for (let k = 1; k < hits.length; k++) if (hits[k].X < target.X) target = hits[k];
      page.click(target.X + target.Width / 2, target.Y + target.Height / 2);
      await sleep(clickDelay + 400);
      const after = ocr();
      if (findByText(after, "完成进度").length > 0 || findByText(after, "本周进度").length > 0) actEntered = true;
      else if (hits.length >= 2) actEntered = true;
    } else {
      moveMouseTo(300, 760);
      verticalScroll(-2);
      await sleep(800);
    }
  }
  if (!actEntered) { log.error("没进入砺行修远页面，中止"); return; }
  await sleep(1000);

  // ---------------- 4. 决定进度 & 点击 ----------------
  let progress = -1;
  if (cfg.useManualProgress === true) {
    progress = num(cfg.manualProgress, -1);
    if (progress < 0 || progress > 8) {
      log.error("手动进度填的是“{0}”，不是 0~8 的数字，中止。", String(cfg.manualProgress));
      return;
    }
    log.info("[4/5] 使用手动配置的进度：{0}/8（未做图像识别）", progress);
  } else {
    log.info("[4/5] 图像识别读取进度");
    progress = ocrProgress();
    if (progress < 0) {
      log.error("没读到“完成进度 N/8”。可勾选【使用手动指定的进度】填数字绕开识别，或勾调试模式把 OCR 日志发我。");
      return;
    }
    log.info("识别到完成进度：{0}/8", progress);
  }

  if (progress === 0) {
    log.warn("进度 0/8，没有可领奖励。");
  } else if (progress <= 7) {
    const c = nodeCoords[progress - 1];
    if (c) {
      log.info("只点第 {0}/8 档节点 ({1},{2})", progress, c.x, c.y);
      await clickAndHandle(c.x, c.y, "第 " + progress + " 档");
      verifyTierName(progress);
      if (popupOpen()) {
        log.info("关闭该档弹窗");
        await closePopup();
      }
    } else {
      log.error("坐标表里没有第 {0} 档，检查自定义配置里的 nodeCoords", progress);
    }
  } else {
    // 8/8
    log.info("8/8 第 1 次点击：中央宝箱 ({0},{1})", chestX, chestY);
    await clickAndHandle(chestX, chestY, "中央宝箱");
    verifyTierName(8);

    log.info("连点右下角 UID 关闭弹窗（最多 {0} 次）", uidMaxClicks);
    const cleared = await clearByUidClicks("中央宝箱后");
    if (!cleared) {
      log.warn("仍未回到活动页，为防误点跳过砺行复礼宝箱。");
    } else {
      log.info("8/8 第 2 次点击：砺行复礼宝箱 ({0},{1})", giftChestX, giftChestY);
      await clickAndHandle(giftChestX, giftChestY, "砺行复礼宝箱");
      if (popupOpen()) {
        log.info("关闭砺行复礼弹窗");
        await clearByUidClicks("砺行复礼后");
      }
    }
  }

  log.info("[4/5] 完成：点击 {0} 次，领取成功 {1} 次", clickCount, successCount);
  if (findByText(ocr(), "选择命星").length > 0) {
    log.warn("页面有“选择命星”：不可逆命座兑换，需手动操作。");
  }

  // ---------------- 5. 退出 ----------------
  log.info("[5/5] 退出活动一览");
  keyPress("ESCAPE");
  await sleep(700);
  keyPress("ESCAPE");
  await sleep(700);
  await genshin.returnMainUi();

  if (typeof settings !== "undefined" && settings) {
    settings.lastRunAt = new Date().toISOString();
    settings.lastProgress = String(progress);
    settings.lastSuccessCount = String(successCount);
  }
  log.info("砺行修远自动领取结束，进度 {0}/8，成功 {1} 次", progress, successCount);
})();



