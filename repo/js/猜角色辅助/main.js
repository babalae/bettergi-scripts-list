const ocrRegion1 = { x: 0, y: 230, width: 500, height: 100 };

(async function () {
  const data = loadData();
  let emptyCount = 0;
  let lastTextKey = "";
  let lastResultKey = "";
  while (true) {
    let texts = ocr(ocrRegion1.x, ocrRegion1.y, ocrRegion1.width, ocrRegion1.height);
    if (!texts || texts.length === 0) {
      emptyCount++;
      log.info(`未识别到内容，计数 ${emptyCount}/50`);
      if (emptyCount >= 50) {
        log.warn("连续未识别达到上限，退出循环");
        break;
      }
      await sleep(5000);
      continue;
    }

    emptyCount = 0;
    // 仅在识别结果发生变化时输出，避免刷屏
    let textKey = texts.join(" | ").trim();
    if (textKey === lastTextKey) {
      await sleep(5000);
      continue;
    }
    if (lastResultKey) {
      log.info("==== 识别结果 ====");
    }
    lastTextKey = textKey;
    lastResultKey = textKey;
    log.info(`识别到文本: ${textKey}`);

    // 解析 OCR 文本，提取冒号后的台词内容
    let parsedList = parseOcrTexts(texts);
    if (parsedList.length === 0) {
      log.info("未获取到可用台词内容，继续识别");
      await sleep(5000);
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

    await sleep(5000);
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
    }
    // 没有“前两字/首字”标记时，认为是完整台词
    let isFull = prefix.indexOf("（前两字）") < 0
      && prefix.indexOf("(前两字)") < 0
      && prefix.indexOf("（首字）") < 0
      && prefix.indexOf("(首字)") < 0;
    parsed.push({ raw, content, isFull, prefix });
  }
  return parsed;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .replace(/[\"“”]/g, "")
    .trim();
}

function isDialogueKey(key) {
  return key.indexOf("台词") >= 0 || key.indexOf("鍙拌瘝") >= 0;
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
    return v === c;
  }
  if (c.length <= 2) {
    return v.indexOf(c) === 0;
  }
  return v.indexOf(c) >= 0 || c.indexOf(v) >= 0;
}

function findCharactersByLine(parsed, data) {
  let matches = [];
  if (!parsed || !parsed.content || !data) {
    return matches;
  }
  for (let i = 0; i < data.length; i++) {
    let item = data[i];
    for (let key in item) {
      if (!isDialogueKey(key)) {
        continue;
      }
      let val = item[key];
      if (typeof val !== "string" || !val) {
        continue;
      }
      if (isMatch(parsed.content, val, parsed.isFull)) {
        matches.push({
          name: getName(item),
          info: buildCharacterInfo(item)
        });
        break;
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
  if (settings && settings.onlyName) {
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
