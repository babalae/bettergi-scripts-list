const ocrRegion1 = { x: 0, y: 230, width: 500, height: 100 };

(async function () {
  const data = loadData();
  const kmHook = new KeyMouseHook();
  const skipKey = (typeof settings !== "undefined" && settings && settings.skipKey) ? settings.skipKey : "R";
  const autoRecognize = (typeof settings !== "undefined" && settings && typeof settings.autoRecognize !== "undefined") ? settings.autoRecognize : true;
  let skipWait = false;
  kmHook.OnKeyDown((key) => {
    if (key === skipKey) {
      skipWait = true;
    }
  });
  const sleepOrSkip = async (ms) => {
    const step = 100;
    const endTime = Date.now() + ms;
    while (Date.now() < endTime) {
      if (skipWait) {
        skipWait = false;
        return true;
      }
      await sleep(Math.min(step, endTime - Date.now()));
    }
    return false;
  };
  log.info("按 {0} 可跳过等待并立刻识别", skipKey);
  log.info("自动识别: {0}", autoRecognize ? "开启" : "关闭");
  try {
  let emptyCount = 0;
  let lastTextKey = "";
  let lastResultKey = "";
  while (true) {
    // 自动识别关闭时：仅在按下跳过按键后才进行一次识别
    if (!autoRecognize) {
      let triggered = await sleepOrSkip(24 * 60 * 60 * 1000);
      if (!triggered) {
        continue;
      }
    }
    let texts = ocr(ocrRegion1.x, ocrRegion1.y, ocrRegion1.width, ocrRegion1.height);
    if (!texts || texts.length === 0) {
      emptyCount++;
      log.info(`未识别到内容，计数 ${emptyCount}/50`);
      if (emptyCount >= 50) {
        log.warn("连续未识别达到上限，退出循环");
        break;
      }
      await sleepOrSkip(1000);
      continue;
    }

    emptyCount = 0;
    // 仅在识别结果发生变化时输出，避免刷屏
    let textKey = texts.join(" | ").trim();
    if (textKey === lastTextKey) {
      await sleepOrSkip(5000);
      continue;
    }
    if (lastResultKey) {
      log.info("==== 识别结果 ====");
    }
    lastTextKey = textKey;
    lastResultKey = textKey;
    log.debug(`识别到文本: ${textKey}`);

    // 解析 OCR 文本，提取冒号后的台词内容
    let parsedList = parseOcrTexts(texts);
    if (parsedList.length === 0) {
      log.info("未获取到可用台词内容，继续识别");
      await sleepOrSkip(1000);
      continue;
    }

    for (let i = 0; i < parsedList.length; i++) {
      let parsed = parsedList[i];
      // 在数据集中查找匹配台词的角色
      let matches = findCharactersByLine(parsed, data);
      if (matches.length === 0) {
        log.info(`未命中台词: ${parsed.content}`);
        continue;
      }
      logMatches(matches);
    }

    await sleepOrSkip(5000);
  }
  } finally {
    kmHook.Dispose();
  }
})();

/* 加载数据
* @returns {Object} - 返回解析后的数据对象
*/
function loadData() {
  try {
    const data = JSON.parse(file.readTextSync('data.json'));
    return data;
  } catch (error) {
    log.error(`加载数据失败: ${error}`);
    throw error;
  }
}


/*
* OCR 区域识别
* @param {number} x - X坐标
* @param {number} y - Y坐标
* @param {number} width - 宽度
* @param {number} height - 高度
* @returns {string[]} texts - 识别到的文本数组
*/
function ocr(x, y, width, height) {
  let captureRegion = null;
  try {
    captureRegion = captureGameRegion();
    let ocrRo = RecognitionObject.ocr(x, y, width, height);
    let resList = captureRegion.findMulti(ocrRo);
    let texts = [];
    for (let i = 0; i < resList.count; i++) {
      let res = resList[i];
      if (res && res.text) {
        texts.push(res.text);
      }
    }
    return texts;
  } catch (error) {
    log.error(`OCR 失败: ${error}`);
    return [];
  } finally {
    if (captureRegion) {
      captureRegion.dispose();
    }
  }
}

