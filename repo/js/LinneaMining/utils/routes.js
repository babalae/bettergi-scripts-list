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

function getRoutes() {
  try {
    return readRouteFiles("paths");
  } catch (err) {
    log.error("获取路线文件时出错:", err);
    return [];
  }
}

export { getRoutes };
