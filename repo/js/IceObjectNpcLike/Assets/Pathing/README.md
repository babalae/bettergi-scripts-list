# Pathing 路线资源说明

本目录包含热能恢复路线、冰造物 NPC 点位路线和一条任务分支备用路线，均使用至冬实机验证过的 `SIFT` 地图匹配。

| 文件 | 实际用途 | 点赞标签 | 前置条件 |
| --- | --- | ---: | --- |
| `restore.json` | 传送至固定七天神像，原地恢复热能 | — | 已解锁锚点 |
| `point01.json` | 北国银行门口，3 名 NPC | 6 | 已解锁区域 |
| `point02.json` | 印记商店门口，4 名 NPC | 8 | 已解锁区域 |
| `point03.json` | 炉灰食堂门口，1 名 NPC | 2 | 已解锁区域 |
| `point04.json` | 餐厅门口，2 名 NPC | 4 | 已解锁区域 |
| `point05.json` | 铁匠附近，1 名 NPC | 2 | 已解锁区域 |
| `point06.json` | 曙光车站玩具附近，2 名 NPC | 4 | 完成“雪后曙光” |
| `point07.json` | 车站餐厅，1 名 NPC | 2 | 完成“雪后曙光” |
| `point08_continue.json` | 从 Point 07 前往车站火炬边，3 名 NPC | 6 | 完成现实时间第二天任务“新雪来客” |
| `point09_continue.json` | 从 Point 08 前往车站台子，1 名 NPC | 2 | 完成“雪后曙光”；依赖 Point 08 |
| `point09_from07.json` | Point 08 关闭时使用的 Point 09 完整备用路线 | 2（作为 Point 09 计入） | 完成“雪后曙光”；依赖 Point 07 |

Point 01～07 是以 `teleport` 开始的独立路线。车站连续组有两种执行分支：

```text
Point 08 开启：point07.json → point08_continue.json → point09_continue.json
Point 08 关闭：point07.json → point09_from07.json（完整替代 point09_continue.json）
```

`point09_from07.json` 从 Point 07 的结束点出发，终点就是 Point 09 工位，是 Point 08 关闭时的完整备用 Point 09 路线。脚本运行完该文件后会执行一次 Point 09 的镜头和冰造物动作，并将其作为 Point 09 计入 `2` 赞；不会再运行 `point09_continue.json`，也不会把备用文件当成额外 Point 或重复计赞。

所有 NPC 工位路线及备用路线均以 `target → orientation` 结束：`target` 用于精确站位，`orientation` 用于确定水平视角。

每条正式 Point 路线在 `info.tags` 中记录两次冰造物放置预计获得的总点赞量，格式为：

```text
点赞=6
```

脚本会自动扫描正式的 `pointXX.json` 和 `pointXX_continue.json`。备用路径由 `main.js` 明确调用，不参与普通 Point 自动发现。
