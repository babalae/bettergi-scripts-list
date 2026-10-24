import { __name } from "../rolldown-runtime.js";
import { getNextDay4AM, getNextMonday4AM, useStoreWithDefaults } from "../@bettergi+utils.js";
import { findUidText } from "./regions.js";

//#region src/constants/store.ts
const DEFAULT_STORE_NAME = "default";
/** 脚本数据存储 */
const store = await (async () => {
  const uid = String(findUidText() || (await genshin.uid()) || DEFAULT_STORE_NAME);
  if (uid === DEFAULT_STORE_NAME)
    log.warn("无法识别 UID，已回退至默认数据存储，多用户数据存储功能将不可用");
  return useStoreWithDefaults(uid, {
    uid,
    weekly: {
      expGained: 0,
      attempts: 0,
    },
    daily: { attempts: 0 },
    nextWeek: getNextMonday4AM().getTime(),
    nextDay: getNextDay4AM().getTime(),
  });
})();

//#endregion
export { store };
