// 千星奇遇刷经验 - 图像识别版（经验驱动，刷满4000+）
// 功能：首次挑战 + 循环删除存档再挑战，直到累计经验 ≥ 4000
// 进度文件：weekly_exp_state.txt，自动跨周重置

const ASSETS_DIR = 'assets';
const WEEKLY_EXP_CAP = 4000;        // 每周经验上限（允许最终超过）
const EXP_PER_RUN = 270;            // 每次挑战获得经验

// ==================== 初始化识别对象 ====================
function initRecognitionObjects() {
    const loadRO = (filename, x, y, w, h, threshold = 0.75) => {
        const mat = file.ReadImageMatSync(ASSETS_DIR + '/' + filename);
        const ro = RecognitionObject.TemplateMatch(mat, x, y, w, h);
        ro.Threshold = threshold;
        return ro;
    };

    return {
        btnCollect:      loadRO('btn_qiyu_collect.png', 30, 915, 200, 150),
        btnTopQiyu:      loadRO('btn_top_qiyu.png', 230, 740, 400, 330),
        btnGotoHall:     loadRO('btn_goto_hall.png', 1430, 890, 400, 100),
        btnSingle:       loadRO('btn_single_challenge.png', 1120, 890, 400, 180),
        btnReturnHall:   loadRO('btn_return_hall.png', 1210, 980, 400, 90),
        btnManageStage:  loadRO('btn_manage_stage.png', 1454, 20, 200, 60),
        btnManage:       loadRO('btn_manage.png', 1628, 994, 250, 65),
        checkboxArchive: loadRO('checkbox_archive.png', 1297, 268, 55, 55),
        btnDeleteSelected: loadRO('btn_delete_selected.png', 1628, 994, 250, 65),
        btnConfirmDelete:  loadRO('btn_confirm_delete.png', 970, 710, 390, 90),
        btnReturn:       loadRO('btn_return.png', 1560, 960, 300, 100),
        btnConfirmReturn:  loadRO('btn_confirm_return.png', 1090, 720, 200, 100),
        iconHall:        loadRO('icon_hall.png', 0, 0, 100, 90)
    };
}

const ros = initRecognitionObjects();
let state;   // 全局状态变量

// ==================== 状态管理 ====================
const STATE_FILE = 'weekly_exp_state.txt';

function loadState() {
    try {
        if (file.IsExists(STATE_FILE)) {
            return JSON.parse(file.ReadTextSync(STATE_FILE));
        }
    } catch (e) {
        log.error('读取状态文件失败: ' + e.message);
    }
    const defaultState = { week: getWeekNumber(), totalExp: 0, runCount: 0 };
    defaultState.remainingRuns = calcRemainingRuns(0, WEEKLY_EXP_CAP, EXP_PER_RUN);
    return defaultState;
}

function saveState(state) {
    try {
        file.WriteTextSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        log.error('保存状态文件失败: ' + e.message);
    }
}

function getWeekNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const days = Math.floor((now - firstDay) / (24 * 60 * 60 * 1000));
    return year + '-W' + Math.ceil((days + firstDay.getDay() + 1) / 7);
}

function resetIfNewWeek(state) {
    const currentWeek = getWeekNumber();
    if (state.week !== currentWeek) {
        log.info(`🔄 新的一周，重置进度 (原周次: ${state.week})`);
        state.week = currentWeek;
        state.totalExp = 0;
        state.runCount = 0;
        state.remainingRuns = calcRemainingRuns(0, WEEKLY_EXP_CAP, EXP_PER_RUN);
        saveState(state);
    }
}

function addExperience(state) {
    state.totalExp += EXP_PER_RUN;
    state.runCount += 1;
    state.remainingRuns = calcRemainingRuns(state.totalExp, WEEKLY_EXP_CAP, EXP_PER_RUN);
    saveState(state);
    log.info(`📈 进度更新：本周已获得 ${state.totalExp}/${WEEKLY_EXP_CAP} 经验 (${state.runCount} 次)，预计还需 ${state.remainingRuns} 次`);
}

// 计算剩余需要刷的次数（向上取整）
function calcRemainingRuns(totalExp, cap, perRun) {
    if (totalExp >= cap) return 0;
    return Math.ceil((cap - totalExp) / perRun);
}

// ==================== 工具函数 ====================
async function waitAndClick(ro, timeout = 5000, desc = '元素') {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const cap = captureGameRegion();
        const found = cap.Find(ro);
        if (!found.IsEmpty()) {
            await sleep(500);
            found.Click();
            log.info(`点击 ${desc} 成功`);
            found.Dispose();
            cap.Dispose();
            return true;
        }
        found.Dispose();
        cap.Dispose();
        await sleep(300);
    }
    log.error(`等待 ${desc} 超时`);
    return false;
}

async function safeKeyPress(key, delay = 500) {
    keyPress(key);
    log.info(`按下 ${key}`);
    await sleep(delay);
}

async function waitForHallLoaded(timeout = 30000) {
    log.info('等待返回大厅...');
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const cap = captureGameRegion();
        const found = cap.Find(ros.iconHall);
        cap.Dispose();
        if (!found.IsEmpty()) {
            await sleep(2000);
            log.info('已返回大厅');
            found.Dispose();
            return true;
        }
        found.Dispose();
        await sleep(700);
    }
    log.error('等待返回大厅超时');
    return false;
}

