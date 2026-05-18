# 切换主角元素

## 脚本用途

用于执行 `切换主角元素` 脚本定义的自动化流程。

## 资源用途

本目录包含脚本运行所需的资源文件，以下用途根据资源文件名、目录名和 `main.js` 中的资源引用进行保守推断：

- 用于脚本运行所需的识别或配置资源。
  - `assets/switchElement/岩.json`
  - `assets/switchElement/水.json`
  - `assets/switchElement/火.json`
  - `assets/switchElement/草.json`
  - `assets/switchElement/雷.json`
  - `assets/switchElement/风.json`

## 注意事项

- 请保持资源文件的相对路径不变，避免脚本无法加载。
- 若替换识别图片或路径 JSON，请同步检查 `main.js` 中的引用。
- 未能从文件名或引用明确判断的资源，按“用于脚本运行所需的识别或配置资源”处理。
