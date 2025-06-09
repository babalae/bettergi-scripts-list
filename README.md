# BetterGI · 更好的原神 的脚本仓库

[BetterGI](https://github.com/babalae/better-genshin-impact) 的 📜 脚本仓库

在线版脚本仓库：[bgi.sh](https://bgi.sh)

作者Q群：764972801 （非作者请勿加入）

[如何提交到本仓库？（谁都能看懂的 GitHub Pull Request 使用指南）](https://bgi.huiyadan.com/dev/pr.html)

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
编号-材料名称-区域（跨区域材料填写）-二级子区域-数量
```
- 编号
  - 两位数，如果单个资源脚本数量超过 `100` 可以考虑使用三位数编号或者使用字母加数字编号，如 A01
  - 编号的排序应遵循以下两种方式之一：
    - 按传送点位顺序排序。相邻脚本之间优先保证传送的便捷性，这种编号方式考虑整体采集效率。
    - 按材料获取效率排序。优先选择资源分布密集或容易采集的点，效率高的路径放在靠前编号，这种编号方式考虑编号靠前脚本的采集效率。
- 材料名称
  - 采集物（使用游戏内官方名称命名，如 `慕风蘑菇`，`劫波莲`，不应当使用 `绫华突破材料`等不清晰的名称命名）
  - 掉落物（因掉落物名称与掉落物等级有关，因此不使用掉落物本身命名，而是使用怪物名称命名）
- 区域（指 `蒙德` `璃月` `稻妻` `须弥` `枫丹` `纳塔` `至冬`，仅当材料跨区域需标注）
- 二级子区域（细分地点，如 `绝云间`）
- 预期采集的数量
示例：
```
01-水晶块-璃月-绝云间-6个
02-水晶块-璃月-荻花洲-8个
```
脚本名称仅限上述规定的编号、材料名称、区域、二级子区域，不应包含额外的描述或标点符号。如：
```
01-水晶块-璃月-快速路径-绝云间-6个
```
其他注意事项
- 脚本文件名应当和 `json` 文件中的 `name` 字段相同。
#### 文件夹命名规范

目的：对脚本按材料分类管理，便于版本控制与团队协作。目录结构应当遵循以下原则：
- 根据脚本种类选择恰当的一级分类，目前共有六个分类 `锄地专区`、`地方特产`、'敌人与魔物`、`矿物`、`其他`。
- 一级目录：以材料名称命名，须与文件命名中的材料名称一致。
- 二级子目录（可选）：可根据项目或作者划分，如有必要。
示例目录结构如下：
```
repo/pathing/矿物
├─ 水晶块/ 
│   ├─ 01-水晶块-璃月-绝云间-6个
│   └─ 02-水晶块-璃月-荻花洲-8个
└─ 风车菊/
    └─ 01-风车菊-蒙德-清泉镇-15个
```
如果脚本和原来的地图追踪脚本存在冲突 按照以下原则处理：
- 修复或补充：直接提交到原材料目录。
- 路线冲突：新建同名目录并添加作者标识：
  1. 将旧脚本目录重命名为 `AA@旧作者名`
  2. 新脚本放入 `AA@你的名字`
  3. 例：原 `repo/pathing/AA` 重命名为 `repo/pathing/AA@oldauthor` 新目录 `repo/pathing/AA@yourname`

其他注意事项
- 目录名仅限材料官方名称，不添加版本号或其他标识。
- 作者标识仅在冲突时追加，格式为“@作者名”，紧随原目录名。

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

脚本仓库页面的源码：[bettergi-scripts-web](https://github.com/huiyadanli/bettergi-scripts-web)

地图路径追踪的源码：[bettergi-map](https://github.com/huiyadanli/bettergi-map)
