/** 只检查启用流程必需的能力；不猜测接口、不操作游戏。 */
export function assertRuntimeCapabilities({ version, required }) {
  const match = String(version ?? '').match(/(?:^|[^\d])(\d+)\.(\d+)\.(\d+)/);
  if (!match || Number(match[1]) === 0 && Number(match[2]) < 66) {
    throw new Error('角色一键养成需要 BetterGI 0.66.0 或更高版本，请升级并启用 OCR V6');
  }
  const missing = Object.entries(required).filter(([, available]) => !available).map(([name]) => name);
  if (missing.length) throw new Error(`当前 BetterGI 缺少必需接口：${missing.join('、')}；请检查安装是否完整并升级 BetterGI`);
}
