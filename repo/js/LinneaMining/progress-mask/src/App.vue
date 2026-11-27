<template>
  <div class="overlay">
    <!-- DPI 补偿缩放容器 -->
    <div class="pixel-scale" ref="panelOuter">
      <div class="panel-outer">
        <!-- 四角像素装饰 -->
        <span class="corner corner-tl"></span>
        <span class="corner corner-tr"></span>
        <span class="corner corner-bl"></span>
        <span class="corner corner-br"></span>

        <div class="panel-inner full" v-show="!minimized">
          <div class="panel-body">
            <!-- 左侧信息区 -->
            <div class="panel-info">
              <!-- 标题 -->
              <div class="title-row" ref="titleRow">
                <span class="diamond">◆</span>
                <span class="title-text">LINNEA MINING</span>
              </div>

              <!-- 像素点阵分隔线 -->
              <div class="divider" ref="dividerEl">
                <span v-for="i in 32" :key="i" class="dot"></span>
              </div>

              <!-- 统计行：[05/32]  15% -->
              <div class="stats-row" ref="statsRow">
                <span class="stat-bracket">[</span>
                <span class="stat-current">{{ current }}</span>
                <span class="stat-sep">/</span>
                <span class="stat-total">{{ total }}</span>
                <span class="stat-bracket">]</span>
                <span class="stat-spacer"></span>
                <span class="stat-percent">{{ displayProgress }}</span>
                <span class="stat-percent-unit">%</span>
              </div>

              <!-- 分段横向进度条 -->
              <div class="bar-track" ref="barTrack">
                <div
                    v-for="i in SEGMENT_COUNT"
                    :key="i"
                    class="bar-segment"
                    :class="{ filled: i <= filledCount, complete: isComplete }"
                    :ref="el => { if (el) segmentRefs[i - 1] = el }"
                >
                  <span class="seg-inner"></span>
                </div>
              </div>

              <!-- 当前路线名 -->
              <div class="route-name" ref="routeNameEl">
                <span class="route-arrow">▶</span>
                <span>{{ routeName || '---' }}</span>
              </div>

              <!-- 时间行 -->
              <div class="time-row" ref="timeRow">
                <div class="time-item">
                  <span class="time-label">剩余</span>
                  <span class="time-value">{{ estimatedTime || '--' }}</span>
                </div>
                <div class="time-item">
                  <span class="time-label">已用</span>
                  <span class="time-value">{{ elapsedTime || '--' }}</span>
                </div>
              </div>

              <!-- 状态 -->
              <div class="status-row" ref="statusEl">
                <span>
                  <span class="status-dot" ref="statusDot">▶</span>
                  <span>{{ status }}</span>
                </span>
                <span class="hint-text">点按 N 隐藏面板</span>
              </div>
            </div>

            <!-- 右侧像素小人 -->
            <LinneaSprite :src="currentSprite"/>
          </div>
        </div>
        <div class="panel-inner panel-mini" v-show="minimized">
          <span class="hint-text">点按 N 开启面板</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * @file 挖矿进度遮罩层主组件
 * 组合 DebrisField、LinneaSprite 子组件与 useMiningProgress、usePixelAnimations composable
 */

import {computed, onMounted, onUnmounted, ref} from 'vue'

// 子组件
import LinneaSprite from './components/LinneaSprite.vue'

// Composable
import {useMiningProgress} from './composables/useMiningProgress'
import {usePixelAnimations} from './composables/usePixelAnimations'

import gsap from 'gsap'

// 常量
import {DEFAULT_SPRITE, SEGMENT_COUNT, SPRITE_MAP, SPRITE_STATES} from './constants'

// ===== Composable 实例 =====

const {
  current, total, displayProgress,
  routeName, status, estimatedTime, elapsedTime,
  isComplete, filledCount,
  initMessageHandler, startDemo, cleanup: cleanupProgress,
} = useMiningProgress()

const {
  applyDpiScale, playEntranceAnimation, animateFilledSegments,
  startBlink, playCompleteAnimation,
  cleanup: cleanupAnimations,
} = usePixelAnimations()

// ===== DOM Refs =====

/** DPI 缩放容器（.pixel-scale） */
const panelOuter = ref(null)
const titleRow = ref(null)
const dividerEl = ref(null)
const statsRow = ref(null)
const barTrack = ref(null)
const routeNameEl = ref(null)
const timeRow = ref(null)
const statusEl = ref(null)
const statusDot = ref(null)
/** 进度条段块 refs */
const segmentRefs = ref([])

// ===== 面板最小化 =====

/** 面板最小化状态（持久化到 localStorage） */
const minimized = ref(localStorage.getItem('linnea-panel-mini') === '1')

/** 动画进行中防重入 */
let animating = false

/** 隐藏面板左移量基准值，越大越靠左。运行时按分辨率自动缩放 */
const OFFSET_BASE = 360
let offsetX = 0

