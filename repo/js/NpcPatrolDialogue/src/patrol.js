// 巡逻对话核心逻辑。独立脚本模块，不依赖加载器修改，也不从任务目录动态执行代码。
const ROUTE_DIR = 'assets/Pathing/';
const IMAGE_DIR = 'assets/RecognitionObject/';

export async function runPatrol(config) {
  const npc = String(config.npc || '').trim();
  if (!npc) throw new Error('请在设置里填写要寻找的 NPC 名称');
  if (/[\\/]/.test(config.routeFile || '')) throw new Error('路线文件名不合法');

  const route = JSON.parse(file.readTextSync(ROUTE_DIR + config.routeFile));
  const points = route.positions;
  const start = config.patrolStartIndex;
  if (!Array.isArray(points) || !Number.isInteger(start) || start < 1 || start >= points.length - 1) {
    throw new Error('巡逻配置或路线点位不完整');
  }

  const scale = genshin.width / 1920;
  const dpi = Number(getGameMetrics()[2]) || 1;
  const ro = (path, x, y, w, h) => RecognitionObject.TemplateMatch(
    file.readImageMatSync(path), Math.round(x * scale), Math.round(y * scale),
    Math.round(w * scale), Math.round(h * scale));
  const mainRo = ro(IMAGE_DIR + 'paimon_menu.png', 0, 0, 500, 200);
  const talkRo = ro(IMAGE_DIR + 'IconInTalk.png', 0, 0, 500, 200);
  const fRo = ro(IMAGE_DIR + 'F.png', 1090, 330, 60, 420);
  const chatRo = ro(IMAGE_DIR + '聊天气泡.png', 1140, 330, 100, 420);
  const speakerRo = RecognitionObject.Ocr(Math.round(650 * scale), Math.round(800 * scale),
    Math.round(620 * scale), Math.round(190 * scale));

  // 原生入口回放结束才开始计时，避免把下楼时间算进巡逻超时。
  let deadline = Infinity;
  const maxRounds = config.maxRounds;
  const normalize = text => String(text || '').replace(/\s|[·「」【】]/g, '');

  const mainUi = () => {
    const screen = captureGameRegion();
    try { return !screen.find(mainRo).isEmpty(); }
    finally { screen.dispose(); }
  };
  const inTalk = () => {
    const screen = captureGameRegion();
    try {
      if (!screen.find(talkRo).isEmpty()) return true;
      if (!screen.find(mainRo).isEmpty()) return false;
      const names = screen.findMulti(speakerRo);
      for (let i = 0; i < names.count; i++) {
        if (normalize(names[i].text).includes(normalize(npc))) return true;
      }
      return false;
    }
    finally { screen.dispose(); }
  };
  const release = () => { keyUp('W'); keyUp('VK_MENU'); };
  const checkDeadline = () => {
    if (Date.now() >= deadline) throw new Error('寻找' + npc + '超过时限，已停止；请检查所在楼层及 NPC 位置');
  };
  const isTargetRow = text => text === normalize(npc) ||
    text === '掌柜' + normalize(npc) || text === normalize(npc) + '掌柜';

  // 只点击确认带有目标 NPC 名字的交互行，不点场景里的头顶名牌。
  function interaction() {
    const screen = captureGameRegion();
    try {
      if (screen.find(mainRo).isEmpty()) return null;
      const f = screen.find(fRo);
      if (f.isEmpty()) return null;
      const chats = screen.findMulti(chatRo);
      const rows = [];
      for (let i = 0; i < chats.count; i++) {
        const icon = chats[i];
        const textRo = RecognitionObject.Ocr(Math.round(f.x + 115 * scale),
          Math.round(icon.y - 8 * scale), Math.round(285 * scale),
          Math.round(icon.height + 16 * scale));
        const texts = screen.findMulti(textRo);
        const parts = [];
        for (let j = 0; j < texts.count; j++) parts.push(texts[j].text);
        const text = normalize(parts.join(''));
        const y = icon.y + icon.height / 2;
        if (rows.some(row => Math.abs(row.y - y) < 10 * scale)) continue;
        rows.push({ text, y });
      }
      rows.sort((a, b) => a.y - b.y);
      const target = rows.find(row => isTargetRow(row.text));
      if (!target) return null;
      const fY = f.y + f.height / 2;
      let selected = rows.find(row => Math.abs(row.y - fY) < 18 * scale);
      if (!selected) {
        // 没有匹配行时，只按 F 提示所在行的文字判断，不猜场景名牌。
        const textRo = RecognitionObject.Ocr(Math.round(f.x + 115 * scale),
          Math.round(f.y - 8 * scale), Math.round(285 * scale), Math.round(f.height + 16 * scale));
        const text = screen.findMulti(textRo);
        const parts = [];
        for (let i = 0; i < text.count; i++) parts.push(text[i].text);
        selected = { text: normalize(parts.join('')), y: fY };
      }
      return { target, selected, rows, fY };
    } finally { screen.dispose(); }
  }

  const selectedNpc = state => state && isTargetRow(state.selected.text);

  async function selectNpc() {
    for (let i = 0; i < 6; i++) {
      const state = interaction();
      if (!state) return false;
      log.info('交互列表：' + state.rows.map(row => row.text).join(' / ') + '；F当前选择：' + state.selected.text);
      if (selectedNpc(state)) return true;
      const direction = state.target.y < state.fY ? 1 : -1;
      log.info('滚轮切换至' + npc + '，方向：' + (direction > 0 ? '上' : '下'));
      verticalScroll(direction);
      await sleep(180);
    }
    return false;
  }

  async function tryTalk() {
    if (!interaction()) return false;
    release();
    log.info('发现' + npc + '，停止移动，重新识别交互并尝试对话');
    await sleep(180);
    let entered = false;
    for (let attempt = 0; attempt < 3 && !entered; attempt++) {
      const target = interaction();
      if (!target) {
        log.warn(npc + '交互提示已离开范围，继续沿路线寻找');
        return false;
      }
      if (!(await selectNpc())) throw new Error('未能在 F 交互列表选中' + npc + '，已停止，避免误点其他 NPC');
      if (!selectedNpc(interaction())) return false;
      log.info('确认 F 选择的是' + npc + '，按 F 对话，第' + (attempt + 1) + '次');
      keyPress('F');
      for (let i = 0; i < 30; i++) {
        await sleep(100);
        if (inTalk()) { entered = true; break; }
      }
      if (!entered && !mainUi()) throw new Error('交互后出现未知界面，停止巡逻');
    }
    if (!entered) throw new Error('F 已选中' + npc + '但 3 次交互都未进入对话，已停止；请查看交互列表日志');

    log.info('已确认进入' + npc + '对话，停止巡逻并等待对话结束');
    let stableMain = 0;
    const talkDeadline = Date.now() + 180000;
    while (Date.now() < talkDeadline) {
      release();
      await sleep(300);
      stableMain = mainUi() && !inTalk() ? stableMain + 1 : 0;
      if (stableMain >= 3) {
        log.info(npc + '对话结束，巡逻已退出；请核对任务奖励');
        return true;
      }
    }
    throw new Error(npc + '对话未在 3 分钟内结束，已停止');
  }

  function position() {
    // 窄楼梯处默认坐标缓存会冲过转角，这里每次取实时小地图坐标。
    const p = genshin.getPositionFromMap('Teyvat', 0);
    if (!p || !Number.isFinite(p.X) || !Number.isFinite(p.Y) || (p.X === 0 && p.Y === 0)) {
      throw new Error('小地图坐标识别失败，停止移动');
    }
    return { x: p.X, y: p.Y };
  }
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  async function walkTo(target) {
    const pointDeadline = Date.now() + 45000;
    let lastProgress = position();
    let progressAt = Date.now();
    let recoveryCount = 0;
    log.info('巡逻目标点：(' + target.x.toFixed(2) + ',' + target.y.toFixed(2) + ')');
    while (Date.now() < pointDeadline) {
      checkDeadline();
      if (await tryTalk()) return true;
      if (!mainUi()) { release(); throw new Error('巡逻中离开主界面，已停止移动'); }
      const p = position();
      if (distance(p, target) <= config.arrivalDistance) { release(); return false; }
      if (distance(p, target) > 30) { release(); throw new Error('偏离巡逻路线过远，请检查楼层或坐标识别'); }
      if (distance(p, lastProgress) >= 0.7) { lastProgress = p; progressAt = Date.now(); }
      if (Date.now() - progressAt > 2500) {
        release();
        if (recoveryCount++ >= 2) {
          throw new Error('巡逻点连续卡住，已停止：当前位置(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) +
            ')，目标(' + target.x.toFixed(2) + ',' + target.y.toFixed(2) + ')');
        }
        log.warn('巡逻遇到障碍，退回后重试，第' + recoveryCount + '次；位置(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ')');
        keyDown('S');
        try { await sleep(500); } finally { keyUp('S'); }
        progressAt = Date.now();
        lastProgress = position();
      }
      // BGI 世界坐标与小地图图像轴相反，因此朝向角相差 180 度。
      const desired = (Math.atan2(p.y - target.y, p.x - target.x) * 180 / Math.PI + 360) % 360;
      const angle = genshin.getCameraOrientation();
      if (!Number.isFinite(angle)) throw new Error('摄像机朝向识别失败');
      const diff = ((angle - desired + 540) % 360) - 180;
      if (Math.abs(diff) > 8) {
        if (Math.abs(diff) > 45) release();
        const ratio = Math.abs(diff) > 90 ? 4 : Math.abs(diff) > 30 ? 3 : 2;
        moveMouseBy(Math.round(-ratio * diff * dpi), 0);
        await sleep(80);
      }
      if (Math.abs(diff) <= 45) keyDown('W');
      await sleep(180);
    }
    release();
    throw new Error('到达巡逻点超时，已停止移动');
  }

  try {
    dispatcher.clearAllTriggers();
    dispatcher.addTrigger(new RealtimeTimer('AutoSkip'));
    if (!Number.isInteger(config.approachPointCount) || config.approachPointCount < 2 ||
        config.approachPointCount > start) {
      throw new Error('安全下楼路径的点位范围配置错误');
    }
    const approach = JSON.parse(JSON.stringify(route));
    approach.positions = approach.positions.slice(0, config.approachPointCount);
    if (approach.positions[0].type !== 'teleport') throw new Error('安全下楼路线缺少传送起点');

    log.info('BGI 原生回放安全下楼路线，保留飞行和收翼动作');
    release();
    await pathingScript.run(JSON.stringify(approach));
    release();
    if (!mainUi()) throw new Error('未回到主界面，无法开始巡逻');
    if (distance(position(), approach.positions[config.approachPointCount - 1]) > 3) {
      throw new Error('安全下楼回放未到达终点，已停止，不会误报任务完成');
    }

    deadline = Date.now() + config.timeoutSeconds * 1000;
    if (await tryTalk()) return;

    const here = position();
    const recordedRing = points.slice(start);
    let nearest = 0;
    for (let i = 1; i < recordedRing.length; i++) {
      if (distance(here, recordedRing[i]) < distance(here, recordedRing[nearest])) nearest = i;
    }
    if (distance(here, recordedRing[nearest]) > 3) {
      throw new Error('安全下楼终点没有接上巡逻路线，已停止，请检查衔接点');
    }
    const ring = recordedRing.slice(nearest).concat(recordedRing.slice(0, nearest));
    log.info('入口路线结束，开始巡逻；各圈不再传送');
    if (await walkTo(ring[0])) return;
    for (let round = 0; round < maxRounds; round++) {
      checkDeadline();
      log.info('寻找' + npc + '：第' + (round + 1) + '圈，' + (round % 2 ? '反向' : '正向'));
      const targets = round % 2 ? ring.slice(1).reverse().concat([ring[0]])
        : ring.slice(1).concat([ring[0]]);
      for (const target of targets) {
        if (await walkTo(target)) return;
        if (await tryTalk()) return;
      }
    }
    throw new Error('巡逻' + maxRounds + '圈仍未找到' + npc + '，已停止，请手动检查');
  } finally {
    release();
    dispatcher.clearAllTriggers();
    dispatcher.addTrigger(new RealtimeTimer('AutoSkip'));
    if (!config.noSkip) dispatcher.addTrigger(new RealtimeTimer('AutoPick'));
    if (!config.noEat) dispatcher.addTrigger(new RealtimeTimer('AutoEat'));
  }
}
