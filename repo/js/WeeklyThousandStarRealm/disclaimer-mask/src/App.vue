<template>
  <div class="overlay">
    <div class="scan-lines"></div>
    <div class="panel" ref="panel">
      <div class="panel-inner">
        <div class="icon-wrap" ref="icon">
          <div class="icon-ring"></div>
          <span class="icon-text">!</span>
        </div>
        <div class="title" ref="title">WARNING</div>
        <div class="divider" ref="divider"></div>
        <div class="message" ref="message">请先同意免责声明后再运行此脚本！</div>
        <div class="reason-block" ref="reasonBlock">
          <div class="reason-line" v-for="(line, i) in reasonTexts" :key="i" ref="reasonLineEls">{{ line }}</div>
        </div>
        <div class="instruction" ref="instruction">
          请在脚本的 <span class="highlight">自定义 JS 配置</span> 中手动勾选「我已阅读说明中的免责声明」
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import gsap from 'gsap'

const panel = ref(null)
const icon = ref(null)
const title = ref(null)
const divider = ref(null)
const message = ref(null)
const reasonBlock = ref(null)
const reasonLineEls = ref([])
const instruction = ref(null)

const reasonTexts = [
  '本脚本依赖「删除奇域地图存档」来实现重复获取成就经验。',
  '当脚本执行删除存档时，可能会误删你正常游玩的关卡数据。',
  '请务必确认你能承担潜在损失后再继续使用。',
]

onMounted(async () => {
  const tl = gsap.timeline({defaults: {ease: 'power3.out'}})

  tl.from(panel.value, {
    scale: 0, opacity: 0, rotation: -8,
    duration: 0.6, ease: 'back.out(1.4)'
  })
      .from(icon.value, {
        scale: 0, rotation: -360, opacity: 0,
        duration: 0.6, ease: 'elastic.out(1, 0.5)'
      }, '-=0.2')
      .from(title.value, {
        y: -20, opacity: 0, duration: 0.3
      }, '-=0.1')
      .from(divider.value, {
        scaleX: 0, duration: 0.4
      }, '-=0.1')
      .from(message.value, {
        y: 20, opacity: 0, duration: 0.4
      }, '-=0.1')
      .from(reasonBlock.value, {
        opacity: 0, duration: 0.3
      })
      .from(reasonLineEls.value, {
        x: -30, opacity: 0,
        duration: 0.4, stagger: 0.5
      }, '-=0.1')
      .from(instruction.value, {
        y: 15, opacity: 0, duration: 0.5
      })

  // 持续脉冲
  gsap.to(panel.value, {
    boxShadow: '0 0 60px rgba(255,50,50,0.5), 0 0 120px rgba(255,50,50,0.2)',
    duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut'
  })
  gsap.to('.icon-ring', {
    scale: 1.2, opacity: 0.3,
    duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut'
  })
})
</script>

<style>
@property --border-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: transparent; }

.overlay {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.scan-lines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent, transparent 2px,
    rgba(255, 50, 50, 0.03) 2px,
    rgba(255, 50, 50, 0.03) 4px
  );
  pointer-events: none;
  animation: scan 8s linear infinite;
}

@keyframes scan {
  from { transform: translateY(0); }
  to { transform: translateY(4px); }
}

.panel {
  --border-angle: 0deg;
  position: relative;
  padding: 2px;
  border-radius: 18px;
  background: conic-gradient(from var(--border-angle), transparent 60%, #ff4444, #ff2222, #ff4444, transparent 40%) border-box;
  animation: rotate-border 3s linear infinite;
}

@keyframes rotate-border {
  to { --border-angle: 360deg; }
}

.panel-inner {
  background: rgba(8, 0, 0, 0.9);
  border-radius: 16px;
  padding: 44px 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  max-width: 700px;
  box-shadow:
    0 0 30px rgba(255, 50, 50, 0.2),
    0 0 60px rgba(255, 50, 50, 0.1),
    inset 0 0 40px rgba(255, 50, 50, 0.03);
  backdrop-filter: blur(12px);
}

.icon-wrap {
  position: relative;
  width: 70px;
  height: 70px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.icon-ring {
  position: absolute;
  inset: 0;
  border: 3px solid rgba(255, 80, 80, 0.7);
  border-radius: 50%;
}

.icon-text {
  font-size: 46px;
  font-weight: 900;
  color: #ff4444;
  text-shadow: 0 0 20px rgba(255, 68, 68, 0.8), 0 0 40px rgba(255, 68, 68, 0.4);
  font-family: 'Arial Black', sans-serif;
}

.title {
  font-size: 36px;
  font-weight: 900;
  letter-spacing: 14px;
  color: #ff4444;
  text-shadow: 0 0 20px rgba(255, 68, 68, 0.6), 0 0 40px rgba(255, 68, 68, 0.3);
  font-family: 'Arial Black', monospace;
}

.divider {
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #ff4444, transparent);
}

.message {
  font-size: 20px;
  color: #ffcccc;
  text-align: center;
  text-shadow: 0 0 10px rgba(255, 68, 68, 0.4);
  letter-spacing: 2px;
}

.reason-block {
  width: 100%;
  padding: 16px 20px;
  border-left: 3px solid #ff4444;
  background: rgba(255, 50, 50, 0.06);
  border-radius: 0 8px 8px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reason-line {
  font-size: 16px;
  color: #ddaaaa;
  line-height: 1.6;
  letter-spacing: 1px;
}

.instruction {
  font-size: 15px;
  color: #cc8888;
  text-align: center;
  line-height: 1.6;
}

.instruction .highlight {
  color: #ff9999;
  font-weight: bold;
}
</style>
