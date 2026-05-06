/**
 * 递归读取指定文件夹下的所有 JSON 文件
 *
 * @param {string} folderPath - 要扫描的文件夹路径
 * @returns {string[]} 所有 JSON 文件的完整路径数组
 */
function readRouteFiles(folderPath) {
  const files = [];
  const entries = file.ReadPathSync(folderPath);

  for (const entry of entries) {
    if (file.IsFolder(entry)) {
      files.push(...readRouteFiles(entry));
    } else if (entry.endsWith(".json")) {
      files.push(entry);
    }
  }

  return files;
}

/**
 * 获取 paths 目录下所有路线文件路径
 *
 * @returns {string[]} 所有路线文件的完整路径数组，读取失败返回空数组
 */
function getRoutes() {
  try {
    return readRouteFiles("paths");
  } catch (err) {
    log.error("获取路线文件时出错:", err);
    return [];
  }
}

/**
 * 根据 tags 过滤路线，路线的所有 tag 都在排除列表中时才跳过
 *
 * @param {string[]} routePaths - 路线文件路径数组
 * @param {string[]} excludedTags - 要排除的 tag 名称数组
 * @returns {string[]} 过滤后的路线文件路径数组
 */
function filterByTags(routePaths, excludedTags) {
  if (!excludedTags || excludedTags.length === 0) return routePaths;

  return routePaths.filter(routePath => {
    try {
      const raw = file.readTextSync(routePath);
      const data = JSON.parse(raw);
      const tags = data.info?.tags;
      if (!tags || tags.length === 0) return true;
      return tags.some(tag => !excludedTags.includes(tag));
    } catch {
      return true;
    }
  });
}

/**
 * 根据地区目录名过滤路线
 *
 * @param {string[]} routePaths - 路线文件路径数组
 * @param {string[]} excludedRegions - 要排除的地区名称数组
 * @returns {string[]} 过滤后的路线文件路径数组
 */
function filterByRegion(routePaths, excludedRegions) {
  if (!excludedRegions || excludedRegions.length === 0) return routePaths;

  return routePaths.filter(routePath => {
    const parts = routePath.replace(/\\/g, '/').split('/');
    const regionIdx = parts.indexOf("paths") + 1;
    if (regionIdx >= parts.length) return true;
    return !excludedRegions.includes(parts[regionIdx]);
  });
}

export { getRoutes, filterByTags, filterByRegion };
