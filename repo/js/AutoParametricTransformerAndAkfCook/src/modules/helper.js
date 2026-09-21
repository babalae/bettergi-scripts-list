//作者：夜雨l星辰
// 辅助模块：质变等待期间按固定优先级匹配队伍角色，切出并持续放技能/攻击直到质变完成

import { config } from "../config.js";
import { checkTransformDone, waitTransformer, waitWithCheck } from "./transformer.js";
import { switchToAvatar } from "./team.js";

// ===== 技能释放后往后小退一步（避免贴脸质变仪，仅切出辅助角色后执行一次）=====
export async function backStep(holdMs) {
    await keyDown("S");
    await sleep(holdMs);
    await keyUp("S");
    await sleep(300);
}

// ===== 执行单个辅助角色的技能/攻击动作（返回true表示质变已在此期间完成）=====
export async function runHelperSkill(charName) {
    switch (charName) {
        case "妮露":
            for (let i = 0; i < 4; i++) {
                await keyDown("E");  // 按下-保持-释放，避免0ms按键被原神吞掉
                await sleep(100);
                await keyUp("E");
                await sleep(500);
            }
            return await waitWithCheck(18000); // E后等18秒CD再循环放E
        case "爱可菲":
            await keyPress("E"); // 短按E
            await sleep(3000);
            return await checkTransformDone();
        case "久岐忍":
            await keyPress("E");
            await keyDown("W"); // 放E后前进0.07秒
            await sleep(70);
            await keyUp("W");
            return await waitWithCheck(15000); // E后等15秒再循环放E
        case "芙宁娜":
            await keyPress("E");
            return await waitWithCheck(20000); // E后等20秒CD再循环放E
        case "芭芭拉": {
            // E后无限普攻：不加间隔、E CD（32秒）好就继续开E；受 waitTimeout 超时兜底，超时停止点击
            let barbaraNextE = Date.now(); // 下次开E时间（初始立即开）
            const barbaraStart = Date.now();
            while (Date.now() - barbaraStart < config.waitTimeout * 1000) {
                if (await checkTransformDone()) return true;
                if (Date.now() >= barbaraNextE) {
                    await keyPress("E"); // 循环开E水环（E CD 32秒）
                    await sleep(500);
                    barbaraNextE = Date.now() + 32000;
                }
                await click(960, 540); // 一直点普攻，不加间隔
            }
            log.warn("芭芭拉辅助普攻超时（" + config.waitTimeout + "s），停止点击");
            return false;
        }
        default:
            await sleep(1000);
            return await checkTransformDone();
    }
}

// ===== 角色辅助等待：按固定优先级匹配队伍角色，切出并持续放技能直到质变完成 =====
export async function waitTransformerWithHelper() {
    const priority = config.helperPriority.split(/[,，、\s]+/).filter(Boolean);
    if (priority.length === 0) {
        log.info("辅助角色优先级为空，仅等待质变完成");
        return await waitTransformer();
    }

    const avatars = getAvatars();
    let helperName = null;
    if (avatars && avatars.length) {
        for (const name of priority) {
            for (let i = 0; i < avatars.length; i++) {
                if (avatars[i] === name) { helperName = name; break; }
            }
            if (helperName) break;
        }
    }
    if (!helperName) {
        log.info("队伍中没有优先级列表中的角色（" + priority.join(" > ") + "），仅等待质变完成");
        return await waitTransformer();
    }
    log.info("检测到辅助角色: " + helperName + "，正在切换并持续施放");
    const switched = await switchToAvatar(helperName);
    if (!switched) {
        log.warn("切换辅助角色失败，仅等待质变完成");
        return await waitTransformer();
    }
    await sleep(800);

    // 仅执行一次后退，避免贴脸质变仪；爱可菲1s，芙宁娜0.5s，妮露0.3s，其余0.1s；芭芭拉不后退（E水环+疯狂普攻），久岐忍不后退（E后前进）
    const backMs = helperName === "爱可菲" ? 1000 : (helperName === "芙宁娜" ? 500 : (helperName === "妮露" ? 300 : 100));
    if (helperName !== "芭芭拉" && helperName !== "久岐忍") {
        log.info("辅助角色 " + helperName + " 后退一步（" + backMs + "ms，仅执行一次）");
        await backStep(backMs);
    } else {
        log.info("辅助角色 " + helperName + " 不后退，直接施放技能");
    }

    var startTime = new Date();
    while ((new Date() - startTime) < config.waitTimeout * 1000) {
        if (await checkTransformDone()) return true;
        const done = await runHelperSkill(helperName);
        if (done) return true;
    }
    log.warn("等待参量质变完成超时");
    return false;
}