/**
 * 切换面板最小化状态，GSAP 宽度动画 + 内容淡入淡出
 * 宽度从 300px ↔ 100px，平滑缩放无抖动
 */
function toggleMinimized() {
  if (animating) return
  animating = true

  const toMini = !minimized.value
  const pixel = panelOuter.value
  const panel = pixel?.querySelector('.panel-outer')
  const fullInner = panel?.querySelector('.panel-inner.full')
  const miniInner = panel?.querySelector('.panel-inner.panel-mini')
  if (!pixel || !panel || !fullInner || !miniInner) {
    minimized.value = toMini
    animating = false
    return
  }

  const dur = 0.5
  const miniW = 100

  const tl = gsap.timeline({
    onComplete: () => {
      minimized.value = toMini
      localStorage.setItem('linnea-panel-mini', toMini ? '1' : '0')
      animating = false
    }
  })

  if (toMini) {
    // 收：先淡出大内容，再缩宽+移位，最后淡入小提示
    tl.to(fullInner, { opacity: 0, duration: 0.2 }, 0)
    tl.to(panel, { width: miniW, duration: dur, ease: 'power2.inOut' }, 0)
    tl.to(pixel, { x: -offsetX, duration: dur, ease: 'power2.inOut' }, 0)
    tl.call(() => { fullInner.style.display = 'none'; miniInner.style.display = '' }, null, dur * 0.5)
    tl.fromTo(miniInner, { opacity: 0 }, { opacity: 1, duration: 0.2 }, dur * 0.6)
  } else {
    // 展：切回大内容(它渲染在最终宽度上) → 展宽+移回 → 淡入
    tl.call(() => { miniInner.style.display = 'none'; fullInner.style.display = '' })
    tl.set(fullInner, { opacity: 0 })
    tl.to(panel, { width: 300, duration: dur, ease: 'power2.inOut' }, 0)
    tl.to(pixel, { x: 0, duration: dur, ease: 'power2.inOut' }, 0)
    tl.to(fullInner, { opacity: 1, duration: 0.25 }, dur * 0.5)
  }
}

// ===== Sprite 状态 =====

/**
 * 当前 sprite 动画状态名
 */
const spriteState = ref('idle')

/**
 * 当前 sprite GIF URL
 */
const currentSprite = computed(() => SPRITE_MAP[spriteState.value] || DEFAULT_SPRITE)

/** sprite 随机切换定时器 */
let spriteTimer = null

/** 启动 sprite 状态随机切换（每 4 秒） */
function startSpriteCycle() {
  spriteTimer = setInterval(() => {
    spriteState.value = SPRITE_STATES[Math.floor(Math.random() * SPRITE_STATES.length)]
  }, 4000)
}

// ===== 回调：进度更新 / 完成 =====

/** 进度每步更新时的回调 */
function onProgressUpdate(pct) {
  animateFilledSegments(pct, segmentRefs.value)
}

/** 进度达到 100% 时的回调 */
function onComplete() {
  playCompleteAnimation({
    panelOuter: panelOuter.value,
    segmentRefs: segmentRefs.value,
  })
}

// ===== 生命周期 =====

onMounted(() => {
  // 通知 JS 侧遮罩已就绪
  try { window.htmlMask.request('/ready', '{}') } catch {}

  // DPI 补偿
  applyDpiScale(panelOuter.value)

  // 分辨率适配左移量（以 2560 宽为基准等比缩放）
  const w = window.innerWidth
  offsetX = Math.round(OFFSET_BASE * w / 2560)

  // 初始最小化状态
  if (minimized.value) {
    const panel = document.querySelector('.panel-outer')
    if (panel) panel.style.width = '100px'
    gsap.set(panelOuter.value, { x: -offsetX })
  }

  // 初始化消息处理或进入 Demo 模式
  const hasHandler = initMessageHandler({onProgressUpdate, onComplete})
  if (!hasHandler) {
    startDemo({onProgressUpdate, onComplete})
  }

  // 入场动画
  playEntranceAnimation({
    panelOuter: panelOuter.value,
    titleRow: titleRow.value,
    dividerEl: dividerEl.value,
    statsRow: statsRow.value,
    routeNameEl: routeNameEl.value,
    timeRow: timeRow.value,
    statusEl: statusEl.value,
    segmentRefs: segmentRefs.value.filter(Boolean),
  })

  // 状态点闪烁
  startBlink(statusDot.value)

  // sprite 随机切换
  startSpriteCycle()

  // 面板最小化切换：接收 /toggle 消息，包裹已有 handler
  if (window.htmlMask) {
    const prev = window.htmlMask.onMessage
    window.htmlMask.onMessage = (msg) => {
      if (msg.url === '/toggle') {
        toggleMinimized()
        return
      }
      if (prev) prev(msg)
    }
  }
})

