# BetterGI · 更好的原神 的脚本仓库

[BetterGI](https://github.com/babalae/better-genshin-impact) 的 📜 脚本仓库

在线版脚本仓库：[bgi.sh](https://bgi.sh)  备用地址：[https://s.bettergi.com](https://s.bettergi.com/)

作者Q群：764972801 （非作者请勿加入）

[如何提交到本仓库？（谁都能看懂的 GitHub Pull Request 使用指南）](https://bettergi.com/dev/pr.html)

## 脚本提交说明

- 战斗策略提交到 [repo/combat](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/combat) 目录；
- JS 脚本提交到 [repo/js](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/js) 目录；
- 地图追踪路线提交到 [repo/pathing](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/pathing) 目录；
- 七圣召唤策略提交到 [repo/tcg](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/tcg) 目录。

## 提交规范

以下为提交时应遵守的规范，不符合规范的以及作者长期不回复的（通常为1个月），将做 close 处理。

### 战斗策略

创建战斗策略请参考文档[自动战斗](https://www.bettergi.com/feats/task/domain.html)和已有的其他战斗策略

#### 命名规则

- 策略的名称**应包含使用的角色简写**
- 只能用于副本，不适用于锄地的战斗策略应当增加“-副本”的后缀
- 不应添加过多冗余修饰词  

#### 注释与署名

- 使用“//”进行注释，必要时应当在策略中使用注释以明确使用的条件等
- 推荐在策略中同时通过注释说明自动战斗设置中的相关部分，例如：“// 检查战斗结束的延时：设置为 0.4”
- 署名使用“//作者：你的名字”，错误的格式将导致无法识别

#### 注意事项

- 确保你充分了解自动战斗的完整机制（如战斗结束检查的触发）和每个动作的具体内容再开始编写战斗策略
- 由 AI 生成的策略不会被接受  
- 提交前请进行充分的实战测试与优化，提供战斗耗时数据。存在已有策略时，请提供多项对比数据  

### 地图追踪

#### 文件命名

路线文件名格式：

```text
编号-材料名称-[区域]-[二级区域]-二级子区域-数量
```

其中：

- **编号**：默认两位数；超过 100 条时可使用三位数或 `A01` 等形式。排序应按传送便利性或材料获取效率进行。
- **材料名称**：使用游戏内官方名称。采集物不得使用“XX突破材料”等非正式名称；敌怪使用 F1 讨伐页面中的名称。
- **区域**：如 `蒙德`、`璃月`、`稻妻` 等，仅跨区域材料需要标注。
- **二级区域**：如 `珉林`，按实际需要填写。
- **二级子区域**：如 `绝云间`。若无明确子区域，可使用起始锚点显示区域或路线主要经过区域。
- **数量**：路线预期获取数量。

文件名原则上仅包含上述信息，不应加入“快速路线”“推荐路线”等额外描述。

```text
✔ 01-水晶块-璃月-绝云间-6个
✔ 02-水晶块-璃月-荻花洲-8个
✘ 01-水晶块-璃月-快速路径-绝云间-6个
```
同一二级子区域存在多条路线时，可增加方位区分。

路线文件名必须与 JSON 中的 `name` 字段一致，说明文件统一命名为 `README.md`。

#### 文件夹结构

路线应放入对应分类，目前包括：

`锄地专区`、`地方特产`、`敌人与魔物`、`矿物`、`食材与炼金`、`其他`

一级目录以材料名称命名；必要时可增加用于区分项目、采集方式或作者的子目录。

```text
repo/pathing/矿物
├── 水晶块
│   ├── 01-水晶块-璃月-绝云间-6个
│   └── 02-水晶块-璃月-荻花洲-8个
└── 星银矿石
    └── 01-星银矿石-覆雪之路-7个
```
  
已有路线存在冲突时：

| 情况 | 处理方式 |
| --- | --- |
| 修复、补充原路线 | 直接提交至原目录 |
| 同类路线但实现不同 | 使用 `名称@作者` 建立独立目录 |
| 采集角色、方式或目标不同 | 使用 `采集方式@作者`、`效率路线@作者` 等名称区分 |

例如：

```text
水晶矿
├── 大剑@作者A
├── 钟离@作者B
└── 大剑效率路线@作者C
```

### JS 脚本

创建 JS 脚本请参考文档[创建脚本](https://bettergi.com/dev/js/create.html)

#### 文件夹命名规则

- 脚本的文件夹名称**应体现脚本的用途**，简要用途可在描述文件 [manifest.json](https://bettergi.com/dev/js/create.html#manifest-json) 中说明，详细用途可在`README.md` 中说明

- 脚本的主体文件夹名称可采用 [大驼峰式命名法](https://zh.wikipedia.org/wiki/%E9%A7%9D%E5%B3%B0%E5%BC%8F%E5%A4%A7%E5%B0%8F%E5%AF%AB) 等命名方式，名称中不应包含空格，如：
  
  ```
  repo/js
  ├── 
  ├── AutoLeyLineOutcrop
  ├── AutoXXX
  └── ...
  ```

- 常见的脚本结构目录如下：
  
  ```
  repo/js
  └── jsName
      ├── Assets
      │   ├── Pathing
      │   │   └── xxx.json
      │   └── RecognitionObject
      │       └── xxx.png
      │
      ├── src
      │   ├── modules
      │   │   ├── recognition.js
      │   │   ├── navigation.js
      │   │   └── task.js
      │   ├── utils
      │   │   └── common.js
      │   └── constants.js
      │
      ├── main.js
      ├── manifest.json
      ├── settings.json
      └── README.md
  ```

- `Assets`用于存放脚本使用到的资源文件，其中
  
  - `Pathing`用于存放[地图追踪](https://bettergi.com/feats/autos/pathing-dev.html)文件
  - `RecognitionObject`用于存放[模板匹配、图像识别](https://bettergi.com/dev/js/rec.html#%E6%A8%A1%E6%9D%BF%E5%8C%B9%E9%85%8D)对象

#### HTML遮罩内容规范

脚本内由于可以通过`html`文件进行遮罩渲染，用于引导提示、脚本配置等工作，制作遮罩时应遵守如下规则：  
* 需考虑dom元素过多或不当操作引起的浏览器引擎内存占用问题，不能过度影响普通玩家在运行时的内存占用
* 提交代码时如使用了html遮罩，需要将能够人为理解的页面项目完整源码上传（框架打包产物通常不易于理解），或是在pr信息中附上个人开源仓库链接（每次html有更新时都需要）
* 不可用于展示宣传、推广性质的信息，如QQ群号、平台广告、外部视频等（包括iframe中的链接）
* 显示的内容不可有侮辱、贬低、指责他人的意图

#### 其他注意事项

- 当脚本足够大时，应按工程化标准进行实现，具体标准请自行学习  
- `README.md`中应详细介绍脚本使用方式，如有必要再对技术实现做解释。禁止提交未经人工润色、AI 味浓厚、内容臃肿的`README.md`
- main.js 应主要负责脚本入口、初始化以及各模块的调用，例如：

  ```
  import { runTask } from "./src/modules/task.js";
  
  async function main() {
      await runTask();
  }
  
  main();
  ```
  
  随着逻辑增加，应及时将不同职责拆分为独立模块。原则上不推荐大于500行、几乎没有模块导入的单文件 main.js，这会显著增加各方面成本。

## Contributors

<a href="https://next.ossinsight.io/widgets/official/compose-recent-active-contributors?repo_id=866958830&limit=30" target="_blank" style="display: block" align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/compose-recent-active-contributors/thumbnail.png?repo_id=866958830&limit=30&image_size=auto&color_scheme=dark" width="655" height="auto">
    <img alt="Active Contributors of babalae/bettergi-scripts-list - Last 28 days" src="https://next.ossinsight.io/widgets/official/compose-recent-active-contributors/thumbnail.png?repo_id=866958830&limit=30&image_size=auto&color_scheme=light" width="655" height="auto">
  </picture>
</a>

## 相关源码

脚本仓库页面的源码

- 旧版：[bettergi-scripts-web](https://github.com/huiyadanli/bettergi-scripts-web)
- 新版：[bettergi-script-web](https://github.com/zaodonganqi/bettergi-script-web)


地图路径追踪的源码：[bettergi-map](https://github.com/huiyadanli/bettergi-map)
