# 摔落保护：提瓦特反牛顿机制

## 脚本用途

利用游戏机制获取免疫摔落伤害的buff，鸣谢柒叶子制作的键鼠脚本

## 资源用途

本目录包含脚本运行所需的资源文件，以下用途根据资源文件名、目录名和 `main.js` 中的资源引用进行保守推断：

- 地图追踪或自动路径 JSON，供脚本加载对应路线。
  - `assets/pathing/信仰之跃.json`
  - `assets/pathing/原始胎海.json`
- 界面、图标、物品或状态识别模板图片。
  - `assets/icon/GoTeleport.png`
  - `assets/icon/PortableWaypoint.png`
  - `assets/icon/PortableWaypointBag.png`
  - `assets/icon/SwimState.png`
- 键鼠操作记录或配置资源。
  - `assets/keymouse/锚点放置处.json`

## 注意事项

- 请保持资源文件的相对路径不变，避免脚本无法加载。
- 若替换识别图片或路径 JSON，请同步检查 `main.js` 中的引用。
- 未能从文件名或引用明确判断的资源，按“用于脚本运行所需的识别或配置资源”处理。