// ==================== 删除存档流程 ====================
async function deleteArchive() {
    log.info('--- 开始删除存档 ---');
    await safeKeyPress('B', 1000);
    
    if (!await waitAndClick(ros.btnManageStage, 5000, '管理关卡')) return false;
    await sleep(700);
    if (!await waitAndClick(ros.btnManage, 5000, '管理按钮')) return false;
    await sleep(700);
    if (!await waitAndClick(ros.checkboxArchive, 5000, '勾选存档')) return false;
    await sleep(700);
    if (!await waitAndClick(ros.btnDeleteSelected, 5000, '删除所选')) return false;
    await sleep(700);
    if (!await waitAndClick(ros.btnConfirmDelete, 5000, '确认删除')) return false;
    await sleep(700);
    if (!await waitAndClick(ros.btnConfirmDelete, 5000, '再次确认删除')) return false;
    await sleep(700);
    
    await safeKeyPress('ESCAPE', 700);
    await safeKeyPress('ESCAPE', 700);
    log.info('--- 删除存档完成 ---');
    return true;
}

// ==================== 主任务流程 ====================
async function runTask() {
    log.info('===== 千星奇遇刷经验任务开始 =====');
    
    // 1. 打开奇遇 -> 奇域收藏
    await safeKeyPress('F6', 1000);
    if (!await waitAndClick(ros.btnCollect, 5000, '奇域收藏')) return false;
    
    // 2. 点击置顶奇遇 -> 前往大厅
    if (!await waitAndClick(ros.btnTopQiyu, 5000, '置顶奇遇')) return false;
    await sleep(1000);
    if (!await waitAndClick(ros.btnGotoHall, 5000, '前往大厅')) return false;
    if (!await waitForHallLoaded(40000)) return false;
    
    // 3. 第一次单人挑战（第 1 次）
    let currentRunDisplay = state.runCount + 1;
    log.info(`--- 第 ${currentRunDisplay} 次挑战 (本周已刷 ${state.runCount} 次，预计还需刷 ${state.remainingRuns} 次) ---`);
    if (!await waitAndClick(ros.btnSingle, 15000, '单人挑战')) return false;
    log.info('等待进入关卡...');
    await sleep(5000);  // 等待 5 秒，确保关卡加载完成
    
    // 4. 返回大厅
    if (!await waitAndClick(ros.btnReturnHall, 30000, '返回大厅')) return false;
    if (!await waitForHallLoaded(40000)) return false;
    
    // 第一次成功，增加经验
    addExperience(state);log.info(`--- 第 ${currentRunDisplay} 次挑战已完成 (本周已刷 ${state.runCount} 次，预计还需刷 ${state.remainingRuns} 次) ---`);
    log.info(`📊 本周累计：${state.totalExp}/${WEEKLY_EXP_CAP} 经验 (已完成 ${state.runCount} 次)`);
    
    // 5. 循环刷取，直到经验达到或超过 4000
    while (state.totalExp < WEEKLY_EXP_CAP) {
        const remainingRuns = calcRemainingRuns(state.totalExp, WEEKLY_EXP_CAP, EXP_PER_RUN);
        const nextRun = state.runCount + 1;
                
        if (!await deleteArchive()) return false;
        log.info(`--- 准备第 ${nextRun} 次挑战 (本周已完成 ${state.runCount} 次，预计还需刷 ${state.remainingRuns} 次) ---`);
        if (!await waitAndClick(ros.btnTopQiyu, 5000, '置顶奇遇')) return false;
        await sleep(1000);
        if (!await waitAndClick(ros.btnSingle, 15000, '单人挑战')) return false;
        await sleep(5000);
        if (!await waitAndClick(ros.btnReturnHall, 30000, '返回大厅')) return false;
        if (!await waitForHallLoaded(40000)) return false;
        
        addExperience(state);
        log.info(`--- 第 ${nextRun} 次挑战已完成 (本周已刷 ${state.runCount} 次，预计还需刷 ${state.remainingRuns} 次) ---`);
        log.info(`📊 本周累计：${state.totalExp}/${WEEKLY_EXP_CAP} 经验 (已完成 ${state.runCount} 次)`);
    }
    
    log.info(`🎉 本周经验已达 ${state.totalExp}/${WEEKLY_EXP_CAP}，停止刷取。`);
    
    // 6. 最后一次删除存档（清理痕迹）
    log.info('--- 最终清理：删除最后一次存档 ---');
    await deleteArchive();
    await safeKeyPress('ESCAPE', 700);
    await waitForHallLoaded(40000);
    
    // 7. 返回提瓦特
    await safeKeyPress('ESCAPE', 1000);
    if (!await waitAndClick(ros.btnReturn, 5000, '返回提瓦特')) {
        log.warn('未找到返回提瓦特按钮，尝试按ESC');
        await safeKeyPress('ESCAPE', 1000);
    }
    if (!await waitAndClick(ros.btnConfirmReturn, 5000, '确认返回提瓦特')) {
        log.warn('未找到确认按钮，直接等待');
    }
    log.info('等待返回大世界...');
    await sleep(10000);
    
    log.info(`===== 任务执行完毕，本周累计经验 ${state.totalExp}/${WEEKLY_EXP_CAP} (共 ${state.runCount} 次) =====`);
    return true;
}

// ==================== 主入口 ====================
(async function () {
    state = loadState();
    resetIfNewWeek(state);
    
    log.info(`📊 周次: ${state.week}`);
    log.info(`📈 当前经验: ${state.totalExp}/${WEEKLY_EXP_CAP} (已完成 ${state.runCount} 次)`);
    log.info(`⏳ 预计还需: ${state.remainingRuns} 次`);
    if (state.totalExp >= WEEKLY_EXP_CAP) {
        log.info(`✅ 本周经验已达上限，无需执行。`);
        return;
    }
    
    log.info('开始执行刷经验任务...');
    const success = await runTask();
    if (success) {
        log.info(`✅ 脚本执行成功，最终经验: ${state.totalExp}/${WEEKLY_EXP_CAP}`);
    } else {
        log.error('❌ 脚本执行失败');
    }
})();