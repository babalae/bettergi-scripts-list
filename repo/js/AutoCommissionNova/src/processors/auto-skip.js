/**
 * 对话步骤处理器
 * 使用 BetterGI AutoSkip 实时任务处理 NPC 对话
 */
import { DIALOG_REGIONS } from "../config/index.js";
import { isInMainUI, bvPageOcrRegion, RO } from "../vision/index.js";
import { extractName } from "../utils/text-utils.js";
import { isCancellationError } from "../utils/error-utils.js";
import { dispatchOnDialogOcr } from "../probes/index.js";

import { defineStep } from "./define-step.js";
const page = new BvPage();

function createAutoSkipConfig(priorityOptions) {
    const config = new AutoSkipConfig();
    config.enabled = true;
    config.quicklySkipConversationsEnabled = true;
    config.clickChatOption = "优先选择最后一个选项";
    config.customPriorityOptionsEnabled = priorityOptions.length > 0;
    config.customPriorityOptions = priorityOptions.join("\n");
    config.skipBuiltInClickOptions = true;
    config.autoGetDailyRewardsEnabled = false;
    config.autoReExploreEnabled = false;
    return config;
}

export default [
    defineStep({
        type: "对话",
        category: "交互方法",
        dataSpec: {
            kind: "object",
            optional: true,
            fields: {
                priorityOptions: {
                    type: "array",
                    label: "优先对话选项",
                    minItems: 1,
                    items: { type: "string", nonEmpty: true },
                    hint: "每行一个对话选项。",
                },
                npcWhiteList: {
                    type: "array",
                    label: "NPC 白名单",
                    minItems: 1,
                    items: { type: "string", nonEmpty: true },
                    hint: "每行一个 NPC 名称。",
                },
            },
        },
        run: async (step, context) => {
            try {
                log.info("执行对话步骤");
                const priorityOptions = Array.isArray(step.data?.priorityOptions) ? step.data.priorityOptions : [];
                const npcWhiteList = Array.isArray(step.data?.npcWhiteList) ? step.data.npcWhiteList : [];

                // 追踪任务描述，从当前任务描述中提取目标人名，作为白名单未命中时的兜底匹配源
                keyPress("V");
                await sleep(1000);
                let extractedName = null;
                const nameResults = bvPageOcrRegion(DIALOG_REGIONS.NPC_NAME);
                for (let i = 0; i < nameResults.count; i++) {
                    const text = nameResults[i].text;
                    log.info("任务区域识别文本: {text}", text);
                    const name = extractName(text);
                    if (name) {
                        extractedName = name;
                        log.info("提取到人名: {name}", extractedName);
                        break;
                    }
                }

                const results = bvPageOcrRegion(DIALOG_REGIONS.DIALOG_OPTIONS);

                // 使用筛选方法先过滤出符合点击条件的元素，并保存匹配的NPC名称
                const matchedNPCs = Array.from(results)
                    .map(r => ({
                        element: r,
                        matchedNPC: npcWhiteList.find(npc => r.text.includes(npc))
                    }))
                    .filter(item => item.matchedNPC !== undefined);

                // 复用同一份 OCR，找一个文本包含提取人名的选项作为兜底点击目标
                const matchedByName = extractedName
                    ? Array.from(results).find(r => r.text.includes(extractedName))
                    : null;

                await page.locator(RO.inTalk)
                    .withRetryInterval(500)
                    .withRetryAction(async () => {
                        if (matchedNPCs.length > 0) {
                            for (let i = 0; i < matchedNPCs.length; i++) {
                                const { element, matchedNPC } = matchedNPCs[i];
                                log.info("找到白名单NPC: {npc}，点击该NPC", matchedNPC);
                                keyDown("VK_MENU");
                                await sleep(200);
                                element.click();
                                await sleep(100);
                                leftButtonClick();
                                keyUp("VK_MENU");
                            }
                        } else if (matchedByName) {
                            log.info("点击包含提取到任务人名的选项: {text}", matchedByName.text);
                            keyDown("VK_MENU");
                            await sleep(200);
                            matchedByName.click();
                            await sleep(100);
                            leftButtonClick();
                            keyUp("VK_MENU");
                        } else {
                            log.info("未找到匹配的NPC，使用默认按F触发对话");
                            keyPress("F");
                            await sleep(100);
                            keyPress("F");
                            await sleep(400);
                        }
                    })
                    .waitFor();

                log.info("开始执行自动对话");

                // 探针总开关：仅当 step 显式声明 probe:true 才扫描分支条件
                // 一条流程通常有多个对话，关键词可能在非目标对话里出现，所以默认关闭、按需打开
                const probeEnabled = step.probe === true;

                const autoSkipConfig = createAutoSkipConfig(priorityOptions);
                dispatcher.AddTimer(new RealtimeTimer("AutoSkip", autoSkipConfig));
                try {
                    const startTime = Date.now();
                    while (Date.now() - startTime < 120000) {
                        if (probeEnabled && !context.branchConditionMet) {
                            dispatchOnDialogOcr(context, bvPageOcrRegion(DIALOG_REGIONS.DIALOG_CONTENT));
                            dispatchOnDialogOcr(context, bvPageOcrRegion(DIALOG_REGIONS.DIALOG_OPTIONS_OCR));
                        }
                        if (isInMainUI()) {
                            log.info("已返回主界面，AutoSkip 对话执行完成");
                            return;
                        }
                        await sleep(probeEnabled ? 200 : 500);
                    }
                    throw new Error("AutoSkip 对话执行超过 120 秒，但未检测到返回主界面");
                } finally {
                    dispatcher.ClearAllTriggers();
                }
            } catch (error) {
                if (isCancellationError(error)) { throw error; }
                log.error("执行对话步骤时出错: {error}", error.message);
                throw error;
            }
        },
    }),
];
