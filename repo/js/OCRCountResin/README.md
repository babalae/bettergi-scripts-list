# 读取当前树脂

## 脚本用途

至少0.44.3版本。OCR识别原粹/浓缩/须臾/脆弱树脂数量，支持通知

## 资源用途

本目录包含脚本运行所需的资源文件，以下用途根据资源文件名、目录名和 `main.js` 中的资源引用进行保守推断：

- 界面、图标、物品或状态识别模板图片。
  - `assets/icon/condensed_resin.png`
  - `assets/icon/fragile_resin.png`
  - `assets/icon/num0_white.png`
  - `assets/icon/num1.png`
  - `assets/icon/num1_white.png`
  - `assets/icon/num2.png`
  - `assets/icon/num2_white.png`
  - `assets/icon/num3.png`
  - `assets/icon/num3_white.png`
  - `assets/icon/num4.png`
  - `assets/icon/num4_white.png`
  - `assets/icon/num5_white.png`
  - `assets/icon/original_resin.png`
  - `assets/icon/transient_resin.png`
- 界面按钮或状态识别模板图片。
  - `assets/icon/replenish_resin_button.png`

## 注意事项

- 请保持资源文件的相对路径不变，避免脚本无法加载。
- 若替换识别图片或路径 JSON，请同步检查 `main.js` 中的引用。
- 未能从文件名或引用明确判断的资源，按“用于脚本运行所需的识别或配置资源”处理。
