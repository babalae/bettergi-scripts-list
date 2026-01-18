import { __name } from "../rolldown-runtime.js";
import {
  assertRegionAppearing,
  assertRegionDisappearing,
  getErrorMessage,
} from "../@bettergi+utils.js";
import {
  clickToContinue,
  findBeyondBattlepassBtn,
  findBeyondBattlepassPopup,
  findBottomBtnText,
  findFetchRewardBtn,
  findHeaderTitle,
} from "../constants/regions.js";
import { isInLobby } from "./lobby.js";

//#region src/modules/reawrd.ts
//! 领取诸界纪游经验
const fetchBattlepassExp = async () => {
  //! 确保处于大厅内
  if (!isInLobby()) {
    log.warn("不在奇域大厅内，跳过领取诸界纪游经验");
    return;
  }
  if (!findBeyondBattlepassBtn()) {
    log.warn("诸界纪游已结束，跳过领取诸界纪游经验");
    return;
  }
  //! 打开诸界纪游界面
  await assertRegionAppearing(
    () => findHeaderTitle("纪游", true),
    "打开诸界纪游界面超时",
    () => {
      keyPress("VK_F4");
      //! 关闭纪游开屏动画（如果弹出）
      if (findBeyondBattlepassPopup()) keyPress("VK_ESCAPE");
    },
    {
      maxAttempts: 5,
      retryInterval: 2e3,
    },
  );
  //! 跳转到任务界面
  await assertRegionAppearing(
    () => findHeaderTitle("任务", true),
    "打开诸界纪游任务界面超时",
    () => {
      keyPress("VK_E");
    },
    {
      maxAttempts: 5,
      retryInterval: 2e3,
    },
  );
  //! 点击一键领取
  await assertRegionDisappearing(
    () => findBottomBtnText("领取", true),
    "领取诸界纪游经验超时",
    async () => {
      //! 重复确认，防止误领纪游奖励（部件礼箱会卡流程）而不是经验
      if (findHeaderTitle("任务", true)) {
        findBottomBtnText("领取", true)?.click();
        clickToContinue();
        await sleep(1e3);
        clickToContinue();
      }
    },
    {
      maxAttempts: 5,
      retryInterval: 3e3,
    },
  );
  await genshin.returnMainUi();
};
//! 领取绮衣珍赏奖励
const fetchRaimentCollection = async () => {
  //! 打开绮衣珍赏
  await assertRegionAppearing(
    () => findHeaderTitle("珍赏", true),
    "打开绮衣珍赏超时，活动未轮换/已结束",
    async () => {
      keyPress("VK_F6");
      await sleep(2e3);
      if (findHeaderTitle("珍赏", true) === void 0) keyPress("VK_Q");
    },
    {
      maxAttempts: 5,
      retryInterval: 1e3,
    },
  );
  //! 领取绮衣珍赏奖励
  await assertRegionDisappearing(
    findFetchRewardBtn,
    "领取绮衣珍赏奖励超时",
    async () => {
      const reward = findFetchRewardBtn();
      if (reward) {
        reward.click();
        clickToContinue();
        await sleep(1e3);
        clickToContinue();
      }
    },
    {
      maxAttempts: 5,
      retryInterval: 2e3,
    },
  );
  await genshin.returnMainUi();
};
//! 领取奇趣盛邀奖励
const fetchInvitationToWonderland = async () => {
  //! 打开奇趣盛邀
  await assertRegionAppearing(
    () => findHeaderTitle("盛邀", true),
    "打开奇趣盛邀超时，活动未轮换/已结束",
    async () => {
      keyPress("VK_F1");
      await sleep(2e3);
      if (findHeaderTitle("盛邀", true) === void 0) keyPress("VK_Q");
    },
    {
      maxAttempts: 5,
      retryInterval: 1e3,
    },
  );
  //! 领取妙思觅索奖励
  await assertRegionDisappearing(
    findFetchRewardBtn,
    "领取妙思觅索奖励超时",
    async () => {
      const reward = findFetchRewardBtn();
      if (reward) {
        reward.click();
        clickToContinue();
        await sleep(1e3);
        clickToContinue();
      }
    },
    {
      maxAttempts: 5,
      retryInterval: 2e3,
    },
  );
  await genshin.returnMainUi();
};
//! 领取日活奖励
const fetchCultivateReward = async () => {
  //! 确保处于大厅内
  if (!isInLobby()) {
    log.warn("不在奇域大厅内，跳过领取日活奖励");
    return;
  }
  try {
    log.info("尝试领取绮衣珍赏奖励...");
    await fetchRaimentCollection();
  } catch (err) {
    log.warn(`尝试领取绮衣珍赏奖励失败: ${getErrorMessage(err)}`);
  }
  try {
    log.info("尝试领取奇趣盛邀奖励...");
    await fetchInvitationToWonderland();
  } catch (err) {
    log.warn(`尝试领取奇趣盛邀奖励失败: ${getErrorMessage(err)}`);
  }
};

//#endregion
export { fetchBattlepassExp, fetchCultivateReward };
