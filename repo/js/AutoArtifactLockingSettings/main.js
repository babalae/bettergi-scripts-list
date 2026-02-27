import { findTextInRegion, smoothDragVertical } from './lib.js';

// 延迟时间默认值（单位：毫秒）
const DEFAULT_DELAY_SHORT = 75;
const DEFAULT_DELAY_MEDIUM = 200;
const DEFAULT_DELAY_LONG = 1000;
const DEFAULT_DELAY_EXTRA_LONG = 3000;

// 从 settings 读取延迟系数，不填则使用默认值 1.2
const rawMultiplier = settings.delayMultiplier ? parseFloat(settings.delayMultiplier) : 1.2;
if (isNaN(rawMultiplier) || rawMultiplier <= 0) {
  log.error("延迟系数配置错误，必须是大于 0 的数字，当前值: {value}", settings.delayMultiplier);
  throw new Error("延迟系数配置错误，脚本已终止");
}
const DELAY_MULTIPLIER = rawMultiplier;

// 计算实际延迟值（默认值 × 延迟系数）
const DELAY_SHORT = Math.round(DEFAULT_DELAY_SHORT * DELAY_MULTIPLIER);
const DELAY_MEDIUM = Math.round(DEFAULT_DELAY_MEDIUM * DELAY_MULTIPLIER);
const DELAY_LONG = Math.round(DEFAULT_DELAY_LONG * DELAY_MULTIPLIER);
const DELAY_EXTRA_LONG = Math.round(DEFAULT_DELAY_EXTRA_LONG * DELAY_MULTIPLIER);

// 标记是否已检查过必须条件提示框
let hasCheckedNecessaryTip = false;

/**
 * 检查 OCR 识别到的套装名称是否匹配配置中的套装
 * @param {string} recognizedName - OCR 识别到的套装名称
 * @param {Object} setConfig - 套装配置对象（包含 set_name 和可选的 alias 数组）
 * @returns {boolean} - 是否匹配
 */
