import { __name } from "../rolldown-runtime.js";
import { assertRegionAppearing, waitForAction } from "../@bettergi+utils.js";
import {
  clickToChooseFirstSearchResult,
  findAllWonderlandsBtn,
  findClearInputBtn,
  findConfirmBtn,
  findCreateRoomBtn,
  findEnterRoomShortcut,
  findGoToLobbyBtn,
  findHeaderTitle,
  findLeaveRoomBtn,
  findSearchWonderlandBtn,
  findSearchWonderlandInput,
  findTopNSearchResultTexts,
} from "../constants/regions.js";
import { isInLobby } from "./lobby.js";

//#region src/modules/room.ts
const isInRoom = () => findHeaderTitle("房间", true) !== void 0;
/** 打开人气奇域 */
const goToRecommendedWonderlands = async () => {
  log.info("打开人气奇域界面...");
  await assertRegionAppearing(
    () => findHeaderTitle("人气", true),
    "打开人气奇域界面超时",
    () => {
      keyPress("VK_F6");
    },
  );
};
/** 创建并进入奇域房间 */
const createRoom = async (room) => {
  await goToRecommendedWonderlands();
  log.info("打开搜索奇域界面...");
  await assertRegionAppearing(
    () => findHeaderTitle("搜索", true),
    "打开搜索奇域界面超时",
    () => {
      findAllWonderlandsBtn()?.click();
    },
  );
  /** 帮助函数：获取首行奇域名称 */
  const findTopWonderlandNames = async (maxAttempts = 5, retryInterval = 2e3) => {
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(retryInterval);
      const texts = findTopNSearchResultTexts(4);
      if (texts.some((t) => t !== void 0)) return texts;
    }
  };
  const iwnts = await findTopWonderlandNames();
  if (iwnts === void 0) throw new Error("奇域列表加载超时");
  log.info("搜索前的奇域关卡名称: {iwnt}", iwnts.join(", "));
  log.info("粘贴奇域关卡文本: {room}", room);
  await assertRegionAppearing(findClearInputBtn, "粘贴关卡文本超时", () => {
    const input = findSearchWonderlandInput();
    if (input) {
      input.click();
      inputText(room);
    }
  });
  /** 等待搜索结果变化 */
  let lwnts;
  log.info("搜索奇域关卡: {room}", room);
  await waitForAction(
    () => {
      if (lwnts === void 0) return false;
      const isChanged = lwnts.some((text, i) => text?.toLowerCase() !== iwnts[i]?.toLowerCase());
      if (isChanged) log.info("奇域关卡名称已变化: {lwnt}，搜索完成", lwnts[0]);
      return isChanged;
    },
    async () => {
      const searchBtn = findSearchWonderlandBtn();
      if (searchBtn) {
        searchBtn.click();
        lwnts = await findTopWonderlandNames();
      }
    },
    {
      maxAttempts: 10,
      retryInterval: 1e3,
    },
  );
  log.info("打开奇域介绍...");
  await assertRegionAppearing(
    findCreateRoomBtn,
    "打开奇域介绍超时",
    () => {
      const goToLobbyButton = findGoToLobbyBtn();
      if (goToLobbyButton) {
        log.info("当前不在大厅，前往大厅...");
        goToLobbyButton.click();
      } else {
        log.info("选择第一个奇域关卡...");
        clickToChooseFirstSearchResult();
      }
    },
    { maxAttempts: 60 },
  );
  log.info("创建并进入房间...");
  await assertRegionAppearing(
    () => findHeaderTitle("房间", true),
    "创建并进入房间超时",
    () => {
      findCreateRoomBtn()?.click();
    },
    { maxAttempts: 60 },
  );
};
/** 进入奇域房间 */
const enterRoom = async (room) => {
  if (isInLobby()) {
    if (findEnterRoomShortcut()) {
      log.info("当前已存在房间，进入房间...", room);
      await assertRegionAppearing(
        () => findHeaderTitle("房间", true),
        "进入房间超时",
        () => {
          keyPress("VK_P");
        },
      );
      return;
    }
  }
  log.info("当前不在房间内，创建房间...", room);
  await createRoom(room);
};
/** 离开房间 */
const leaveRoom = async () => {
  /** 当前在大厅，且存在房间 */
  if ((isInLobby() && findEnterRoomShortcut() !== void 0) || isInRoom()) {
    log.info("当前存在房间，离开房间...");
    /** 先进入房间 */
    await assertRegionAppearing(
      () => findHeaderTitle("房间", true),
      "进入房间超时",
      () => {
        keyPress("VK_P");
      },
    );
    if (
      !(await waitForAction(
        isInLobby,
        async () => {
          findLeaveRoomBtn()?.click();
          await sleep(1e3);
          findConfirmBtn()?.click();
        },
        { maxAttempts: 5 },
      ))
    )
      throw new Error("离开房间超时");
  }
};

//#endregion
export { enterRoom, goToRecommendedWonderlands, leaveRoom };
