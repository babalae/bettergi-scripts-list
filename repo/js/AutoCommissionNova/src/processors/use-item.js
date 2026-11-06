/**
 * 使用道具 step 处理器
 *
 * 打开背包 → 切到指定分页 → 在候选道具列表里挑第一个存在的 → 使用一次
 *
 * data:
 *   tab:   string   — 背包分页名称（武器 / 圣遗物 / 材料 / 任务 / 小道具 / 食物 / ...）
 *   items: string[] — 候选道具名数组；按声明顺序找第一个背包里实际拥有的，使用一次即返回。
 *                     用于"有 A 用 A，否则用 B"的灵活兜底，不会把列表里所有道具都用一遍
 *
 * 失败处理：swallow=true，UI 异常 / 一个候选都找不到时只 log，不阻断后续 step；
 * 调用方（流程作者）若需要严格失败语义，可以在 step 上配 retry / 配 retryOn 显式覆盖
 */
import { defineStep } from "./define-step.js";
import { pageScroll, RO } from "../vision/index.js";

export default defineStep({
    type: "使用道具",
    category: "自动化与道具",
    dataSpec: {
        kind: "object",
        fields: {
            tab: {
                type: "string",
                label: "背包分类",
                required: true,
                options: ["武器", "圣遗物", "养成道具", "食物", "材料", "小道具", "任务", "贵重道具", "摆设"],
            },
            items: {
                type: "array",
                label: "道具名称",
                required: true,
                minItems: 1,
                items: { type: "string", nonEmpty: true },
                hint: "每行一个道具名称，按顺序尝试。",
            },
        },
    },
    swallow: true,
    run: async (step) => {
        const { tab, items } = step.data;
        if (!Array.isArray(items) || items.length === 0 || !items.every(i => typeof i === "string" && i.length > 0)) {
            log.warn("使用道具：items 必须是非空字符串数组");
            return;
        }
        log.info("使用道具：{tab} 页 → 候选 {items}", tab, items.join(" / "));
        const page = new BvPage();
        const Rect = OpenCvSharp.OpenCvSharp.Rect;

        try {
            const uiMap = {
                "武器": { x: 570, y: 50 },
                "圣遗物": { x: 665, y: 50 },
                "养成道具": { x: 760, y: 50 },
                "食物": { x: 855, y: 50 },
                "材料": { x: 950, y: 50 },
                "小道具": { x: 1045, y: 50 },
                "任务": { x: 1140, y: 50 },
                "贵重道具": { x: 1235, y: 50 },
                "摆设": { x: 1330, y: 50 }
            };
            if (!uiMap[tab]) {
                log.warn("使用道具：未知 tab {tab}", tab);
                return;
            }

            //  1: 打开背包（B 键背包）
            await page.locator(RO.inBag).withRetryInterval(1000).withRetryAction(() => keyPress("B")).waitFor();

            // 2: 切到 tab 指定的分页
            //   locator 用 tab 文本本身（切换后内容区域左上角会显示当前分页名）
            await page.locator(tab, new Rect(139, 32, 106, 34)).withRetryAction(() => {
                const { x, y } = uiMap[tab];
                page.click(x, y);
            }).waitFor();

            // 3: 按 items 顺序在道具网格里找第一个命中的
            //   - for (const item of items) { 检测是否存在 → 命中即 break 进入 4 }
            //   - 都没命中 → 翻页继续查找；最多 5 页
            //   - 必要时分页/滚动加载
            let found = false;
            let attempt = 0;
            for (; attempt < 5 && !found; attempt++) {
                if (attempt > 0) {
                    log.debug("道具 {tab} 翻到第 {n}/{max} 页继续查找", tab, attempt + 1, 5);
                    await pageScroll(1); //todo 这里使用的是委托页的翻页方法，对背包翻页场景来说翻页范围有点小
                }
                await sleep(500);

                for (const item of items) {
                    let itemRo;
                    try {
                        itemRo = RO.bagItem({ tab, item });
                    } catch (readErr) {
                        log.debug("候选道具 {item} 读取失败（可能不存在），尝试下一个：{err}", item, readErr.message);
                        continue;
                    }
                    const result = page.locator(itemRo).findAll();
                    if (result.count > 0) {
                        result[0].click();
                        await page.locator("使用", new Rect(1662, 994, 77, 42))
                            .withRetryAction(() => result[0].click())
                            .click();

                        log.info("在 {tab} 页使用道具 {name} ", tab, item);
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                throw new Error(`道具：${items.join("/")} 在 ${attempt} 页查找后仍未找到`);
            }
        } finally {
            await genshin.returnMainUi();
        }
    },
});
