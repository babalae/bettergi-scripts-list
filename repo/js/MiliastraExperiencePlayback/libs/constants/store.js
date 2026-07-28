import { getNextDay4AM, getNextMonday4AM, useStoreWithDefaults } from "../@bettergi+utils.js";

//#region src/constants/store.ts
const uidNumber = await genshin.uid();
if (!uidNumber) throw new Error("创建用户数据存储失败：无法识别UID");
/** 脚本数据存储 */
const uid = String(uidNumber);
const store = useStoreWithDefaults(uid, {
  uid,
  weekly: {
    expGained: 0,
    attempts: 0,
  },
  daily: { attempts: 0 },
  nextWeek: getNextMonday4AM().getTime(),
  nextDay: getNextDay4AM().getTime(),
});

//#endregion
export { store };
