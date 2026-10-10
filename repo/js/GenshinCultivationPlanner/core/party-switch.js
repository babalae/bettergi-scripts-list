/**
 * 同次脚本首次切队前先传送七天神像；后续切队直接尝试。
 * 若任意切队失败，则传送神像并重试一次，规避特殊地点禁止切队。
 */
export async function switchPartyWithRecovery({ partyName, taskLabel, state, switchParty, teleportToStatue, logger }) {
  state.unavailableParties ??= new Set();
  if (state.unavailableParties.has(partyName)) {
    logger.warn('[队伍] 队伍“{party}”本次已连续切换失败两次，跳过重复尝试', partyName);
    return false;
  }
  if (!state.initialized) {
    logger.info('[队伍] 本次首次任务，先传送七天神像恢复并离开特殊区域');
    await teleportToStatue();
    state.initialized = true;
  }
  if (await switchParty(partyName)) return true;

  logger.warn('[队伍] 切换{label}队伍失败，传送七天神像后重试一次：{party}', taskLabel, partyName);
  await teleportToStatue();
  const switched = await switchParty(partyName);
  if (!switched) state.unavailableParties.add(partyName);
  return switched;
}
