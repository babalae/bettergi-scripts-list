import { __name } from "../rolldown-runtime.js";

//#region src/constants/config.ts
//! 用户脚本设置
const userConfig = {
  room: settings.room || "20031486040",
  playbacks: (settings.playbacks || "美景音乐播放器结算.json")
    .replace(/，/g, ",")
    .split(",")
    .map((str) => str.trim())
    .filter(Boolean),
  expPerAttempt: Math.max(1, Number(settings.expPerAttempt || "20")),
  deleteStageSave: settings.deleteStageSave ?? false,
  deleteStageSaveKeyword: settings.deleteStageSaveKeyword || "音乐播放",
  expWeeklyLimit: Math.max(1, Number(settings.expWeeklyLimit || "4000")),
  force: settings.force ?? false,
  thisAttempts: Math.max(0, Number(settings.thisAttempts || "0")),
  dailyEnabled: settings.dailyEnabled ?? false,
  dailyRooms: (settings.dailyRooms || "24429042323,28644538672")
    .replace(/，/g, ",")
    .split(",")
    .map((str) => str.trim())
    .filter(Boolean),
  dailyPlaybacks: (settings.dailyPlaybacks || "通关回放1.json,通关回放2.json;40秒按1通关.json")
    .replace(/，/g, ",")
    .replace(/；/g, ";")
    .split(";")
    .map((str) => str.trim())
    .filter(Boolean)
    .reduce((arr, room) => {
      const files = room
        .split(",")
        .map((str) => str.trim())
        .filter(Boolean);
      if (files.length > 0) arr.push(files);
      return arr;
    }, []),
  dailyLimit: Math.max(1, Number(settings.dailyLimit || "1")),
  dailyForce: settings.dailyForce ?? false,
  closeStageDialog: settings.closeStageDialog ?? true,
  goToTeyvat: settings.goToTeyvat ?? true,
};

//#endregion
export { userConfig };
