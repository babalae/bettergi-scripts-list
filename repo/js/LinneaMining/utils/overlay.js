import { checkVersion } from "./version.js"

// 遮罩支持最低版本
const MIN_MASK_VERSION = '0.60.2-alpha.3'

let progressWinId = null
let useMask = false

/**
 * 初始化遮罩支持，根据版本号判断是否启用
 * @param {string} version - 当前 BetterGI 版本号
 */
function initOverlay(version) {
  useMask = checkVersion(version, MIN_MASK_VERSION)
  if (!useMask) {
    log.info(`遮罩功能需要 BetterGI >= ${MIN_MASK_VERSION}，当前版本不支持`)
  }
}

/**
 * 显示进度遮罩
 * @param {Object} initialData - 初始进度数据
 */
function showOverlay(initialData) {
  if (!useMask) return
  try {
    progressWinId = htmlMask.show("assets/progress-mask.html", "linnea-progress")
    if (progressWinId && initialData) {
      htmlMask.send(progressWinId, "/progress", JSON.stringify(initialData))
    }
  } catch (e) {
    log.error("遮罩显示失败:", e)
    progressWinId = null
  }
}

/**
 * 发送进度更新到遮罩
 * @param {Object} data - 进度数据
 * @param {number} data.percentage - 进度百分比 0-100
 * @param {number} data.current - 当前路线序号
 * @param {number} data.total - 总路线数
 * @param {string} data.routeName - 当前路线名称
 * @param {string} data.status - 状态文本
 * @param {string} data.estimatedTime - 预计剩余时间
 * @param {string} data.elapsedTime - 已用时间
 */
function sendProgress(data) {
  if (!progressWinId) return
  try {
    if (!htmlMask.exists(progressWinId)) {
      progressWinId = null
      return
    }
    htmlMask.send(progressWinId, "/progress", JSON.stringify(data))
  } catch (e) {
    // 静默忽略发送失败
  }
}

/**
 * 关闭进度遮罩
 */
function closeOverlay() {
  if (!progressWinId) return
  try {
    htmlMask.close(progressWinId)
  } catch (e) {
    // 静默忽略关闭失败
  }
  progressWinId = null
}

// ===== N 键切换面板最小化 =====

let keyHook = null

/**
 * 初始化快捷键监听：按 N 键切换面板最小化状态
 */
function initKeyHook() {
  if (!useMask) return
  try {
    keyHook = new KeyMouseHook()
    keyHook.OnKeyDown((key) => {
      if (key === 'N' && progressWinId && htmlMask.exists(progressWinId)) {
        htmlMask.send(progressWinId, '/toggle', '{}')
      }
    })
  } catch (e) {
    // kmCallback 不可用时静默跳过
  }
}

/**
 * 释放快捷键监听资源
 */
function disposeKeyHook() {
  try {
    if (keyHook) keyHook.dispose()
  } catch (e) {
    // 静默忽略
  }
  keyHook = null
}

export { initOverlay, showOverlay, sendProgress, closeOverlay, initKeyHook, disposeKeyHook }
