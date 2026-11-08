// 账号识别：多账号下按 UID 隔离刷新记录
//
// 优先级：
// 1. 设置里手动填写的账号标识（最稳，OCR 不好使时用）
// 2. 关闭多账号模式 -> 走旧的全局记录
// 3. 自动 OCR 读取当前角色 UID
// 4. 都失败 -> unknown（同一台机器上未识别账号共用一份记录）

const UNKNOWN_KEY = "unknown"
const DEFAULT_KEY = "default"

function sanitize(raw) {
  return String(raw).replace(/[\\/:*?"<>|\s]/g, "_").slice(0, 40)
}

async function resolveAccount() {
  const manual = String((settings.accountLabel || "")).trim()
  if (manual) {
    return { key: sanitize(manual), label: manual, source: "manual" }
  }

  if (settings.multiAccount === false) {
    return { key: DEFAULT_KEY, label: "未启用多账号", source: "disabled" }
  }

  try {
    const uid = await genshin.uid()
    if (uid && Number(uid) > 0) {
      return { key: String(uid), label: String(uid), source: "uid" }
    }
  } catch (e) {
    log.warn("读取账号 UID 失败: " + e)
  }

  return { key: UNKNOWN_KEY, label: "未识别账号", source: "fallback" }
}

export {
  resolveAccount
}
