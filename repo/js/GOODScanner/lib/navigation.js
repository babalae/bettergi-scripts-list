// ============================================================
// UI Navigation Helpers
// ============================================================

// 背包物品网格布局常量 (武器/圣遗物)
var GRID = {
    COLS: 8,
    ROWS: 5,
    FIRST_X: 180,
    FIRST_Y: 253,
    OFFSET_X: 145,
    OFFSET_Y: 166
};

async function returnToMainUI() {
    await genshin.returnMainUi();
    await sleep(DELAY_OPEN_SCREEN);
}

async function openBackpack() {
    await returnToMainUI();
    keyPress("VK_B");
    await sleep(DELAY_OPEN_SCREEN);
}

async function selectBackpackTab(tabName) {
    var tabPositions = {
        "weapon": { x: 585, y: 50 },
        "artifact": { x: 675, y: 50 }
    };
    var pos = tabPositions[tabName];
    if (!pos) {
        log.error("[导航] 未知的背包标签: " + tabName);
        return;
    }
    click(pos.x, pos.y);
    await sleep(DELAY_INV_TAB);
}

var _scrollCnt = 0;
async function scrollGridPage() {
    for (var i = 0; i < 49; i++) {
        await verticalScroll(-1);
    }
    _scrollCnt++;
    if (_scrollCnt % 3 === 0) {
        await verticalScroll(1);
    }
    await sleep(DELAY_SCROLL);
}

var _gridItemDelay;
async function clickGridItem(row, col) {
    if (!_gridItemDelay) _gridItemDelay = Math.round(DELAY_GRID_ITEM / 3);
    var x = GRID.FIRST_X + col * GRID.OFFSET_X;
    var y = GRID.FIRST_Y + row * GRID.OFFSET_Y;
    moveMouseTo(x, y);
    await sleep(_gridItemDelay);
    click(x, y);
    await sleep(_gridItemDelay);
}

// 遍历背包网格中的物品
async function traverseBackpackGrid(totalCount, callback, onScroll) {
    var itemsPerPage = GRID.COLS * GRID.ROWS;
    var pageCount = Math.ceil(totalCount / itemsPerPage);
    var itemIndex = 0;

    _scrollCnt = 0;

    for (var page = 0; page < pageCount; page++) {
        var startRow = 0;
        var remaining = totalCount - page * itemsPerPage;

        if (remaining < itemsPerPage) {
            var rowCount = Math.ceil(remaining / GRID.COLS);
            startRow = GRID.ROWS - rowCount;
            if (startRow < 0) startRow = 0;
            log.info("[导航] 最后一页: remaining=" + remaining + " rowCount=" + rowCount + " startRow=" + startRow + " page=" + page + "/" + pageCount);
        }

        for (var row = startRow; row < GRID.ROWS; row++) {
            for (var col = 0; col < GRID.COLS; col++) {
                if (itemIndex >= totalCount) return;
                await clickGridItem(row, col);
                await sleep(_gridItemDelay);
                var shouldStop = await callback(itemIndex);
                if (shouldStop) return;
                itemIndex++;
            }
        }

        if (page < pageCount - 1) {
            moveMouseTo(GRID.FIRST_X, GRID.FIRST_Y);
            await sleep(100);
            await scrollGridPage();
            if (onScroll) onScroll();
        }
    }
}

async function openCharacterScreen() {
    await returnToMainUI();
    keyPress("VK_C");
    await sleep(Math.round(DELAY_OPEN_SCREEN * 1.5));
}
