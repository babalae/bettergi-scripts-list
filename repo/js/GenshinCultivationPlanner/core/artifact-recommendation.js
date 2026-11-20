/** 依据实测布局读取推荐区方案一；不读取当前装备、不纠正近似套装名。 */
export function parseArtifactRecommendation(snapshot, characterName, catalog) {
  if (snapshot?.screen?.width !== 1920 || snapshot?.screen?.height !== 1080) {
    throw new Error('圣遗物推荐读取仅支持1920×1080');
  }
  if (!Array.isArray(snapshot.regions)) throw new Error('圣遗物推荐OCR结果不完整');
  const rows = snapshot.regions.filter(row => row && typeof row.text === 'string'
    && [row.x, row.y, row.width, row.height].every(Number.isFinite));
  const normalize = text => text.replace(/\s/g, '').replace(/：/g, ':').replace(/[×Xｘ]/g, 'x');
  const header = rows.filter(row => row.x > 620 && row.y >= 95 && row.y < 175
    && normalize(row.text) === normalize(characterName));
  if (header.length !== 1) throw new Error('圣遗物推荐角色标题不一致或无法确认');
  const headings = rows.filter(row => row.x >= 620 && row.y > 300 && row.y < 900
    && normalize(row.text) === '推荐圣遗物搭配方案');
  if (headings.length !== 1) throw new Error('未找到唯一的圣遗物推荐区域，请检查OCR V6');
  const heading = headings[0];
  const region = rows.filter(row => row.x >= 620 && row.x < 1850 && row.y > heading.y + heading.height
    && row.y < 1015);
  const labels = region.filter(row => /^方案[一二三四五六七八九十\d]+[:：]/.test(normalize(row.text)))
    .sort((a, b) => a.y - b.y);
  if (!labels.length || !/^方案(?:一|1):/.test(normalize(labels[0].text))
    || labels.filter(row => /^方案(?:一|1):/.test(normalize(row.text))).length !== 1) {
    throw new Error('无法确认第一推荐方案及其顺序，请手动指定套装');
  }
  const first = labels[0];
  const text = normalize(first.text);
  const match = text.match(/^方案(?:一|1):(.+?)x4$/);
  if (!match) throw new Error(`第一推荐“${first.text}”不是完整四件套，请手动指定一个套装`);
  const setName = Object.keys(catalog.sets ?? {}).find(name => normalize(name) === match[1]);
  if (!setName) throw new Error(`第一推荐套装“${match[1]}”不在目录中；请检查OCR或手动指定`);
  // 获取途径必须在第一方案和下一方案之间，不能借用方案二的秘境说明。
  const boundary = labels[1]?.y ?? 1015;
  const acquisition = region.filter(row => row.y > first.y + first.height && row.y < boundary
    && /成功挑战.*祝圣秘境.*获得/.test(row.text));
  if (acquisition.length !== 1) throw new Error('第一推荐的秘境获取途径不完整，请手动指定套装');
  const rate = region.find(row => row.x > 1600 && Math.abs(row.y - first.y) < 20
    && /^\d+(?:\.\d+)?%$/.test(normalize(row.text)));
  return { characterName, setName, pieces: 4, source: '提升指南第一项推荐',
    usageRate: rate ? normalize(rate.text) : null, rawText: first.text,
    acquisitionText: acquisition[0].text, snapshotId: snapshot.snapshot_id ?? null };
}

/** 两帧必须同角色、同四件套；旧报告或单帧不能授权执行。 */
export function resolveArtifactGuideRecommendation(report, characterName, catalog) {
  if (!report?.ok || report.cleanup?.status !== 'succeeded' || report.characterName !== characterName
    || report.requestedTab !== '圣遗物' || report.tabClicked !== true) {
    throw new Error(`圣遗物推荐读取未完成：${report?.error?.message ?? '角色、页签或安全返回无法确认'}`);
  }
  const first = parseArtifactRecommendation(report.snapshots?.first, characterName, catalog);
  const second = parseArtifactRecommendation(report.snapshots?.second, characterName, catalog);
  if (first.setName !== second.setName || first.acquisitionText !== second.acquisitionText) {
    throw new Error('两次圣遗物推荐读取不一致，已停止；请检查OCR V6或手动指定套装');
  }
  return { ...second, reportPath: report.reportPath };
}

/** 套装到秘境使用明确掉落映射，并再次检查 BetterGI 目录。 */
export function buildRoleArtifactTask(recommendation, catalog, nativeCatalog) {
  const entry = catalog.sets?.[recommendation.setName];
  if (!entry?.supported || !entry.domainName || !nativeCatalog.domains?.includes(entry.domainName)) {
    throw new Error(`套装“${recommendation.setName}”没有当前BetterGI可执行的秘境，已停止`);
  }
  // 指南显示的是秘境挑战名，调用接口需要入口名；两者通过静态数据交叉核对。
  if (recommendation.acquisitionText) {
    const challenge = entry.evidence?.name?.replace(/\s+[IVX]+$/, '');
    const normalize = text => text.replace(/\s/g, '').replace(/：/g, ':');
    if (!challenge || !normalize(recommendation.acquisitionText).includes(normalize(challenge))) {
      throw new Error('指南获取途径与套装秘境映射不一致，已停止；请手动指定套装');
    }
  }
  return { materialId: `artifact:${entry.domainName}`, materialName: recommendation.setName,
    executionType: 'artifactDomain', domainName: entry.domainName, materials: [], shortage: 0,
    priority: 0, status: 'supported', limited: false, roleArtifact: true, recommendation };
}

/** 只报告原生识别结果，不把奖励名当作套装质量或毕业证据。 */
export function buildRoleArtifactSummary(record) {
  const { recommendation, task, execution } = record;
  const lines = ['角色圣遗物刷取', `角色：${recommendation.characterName}`,
    `套装：${recommendation.setName}`, `来源：${recommendation.source}`, `秘境：${task.domainName}`];
  if (execution.status === 'failed') lines.push(`结果：未完成；${execution.reason}`);
  else if (execution.status === 'completed') lines.push('结果：任务结束，BetterGI已返回奖励识别');
  else lines.push(`结果：任务调用结束，领奖未确认；${execution.reason ?? '未返回奖励'}`);
  const rewards = Object.entries(execution.taskRecognizedRewards ?? {});
  if (rewards.length) lines.push('识别奖励', ...rewards.map(([name, count]) => `• ${name}×${count}`));
  lines.push(`记录：${record.reportPath}`);
  return lines.join('\n');
}