/*
* 按台词分类识别结果
* @param {string[]} texts
* @param {Object[]} data
* @returns {{matches: Array<{name: string, type: string, text: string}>}}
*/
function parseOcrTexts(texts) {
  let parsed = [];
  for (let i = 0; i < texts.length; i++) {
    let raw = texts[i];
    if (!raw) {
      continue;
    }
    let cleaned = raw.replace(/[\"“”]/g, "").trim();
    let colonIndex = cleaned.indexOf("：");
    if (colonIndex < 0) {
      colonIndex = cleaned.indexOf(":");
    }
    if (colonIndex < 0) {
      continue;
    }
    let prefix = cleaned.slice(0, colonIndex).trim();
    let content = cleaned.slice(colonIndex + 1).trim();
    if (!content) {
      continue;
    }    let category = detectCategory(prefix);
    // 没有“前两字/首字”标记时，认为是完整台词
    let isFull = prefix.indexOf("（前两字）") < 0
      && prefix.indexOf("(前两字)") < 0
      && prefix.indexOf("（首字）") < 0
      && prefix.indexOf("(首字)") < 0;
    parsed.push({ raw, content, isFull, prefix, category });
  }
  return parsed;
}

function detectCategory(prefix) {
  let p = String(prefix || "").replace(/\s+/g, "");
  if (p.includes("元素战技")) {
    return "elementSkill";
  }
  if (p.includes("元素爆发")) {
    return "elementBurst";
  }
  if (p.includes("入队语音") || p.includes("加入队伍")) {
    return "joinVoice";
  }
  if (p.includes("倒下语音") || p === "倒下") {
    return "fallVoice";
  }
  if (p.includes("宝箱语音") || p.includes("打开宝箱") || p.includes("宝箱")) {
    return "chestVoice";
  }
  if (p.includes("命之座")) {
    return "constellation";
  }
  if (p.includes("天赋")) {
    return "talent";
  }
  return "unknown";
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .replace(/[\"“”]/g, "")
    .replace(/[\p{P}\p{S}]/gu, "")
    .trim();
}

function isDialogueKey(key) {
  return key.indexOf("台词") >= 0
    || key.indexOf("语音") >= 0
    || key.indexOf("命之座") >= 0
    || key.indexOf("天赋") >= 0
    || key.indexOf("鍙拌瘝") >= 0;
}

function getName(item) {
  let keys = Object.keys(item || {});
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i];
    if (k.indexOf("角色") >= 0 || k.indexOf("瑙掕壊") >= 0) {
      return item[k];
    }
  }
  return "";
}

function buildCharacterInfo(item) {
  let info = {};
  for (let key in item) {
    if (isDialogueKey(key)) {
      continue;
    }
    info[key] = item[key];
  }
  return info;
}

function isMatch(content, value, isFull) {
  let c = normalizeText(content);
  let v = normalizeText(value);
  if (!c || !v) {
    return false;
  }
  // 完整台词严格匹配，前两字/首字走前缀/包含匹配
  if (isFull) {
    if (v === c) {
      return true;
    }
    if (shouldUseLooseMatch(v)) {
      return isLooseMatch(c, v, 2);
    }
    return false;
  }
  if (c.length <= 2) {
    return v.indexOf(c) === 0;
  }
  return v.indexOf(c) >= 0 || c.indexOf(v) >= 0;
}

function shouldUseLooseMatch(text) {
  const specialChars = ["貘"];
  for (let i = 0; i < specialChars.length; i++) {
    if (text.indexOf(specialChars[i]) >= 0) {
      return true;
    }
  }
  return false;
}

function isLooseMatch(shortText, fullText, maxMissing) {
  let a = shortText;
  let b = fullText;
  if (a.length > b.length) {
    let tmp = a;
    a = b;
    b = tmp;
  }
  if (b.length - a.length > maxMissing) {
    return false;
  }
  return lcsLength(a, b) >= b.length - maxMissing;
}

function lcsLength(a, b) {
  let m = a.length;
  let n = b.length;
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = curr[j - 1] > prev[j] ? curr[j - 1] : prev[j];
      }
    }
    let temp = prev;
    prev = curr;
    curr = temp;
    for (let k = 0; k <= n; k++) {
      curr[k] = 0;
    }
  }
  return prev[n];
}
function findCharactersByLine(parsed, data) {
  let matches = [];
  if (!parsed || !parsed.content || !data) {
    return matches;
  }
  let allowKey = (key) => {
    if (!key || !isDialogueKey(key)) {
      return false;
    }
    switch (parsed.category) {
      case "elementSkill":
        return key.indexOf("元素战技台词") >= 0;
      case "elementBurst":
        return key.indexOf("元素爆发台词") >= 0;
      case "joinVoice":
        return key.indexOf("入队语音") >= 0;
      case "fallVoice":
        return key.indexOf("倒下语音") >= 0;
      case "chestVoice":
        return key.indexOf("宝箱语音") >= 0;
      case "constellation":
        return key.indexOf("命之座") >= 0;
      case "talent":
        return key.indexOf("天赋") >= 0;
      default:
        return true;
    }
  };

  let collectMatches = (isFullFlag) => {
    let out = [];
    for (let i = 0; i < data.length; i++) {
      let item = data[i];
      for (let key in item) {
        if (!allowKey(key)) {
          continue;
        }
        let val = item[key];
        if (typeof val !== "string" || !val) {
          continue;
        }
        if (isMatch(parsed.content, val, isFullFlag)) {
          out.push({
            name: getName(item),
            info: buildCharacterInfo(item)
          });
          break;
        }
      }
    }
    return out;
  };

  // 先按“完整匹配”尝试；若完全匹配不到，再降级为“只用前几个字/部分内容匹配”（解决长文本OCR截断问题）
  matches = collectMatches(parsed.isFull);
  if (matches.length > 0) {
    return matches;
  }

  if (parsed.isFull) {
    let normalized = normalizeText(parsed.content);
    // 太短的内容降级会产生大量误匹配，这里做个下限
    if (normalized.length >= 3) {
      let relaxed = collectMatches(false);
      if (relaxed.length > 0) {
        // 去重（同一角色可能在多个字段命中）
        let seen = {};
        let uniq = [];
        for (let i = 0; i < relaxed.length; i++) {
          let name = relaxed[i].name;
          if (seen[name]) {
            continue;
          }
          seen[name] = true;
          uniq.push(relaxed[i]);
        }
        return uniq;
      }
    }
  }

  return matches;
}

