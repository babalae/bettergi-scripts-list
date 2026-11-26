import { __name } from "../rolldown-runtime.js";
import {
  assertRegionAppearing,
  assertRegionDisappearing,
  getErrorMessage,
  waitForAction,
} from "../@bettergi+utils.js";
import { userConfig } from "../constants/config.js";
import {
  clickToChooseFirstCharacter,
  clickToContinue,
  clickToPrepare,
  findBottomBtnText,
  findCloseDialog,
  findExitStageBtn,
  findLeave,
  findLoading,
  findPromptText,
  findSetupFilterBtn,
  findSkipBtn,
  findStarlitGalaVoteBtn,
} from "../constants/regions.js";
import { isInLobby } from "./lobby.js";

// src/modules/stage.ts
/** 已有的执行通关回放文件列表 */
const availablePlaybackFiles = () => {
  return [...file.readPathSync("assets/playbacks")].map((path) => path.replace(/\\/g, "/"));
};
const playStage = async (playbacks) => {
  log.info("进入关卡...");
  if (
    !(await waitForAction(
      (() => {
        let loadingStartTime = null;
        return () => {
          const isEntered = findLeave() !== void 0;
          if (isEntered) log.info("发现退出按钮，已进入关卡");
          const isEnded = findBottomBtnText("返回大厅", { maxEditDistance: 1 }) !== void 0;
          if (isEnded) log.info("发现返回大厅按钮，关卡已结束");
          const isLoading = findLoading() !== void 0;
          const timeout = userConfig.loadingTimeout;
          if (isLoading && loadingStartTime === null) {
            loadingStartTime = Date.now();
            log.info("发现加载图标，超时 {timeout} 秒将视作已进入关卡，执行通关回放文件", timeout);
          }
          const isTimedOut =
            loadingStartTime !== null &&
            !isLoading &&
            Date.now() - loadingStartTime > timeout * 1e3;
          return isEntered || isEnded || isTimedOut;
        };
      })(),
      async () => {
        /** 关卡房间，点击 “开始游戏” 按钮 */
        /** 「经典模式」关卡，点击 “开始挑战” 按钮 */
        findBottomBtnText("开始", { contains: true })?.click();
        /** 判断是否已经加入准备区 */
        const findPrepareMsg = () =>
          findPromptText("请先加入准备区", {
            contains: true,
            maxEditDistance: 3,
          });
        if (findPrepareMsg()) {
          log.info("加入准备区...");
          await assertRegionDisappearing(findPrepareMsg, "等待加入准备区提示消失超时");
          clickToPrepare();
        }
        /** 判断是否需要快速编队 */
        const findSetupMsg = () =>
          findBottomBtnText("快速", { contains: true }) &&
          findPromptText("请选择至少", {
            contains: true,
            maxEditDistance: 2,
          });
        if (findSetupMsg()) {
          log.info("快速编队...");
          await assertRegionDisappearing(findSetupMsg, "等待未编队提示消失超时");
          await assertRegionAppearing(findSetupFilterBtn, "等待快速编队界面出现超时", () => {
            findBottomBtnText("快速", { contains: true })?.click();
          });
          /** 编入第一位角色 */
          const findSaveBtn = () =>
            findBottomBtnText("保存", { contains: true }) ||
            findPromptText("配置", { contains: true });
          await assertRegionAppearing(findSaveBtn, "快速编队超时", () => {
            clickToChooseFirstCharacter();
          });
          /** 保存配置 */
          await assertRegionDisappearing(findSetupFilterBtn, "保存编队配置超时", () => {
            log.info("保存编队配置...");
            findSaveBtn()?.click();
          });
        }
      },
      { maxAttempts: 60 },
    ))
  )
    throw new Error("进入关卡超时");
  await sleep(1e3);
  /** 直接通关结算的关卡（不会进入关卡） */
  if (
    findBottomBtnText("返回大厅", {
      contains: true,
      maxEditDistance: 1,
    })
  ) {
    await finishStageAndReturn();
    return;
  }
  /** 关闭游戏说明对话框 */
  if (userConfig.closeStageDialog)
    for (let i = 0; i < 3; i++) {
      await sleep(500);
      await assertRegionDisappearing(
        findCloseDialog,
        "关闭游戏说明对话框超时",
        () => {
          findCloseDialog()?.click();
        },
        {
          maxAttempts: 10,
          retryInterval: 500,
        },
      );
    }
  /** 执行随机通关回放文件 */
  await execStagePlayback(playbacks);
  await sleep(3e3);
  /** 退出关卡返回大厅 */
  await finishStageAndReturn();
};
/** 执行通关回放文件（随机抽取） */
const execStagePlayback = async (playbacks) => {
  const file = playbacks[Math.floor(Math.random() * playbacks.length)];
  log.info("执行通关回放文件: {file}", file);
  await keyMouseScript.runFile(file);
};
/** 返回大厅 */
const returnToLobby = async (attempts) => {
  /** 点击底部 “返回大厅” 按钮 */
  const exitToLobbyBtn = findBottomBtnText("返回大厅", {
    contains: true,
    maxEditDistance: 1,
  });
  if (exitToLobbyBtn) {
    /** 绮星盛会投票 */
    try {
      if (userConfig.dailyRewards.includes("绮星盛会") && attempts && attempts <= 15)
        /** 等待投票动画结束 */
        await sleep(2e3);
      if (findStarlitGalaVoteBtn())
        await assertRegionDisappearing(findStarlitGalaVoteBtn, "等待绮星盛会投票完成超时", () => {
          findStarlitGalaVoteBtn()?.doubleClick();
        });
    } catch (err) {
      log.warn("绮星盛会投票失败: {error}", getErrorMessage(err));
    }
    exitToLobbyBtn.click();
  }
};
/** 强制退出关卡 */
const forceExitStage = async () => {
  if (isInLobby()) return;
  log.warn("关卡超时，尝试退出关卡...");
  await assertRegionAppearing(
    findExitStageBtn,
    "等待中断挑战按钮出现超时",
    () => {
      keyPress("VK_ESCAPE");
    },
    {
      maxAttempts: 10,
      retryInterval: 1e3,
    },
  );
  if (
    !(await waitForAction(
      isInLobby,
      async (attempts) => {
        /** 点击 “中断挑战” 按钮 */
        findExitStageBtn()?.click();
        /** 返回大厅 */
        await returnToLobby(attempts);
      },
      { maxAttempts: 60 },
    ))
  )
    throw new Error("返回大厅超时");
  await genshin.returnMainUi();
};
/** 退出关卡返回大厅 */
const finishStageAndReturn = async () => {
  if (isInLobby()) {
    log.warn("已处于奇域大厅，跳过");
    return;
  }
  log.info("退出关卡返回大厅...");
  if (
    !(await waitForAction(
      isInLobby,
      async (attempts) => {
        /** 跳过奇域等级提升界面（奇域等级每逢11、21、31、41级时出现加星界面） */
        clickToContinue();
        /** 跳过结算画面 */
        findSkipBtn()?.click();
        /** 返回大厅 */
        await returnToLobby(attempts);
      },
      { maxAttempts: 60 },
    ))
  ) {
    await forceExitStage();
    throw new Error("退出关卡返回大厅超时");
  }
  await sleep(1e3);
};

export { availablePlaybackFiles, forceExitStage, playStage };
