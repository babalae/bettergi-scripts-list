function checkAvatar(targetName) {
  const avatars = getAvatars();
  if (!avatars || avatars.length < 1) return false;
  for (let i = 0; i < avatars.length; i++) {
    if (avatars[i] === targetName) return true;
  }
  return false;
}

export { checkAvatar };
