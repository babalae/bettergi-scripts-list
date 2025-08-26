/**
 * 自动按键操作脚本
 * 
 * 该函数通过模拟键盘按键实现一系列预设的按键组合操作，
 * 包括按住、释放和点击特定键位，并在各操作之间加入延时。
 * 主要涉及的键位有：VK_D、VK_A、VK_SPACE、VK_Q。
 * 所有操作均在异步环境下执行，确保延时逻辑正确生效。
 */

(async function () {
    // 初始延时200毫秒
    await sleep(200)
    
    // 向右移动：按住D键
    keyDown("VK_D");
    // 等待500ms
    await sleep(500);
    // 跳跃：按压空格键
    keyPress("VK_SPACE");
    // 等待2000ms
    await sleep(2000);
    // 停止向右移动：释放D键
    keyUp("VK_D");
    // 向左移动：按住A键
    keyDown("VK_A");
    // 等待2000ms
    await sleep(2000);
    // 停止向左移动：释放A键
    keyUp("VK_A");
    // 再次向右移动：按住D键
    keyDown("VK_D");
    // 等待3000ms
    await sleep(3000);
    // 跳跃：按压空格键
    keyPress("VK_SPACE");
    // 等待1000ms
    await sleep(1000);
    // 再次跳跃：按压空格键
    keyPress("VK_SPACE");
    // 等待500ms
    await sleep(500);
    // 停止向右移动：释放D键
    keyUp("VK_D");
    await sleep(1000);
    // 向左移动：按住A键
    keyDown("VK_A");
    await sleep(200)
    // 跳跃：按住空格键
    keyDown("VK_SPACE");
    await sleep(500);
    // 释放空格键
    keyUp("VK_SPACE");
    await sleep(1000);
    // 停止向左移动：释放A键
    keyUp("VK_A");
    // 使用技能Q
    keyPress("VK_Q");
    // 向右移动：按住D键
    keyDown("VK_D");
    await sleep(2000);
    // 跳跃：按压空格键
    keyPress("VK_SPACE");
    await sleep(3000);
    // 再次跳跃：按压空格键
    keyPress("VK_SPACE");
    await sleep(4000);
    // 停止向右移动：释放D键
    keyUp("VK_D");
    // 使用技能Q
    keyPress("VK_Q");
    // 向右移动：按住D键
    keyDown("VK_D");
    await sleep(3000);
    // 停止向右移动：释放D键
    keyUp("VK_D");
})();