function logMatches(matches) {
  if (!matches || matches.length === 0) {
    return;
  }

  // “只显示角色名”时仅输出角色名
  if (typeof settings !== "undefined" && settings && settings.onlyName) {
    for (let i = 0; i < matches.length; i++) {
      let m = matches[i];
      log.info("角色名：{0}", m.name);
    }
    return;
  }

  if (matches.length < 3) {
    for (let i = 0; i < matches.length; i++) {
      let m = matches[i];
      log.info("命中角色：{0}", m.name);
      log.info(formatFullInfo(m.info, m.name), m.name);
    }
  } else {
    for (let i = 0; i < matches.length; i++) {
      let m = matches[i];
      log.info(formatBriefInfo(m.info, m.name), m.name);
    }
  }

  if (matches.length >= 2) {
    log.info(`命中数量: ${matches.length}`);
  }
}

function isNameKey(key) {
  return key.indexOf("角色") >= 0 || key.indexOf("瑙掕壊") >= 0;
}

function formatFullInfo(info, name) {
  let parts = [];
  let hasName = false;
  for (let key in info) {
    if (isNameKey(key)) {
      parts.push(`${key}：{0}`);
      hasName = true;
      continue;
    }
    parts.push(`${key}：${info[key]}`);
  }
  if (!hasName && name) {
    parts.unshift("角色名：{0}");
  }
  return parts.join("，");
}

function formatBriefInfo(info, name) {
  let parts = [];
  let hasName = false;
  for (let key in info) {
    if (isNameKey(key)) {
      parts.push("{0}");
      hasName = true;
      continue;
    }
    let val = info[key];
    if (val === undefined || val === null || String(val).trim() === "") {
      continue;
    }
    parts.push(String(val));
  }
  if (!hasName && name) {
    parts.unshift("{0}");
  }
  return parts.join(",");
}








