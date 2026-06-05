<!--
  @component DebrisField
  散乱像素碎片装饰层，围绕面板随机分布
  通过 defineExpose 暴露 debrisRefs 供父组件 GSAP 动画使用
-->
<template>
  <div class="debris-field">
    <div
      v-for="(d, idx) in data"
      :key="idx"
      class="debris"
      :style="{
        left: d.x + 'px',
        top: d.y + 'px',
        width: d.s + 'px',
        height: d.s + 'px',
      }"
      :ref="collectRef"
    ></div>
  </div>
</template>

<script setup>
/**
 * @file 散乱像素碎片装饰组件
 * 接收碎片数据数组，渲染为绝对定位的像素方块
 */

import { ref, watch } from 'vue'

/** @type {{ data: Array<{ x: number, y: number, s: number, color: string, type: number }> }} */
const props = defineProps({
  /** 碎片数据数组 */
  data: { type: Array, required: true },
})

/** 碎片 DOM 元素引用数组 */
const debrisRefs = ref([])

/** 收集碎片 DOM ref 的回调 */
function collectRef(el) {
  if (el) {
    debrisRefs.value.push(el)
  }
}

/** 暴露给父组件用于 GSAP 动画 */
defineExpose({ debrisRefs })
</script>

<style scoped>
.debris-field {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 200px;
  height: 200px;
  pointer-events: none;
}

.debris {
  position: absolute;
  image-rendering: pixelated;
}
</style>
