import { __name } from "../rolldown-runtime.js";
import {
  ProgressTracker,
  getErrorMessage,
  getNextDay4AM,
  isHostException,
} from "../@bettergi+utils.js";
import { userConfig } from "../constants/config.js";
import { store } from "../constants/store.js";
import { fetchBattlepassExp, fetchCultivateReward } from "../modules/reawrd.js";
import { enterRoom, leaveRoom } from "../modules/room.js";
import { availablePlaybackFiles, exitStage, playStage } from "../modules/stage.js";

//#region src/workflows/daily.ts
const execDailyTask = async () => {
  if (!userConfig.dailyEnabled) {
    log.warn("未启用执行每日通关任务，跳过");
    return;
  }
  //! 确保通关回放文件存在
  if (userConfig.dailyRooms.length !== userConfig.dailyPlaybacks.length) {
    log.warn("每日奇域关卡数量与通关回放文件池数量不匹配，跳过");
    return;
  }
  const files = availablePlaybackFiles();
  const mappings = {};
  for (let i = 0; i < userConfig.dailyRooms.length; i++) {
    const room = userConfig.dailyRooms[i];
    const playbacks = userConfig.dailyPlaybacks[i]
      .map((file) => `assets/playbacks/${file}`)
      .filter((path) => files.includes(path));
    if (playbacks.length === 0) {
      log.warn(
        "房间 {room} 未找到任何通关回放文件，请确保已录制回放并拷贝到 assets/playbacks 目录下",
        room,
      );
      return;
    }
    mappings[room] = playbacks;
  }
  //! 新的一天开始，重置经验值数据
  if (Date.now() >= store.nextDay) {
    store.daily = { attempts: 0 };
    store.nextDay = getNextDay4AM().getTime();
  }
  //! 检查当日通关次数是否已达上限
  if (store.daily.attempts >= userConfig.dailyLimit)
    if (userConfig.dailyForce) log.warn("当日通关次数已达上限，强制执行");
    else {
      log.warn("当日通关次数已达上限，跳过执行");
      return;
    }
  //! 计算需要进行的尝试次数
  let attempts = userConfig.dailyLimit - store.daily.attempts;
  attempts = attempts > 0 ? attempts : 1;
  //! 创建进度追踪器
  const tracker = new ProgressTracker(attempts * userConfig.dailyRooms.length);
  //! 迭代奇域关卡列表
  try {
    for (let i = 0; i < attempts; i++) {
      //! 迭代尝试
      try {
        for (const room of userConfig.dailyRooms) {
          //! 离开当前所在房间（如果存在）
          await leaveRoom();
          tracker.print(`开始 ${store.uid} 当日第 ${store.daily.attempts + 1} 次奇域挑战...`);
          //! 进入房间
          await enterRoom(room);
          //! 游玩关卡
          await playStage(mappings[room]);
          //! 更新进度
          tracker.tick({ increment: 1 });
        }
      } catch (err) {
        //! 发生主机异常（如：任务取消异常等），无法再继续执行
        if (isHostException(err)) throw err;
        //! 发生脚本流程异常，尝试退出关卡（如果在关卡中）
        await exitStage();
        log.error("脚本执行出错: {error}", getErrorMessage(err));
      }
      //! 一轮关卡执行结束，更新数据存储
      store.daily.attempts += 1;
    }
    //! 领取诸界纪游经验
    await fetchBattlepassExp();
    //! 领取日活奖励
    await fetchCultivateReward();
  } catch (err) {
    //! 发生主机异常（如：任务取消异常等），无法再继续执行
    if (isHostException(err)) throw err;
    log.error("脚本执行出错: {error}", getErrorMessage(err));
  }
  await genshin.returnMainUi();
};

//#endregion
export { execDailyTask };
