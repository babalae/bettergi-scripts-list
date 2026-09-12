/**
 * @file 像素风 GSAP 动画 composable
 * 包含：DPI 补偿、入场动画、进度填充、完成动画、状态闪烁、碎片动画
 */

import gsap from 'gsap'
import { SEGMENT_COUNT, BASE_SCALE } from '../constants'

export function usePixelAnimations() {
  // ===== GSAP Timeline 实例 =====

  /** 入场动画时间线 */
  let entranceTl = null

  /** 完成动画时间线 */
  let completeTl = null

  /** 状态点闪烁时间线 */
  let blinkTl = null

  // (碎片动画已移除)

  // ===== DPI 补偿 =====

  /**
   * 根据当前系统 DPI 缩放比例设置面板缩放
   * 确保面板物理尺寸不受 Windows 系统缩放影响
   * @param {HTMLElement} el - .pixel-scale 容器元素
   */
  function applyDpiScale(el) {
    if (!el) return
    const dpr = window.devicePixelRatio || 1
    gsap.set(el, { scale: BASE_SCALE / dpr })
  }

  // ===== 入场动画 =====

  /**
   * 播放面板入场动画（碎片闪现 → 面板滑入 → 各行依次出现）
   * @param {Object} refs - DOM 元素引用集合
   */
  function playEntranceAnimation(refs) {
    const {
      panelOuter, titleRow, dividerEl,
      statsRow, routeNameEl, timeRow, statusEl,
      segmentRefs,
    } = refs

    entranceTl = gsap.timeline()

    // 面板滑入
    entranceTl.from(panelOuter, {
      x: 60,
      y: 40,
      opacity: 0,
      duration: 0.6,
      ease: 'steps(12)',
    }, '-=0.4')

    // 标题行展开
    entranceTl.from(titleRow, {
      scaleX: 0,
      opacity: 0,
      duration: 0.2,
      transformOrigin: 'left center',
      ease: 'steps(4)',
    }, '-=0.2')

    // 分隔线逐点出现
    entranceTl.add(() => {
      const dots = dividerEl.querySelectorAll('.dot')
      gsap.from(dots, {
        opacity: 0,
        duration: 0.02,
        stagger: 0.015,
        ease: 'steps(1)',
      })
    }, '-=0.05')

    // 统计行
    entranceTl.from(statsRow, {
      y: -6,
      opacity: 0,
      duration: 0.15,
      ease: 'steps(3)',
    }, '-=0.3')

    // 进度条段块依次展开
    entranceTl.add(() => {
      const segments = segmentRefs.filter(Boolean)
      gsap.from(segments, {
        scaleY: 0,
        opacity: 0,
        duration: 0.04,
        stagger: 0.02,
        ease: 'steps(1)',
      })
    }, '-=0.05')

    // 路线名
    entranceTl.from(routeNameEl, {
      x: -10,
      opacity: 0,
      duration: 0.15,
      ease: 'steps(3)',
    }, '-=0.3')

    // 时间行
    entranceTl.from(timeRow, {
      opacity: 0,
      duration: 0.15,
      ease: 'steps(3)',
    }, '-=0.15')

    // 状态行
    entranceTl.from(statusEl, {
      y: 6,
      opacity: 0,
      duration: 0.15,
      ease: 'steps(3)',
    }, '-=0.1')
  }

  // ===== 进度条段块填充动画 =====

  /**
   * 根据进度百分比，对新增的已填充段块播放弹入动画
   * @param {number} pct - 当前进度百分比 0-100
   * @param {HTMLElement[]} segmentRefs - 段块 DOM 元素数组
   */
  function animateFilledSegments(pct, segmentRefs) {
    const target = Math.round(pct / 100 * SEGMENT_COUNT)
    const segments = segmentRefs.filter(Boolean)

    for (let i = 0; i < target; i++) {
      const seg = segments[i]
      if (!seg || seg.dataset.animated === '1') continue
      seg.dataset.animated = '1'
      gsap.fromTo(seg,
        { scaleY: 0, opacity: 0 },
        { scaleY: 1, opacity: 1, duration: 0.1, ease: 'steps(2)' }
      )
    }
  }

  // ===== 状态点闪烁 =====

  /**
   * 启动状态指示点的循环闪烁动画
   * @param {HTMLElement} dotEl - 状态点元素
   */
  function startBlink(dotEl) {
    if (!dotEl) return
    blinkTl = gsap.timeline({ repeat: -1 })
    blinkTl.to(dotEl, { opacity: 0, duration: 0.4, ease: 'steps(1)' })
    blinkTl.to(dotEl, { opacity: 1, duration: 0.4, ease: 'steps(1)' })
  }

  // ===== 完成动画 =====

  /**
   * 播放挖矿全部完成时的庆祝动画
   * 进度条闪烁 → 面板弹跳 → 边框高亮
   * @param {Object} refs - DOM 元素引用集合
   */
  function playCompleteAnimation(refs) {
    const { panelOuter, segmentRefs } = refs

    if (blinkTl) blinkTl.kill()

    const segments = segmentRefs.filter(Boolean)
    completeTl = gsap.timeline()

    // 进度条闪烁
    for (let n = 0; n < 3; n++) {
      completeTl.to(segments, { backgroundColor: '#ffcc00', duration: 0.1, ease: 'steps(1)' })
      completeTl.to(segments, { backgroundColor: '#4caf50', duration: 0.1, ease: 'steps(1)' })
    }
    completeTl.to(segments, { backgroundColor: '#ffcc00', duration: 0.1, ease: 'steps(1)' })

    // 面板弹跳
    completeTl.to(panelOuter, { y: -4, duration: 0.1, ease: 'steps(2)' }, '-=0.1')
    completeTl.to(panelOuter, { y: 0, duration: 0.15, ease: 'steps(3)' })

    // 边框高亮闪烁
    completeTl.to(panelOuter, {
      borderColor: '#ffe066', duration: 0.12, ease: 'steps(1)', yoyo: true, repeat: 3,
    }, '-=0.3')
  }

  // ===== 清理 =====

  /** 终止所有正在播放的 GSAP 动画 */
  function cleanup() {
    if (entranceTl) entranceTl.kill()
    if (completeTl) completeTl.kill()
    if (blinkTl) blinkTl.kill()
  }

  return {
    applyDpiScale,
    playEntranceAnimation,
    animateFilledSegments,
    startBlink,
    playCompleteAnimation,
    cleanup,
  }
}
