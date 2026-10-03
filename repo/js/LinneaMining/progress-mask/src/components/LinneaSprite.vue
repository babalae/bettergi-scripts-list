<!--
  @component LinneaSprite
  像素小人 GIF 容器，贴右放置，左右各裁剪 15px
-->
<template>
  <div class="sprite-container">
    <img class="sprite" :src="src" alt="" />
  </div>
</template>

<script setup>
/**
 * @file 像素小人组件
 * 接收 GIF URL，贴右显示并裁剪两侧多余空间
 */

/** @type {{ src: string }} */
defineProps({
  /** 当前显示的 GIF 资源 URL */
  src: { type: String, required: true },
})
</script>

<style scoped>
.sprite-container {
  width: 80px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  flex-shrink: 0;
  overflow: hidden;
}

.sprite {
  width: calc(100% + 30px);
  margin-left: -15px;
  margin-right: -15px;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: -webkit-crisp-edges;
}
</style>
