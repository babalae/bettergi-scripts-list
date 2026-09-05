import { createApp } from 'vue'
import zpixUrl from './fonts/zpix.ttf'

// 注入 zpix 字体
const fontFace = new FontFace('Zpix', `url(${zpixUrl})`)
fontFace.load().then(() => {
  document.fonts.add(fontFace)
})

import App from './App.vue'

createApp(App).mount('#app')
