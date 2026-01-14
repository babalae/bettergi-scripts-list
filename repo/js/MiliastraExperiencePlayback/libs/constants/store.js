import { getNextDay4AM, getNextMonday4AM, useStoreWithDefaults } from "../@bettergi+utils.js";

//#region src/constants/store.ts
//! 脚本数据存储
const store = useStoreWithDefaults("data", {
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
