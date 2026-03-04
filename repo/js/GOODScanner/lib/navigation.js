// ============================================================
// UI Navigation Helpers
// ============================================================

// Grid layout constants for backpack items (weapons/artifacts)
var GRID = {
    COLS: 8,
    ROWS: 5,
    FIRST_X: 180,    // center of first item
    FIRST_Y: 253,    // center of first item
    OFFSET_X: 145,   // horizontal spacing
    OFFSET_Y: 166    // vertical spacing
};

// Return to main game UI
async function returnToMainUI() {
    await genshin.returnMainUi();
    await sleep(1000);
}

// Open the backpack (press B)
async function openBackpack() {
    await returnToMainUI();
    keyPress("VK_B");
    await sleep(1500);
}

// Select a tab in the backpack by clicking its icon position
// Tab positions at y=50: weapons≈585, artifacts≈675
async function selectBackpackTab(tabName) {
    var tabPositions = {
        "weapon": { x: 585, y: 50 },
        "artifact": { x: 675, y: 50 }
    };
    var pos = tabPositions[tabName];
    if (!pos) {
        log.error("Unknown backpack tab: " + tabName);
        return;
    }
    click(pos.x, pos.y);
    await sleep(1000);
}

// Open the character screen
// Press C to open character details, or use Esc + navigate
async function openCharacterScreen() {
    await returnToMainUI();
    keyPress("VK_C");
    await sleep(2000);
}

// Scroll down one page in the backpack grid
// Uses mouse wheel simulation (49 scrolls down = 1 page of 5 rows)
var _scrollCnt = 0;
async function scrollGridPage() {
    for (var i = 0; i < 49; i++) {
        await verticalScroll(-1);
    }
    _scrollCnt++;
    // Correction scroll every 3 pages to prevent drift
    if (_scrollCnt % 3 === 0) {
        await verticalScroll(1);
    }
    await sleep(300);
}

// Click on a grid item by its row and column index (0-based)
async function clickGridItem(row, col) {
    var x = GRID.FIRST_X + col * GRID.OFFSET_X;
    var y = GRID.FIRST_Y + row * GRID.OFFSET_Y;
    moveMouseTo(x, y);
    await sleep(50);
    click(x, y);
    await sleep(100);
}

// Navigate through all items in the backpack grid
// Calls the callback function for each item with its index
// totalCount: total number of items to process
// callback: async function(itemIndex) called after clicking each item
async function traverseBackpackGrid(totalCount, callback) {
    var itemsPerPage = GRID.COLS * GRID.ROWS;
    var pageCount = Math.ceil(totalCount / itemsPerPage);
    var itemIndex = 0;

    _scrollCnt = 0;

    for (var page = 0; page < pageCount; page++) {
        var startRow = 0;
        var remaining = totalCount - page * itemsPerPage;

        // On the last page, figure out where items start
        if (remaining < itemsPerPage) {
            var rowCount = Math.ceil(remaining / GRID.COLS);
            startRow = GRID.ROWS - rowCount;
            if (startRow < 0) startRow = 0;
        }

        for (var row = startRow; row < GRID.ROWS; row++) {
            for (var col = 0; col < GRID.COLS; col++) {
                if (itemIndex >= totalCount) return;
                await clickGridItem(row, col);
                await sleep(150);
                await callback(itemIndex);
                itemIndex++;
            }
        }

        // Scroll to next page if not the last
        if (page < pageCount - 1) {
            moveMouseTo(GRID.FIRST_X, GRID.FIRST_Y);
            await sleep(100);
            await scrollGridPage();
        }
    }
}

// Scroll the character sidebar list
// direction: -1 for down, 1 for up
async function scrollCharacterList(amount) {
    // Move mouse to character list area first
    moveMouseTo(100, 540);
    await sleep(100);
    for (var i = 0; i < Math.abs(amount); i++) {
        await verticalScroll(amount > 0 ? 1 : -1);
        await sleep(30);
    }
    await sleep(300);
}
