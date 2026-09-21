//作者：夜雨l星辰
// 自动参量质变仪与爱可菲烹饪 - 入口文件
// 流程：0.(可选)切换队伍+切出爱可菲(勾选「启用爱可菲锅配置」才执行)
//       1. 执行路径到参量质变仪 2. 打开背包部署参量质变仪 3. 交互进入放入材料界面(先不放直接退出) 4.(可选)切爱可菲长按E
// 材料留空逻辑：未勾爱可菲→直接结束；仅勾爱可菲→跳过质变仪仅执行爱可菲锅；
// 模块说明：配置读取见 src/config.js；队伍/识别/质变仪/辅助/冷却/材料逻辑见 src/modules/ 下各模块

import { config } from "./src/config.js";
import { switchToAvatar, switchParty } from "./src/modules/team.js";
import { readLastTransformTime } from "./src/modules/cooldown.js";
import { deployTransformer, enterMaterialPage, waitTransformer } from "./src/modules/transformer.js";
import { waitTransformerWithHelper } from "./src/modules/helper.js";
import { insertMaterial } from "./src/modules/material.js";

(async function () {
    try {
        // ===== 步骤0：回显上次质变完成时间到配置输入框（仅展示用，手动修改无效，每次运行自动覆盖）=====
        const lastTsForDisplay = await readLastTransformTime();
        settings.lastTransformTime = lastTsForDisplay
            ? new Date(lastTsForDisplay).toLocaleString()
            : "无记录（首次执行）";
        log.info("配置显示的上次质变完成时间已更新: " + settings.lastTransformTime);

        // ===== 步骤0(可选)：7天质变冷却检查（由「启用7天质变冷却」控制）=====
        if (config.enableCooldown) {
            const lastTs = lastTsForDisplay;
            if (lastTs && (Date.now() - lastTs) < config.cooldownMs) {
                const remainDays = Math.ceil((config.cooldownMs - (Date.now() - lastTs)) / (24 * 60 * 60 * 1000));
                log.info("距上次质变不足7天（上次完成: " + new Date(lastTs).toLocaleString() + "），剩余约" + remainDays + "天，跳过执行");
                return;
            }
            log.info(lastTs
                ? "距上次质变已超过7天（上次完成: " + new Date(lastTs).toLocaleString() + "），允许执行"
                : "无质变时间记录（首次执行），允许执行");
        }

        // ===== 材料计划检查：留空则跳过参量质变仪（若勾选爱可菲则仅执行爱可菲锅流程）=====
        const skipTransformer = !config.ifInsert;
        if (skipTransformer) {
            if (!config.enableAkfPot) {
                log.info("材料计划留空且未启用爱可菲锅配置，直接结束脚本");
                return;
            }
            log.info("材料计划留空，跳过参量质变仪，仅执行爱可菲锅配置");
        }

        // ===== 步骤1(可选)：切换队伍 + 切出爱可菲（由「启用爱可菲锅配置」控制）=====
        if (config.enableAkfPot) {
            if (!config.teamName) {
                log.error("已启用爱可菲锅配置但未填写队伍名称，请在设置中填写「队伍名称」");
                return;
            }
            log.info("切换队伍 -> " + config.teamName);
            const okParty = await switchParty(config.teamName);
            if (!okParty) return;

            log.info("切出角色 " + config.targetName);
            const switched = await switchToAvatar(config.targetName);
            if (!switched) return;
        } else {
            log.info("未启用爱可菲锅配置，跳过队伍切换与切出爱可菲");
        }

        // ===== 步骤1：执行路径 =====
        log.info("执行路径 " + config.pathFile);
        await pathingScript.runFile(config.pathFile);
        await sleep(3000); // 路径结束后等待镜头稳定（下落/落地后视角晃动）
        log.info("路径执行完成");

        // ===== 步骤2-5：参量质变仪完整流程（材料计划非空才执行）=====
        if (config.ifInsert) {
            // ===== 步骤2：打开背包，部署参量质变仪 =====
            log.info("打开背包并部署参量质变仪");
            const deployed = await deployTransformer();
            if (!deployed) return;

            // ===== 步骤3：交互参量质变仪，进入放入材料界面 =====
            log.info("交互参量质变仪");
            await enterMaterialPage();

            // ===== 步骤4：按材料计划放入参量质变仪 =====
            await insertMaterial();

            // ===== 步骤5：确定等待完成（勾选「启动角色辅助参量质变仪」时按优先级切角色持续放技能）=====
            if (config.enableSkillHelper) {
                await waitTransformerWithHelper();
            } else {
                await waitTransformer();
            }
        } // ===== 步骤2-5 结束：参量质变仪流程（材料计划非空才执行）=====

        // ===== 步骤6：切爱可菲出来长按E技能（受「启用爱可菲锅配置」控制）=====
        if (config.enableAkfPot) {
            // 走回终点属于质变仪流程：执行了质变仪流程（材料非空）才需要走回；仅爱可菲（跳过质变仪）时角色仍在路径终点，直接放锅
            if (config.ifInsert) {
                // 等待阶段辅助角色可能已后退/移动，从当前位置直接寻路到路径终点（不重跑完整路径），保证放锅位置正确
                log.info("从当前位置走回质变仪旁");
                await pathingScript.run(JSON.stringify({
                    info: {
                        name: "走到终点",
                        type: "collect",
                        map_name: "Teyvat",
                        map_match_method: "",
                        version: "1.0",
                        bgi_version: "0.45.0",
                        description: "",
                        enable_monster_loot_split: false,
                        last_modified_time: 1789485644258,
                        tags: [],
                        authors: [{ name: "夜雨l星辰", links: "" }]
                    },
                    positions: [
                        { id: 5, type: "orientation", x: -309.015625, y: 615.736328125 },
                        { id: 6, type: "target", move_mode: "walk", x: -309.015625, y: 615.736328125 }
                    ]
                }));
                await sleep(3000); // 等镜头稳定，同步骤1
            }

            log.info("切换 " + config.targetName + " 并长按E技能");
            const switchedBack = await switchToAvatar(config.targetName);
            if (!switchedBack) return;

            await keyDown("E");
            await sleep(config.eHoldMs);
            await keyUp("E");
            log.info("长按E技能完成");

            // 长按E后先立即后退，避免站在锅边被点死（后退不被计时等待阻塞）
            await keyDown("S");
            await sleep(1000);
            await keyUp("S");
            log.info("已向后撤退");

            // 后退完成后再开始计时等待（仅计时，不做其他操作；时长可配置，默认60秒）
            log.info("开始计时等待 " + config.eWaitSec + " 秒");
            await sleep(config.eWaitSec * 1000);
            log.info("爱可菲E等待计时结束（" + config.eWaitSec + " 秒）");
        } else {
            log.info("未启用爱可菲锅配置，跳过切爱可菲与长按E");
        }

        log.info("========== 脚本全部执行完成 ==========");
    } catch (error) {
        log.error("脚本执行失败: " + error.message);
    }
})();
