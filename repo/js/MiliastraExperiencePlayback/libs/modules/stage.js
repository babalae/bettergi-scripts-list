import { __name } from "../rolldown-runtime.js";
import {
  assertRegionAppearing,
  assertRegionDisappearing,
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
  findPromptText,
  findSetupFilterBtn,
  findSkipBtn,
  findStageEscBtn,
} from "../constants/regions.js";
import { isInLobby } from "./lobby.js";

//#region src/modules/stage.ts
/** 已有的执行通关回放文件列表 */
const availablePlaybackFiles = () => {
  return [...file.readPathSync("assets/playbacks")].map((path) => path.replace(/\\/g, "/"));
};
const playStage = async (playbacks) => {
  if (
    !(await waitForAction(
      () => findStageEscBtn() !== void 0 || findBottomBtnText("返回大厅") !== void 0,
      async () => {
        /** 关卡房间，点击 “开始游戏” 按钮 */
        /** 「经典模式」关卡，点击 “开始挑战” 按钮 */
        findBottomBtnText("开始", true)?.click();
        /** 判断是否已经加入准备区 */
        const findPrepareMsg = () => findPromptText("请先加入") || findPromptText("准备");
        if (findPrepareMsg()) {
          log.info("加入准备区...");
          await assertRegionDisappearing(findPrepareMsg, "等待加入准备区提示消失超时");
          clickToPrepare();
        }
        /** 判断是否需要快速编队 */
        const findSetupMsg = () => findPromptText("至少") || findPromptText("角色");
        if (findSetupMsg()) {
          log.info("快速编队...");
          await assertRegionDisappearing(findSetupMsg, "等待未编队提示消失超时");
          await assertRegionAppearing(findSetupFilterBtn, "等待快速编队界面出现超时", () => {
            findBottomBtnText("快速", true)?.click();
          });
          /** 编入第一位角色 */
          const findSaveBtn = () => findBottomBtnText("保存", true) || findPromptText("配置");
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
  /** 直接通关结算的关卡（不会进入关卡） */
  if (findBottomBtnText("返回大厅")) {
    await exitStageToLobby();
    return;
  }
  /** 关闭游戏说明对话框 */
  if (userConfig.closeStageDialog)
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
  /** 执行随机通关回放文件 */
  await execStagePlayback(playbacks);
  await sleep(3e3);
  /** 退出关卡返回大厅 */
  await exitStageToLobby();
};
/** 执行通关回放文件（随机抽取） */
const execStagePlayback = async (playbacks) => {
  const file = playbacks[Math.floor(Math.random() * playbacks.length)];
  log.info("执行通关回放文件: {file}", file);
  await keyMouseScript.runFile(file);
};
/** 退出关卡 */
const exitStage = async () => {
  if (findStageEscBtn() === void 0) return;
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
      async () => {
        /** 点击 “中断挑战” 按钮 */
        findExitStageBtn()?.click();
        /** 点击底部 “返回大厅” 按钮 */
        findBottomBtnText("返回大厅")?.click();
      },
      { maxAttempts: 60 },
    ))
  )
    throw new Error("返回大厅超时");
  await genshin.returnMainUi();
};
/** 退出关卡返回大厅 */
const exitStageToLobby = async () => {
  if (isInLobby()) {
    log.warn("已处于奇域大厅，跳过");
    return;
  }
  log.info("退出关卡返回大厅...");
  if (
    !(await waitForAction(
      isInLobby,
      async () => {
        /** 跳过奇域等级提升页面（奇域等级每逢11、21、31、41级时出现加星页面） */
        clickToContinue();
        /** 跳过结算画面 */
        findSkipBtn()?.click();
        /** 点击底部 “返回大厅” 按钮 */
        findBottomBtnText("返回大厅")?.click();
      },
      { maxAttempts: 60 },
    ))
  ) {
    await exitStage();
    throw new Error("退出关卡返回大厅超时");
  }
};

//#endregion
export { availablePlaybackFiles, exitStage, playStage };
