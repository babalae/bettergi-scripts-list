// 千星每周珍赏任务 - 图像识别版（无 scriptPath 依赖）
// 功能：每周最多执行5次，每天最多成功1次

// ==================== 配置区 ====================
// 直接使用相对路径（脚本所在目录为工作目录）
const ASSETS_DIR = 'assets';

// 初始化识别对象
function initRecognitionObjects() {
    const createRO = (filename, x, y, w, h, threshold) => {
        const mat = file.ReadImageMatSync(ASSETS_DIR + '/' + filename);
        const ro = RecognitionObject.TemplateMatch(mat, x, y, w, h);
        ro.Threshold = threshold;
        return ro;
    };

    return {
        btnCollect:      createRO('btn_qiyu_collect.png', 30, 915, 200, 150, 0.75),
        btnFavorite:     createRO('btn_favorite_qiyu.png', 338, 187, 700, 400, 0.75),
        btnGotoHall:     createRO('btn_goto_hall.png', 1430, 890, 400, 100, 0.75),
        btnSingle:       createRO('btn_single_challenge.png', 1120, 890, 400, 180, 0.75),
        btnEndStage:     createRO('btn_end_stage.png', 1770, 265, 145, 100, 0.75),
        btnReturnHall:   createRO('btn_return_hall.png', 1210, 980, 400, 90, 0.75),
        iconMyCollect:   createRO('icon_my_qiyu_collect.png', 0, 0, 1920, 1080, 0.75),
        btnTop:          createRO('btn_top_qiyu.png', 230, 740, 400, 330, 0.75),
        iconPopular:     createRO('icon_popular_qiyu.png', 1635, 10, 80, 80, 0.75),
        tabZhenshang:    createRO('tab_zhenshang.png', 1010, 0, 100, 100, 0.75),
        btnClaim:        createRO('btn_claim_reward.png', 1565, 360, 100, 100, 0.75),
        btnReturn:       createRO('btn_return.png', 1560, 960, 300, 100, 0.75),
        btnConfirmReturn:createRO('btn_confirm_return.png', 1090, 720, 200, 100, 0.75),
        iconHall:       createRO('icon_hall.png', 0, 0, 100, 90, 0.75),
    };
}

const ros = initRecognitionObjects();

// ==================== 工具函数 ====================

