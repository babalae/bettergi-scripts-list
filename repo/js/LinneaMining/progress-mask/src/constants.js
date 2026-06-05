/**
 * @file 常量、Sprite GIF 映射、碎片装饰数据
 * 集中管理所有静态配置，供组件和 composable 引用
 */

// ===== Sprite GIF 资源 =====
import gifIdle from './assets/linnea/linnea-idle.gif'
import gifRunning from './assets/linnea/linnea-running.gif'
import gifRunningLeft from './assets/linnea/linnea-running-left.gif'
import gifRunningRight from './assets/linnea/linnea-running-right.gif'
import gifJumping from './assets/linnea/linnea-jumping.gif'
import gifWaiting from './assets/linnea/linnea-waiting.gif'
import gifWaving from './assets/linnea/linnea-waving.gif'
import gifReview from './assets/linnea/linnea-review.gif'
import gifFailed from './assets/linnea/linnea-failed.gif'

/** 状态名 → GIF URL 映射表 */
export const SPRITE_MAP = {
  idle: gifIdle,
  running: gifRunning,
  'running-left': gifRunningLeft,
  'running-right': gifRunningRight,
  jumping: gifJumping,
  waiting: gifWaiting,
  waving: gifWaving,
  review: gifReview,
  failed: gifFailed,
}

/** 默认 sprite GIF（idle） */
export { gifIdle as DEFAULT_SPRITE }

/** 可随机切换的 sprite 状态列表 */
export const SPRITE_STATES = [
  'idle', 'running', 'running-left', 'running-right',
  'jumping', 'waiting', 'waving', 'review',
]

/** 进度条分段数量 */
export const SEGMENT_COUNT = 20

/** 散乱像素碎片数量 */
export const DEBRIS_COUNT = 24

/** 基础视觉缩放倍率（在 100% DPI 下的放大倍数） */
export const BASE_SCALE = 2.5

// ===== 碎片装饰 =====

/** 碎片配色列表 */
const DEBRIS_COLORS = ['#ffcc00', '#4caf50', '#cc9900', '#88ff88', '#ffe066', '#333']

/**
 * 基于种子的伪随机数生成器
 * @param {number} seed - 随机种子
 * @param {number} max - 输出上限
 * @returns {number} 0 ~ max 之间的伪随机数
 */
export function pseudoRandom(seed, max) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return Math.abs(x - Math.floor(x)) * max
}

/** 预生成的碎片装饰数据数组 */
export const debrisData = Array.from({ length: DEBRIS_COUNT }, (_, i) => {
  const zone = i % 4
  let x, y
  switch (zone) {
    case 0: x = -(8 + pseudoRandom(i, 25)); y = -(6 + pseudoRandom(i + 100, 40)); break
    case 1: x = -(6 + pseudoRandom(i + 200, 30)); y = 10 + pseudoRandom(i + 300, 50); break
    case 2: x = 5 + pseudoRandom(i + 400, 35); y = -(8 + pseudoRandom(i + 500, 50)); break
    case 3: x = 5 + pseudoRandom(i + 600, 20); y = 8 + pseudoRandom(i + 700, 40); break
  }
  return {
    x, y,
    s: [1, 1, 1, 2, 2, 3][i % 6],
    color: DEBRIS_COLORS[i % DEBRIS_COLORS.length],
    type: i % 3,
  }
})
