<template>
  <div class="overlay">
    <canvas ref="canvas" class="particle-canvas"></canvas>
    <div class="content" ref="content">
      <div class="title" ref="titleEl">{{ title }}</div>
      <div class="fraction" ref="fractionWrap">
        <span class="frac-current">{{ current }}</span>
        <span class="frac-sep">/</span>
        <span class="frac-total">{{ total }}</span>
      </div>
      <div class="bar-area" ref="barArea">
        <div class="bar-glow"></div>
        <div class="bar-track">
          <div class="bar-fill" ref="barFill">
            <div class="bar-shine"></div>
          </div>
        </div>
      </div>
      <div class="percent-wrap" ref="percentWrap">
        <span class="percent-value">{{ displayProgress }}</span>
        <span class="percent-unit">%</span>
      </div>
      <div class="status" ref="statusEl">{{ status }}</div>
    </div>
    <div v-if="showSkill" class="special-skill">
      <span>如需使用秒刷图，请查看脚本说明中的焚诀</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'

const canvas = ref(null)
const content = ref(null)
const titleEl = ref(null)
const fractionWrap = ref(null)
const barArea = ref(null)
const barFill = ref(null)
const percentWrap = ref(null)
const statusEl = ref(null)
const showSkill = ref(false)

const title = ref('')
const status = ref('等待中...')
const progress = ref(0)
const displayProgress = ref(0)
const current = ref(0)
const total = ref(0)

let animId = null
let particles = []

onMounted(() => {
  setTimeout(() => {
    showSkill.value = false
  }, 60000)

  window.htmlMask.onMessage = (msg) => {
    if (msg.url === '/progress') {
      if (msg.data.title !== undefined) title.value = msg.data.title
      if (msg.data.status) status.value = msg.data.status
      if (msg.data.current !== undefined) current.value = msg.data.current
      if (msg.data.total !== undefined) total.value = msg.data.total
      if (msg.data.progress !== undefined) {
        const pct = Math.min(100, Math.max(0, msg.data.progress))
        progress.value = pct
        gsap.to(displayProgress, { value: pct, duration: 0.5, snap: { value: 1 } })
        gsap.to(barFill.value, { height: pct + '%', duration: 2, ease: 'power2.out' })
      }
    } else if (msg.url === '/showskill') {
      showSkill.value = msg.data.show;
    }
  }

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
  tl.from(content.value, { opacity: 0, x: 40, duration: 0.5 })
    .from(titleEl.value, { y: -15, opacity: 0, duration: 0.3 }, '-=0.2')
    .from(fractionWrap.value, { scale: 0.5, opacity: 0, duration: 0.4, ease: 'back.out(1.7)' }, '-=0.1')
    .from(barArea.value, { scaleY: 0, opacity: 0, duration: 0.4 }, '-=0.1')
    .from(percentWrap.value, { scale: 0.5, opacity: 0, duration: 0.4, ease: 'back.out(1.7)' }, '-=0.1')
    .from(statusEl.value, { y: 10, opacity: 0, duration: 0.3 }, '-=0.1')

  initParticles()
})

onUnmounted(() => {
  window.htmlMask.onMessage = null
  if (animId) cancelAnimationFrame(animId)
})

function initParticles() {
  const cvs = canvas.value
  cvs.width = window.innerWidth
  cvs.height = window.innerHeight
  const ctx = cvs.getContext('2d')

  const COUNT = 35
  particles = Array.from({ length: COUNT }, () => spawn(cvs))

  ;(function loop() {
    ctx.clearRect(0, 0, cvs.width, cvs.height)
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.life -= p.decay
      if (p.life <= 0) Object.assign(p, spawn(cvs))

      ctx.save()
      ctx.globalAlpha = p.life * p.alpha
      ctx.shadowBlur = p.size * 6
      ctx.shadowColor = p.color
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    animId = requestAnimationFrame(loop)
  })()
}

function spawn(cvs) {
  // 粒子从右侧进度条区域生成
  const rx = cvs.width - 70
  const cy = cvs.height / 2
  return {
    x: rx + (Math.random() - 0.5) * 60,
    y: cy + (Math.random() - 0.5) * 280,
    vx: (Math.random() - 0.5) * 0.5 + 0.3,
    vy: -(Math.random() * 0.8 + 0.2),
    size: Math.random() * 2.5 + 0.5,
    life: 1,
    decay: Math.random() * 0.008 + 0.004,
    alpha: Math.random() * 0.5 + 0.2,
    color: Math.random() > 0.3 ? '#00ff88' : '#88ffcc',
  }
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: transparent; font-family: 'Segoe UI', system-ui, sans-serif; }

.overlay {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-right: 50px;
  position: relative;
}

.particle-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  z-index: 1;
}

/* 标题 */
.title {
  font-size: 15px;
  letter-spacing: 6px;
  color: rgba(0, 255, 136, 0.85);
  text-transform: uppercase;
}

/* 分数 3/15 */
.fraction {
  display: flex;
  align-items: baseline;
  gap: 4px;
  line-height: 1;
}

.frac-current {
  font-size: 30px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.frac-sep {
  font-size: 22px;
  font-weight: 300;
  color: rgba(0, 255, 136, 0.7);
}

.frac-total {
  font-size: 22px;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.75);
}

/* 竖向进度条 */
.bar-area {
  position: relative;
}

.bar-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 400%;
  height: 130%;
  transform: translate(-50%, -50%);
  background: radial-gradient(ellipse, rgba(0, 255, 136, 0.08), transparent 60%);
  pointer-events: none;
  filter: blur(20px);
  animation: glow-pulse 2.5s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.bar-track {
  width: 14px;
  height: 260px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 7px;
  position: relative;
  overflow: hidden;
  box-shadow:
    inset 2px 3px 6px rgba(0, 0, 0, 0.6),
    inset -1px 0 2px rgba(255, 255, 255, 0.04),
    1px 0 0 rgba(255, 255, 255, 0.03);
}

.bar-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0%;
  border-radius: 7px;
  background: linear-gradient(90deg,
    rgba(255,255,255,0.2) 0%,
    #00ff88 15%,
    #00dd70 45%,
    #00aa55 80%,
    #008844 100%
  );
  box-shadow:
    0 0 12px rgba(0, 255, 136, 0.4),
    0 0 28px rgba(0, 255, 136, 0.15);
}

/* 3D 高光 */
.bar-shine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(90deg, rgba(255,255,255,0.35), transparent);
  border-radius: 7px 0 0 7px;
  pointer-events: none;
}

/* 百分比 */
.percent-wrap {
  display: flex;
  align-items: baseline;
  line-height: 1;
}

.percent-value {
  font-size: 36px;
  font-weight: 200;
  color: #fff;
  text-shadow:
    0 0 20px rgba(0, 255, 136, 0.3),
    0 0 40px rgba(0, 255, 136, 0.1);
  font-variant-numeric: tabular-nums;
}

.percent-unit {
  font-size: 18px;
  font-weight: 300;
  color: rgba(0, 255, 136, 0.7);
  margin-left: 2px;
}

/* 状态文字 */
.status {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 1px;
  max-width: 100px;
  text-align: center;
  line-height: 1.4;
}

.special-skill {
  display: flex;
  position: absolute;
  bottom: 10px;
  left: 10px;
  color: #0aff96;
  font-size: 20px;
  font-weight: bold;
  text-shadow: 5px 0 5px rgba(0, 255, 136, 0.4),
  0 5px 5px rgba(0, 255, 136, 0.4),
  5px 5px 5px rgba(0, 255, 136, 0.4);
}
</style>
