# 锁定四星教官

## 脚本用途

锁定背包中的四星教官

## 资源用途

本目录包含脚本运行所需的资源文件，以下用途根据资源文件名、目录名和 `main.js` 中的资源引用进行保守推断：

- 用于脚本运行所需的识别或配置资源。
  - `assets/滚轮下翻.json`
- 界面、图标、物品或状态识别模板图片。
  - `assets/RecognitionObject/Artifacts.png`
  - `assets/RecognitionObject/chargeE1.png`
  - `assets/RecognitionObject/chargeE2.png`
  - `assets/RecognitionObject/filter.png`
  - `assets/RecognitionObject/filterSet.png`
  - `assets/RecognitionObject/fourStar.png`
  - `assets/RecognitionObject/instructor.png`
  - `assets/RecognitionObject/lock.png`
  - `assets/RecognitionObject/notFullLevel.png`
  - `assets/RecognitionObject/notLocked.png`
  - `assets/RecognitionObject/reset.png`
  - `assets/RecognitionObject/sequence.png`
  - `assets/RecognitionObject/threeStart.png`
- 界面按钮或状态识别模板图片。
  - `assets/RecognitionObject/confirm.png`
  - `assets/RecognitionObject/confirmFilter.png`

## 注意事项

- 请保持资源文件的相对路径不变，避免脚本无法加载。
- 若替换识别图片或路径 JSON，请同步检查 `main.js` 中的引用。
- 未能从文件名或引用明确判断的资源，按“用于脚本运行所需的识别或配置资源”处理。