async function waitAndClick(ro, timeout = 5000, desc = '元素') {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const cap = captureGameRegion();
        const found = cap.Find(ro);
        if (!found.IsEmpty()) {
            // 等待 500ms 后再点击，确保界面稳定
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

// 新增：等待大厅加载完成
async function waitForHallLoaded(timeout = 30000) {
    log.info('等待返回大厅...');
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const cap = captureGameRegion();
        const found = cap.Find(ros.iconHall);
        cap.Dispose();
        if (!found.IsEmpty()) {
            await sleep(2000);
            log.info('已返回大厅，继续执行');
            found.Dispose();
            return true;
        }
        found.Dispose();
        await sleep(700);
    }
    log.error('等待返回大厅超时');
    return false;
}

// ==================== 主任务流程 ====================
async function runWeeklyTask() {
    log.info('===== 开始执行千星每周珍赏任务 =====');
    
    // 1. 打开奇遇 -> 奇域收藏
    await safeKeyPress('F6', 1000);
    if (!await waitAndClick(ros.btnCollect, 5000, '奇域收藏')) return false;
    
    //2. 最爱奇遇 -> 前往大厅
    if (!await waitAndClick(ros.btnFavorite, 5000, '最爱奇遇')) return false;
    if (!await waitAndClick(ros.btnGotoHall, 5000, '前往大厅')) return false;
    log.info('等待进入大厅...');
    
    //3. 第一次单人挑战
    if (!await waitAndClick(ros.btnSingle, 20000, '单人挑战')) return false;
    log.info('等待进入关卡...');
    
    // 4. 结束关卡并返回大厅
    if (!await waitAndClick(ros.btnEndStage, 25000, '结束关卡')) {
        await safeKeyPress('ESCAPE', 1000);
    }
    if (!await waitAndClick(ros.btnReturnHall, 40000, '返回大厅')) return false;
    if (!await waitForHallLoaded(40000, '大厅界面')) return false;
    
    // 5. 第二次挑战（置顶奇遇）
    await safeKeyPress('B', 1000);
    if (!await waitAndClick(ros.btnTop, 5000, '置顶奇遇')) return false;
    await sleep(1000);
    if (!await waitAndClick(ros.btnSingle, 10000, '单人挑战（第二次）')) return false;
    log.info('等待进入第二次关卡...');
    if (!await waitAndClick(ros.btnReturnHall, 30000, '返回大厅（第二次）')) return false;
    if (!await waitForHallLoaded(40000)) return false;
    //await sleep(2000);
    
    // 6. 领取珍赏奖励
    await safeKeyPress('F6', 1000);
    //if (!await waitAndClick(ros.iconPopular, 40000, '人气奇遇')) return false;
    if (!await waitAndClick(ros.tabZhenshang, 5000, '绮衣珍赏标签')) return false;
    await sleep(1000);
    //if (!await waitAndClick(ros.btnClaim, 5000, '领取珍赏奖励')) return false;
    await sleep(1000);
    
    // 7. 关闭弹窗，返回大世界
    await safeKeyPress('ESCAPE', 700);
    await safeKeyPress('ESCAPE', 1000);
    await safeKeyPress('ESCAPE', 1000);
    if (!await waitAndClick(ros.btnReturn, 5000, '返回提瓦特')) return false;
    if (!await waitAndClick(ros.btnConfirmReturn, 5000, '确认返回提瓦特')) return false;
    log.info('等待返回大世界...');
    await sleep(10000);
    
    log.info('===== 任务流程执行完毕 =====');
    return true;
}

// ==================== 状态管理（基于实际 file 方法） ====================
const STATE_FILE = 'weekly_task_state.txt';

function loadState() {
    try {
        if (file.IsExists(STATE_FILE)) {
            const content = file.ReadTextSync(STATE_FILE);
            return JSON.parse(content);
        }
    } catch (e) {
        log.error('读取状态文件失败: ' + e.message);
    }
    return { week: getWeekNumber(), count: 0, lastSuccessDate: null };
}

function saveState(state) {
    try {
        const json = JSON.stringify(state, null, 2);
        file.WriteTextSync(STATE_FILE, json);
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

function getTodayString() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function canRunToday(state) {
    const currentWeek = getWeekNumber();
    const today = getTodayString();

    if (state.week !== currentWeek) {
        state.week = currentWeek;
        state.count = 0;
        state.lastSuccessDate = null;
    }

    if (state.count >= 5) {
        log.info(`本周已完成 ${state.count} 次，已达上限。`);
        return false;
    }

    if (state.lastSuccessDate === today) {
        log.info(`今天已经成功领取奖励，跳过执行。`);
        return false;
    }

    return true;
}

// ==================== 主入口 ====================
(async function () {
    const state = loadState();
    const today = getTodayString();
    const isTodayClaimed = (state.lastSuccessDate === today);

    // 整合日志：周次、今天日期、进度、今日状态
    log.info(`上次记录: `);
    log.info(`✅ 上次成功: ${state.lastSuccessDate || '无'}`);
    log.info(`📊 周次: ${state.week}`);
    log.info(`📅 今天: ${today}`);
    log.info(`📈 本周进度: ${state.count}/5${isTodayClaimed ? ' (今日已领取)' : ''}`);
        
    if (!canRunToday(state)) {
        return;
    }
    
    const success = await runWeeklyTask();
    
    if (success) {
        state.count += 1;
        state.lastSuccessDate = getTodayString();
        saveState(state);
        log.info(`任务成功完成！记录已更新。`);
        log.info(`📊 周次: ${state.week}`);
        log.info(`📅 今天: ${today}`);
        log.info(`📈 本周进度: ${state.count}/5${isTodayClaimed ? ' (今日已领取)' : ''}`);
    } else {
        log.error('任务执行失败，未更新计数。');
    }
})();