onUnmounted(() => {
  cleanupProgress()
  cleanupAnimations()
  if (spriteTimer) clearInterval(spriteTimer)
})
</script>

<style>
/* ===== 全局重置 ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: transparent;
  font-family: 'Zpix', Consolas, 'Courier New', monospace;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: unset;
  font-smooth: never;
}

/* ===== 全屏遮罩 ===== */
.overlay {
  width: 100vw;
  height: 100vh;
  position: relative;
}

/* ===== DPI 补偿缩放容器 ===== */
.pixel-scale {
  /* scale 由 JS 根据 devicePixelRatio 动态设置 */
  transform-origin: bottom right;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: -webkit-crisp-edges;
  position: absolute;
  right: 8px;
  bottom: 8px;
}

/* ===== 外层面板 ===== */
.panel-outer {
  position: relative;
  border: 2px solid #ffcc00;
  background: #000000;
  padding: 3px;
  width: 300px;
  box-shadow: 2px 2px 0 0 #000000,
  2px 2px 0 1px #997a00;
}

/* 四角像素装饰 */
.corner {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #ffcc00;
}

.corner-tl {
  top: -3px;
  left: -3px;
}

.corner-tr {
  top: -3px;
  right: -3px;
}

.corner-bl {
  bottom: -3px;
  left: -3px;
}

.corner-br {
  bottom: -3px;
  right: -3px;
}

/* ===== 内层面板 ===== */
.panel-inner {
  border: 1px solid #cc9900;
  padding: 6px 8px;
}

/* 面板双列布局 */
.panel-body {
  display: flex;
  gap: 8px;
}

/* 左侧信息区 */
.panel-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* ===== 标题行 ===== */
.title-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.diamond {
  color: #ffcc00;
  font-size: 9px;
}

.title-text {
  color: #ffcc00;
  font-size: 8px;
  font-weight: bold;
  letter-spacing: 1px;
}

/* ===== 像素点阵分隔线 ===== */
.divider {
  display: flex;
  gap: 0;
  margin-bottom: 4px;
  margin-top: 2px;
}

.dot {
  flex: 1;
  height: 1px;
  background: #ffcc00;
}

/* ===== 统计行 ===== */
.stats-row {
  display: flex;
  align-items: baseline;
  margin-bottom: 4px;
  line-height: 1;
}

.stat-bracket {
  color: #ffcc00;
  font-size: 8px;
  font-weight: bold;
}

.stat-current {
  color: #ffffff;
  font-size: 11px;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}

.stat-sep {
  color: #666;
  font-size: 8px;
}

.stat-total {
  color: #999;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

.stat-spacer {
  flex: 1;
}

.stat-percent {
  color: #ffffff;
  font-size: 13px;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}

.stat-percent-unit {
  color: #ffcc00;
  font-size: 8px;
  margin-left: 1px;
  font-weight: bold;
}

/* ===== 分段进度条 ===== */
.bar-track {
  display: flex;
  gap: 1px;
  height: 10px;
  margin-bottom: 4px;
  padding: 1px;
  border: 1px solid #444;
  background: #111;
}

.bar-segment {
  flex: 1;
  height: 100%;
  position: relative;
  background: #1a1a1a;
  border: 1px solid #333;
}

.bar-segment .seg-inner {
  position: absolute;
  inset: 0;
  background: transparent;
}

.bar-segment.filled {
  background: #4caf50;
  border-color: #2e7d32;
}

.bar-segment.filled .seg-inner {
  border-bottom: 1px solid #2e7d32;
  border-right: 1px solid #2e7d32;
  border-top: 1px solid #81c784;
  border-left: 1px solid #81c784;
}

.bar-segment.filled.complete {
  background: #ffcc00;
  border-color: #cc9900;
}

.bar-segment.filled.complete .seg-inner {
  border-bottom-color: #997a00;
  border-right-color: #997a00;
  border-top-color: #ffe566;
  border-left-color: #ffe566;
}

/* ===== 路线名 ===== */
.route-name {
  color: #cccccc;
  font-size: 9px;
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.route-arrow {
  color: #4caf50;
  margin-right: 3px;
  font-size: 6px;
}

/* ===== 时间行 ===== */
.time-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px;
}

.time-item {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.time-label {
  color: #cc9900;
  font-size: 8px;
  font-weight: bold;
}

.time-value {
  color: #88ff88;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

/* ===== 状态行 ===== */
.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #aaaaaa;
  font-size: 9px;
}

.status-dot {
  color: #4caf50;
  margin-right: 3px;
  font-size: 6px;
  display: inline-block;
}

/* ===== 呼吸提示文字 ===== */
.hint-text {
  color: #ffcc00;
  font-size: 7px;
  animation: hint-breathe 2s ease-in-out infinite;
}

@keyframes hint-breathe {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* ===== 最小化提示面板 ===== */
.panel-mini {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
}
</style>
