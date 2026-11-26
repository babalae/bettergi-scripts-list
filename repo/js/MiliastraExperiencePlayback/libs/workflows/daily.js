import { __name } from "../rolldown-runtime.js";
import {
  ProgressTracker,
  getErrorMessage,
  getNextDay4AM,
  isHostException,
} from "../@bettergi+utils.js";
import { userConfig } from "../constants/config.js";
import { store } from "../constants/store.js";
import { fetchBattlepassExp, fetchCultivateReward } from "../modules/reward.js";
import { enterRoom, leaveRoom } from "../modules/room.js";
import { ensureMultiPlayer } from "../modules/scene.js";
import { availablePlaybackFiles, forceExitStage, playStage } from "../modules/stage.js";

// src/workflows/daily.ts
const execDailyTask = async () => {
  if (!userConfig.dailyEnabled) {
    log.warn("未启用执行每日通关任务，跳过");
    return;
  }
  /** 确保不处于 禁止联机 状态/场景 */
  ensureMultiPlayer();
  /** 确保通关回放文件存在 */
  if (userConfig.dailyRooms.length > userConfig.dailyPlaybacks.length) {
    log.warn("通关回放文件池数量小于每日奇域关卡数量，跳过");
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
  /** 新的一天开始，重置每日通关数据 */
  if (Date.now() >= store.nextDay) {
    store.daily = { rooms: {} };
    store.nextDay = getNextDay4AM().getTime();
  }
  /** 计算各房间当日剩余可挑战次数 */
  const roomPlan = userConfig.dailyRooms.map((room) => {
    const completed = store.daily.rooms[room] ?? 0;
    return {
      room,
      completed,
      remaining: userConfig.dailyForce
        ? userConfig.dailyLimit
        : Math.max(0, userConfig.dailyLimit - completed),
    };
  });
  const totalRemaining = roomPlan.reduce((sum, item) => sum + item.remaining, 0);
  if (totalRemaining === 0) {
    log.warn("当日通关次数已达上限，跳过执行");
    return;
  }
  if (userConfig.dailyForce && roomPlan.some((item) => item.completed >= userConfig.dailyLimit))
    log.warn("当日通关次数已达上限，强制执行");
  /** 创建进度追踪器 */
  const tracker = new ProgressTracker(totalRemaining);
  /** 迭代尝试 */
  try {
    for (const { room, remaining } of roomPlan) {
      if (remaining === 0) {
        log.info("房间 {room} 当日已达通关上限，跳过", room);
        continue;
      }
      try {
        /** 离开当前所在房间（如果存在） */
        await leaveRoom();
        for (let i = 0; i < remaining; i++) {
          const completed = store.daily.rooms[room] ?? 0;
          tracker.print(`开始 ${store.uid} 房间 ${room} 当日第 ${completed + 1} 次奇域挑战...`);
          /** 进入房间 */
          await enterRoom(room);
          /** 游玩关卡 */
          await playStage(mappings[room]);
          /** 更新数据存储与进度 */
          store.daily.rooms[room] = completed + 1;
          tracker.tick({ increment: 1 });
        }
      } catch (err) {
        /** 发生主机异常（如：任务取消异常等），无法再继续执行 */
        if (isHostException(err)) throw err;
        /** 发生脚本流程异常，尝试退出关卡（如果在关卡中） */
        try {
          await forceExitStage();
        } catch (exitErr) {
          if (isHostException(exitErr)) throw exitErr;
          log.warn("尝试退出关卡失败: {error}", getErrorMessage(exitErr));
        }
        /** 发生脚本流程异常，尝试返回主界面 */
        await genshin.returnMainUi();
        log.warn("脚本执行出错: {error}", getErrorMessage(err));
      }
    }
    /** 领取诸界纪游经验 */
    await fetchBattlepassExp();
    /** 领取日活奖励 */
    await fetchCultivateReward();
  } catch (err) {
    /** 发生主机异常（如：任务取消异常等），无法再继续执行 */
    if (isHostException(err)) throw err;
    log.error("脚本执行出错: {error}", getErrorMessage(err));
  }
  await genshin.returnMainUi();
};

export { execDailyTask };
