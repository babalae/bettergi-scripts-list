/**
 * @file 挖矿进度 composable
 * 管理进度状态、消息处理、百分比动画、Demo 模式
 */

import { ref, computed, nextTick } from 'vue'
import gsap from 'gsap'
import { SEGMENT_COUNT } from '../constants'

export function useMiningProgress() {
  // ===== 响应式状态 =====

  /** 当前已完成数量 */
  const current = ref(0)

  /** 总数量 */
  const total = ref(0)

  /** 原始进度百分比 0-100 */
  const progress = ref(0)

  /** 动画过渡中的显示百分比（GSAP 驱动） */
  const displayProgress = ref(0)

  /** 当前路线名称 */
  const routeName = ref('')

  /** 当前状态文字 */
  const status = ref('准备中...')

  /** 预计剩余时间 */
  const estimatedTime = ref('')

  /** 已用时间 */
  const elapsedTime = ref('')

  /** 是否已全部完成（100%） */
  const isComplete = ref(false)

  // ===== 计算属性 =====

  /** 已填充的进度条段块数 */
  const filledCount = computed(() =>
    Math.round(progress.value / 100 * SEGMENT_COUNT)
  )

  // ===== Demo 模式定时器 =====
  let demoInterval = null

  /**
   * 启动 Demo 模式：自动推进进度用于开发调试
   * @param {Object} callbacks - 回调集合
   * @param {Function} callbacks.onProgressUpdate - 每步进度更新时调用 (pct)
   * @param {Function} callbacks.onComplete - 进度达到 100% 时调用
   */
  function startDemo({ onProgressUpdate, onComplete }) {
    status.value = '准备中...'
    current.value = 0
    total.value = 12
    routeName.value = 'A01-希汐岛左下-01'
    estimatedTime.value = '25分30秒'
    elapsedTime.value = '00分00秒'

    const demoRoutes = [
      'A01-希汐岛左下-01', 'A02-沐光之台', 'A03-月矩力实验设计局左侧',
      'A04-月矩力实验设计局右侧', 'A05-刻拉蒂之眼', 'A06-蓝珀胡左上',
      'A07-苔骨荒原-01', 'A08-星砂滩左侧-01', 'A09-那夏镇下方',
      'A10-那夏镇左侧', 'A11-叮铃哐啷蛋卷工坊', 'A12-苔古荒原地下',
    ]

    let step = 0
    demoInterval = setInterval(() => {
      step++
      if (step > total.value) {
        clearInterval(demoInterval)
        return
      }

      const pct = Math.round(step / total.value * 100)
      progress.value = pct
      current.value = step
      routeName.value = demoRoutes[step - 1] || '---'
      status.value = step < total.value ? '挖矿中' : '全部完成！'
      estimatedTime.value = `${Math.round((total.value - step) * 2)}分00秒`
      elapsedTime.value = `${Math.round(step * 2)}分00秒`

      // 用 GSAP 做百分比数字的阶梯动画
      gsap.to(displayProgress, {
        value: pct,
        duration: 0.4,
        snap: { value: 1 },
        ease: 'steps(8)',
      })

      nextTick(() => onProgressUpdate?.(pct))

      if (pct >= 100 && !isComplete.value) {
        isComplete.value = true
        onComplete?.()
      }
    }, 1500)
  }

  /**
   * 初始化外部消息处理器（绑定 window.htmlMask.onMessage）
   * @param {Object} callbacks - 同 startDemo 的回调集合
   */
  function initMessageHandler({ onProgressUpdate, onComplete }) {
    if (!window.htmlMask) return false

    window.htmlMask.onMessage = (msg) => {
      if (msg.url !== '/progress') return
      const data = msg.data

      if (data.current !== undefined) current.value = data.current
      if (data.total !== undefined) total.value = data.total
      if (data.routeName !== undefined) routeName.value = data.routeName
      if (data.status) status.value = data.status
      if (data.estimatedTime !== undefined) estimatedTime.value = data.estimatedTime
      if (data.elapsedTime !== undefined) elapsedTime.value = data.elapsedTime

      if (data.percentage !== undefined) {
        const pct = Math.min(100, Math.max(0, Math.round(data.percentage)))
        progress.value = pct

        gsap.to(displayProgress, {
          value: pct,
          duration: 0.4,
          snap: { value: 1 },
          ease: 'steps(8)',
        })

        nextTick(() => onProgressUpdate?.(pct))

        if (pct >= 100 && !isComplete.value) {
          isComplete.value = true
          onComplete?.()
        }
      }
    }
    return true
  }

  /** 清理消息监听和 demo 定时器 */
  function cleanup() {
    if (window.htmlMask) window.htmlMask.onMessage = null
    if (demoInterval) clearInterval(demoInterval)
  }

  return {
    // 状态
    current,
    total,
    progress,
    displayProgress,
    routeName,
    status,
    estimatedTime,
    elapsedTime,
    isComplete,
    // 计算属性
    filledCount,
    // 方法
    initMessageHandler,
    startDemo,
    cleanup,
  }
}