function matchSetName(recognizedName, setConfig) {
  // 先精确匹配套装名称
  if (recognizedName === setConfig.set_name) {
    return true;
  }
  // 如果有别名，尝试模糊匹配（识别到的名称包含别名）
  if (setConfig.alias && Array.isArray(setConfig.alias)) {
    for (let alias of setConfig.alias) {
      if (recognizedName.includes(alias)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 根据 OCR 识别到的套装名称查找对应的配置
 * @param {string} recognizedName - OCR 识别到的套装名称
 * @param {Array} config - 所有套装配置数组
 * @returns {Object|null} - 匹配的套装配置，未找到返回 null
 */
function findSetConfig(recognizedName, config) {
  for (let setConfig of config) {
    if (matchSetName(recognizedName, setConfig)) {
      return setConfig;
    }
  }
  return null;
}

/**
 * 检查用户选择的套装名称是否匹配配置（支持别名）
 * @param {string} selectedName - 用户选择的套装名称
 * @param {string} recognizedName - OCR 识别到的套装名称
 * @param {Array} config - 所有套装配置数组
 * @returns {boolean} - 是否匹配
 */
function isSelectedSetMatch(selectedName, recognizedName, config) {
  // 精确匹配
  if (selectedName === recognizedName) {
    return true;
  }
  // 查找用户选择的套装对应的配置
  let setConfig = config.find(s => s.set_name === selectedName);
  if (setConfig) {
    return matchSetName(recognizedName, setConfig);
  }
  return false;
}

/**
 * 配置单个套装的所有方案
 * @param {Object} setConfig - 套装配置对象
 * @param {Object} uiCoords - UI坐标映射对象
 * @param {boolean} overwriteExisting - 是否覆盖已有方案
 * @returns {boolean|null} - true: 成功配置, false: 跳过(已有方案且未勾选覆盖), null: 错误(找不到按钮/无启用方案等)
 */
async function configureArtifactSet(setConfig, uiCoords, overwriteExisting) {
  // 根据配置处理推荐方案开关
  let shouldEnable = setConfig.enable_recommended_scheme;
  log.debug("套装「{name}」的推荐方案配置: {value}", setConfig.set_name, shouldEnable);

  // 检查当前界面状态：如果不包含"未生效"，说明推荐方案是打开的
  let statusResult = findTextInRegion(838, 294, 1136, 351, "未生效");
  let isCurrentlyEnabled = (statusResult === null); // 不包含"未生效"说明是打开的

  log.debug("当前推荐方案状态: {status}", isCurrentlyEnabled ? "已开启" : "未开启");

  // 判断是否需要点击开关
  if (shouldEnable !== isCurrentlyEnabled) {
    log.info("步骤：切换推荐方案开关");
    click(1786, 323);
    await sleep(DELAY_MEDIUM);
  } else {
    log.debug("步骤：推荐方案状态已符合配置，无需操作");
  }

  // 查找并点击"编辑"按钮
  let editResult = findTextInRegion(1686, 208, 1850, 256, "编辑");
  if (editResult) {
    log.debug("找到「编辑」按钮，坐标: ({x}, {y})", editResult.x, editResult.y);
    log.info("步骤：点击编辑按钮");
    click(editResult.x, editResult.y);
    await sleep(DELAY_MEDIUM);
  } else {
    log.error("未找到「编辑」按钮");
    return null;
  }

  // 获取所有启用的方案
  let enabledPlans = setConfig.plans.filter(p => p.enabled);
  if (enabledPlans.length === 0) {
    log.warn("套装「{name}」未找到启用的方案，跳过", setConfig.set_name);
    // 点击返回按钮
    click(1840, 44);
    await sleep(DELAY_MEDIUM);
    return null;
  }

  log.debug("找到 {count} 个启用的方案", enabledPlans.length);

  // 遍历所有启用的方案
  for (let planIndex = 0; planIndex < enabledPlans.length; planIndex++) {
    let plan = enabledPlans[planIndex];

    log.debug("开始配置第 {index} 个方案", planIndex + 1);

    // 如果不是第一个方案，需要切换到方案2
    if (planIndex > 0) {
      log.info("步骤：切换到方案 {index}", planIndex + 1);
      click(129, 265);
      await sleep(DELAY_LONG);
    }

    // 检查是否存在旧方案
    let noConfigResult = findTextInRegion(1004, 499, 1253, 549, "暂无方案配置");

    if (noConfigResult === null) {
      // 不包含"暂无方案配置"，说明已经有旧方案
      if (!overwriteExisting) {
        // 未勾选覆盖选项，跳过该套装
        log.info("套装「{name}」已有方案配置，且未勾选覆盖选项，跳过", setConfig.set_name);
        // 点击返回按钮
        click(1840, 44);
        await sleep(DELAY_LONG);
        return false;
      }

      // 点击删除按钮
      log.info("步骤：点击删除按钮，坐标: (1147, 1022)");
      click(1147, 1022);

      // 等待一下让删除确认对话框出现
      await sleep(DELAY_MEDIUM);

      // 点击确认按钮
      log.info("步骤：点击确认按钮，坐标: (1171, 758)");
      click(1171, 758);
      await sleep(DELAY_MEDIUM);
    } else {
      log.debug("未检测到旧方案（显示「暂无方案配置」），无需删除");
    }

    // 点击"新建锁定方案"按钮
    let newPlanResult = findTextInRegion(1563, 986, 1876, 1051, "新建锁定方案");

    if (newPlanResult) {
      log.debug("找到「新建锁定方案」按钮，坐标: ({x}, {y})", newPlanResult.x, newPlanResult.y);
      log.info("步骤：点击「新建锁定方案」按钮");
      click(newPlanResult.x, newPlanResult.y);
      await sleep(DELAY_MEDIUM);
    } else {
      log.error("未找到「新建锁定方案」按钮");
      continue;
    }

    // 配置当前方案
    await configurePlan(plan, uiCoords);

    log.debug("第 {index} 个方案配置完成", planIndex + 1);
  }

  // 点击返回按钮
  log.info("步骤：点击返回按钮，坐标: (1840, 44)");
  click(1840, 44);
  await sleep(DELAY_LONG);

  log.debug("套装「{name}」配置完成", setConfig.set_name);
  return true; // 返回 true 表示成功配置
}

/**
 * 配置单个锁定方案
 * @param {Object} plan - 方案配置对象
 * @param {Object} uiCoords - UI坐标映射对象
 */
async function configurePlan(plan, uiCoords) {
  log.debug("开始配置方案: {name}", plan.plan_name);

  // 遍历配置中的所有部位（不一定是5个）
  for (let positionConfig of plan.positions) {
    // 根据部位名称找到对应的UI坐标
    let positionUI = uiCoords.positions.find(p => p.name === positionConfig.position_name);

    if (!positionUI) {
      log.error("未找到部位「{name}」的UI坐标", positionConfig.position_name);
      continue;
    }

    log.info("配置部位: {name}", positionConfig.position_name);

    // 点击部位按钮
    click(positionUI.x, positionUI.y);
    await sleep(DELAY_SHORT);

    // 如果部位未启用，跳过配置
    if (!positionConfig.enabled) {
      log.info("部位 {name} 未启用，跳过", positionConfig.position_name);
      continue;
    }

    // 配置主属性
    log.debug("点击主要属性按钮");
    click(uiCoords.buttons.main_attr.x, uiCoords.buttons.main_attr.y);
    await sleep(DELAY_SHORT);

    // 点击所有需要的主属性
    let positionMainAttrs = uiCoords.main_attrs_by_position[positionConfig.position_name];
    if (!positionMainAttrs) {
      log.error("未找到部位 {name} 的主属性坐标映射", positionConfig.position_name);
      continue;
    }

    // 检查是否包含"元素伤害加成"
    let hasElementalDamage = positionConfig.main_attrs.includes("元素伤害加成");

    for (let mainAttr of positionConfig.main_attrs) {
      // 特殊处理：元素伤害加成 = 使用"全选伤害加成"按钮（包含物理+所有7种元素伤害）
      if (mainAttr === "元素伤害加成") {
        let coord = positionMainAttrs["全选伤害加成"];
        log.debug("检测到「元素伤害加成」，使用全选按钮一次性选择所有伤害加成");
        log.debug("点击全选伤害加成按钮，坐标: ({x}, {y})", coord.x, coord.y);
        click(coord.x, coord.y);
        await sleep(DELAY_SHORT);
      } else if (mainAttr === "物理伤害加成" && hasElementalDamage) {
        // 如果已经点击了"元素伤害加成"（全选），则跳过单独的"物理伤害加成"
        log.debug("「物理伤害加成」已被全选包含，跳过");
      } else {
        // 普通主属性
        if (positionMainAttrs[mainAttr]) {
          let coord = positionMainAttrs[mainAttr];
          log.debug("选择主属性: {attr}, 坐标: ({x}, {y})", mainAttr, coord.x, coord.y);
          click(coord.x, coord.y);
          await sleep(DELAY_SHORT);
        } else {
          log.warn("未找到主属性坐标: {attr} (部位: {pos})", mainAttr, positionConfig.position_name);
        }
      }
    }

    // 配置副属性
    log.debug("点击追加属性按钮");
    click(uiCoords.buttons.sub_attr.x, uiCoords.buttons.sub_attr.y);
    await sleep(DELAY_SHORT);

    // 点击所有需要的副属性
    for (let subAttr of positionConfig.sub_attrs) {
      if (uiCoords.sub_attrs[subAttr]) {
        let coord = uiCoords.sub_attrs[subAttr];
        log.debug("选择副属性: {attr}, 坐标: ({x}, {y})", subAttr, coord.x, coord.y);
        click(coord.x, coord.y);
        await sleep(DELAY_SHORT);

        // 如果该副属性是必须条件，点击右侧的必须条件按钮
        if (positionConfig.necessary_sub_attrs && positionConfig.necessary_sub_attrs.includes(subAttr)) {
          // 必须条件按钮在副属性右侧，X 坐标固定：第一列 1090，第二列 1810
          let necessaryX = coord.x < 800 ? 1090 : 1810;
          log.debug("设置必须条件: {attr}, 坐标: ({x}, {y})", subAttr, necessaryX, coord.y);
          click(necessaryX, coord.y);
          await sleep(DELAY_SHORT);

          // 第一次点击必须条件按钮后，检查是否弹出提示框
          if (!hasCheckedNecessaryTip) {
            hasCheckedNecessaryTip = true;
            await sleep(DELAY_MEDIUM);
            let tipResult = findTextInRegion(870, 261, 1069, 338, "提示");
            if (tipResult) {
              log.debug("检测到提示框，点击确认关闭");
              click(964, 745);
              await sleep(DELAY_MEDIUM);
            }
          }
        }
      } else {
        log.warn("未找到副属性坐标: {attr}", subAttr);
      }
    }

    // 配置副属性最小命中数
    let minCount = positionConfig.min_count;
    let countKey = `任意${minCount}条`;

    if (uiCoords.sub_attr_count[countKey]) {
      let coord = uiCoords.sub_attr_count[countKey];
      log.debug("选择副属性命中数: {count}, 坐标: ({x}, {y})", countKey, coord.x, coord.y);
      click(coord.x, coord.y);
      await sleep(DELAY_SHORT);
    } else {
      log.warn("未找到副属性命中数坐标: {count}", countKey);
    }

    log.debug("部位 {name} 配置完成", positionConfig.position_name);
  }

  // 点击保存按钮
  log.info("步骤：点击保存按钮，坐标: (1733, 1017)");
  click(1733, 1017);
  await sleep(DELAY_LONG);
  // 再点一次关闭弹窗
  log.info("步骤：关闭保存按钮的弹窗");
  click(1733, 1017);
  await sleep(DELAY_LONG);

}

async function main() {
  // 运行前检查游戏窗口信息，并验证分辨率是否为 16:9
  const width = genshin.width;
  const height = genshin.height;
  if (!width || !height) {
    log.error("无法获取游戏窗口信息，请确保原神正在运行，脚本已终止");
    return;
  }

  const aspectRatio = width / height;
  const targetRatio = 16 / 9;
  const ratioTolerance = 0.01; // 允许极小的浮点误差

  log.debug("环境检测：当前游戏分辨率 {w}x{h}", width, height);

  if (Math.abs(aspectRatio - targetRatio) > ratioTolerance) {
    log.error("当前分辨率不是 16:9（检测到: {w}x{h}），脚本已终止", width, height);
    return;
  }

  // 读取配置文件
  const configText = await file.readText("圣遗物锁定方案信息.json");
  const config = JSON.parse(configText);

  // 读取UI坐标映射文件
  const uiCoordsText = await file.readText("ui_coordinates.json");
  const uiCoords = JSON.parse(uiCoordsText);

  // 读取用户设置
  let selectedSets = settings.artifactSets ? Array.from(settings.artifactSets) : []; // C# List<string> 对象，需要转换为 JS 数组
  let overwriteExisting = settings.overwriteExisting; // 是否覆盖已有方案

  log.debug("用户选择的套装数量: {count}", selectedSets.length);
  log.debug("选择的套装: {sets}", JSON.stringify(selectedSets));
  log.debug("是否覆盖已有方案: {value}", overwriteExisting);

  // 如果选择了"全选"，需要读取 settings.json 获取所有套装列表
  if (selectedSets.includes("全选")) {
    const settingsText = await file.readText("settings.json");
    const settingsConfig = JSON.parse(settingsText);
    const artifactSetsConfig = settingsConfig.find(s => s.name === "artifactSets");

    if (artifactSetsConfig && artifactSetsConfig.options) {
      // 包含所有套装（除了"全选"本身）
      selectedSets = artifactSetsConfig.options.filter(name => name !== "全选");
      log.debug("检测到「全选」，已展开为所有套装，共 {count} 个", selectedSets.length);
    }
  }

  // 检查用户是否选择了至少一个套装
  if (selectedSets.length === 0) {
    log.error("未选择任何套装，请在设置中勾选需要配置的圣遗物套装");
    return;
  }

  // 返回主界面
  await genshin.returnMainUi();

  // 打开背包
  keyPress("B")
  await sleep(DELAY_LONG);

  log.info("即将配置 {count} 个套装", selectedSets.length);

  // 第一步：点击圣遗物背包页面
  log.info("步骤：点击圣遗物背包页面");
  click(671, 46);
  await sleep(DELAY_MEDIUM);

  // 第二步：验证是否进入圣遗物页面
  let verifyResult = findTextInRegion(131, 21, 231, 70, "圣遗物");
  if (!verifyResult) {
    log.error("未检测到「圣遗物」页面");
    return;
  }

  // 第三步：点击进入圣遗物锁定方案入口
  log.info("步骤：点击「锁定辅助」");
  click(394, 1017);
  await sleep(DELAY_LONG);

  // 第四步：查找并点击 "套装锁定方案"，来到套装选择界面
  log.info("步骤：点击「套装锁定方案」");
  let result = findTextInRegion(148, 696, 322, 760, "套装锁定方案");
  if (!result) {
    // 第一个位置没找到，尝试第二个位置
    result = findTextInRegion(146, 290, 332, 366, "套装锁定方案");
  }
  if (result) {
    log.debug("点击「套装锁定方案」，坐标: ({x}, {y})", result.x, result.y);
    click(result.x, result.y);
    await sleep(DELAY_LONG);
  } else {
    log.error("未找到「套装锁定方案」按钮");
    return;
  }

  // 第五步：把滚动条拉到顶部
  log.info("步骤：点击滚动条顶部");
  click(795, 212);
  await sleep(DELAY_MEDIUM);

  // 第六步：遍历所有套装
  let processedSets = new Set(); // 记录已处理的套装名称，避免重复
  let configuredSets = []; // 记录成功配置的套装名称
  let skippedSets = []; // 记录跳过的套装名称（已有方案且未勾选覆盖）
  let notFoundSets = []; // 记录未找到的套装名称（OCR 未识别到）
  let failedSets = []; // 记录处理失败的套装名称（执行过程中出错）
  let finishedSetNames = new Set(); // 记录已完成处理的套装名称（成功/跳过/失败）

  while (true) {
    log.info("步骤：开始识别当前屏幕的套装");

    // 获取游戏画面截图
    let screen = captureGameRegion();
    let listRegion = null;

    try {
      // 裁剪套装列表区域 (142,209) 到 (384,954)
      const cropStartX = 142;
      const cropStartY = 209;
      const cropEndX = 384;
      const cropEndY = 954;
      listRegion = screen.deriveCrop(cropStartX, cropStartY, cropEndX - cropStartX, cropEndY - cropStartY);

      // 使用 findMulti 进行 OCR 识别
      let ocrResultList = listRegion.findMulti(RecognitionObject.ocrThis);

      log.debug("识别到 {count} 个文本", ocrResultList.count);

      if (ocrResultList.count === 0) {
        log.warn("未识别到任何文本，列表遍历完成");
        break;
      }

      // 记录本轮识别到的套装名称
      let currentScreenSets = [];
      for (let i = 0; i < ocrResultList.count; i++) {
        currentScreenSets.push(ocrResultList[i].text.trim());
      }

      // 检查是否所有套装都已处理过（说明列表已经到底了）
      let allProcessed = currentScreenSets.every(name => processedSets.has(name));
      if (allProcessed) {
        log.info("当前屏幕所有套装都已处理过，列表遍历完成");
        break;
      }

      // 遍历识别到的所有文本，处理套装
      for (let i = 0; i < ocrResultList.count; i++) {
        let ocrResult = ocrResultList[i];
        let setName = ocrResult.text.trim();

        // 跳过已处理的套装
        if (processedSets.has(setName)) {
          log.debug("套装「{name}」已处理过，跳过", setName);
          continue;
        }

        log.debug("识别到套装名称: {name}", setName);

        // 检查该套装是否在用户选择的列表中（支持别名匹配）
        let matchedSelectedName = selectedSets.find(selected => isSelectedSetMatch(selected, setName, config));
        if (!matchedSelectedName) {
          log.debug("套装「{name}」不在用户选择列表中，跳过", setName);
          processedSets.add(setName);
          continue;
        }

        // 在配置中查找对应的套装（支持别名匹配）
        let setConfig = findSetConfig(setName, config);

        // 标记为已处理（无论是否有配置）
        processedSets.add(setName);

        if (setConfig) {
          log.info(`开始处理套装: 「${setConfig.set_name}」`);

          // 计算文本左上角的屏幕绝对坐标
          let absoluteX = cropStartX + ocrResult.x;
          let absoluteY = cropStartY + ocrResult.y;

          // 点击套装名称进入详情页
          log.debug("点击套装，坐标: ({x}, {y})", absoluteX, absoluteY);
          click(absoluteX, absoluteY);
          await sleep(DELAY_MEDIUM);

          // 配置该套装
          let configured = await configureArtifactSet(setConfig, uiCoords, overwriteExisting);

          if (configured === true) {
            configuredSets.push(setConfig.set_name);
            finishedSetNames.add(setConfig.set_name);
            log.info("套装「{name}」处理完成，进度: {current}/{total}", setConfig.set_name, configuredSets.length, selectedSets.length);

            // 快速结算：如果已完成数量达到用户选择的数量，提前结束
            if (finishedSetNames.size >= selectedSets.length) {
              log.info("已处理完所有选择的套装（含跳过/失败）");
              break;
            }
          } else if (configured === false) {
            skippedSets.push(setConfig.set_name);
            finishedSetNames.add(setConfig.set_name);
            log.info("套装「{name}」已跳过（已有方案且未勾选覆盖）", setConfig.set_name);
          } else {
            failedSets.push(setConfig.set_name);
            finishedSetNames.add(setConfig.set_name);
            log.error("套装「{name}」处理失败（执行过程中出现错误）", setConfig.set_name);
          }
        } else {
          log.info("配置文件中未找到套装「{name}」，跳过", setName);
        }
      }

      // 快速结算：如果已完成数量达到用户选择的数量，跳出外层循环
      if (finishedSetNames.size >= selectedSets.length) {
        break;
      }
    } finally {
      // 释放图像资源
      if (listRegion) {
        listRegion.dispose();
      }
      screen.dispose();
    }

    await sleep(DELAY_LONG);
    // 处理完当前屏幕的所有套装后，平滑拖动列表显示下一批
    log.info("当前屏幕处理完成，拖动列表显示下一批套装");
    // 从 (771,856) 移动到 (770,244)
    await smoothDragVertical(771, 856, 770, 244);
  }

  // 检查哪些用户选择的套装未被识别到
  for (let selectedName of selectedSets) {
    // 检查是否已成功配置或已跳过
    if (configuredSets.includes(selectedName) || skippedSets.includes(selectedName) || failedSets.includes(selectedName)) {
      continue;
    }
    // 检查是否通过别名匹配到了
    let foundByAlias = configuredSets.some(name => {
      let cfg = config.find(c => c.set_name === name);
      return cfg && cfg.set_name !== selectedName && matchSetName(selectedName, cfg);
    }) || skippedSets.some(name => {
      let cfg = config.find(c => c.set_name === name);
      return cfg && cfg.set_name !== selectedName && matchSetName(selectedName, cfg);
    }) || failedSets.some(name => {
      let cfg = config.find(c => c.set_name === name);
      return cfg && cfg.set_name !== selectedName && matchSetName(selectedName, cfg);
    });
    if (!foundByAlias) {
      notFoundSets.push(selectedName);
    }
  }

  // 输出结果汇总
  log.info("========== 配置结果汇总 ==========");
  log.info("成功配置: {count} 个套装", configuredSets.length);

  if (skippedSets.length > 0) {
    log.info("跳过（已有方案）: {count} 个套装", skippedSets.length);
    for (let name of skippedSets) {
      log.info("  - {name}", name);
    }
  }

  if (failedSets.length > 0) {
    log.error("处理失败: {count} 个套装", failedSets.length);
    for (let name of failedSets) {
      log.error("  ✗ {name}", name);
    }
  }

  if (notFoundSets.length > 0) {
    log.warn("未能设置: {count} 个套装（未在列表中识别到）", notFoundSets.length);
    for (let name of notFoundSets) {
      log.warn("  ✗ {name}", name);
    }
  }

  log.info("所有套装配置完成！");
}

main();
