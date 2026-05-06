/**
 * 检测当前队伍中是否包含指定角色
 *
 * @param {string} targetName - 目标角色名称
 * @returns {boolean} 队伍中是否包含该角色
 */
function checkAvatar(targetName) {
  const avatars = getAvatars();
  if (!avatars || avatars.length < 1) return false;
  for (let i = 0; i < avatars.length; i++) {
    if (avatars[i] === targetName) return true;
  }
  return false;
}

export { checkAvatar };
