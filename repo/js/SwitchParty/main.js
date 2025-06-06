(async () => {
  const name = settings.name.trim()
  name === ""
    ? log.error("队伍名称未配置!")
    : await genshin.switchParty(name)
})()