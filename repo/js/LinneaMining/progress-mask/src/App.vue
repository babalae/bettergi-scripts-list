<template>
  <div class="overlay">
    <!-- 散乱像素装饰 -->
    <DebrisField :data="debrisData" ref="debrisFieldRef"/>

    <!-- DPI 补偿缩放容器 -->
    <div class="pixel-scale" ref="panelOuter">
      <div class="panel-outer">
        <!-- 四角像素装饰 -->
        <span class="corner corner-tl"></span>
        <span class="corner corner-tr"></span>
        <span class="corner corner-bl"></span>
        <span class="corner corner-br"></span>

        <div class="panel-inner">
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
                <span class="status-dot" ref="statusDot">▶</span>
                <span>{{ status }}</span>
              </div>
            </div>

            <!-- 右侧像素小人 -->
            <LinneaSprite :src="currentSprite"/>
          </div>
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

import {ref, computed, onMounted, onUnmounted} from 'vue'

// 子组件
import DebrisField from './components/DebrisField.vue'
import LinneaSprite from './components/LinneaSprite.vue'

// Composable
import {useMiningProgress} from './composables/useMiningProgress'
import {usePixelAnimations} from './composables/usePixelAnimations'

// 常量
import {debrisData, SPRITE_MAP, SPRITE_STATES, DEFAULT_SPRITE, SEGMENT_COUNT} from './constants'

// ===== Composable 实例 =====

const {
  current, total, displayProgress,
  routeName, status, estimatedTime, elapsedTime,
  isComplete, filledCount,
  initMessageHandler, startDemo, cleanup: cleanupProgress,
} = useMiningProgress()

const {
  applyDpiScale, playEntranceAnimation, animateFilledSegments,
  startBlink, startDebrisAnimations, playCompleteAnimation,
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
const debrisFieldRef = ref(null)

/** 进度条段块 refs */
const segmentRefs = ref([])

// ===== Sprite 状态 =====

/** 当前 sprite 动画状态名 */
const spriteState = ref('idle')

/** 当前 sprite GIF URL */
const currentSprite = computed(() => SPRITE_MAP[spriteState.value] || DEFAULT_SPRITE)

/** sprite 随机切换定时器 */
let spriteTimer = null

/** 启动 sprite 状态随机切换（每 4 秒） */
function startSpriteCycle() {
  spriteTimer = setInterval(() => {
    const next = SPRITE_STATES[Math.floor(Math.random() * SPRITE_STATES.length)]
    spriteState.value = next
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
    debrisRefs: debrisFieldRef.value?.debrisRefs?.filter(Boolean) ?? [],
    segmentRefs: segmentRefs.value,
  })
}

// ===== 生命周期 =====

onMounted(() => {
  // DPI 补偿
  applyDpiScale(panelOuter.value)

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
    debrisRefs: debrisFieldRef.value?.debrisRefs?.filter(Boolean) ?? [],
    segmentRefs: segmentRefs.value.filter(Boolean),
  })

  // 状态点闪烁
  startBlink(statusDot.value)

  // 碎片循环动画
  startDebrisAnimations(debrisFieldRef.value?.debrisRefs?.filter(Boolean) ?? [])

  // sprite 随机切换
  startSpriteCycle()
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
  color: #aaaaaa;
  font-size: 9px;
}

.status-dot {
  color: #4caf50;
  margin-right: 3px;
  font-size: 6px;
  display: inline-block;
}
</style>
