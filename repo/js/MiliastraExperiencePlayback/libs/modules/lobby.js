import { __name } from "../rolldown-runtime.js";
import { assertRegionAppearing, waitForAction } from "../@bettergi+utils.js";
import { userConfig } from "../constants/config.js";
import {
  findBeyondHall,
  findBeyondPaimon,
  findConfirmBtn,
  findGotTeyvatBtn,
  findHeaderTitle,
  findPaimon,
} from "../constants/regions.js";

// src/modules/lobby.ts
/** 判断是否处于奇域大厅 */
const isInLobby = () => (findBeyondPaimon() || findBeyondHall()) !== void 0;
/** 判断是否处于提瓦特大陆 */
const isInTeyvat = () => findPaimon() !== void 0;
/** 退出大厅返回提瓦特大陆 */
const exitLobbyToTeyvat = async () => {
  if (!userConfig.goToTeyvat) return;
  if (isInTeyvat()) {
    log.warn("已处于提瓦特大陆，跳过");
    return;
  }
  log.info("打开当前大厅...");
  await assertRegionAppearing(
    () => findHeaderTitle("大厅", { contains: true }),
    "打开当前大厅超时",
    () => {
      keyPress("VK_F2");
    },
    {
      maxAttempts: 10,
      retryInterval: 2e3,
    },
  );
  log.info("返回提瓦特大陆...");
  if (
    !(await waitForAction(
      isInTeyvat,
      () => {
        findGotTeyvatBtn()?.click();
        findConfirmBtn()?.click();
      },
      { maxAttempts: 120 },
    ))
  )
    throw new Error("返回提瓦特大陆超时");
};

export { exitLobbyToTeyvat, isInLobby };
