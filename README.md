# BetterGI · 更好的原神 的脚本仓库

[BetterGI](https://github.com/babalae/better-genshin-impact) 的 📜 脚本仓库

在线版脚本仓库：[bgi.sh](https://bgi.sh)  备用地址：[https://s.bettergi.com](https://s.bettergi.com/)

作者Q群：764972801 （非作者请勿加入）

[如何提交到本仓库？（谁都能看懂的 GitHub Pull Request 使用指南）](https://bettergi.com/dev/pr.html)

## 脚本提交说明

- 战斗脚本提交到 [repo/combat](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/combat) 目录；
- JS 脚本提交到 [repo/js](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/js) 目录；
- 地图追踪脚本提交到 [repo/pathing](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/pathing) 目录；
- 七圣召唤脚本提交到 [repo/tcg](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/tcg) 目录。

## 脚本提交规范

为了保证脚本的规范性和可读性，方便用户清晰了解脚本的用途，制定以下脚本命名规则和脚本文件夹命名规则。

### 地图追踪脚本

#### 文件命名规范

确保脚本文件在同一目录下按预期顺序排列，并一目了然地传达关键信息。地图追踪脚本命名需包含以下核心信息：

```
编号-材料名称-区域（跨区域材料填写）-二级区域（可选）-二级子区域-数量
```

- 编号
  
  - 两位数，如果单个资源脚本数量超过 `100` 可以考虑使用三位数编号或者使用字母加数字编号，如 A01
  - 编号的排序应遵循以下两种方式之一：
    - 按传送点位顺序排序。相邻脚本之间优先保证传送的便捷性，这种编号方式考虑整体采集效率。
    - 按材料获取效率排序。优先选择资源分布密集或容易采集的点，效率高的路径放在靠前编号，这种编号方式考虑编号靠前脚本的采集效率。

- 材料名称
  
  - 采集物（使用游戏内官方名称命名，如 `慕风蘑菇`，`劫波莲`，不应当使用 `绫华突破材料`等不清晰的名称命名）
  - 掉落物（因掉落物名称与掉落物等级有关，因此不使用掉落物本身命名，而是使用怪物名称命名）

- 区域（指 `蒙德` `璃月` `稻妻` `须弥` `枫丹` `纳塔` `至冬`，**仅当材料跨区域需标注**）

- 二级区域（如 `珉林`，根据实际需求标注）

- 二级子区域（细分地点，如 `绝云间`）

- 预期采集的数量

脚本名称**仅限上述**规定的编号、材料名称、区域、二级子区域，原则上不应包含额外的描述或标点符号。

```
✔ 参考示范：
01-水晶块-璃月-绝云间-6个
02-水晶块-璃月-荻花洲-8个

❌ 错误示范：
01-水晶块-璃月-快速路径-绝云间-6个
```

**其他注意事项**

- 部分采集物没有对应的二级子区域，允许名称的区域部分使用**起始传送锚点**右侧展示的二级区域，或**这条路径的大部分采集物点位**所位于的二级区域

- 相同**二级子区域**有多条路径时，推荐采用 `编号-材料名称-二级区域-二级子区域及方位-数量` 进行命名。

- 脚本文件名应当和 `json` 文件中的 `name` 字段相同。

- 说明文件应当命名为README.md以保证仓库能够正确读取。

#### 文件夹命名规范

目的：对脚本按材料分类管理，便于版本控制与团队协作。目录结构应当遵循以下原则：

- 根据脚本种类选择恰当的一级分类，目前共有六个分类 `锄地专区`、`地方特产`、`敌人与魔物`、`矿物`、`其他`。

- 一级目录：以材料名称命名，须与文件命名中的材料名称一致。

- 二级子目录（可选）：可根据项目或作者划分，如有必要。

- 示例目录结构如下：
  
  ```
  repo/pathing/矿物
  ├─ 水晶块
  │   ├─ 01-水晶块-璃月-绝云间-6个
  │   └─ 02-水晶块-璃月-荻花洲-8个
  └─ 星银矿石
      └─ 01-星银矿石-覆雪之路-7个
  ```
  
  如果脚本和原来的地图追踪脚本存在冲突 按照以下原则处理：

- 修复或补充：直接提交到原材料目录。

- 路线冲突：新建同名目录并添加作者标识：
  
  1. 将旧脚本目录重命名为 `AA@旧作者名`
  2. 新脚本放入 `AA@你的名字`
  3. 例：原 `repo/pathing/AA` 重命名为 `AA@oldauthor` 新目录 `AA@yourname`
  - 示例目录结构如下：
    
    ```
    repo/pathing/.../
    └── AA
        ├── AA@旧作者名
        └── AA@你的名字
    ```

- 不同采集方式|角色|效率：新建目录添加标识及作者标识：
  
  1. 判断旧脚本目录的采集方式，将旧脚本目录重命名为 `采集方式@旧作者名`
  2. 新脚本放入 `采集方式@你的名字`
  - 示例目录结构如下：
    
    ```
    repo/pathing
    ├── 地方特产/区域
    │   ├── A材料
    │   │   ├── 无草神@作者广告位招租
    │   │   ├── 有草神效率路线@作者广告位招租
    │   │   ├── 有草神全收集@作者广告位招租
    │   │   └── ...
    │   └── B材料
    │       ├── 效率路线@作者广告位招租
    │       ├── 全收集@作者广告位招租
    │       └── ...
    ├── 矿物
    │   ├── 水晶矿
    │   │   ├── 大剑@作者广告位招租
    │   │   ├── 钟离@作者广告位招租
    │   │   ├── 诺艾尔@作者广告位招租
    │   │   └── ...
    │   └── 萃凝晶
    │       ├── 大剑效率路线@作者广告位招租
    │       ├── 大剑无战斗@作者广告位招租
    │       └── ...
    └── ...
    ```

**其他注意事项**

- 目录名仅限材料官方名称，不添加版本号或其他标识。

- 作者标识仅在冲突时追加，格式为“@作者名”，紧随原目录名。

### JS脚本

创建JS脚本请参考文档[创建脚本](https://bettergi.com/dev/js/create.html)

#### 文件夹命名规则

- 脚本的文件夹名称**应体现脚本的用途**，简要用途可在描述文件 [manifest.json](https://bettergi.com/dev/js/create.html#manifest-json) 中说明，详细用途可在`README.md`(大小写敏感，要求全部大写的文件名) 中说明

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
      ├── main.js
      ├── manifest.json
      ├── settings.json
      └── README.md
  ```

- `Assets`用于存放脚本使用到的资源文件，其中
  
  - `Pathing`用于存放[地图追踪](https://bettergi.com/feats/autos/pathing-dev.html)文件
  - `RecognitionObject`用于存放[模板匹配、图像识别](https://bettergi.com/dev/js/rec.html#%E6%A8%A1%E6%9D%BF%E5%8C%B9%E9%85%8D)对象

**其他注意事项**

- 脚本使用的资源文件应在`README.md`中注明实际用途

### 其他

因早期对脚本管理较为宽松，因此仓库有部分脚本并不符合命名规范，欢迎通过 PR 规范这些名称。

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
