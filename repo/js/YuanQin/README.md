# [原琴]原神琴谱自动弹奏脚本

## 脚本用途

原神琴谱自动弹奏脚本，通过读取本地琴谱文件，解析成乐谱对象，然后模拟键盘操作，实现自动弹奏。（需角色手动提前乐器）

## 资源用途

本目录包含脚本运行所需的资源文件，以下用途根据资源文件名、目录名和 `main.js` 中的资源引用进行保守推断：

- 用于脚本运行所需的识别或配置资源。
  - `assets/JOJO黄金之风.json`
  - `assets/JOJO黄金之风2.json`
  - `assets/JOJO黄金处刑曲.json`
  - `assets/One last kiss.json`
  - `assets/声嘶力竭.json`
  - `assets/孤勇者.json`
  - `assets/孤勇者2.json`
  - `assets/溯.json`
  - `assets/牵丝戏.json`
  - `assets/牵丝戏2.json`
  - `assets/花之舞.json`
  - `assets/赤伶.json`
  - `assets/黑人抬棺.json`

## 注意事项

- 请保持资源文件的相对路径不变，避免脚本无法加载。
- 若替换识别图片或路径 JSON，请同步检查 `main.js` 中的引用。
- 未能从文件名或引用明确判断的资源，按“用于脚本运行所需的识别或配置资源”处理。
