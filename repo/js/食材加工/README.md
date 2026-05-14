# 选择加工食材

## 脚本用途

食材加工识图复选框。适配黑麦粉、酸奶油

## 资源用途

本目录包含脚本运行所需的资源文件，以下用途根据资源文件名、目录名和 `main.js` 中的资源引用进行保守推断：

- 地图追踪或自动路径 JSON，供脚本加载对应路线。
  - `assets/璃月杂货商东升旁灶台.json`
- 用于脚本运行所需的识别或配置资源。
  - `assets/pageScroll.json`
  - `assets/pageScroll2.json`
  - `assets/滚轮下翻.json`
- 界面、图标、物品或状态识别模板图片。
  - `assets/Cooking.png`
  - `assets/Picture/Bacon.png`
  - `assets/Picture/Butter.png`
  - `assets/Picture/Cheese.png`
  - `assets/Picture/Crab-Roe.png`
  - `assets/Picture/Fish.png`
  - `assets/Picture/Flour.png`
  - `assets/Picture/Ham.png`
  - `assets/Picture/Jam.png`
  - `assets/Picture/Lard.png`
  - `assets/Picture/Mysterious-Meat.png`
  - `assets/Picture/Raw-Meat.png`
  - `assets/Picture/Rye-Flour.png`
  - `assets/Picture/Sausage.png`
  - `assets/Picture/Smoked-Poultry.png`
  - `assets/Picture/Sour-Cream.png`
  - `assets/Picture/Spices.png`
  - `assets/Picture/Sugar.png`
- 界面按钮或状态识别模板图片。
  - `assets/E_Dialogue.png`
  - `assets/F_Dialogue.png`

## 注意事项

- 请保持资源文件的相对路径不变，避免脚本无法加载。
- 若替换识别图片或路径 JSON，请同步检查 `main.js` 中的引用。
- 未能从文件名或引用明确判断的资源，按“用于脚本运行所需的识别或配置资源”处理。
