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

/** 基础视觉缩放倍率（在 100% DPI 下的放大倍数） */
export const BASE_SCALE = 2.5
