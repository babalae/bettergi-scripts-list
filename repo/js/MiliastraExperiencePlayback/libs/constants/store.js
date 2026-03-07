import { __name } from "../rolldown-runtime.js";
import { getNextDay4AM, getNextMonday4AM, useStoreWithDefaults } from "../@bettergi+utils.js";
import { findUidText } from "./regions.js";

//#region src/constants/store.ts
//! 脚本数据存储
const store = (() => {
  const uid = findUidText()?.text.replace(/\D/g, "");
  if (!uid) throw new Error("创建用户数据存储失败: 无法识别UID");
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
