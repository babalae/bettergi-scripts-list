# JSON 战斗策略文件说明

本文档以 BetterGI 中的 `JsonCombatStrategy`、`JsonCombatStrategyParser` 和 `AutoFightJsonTask` 为准，说明编辑器生成的 `.json` 文件如何被本体加载和执行。JSON 策略与旧版 `.txt` 策略是两套独立格式，不能互相替换。

## 1. 文件位置与执行入口

运行时策略目录为：

```text
BetterGI/User/AutoFight/
```

BetterGI 的策略列表递归扫描 `.txt` 和 `.json`，显示时去掉扩展名。根据名称解析路径时遵循以下顺序：

1. `User/AutoFight/策略名.txt` 存在时使用 TXT。
2. TXT 不存在且 `User/AutoFight/策略名.json` 存在时使用 JSON。
3. 两者都不存在时保留 `.txt` 路径，并在启动时报告文件不存在。

选择“根据队伍自动选择”会传入整个 `User/AutoFight` 目录，只由 TXT 执行器按队伍匹配脚本；JSON 策略必须选择具体的 `.json` 文件名。JSON 文件进入 `JsonCombatTaskFactory`，由 `AutoFightJsonTask` 执行，不会交给 TXT 解析器。

## 2. 顶层结构

```json
{
  "info": {
    "name": "示例策略",
    "author": "作者",
    "config": {},
    "preActions": []
  },
  "actions": []
}
```

### `info`

| 字段 | 类型 | 运行时行为 |
| --- | --- | --- |
| `name` | string | 日志中的策略名称；建议与文件名一致。 |
| `author` | string | 作者信息，不参与战斗逻辑。 |
| `config` | object | 保留给策略元数据的字典；当前 JSON 执行器不会用它覆盖 BetterGI 战斗配置。 |
| `preActions` | string[] | 战斗场景初始化后、主循环前按数组顺序执行的动作字符串。格式为 `角色 指令`，例如 `"钟离 s(0.2),e(hold)"`。 |

解析器要求 `info` 存在，且 `actions` 至少包含一个动作；JSON 语法错误、缺少节点或动作索引重复都会导致策略加载失败。

### `actions`

`actions` 是动作对象数组。每个动作的 `index` 必须唯一；数组书写顺序不是执行顺序，运行时按优先级排序。

| 字段 | 类型 | 默认值 | 运行时行为 |
| --- | --- | --- | --- |
| `name` | string | `""` | 日志和编辑器显示名称。 |
| `character` | string | `""` | 指定执行角色。为空时使用当前角色；指定角色不在队伍中时，该动作被过滤。 |
| `action` | string | `""` | 由 TXT 同一套动作指令解析器执行，详见《编写指南》。空字符串可作为条件标记节点。 |
| `condition` | object | `{ "expression": "" }` | 条件对象；`expression` 为空时视为满足。 |
| `index` | integer | 无 | 主优先级，数值越小越先检查。必须唯一。 |
| `ensureCast` | bool | `false` | 动作后检查 E 技能是否进入冷却；未检测到成功时重新执行动作，最多重试 5 次。 |
| `morePriorities` | array | `[]` | 为同一动作增加其他优先级入口；每项包含 `expression` 和 `priority`。 |

编辑器还可能保留 `redArrowAim` 等历史字段。BetterGI 使用 Newtonsoft.Json 反序列化时会忽略模型未声明的字段，因此这些字段不会自动产生运行时效果；不要把它们当作 JSON 执行器能力。

## 3. 优先级与主循环

启动 JSON 战斗时，本体按以下顺序工作：

1. 识别当前队伍，并过滤 `character` 为空或属于当前队伍的动作。
2. 每个动作展开为一个主条目和若干 `morePriorities` 条目。主条目使用动作的 `condition.expression` 与 `index`；额外条目使用自身的 `expression` 与 `priority`。
3. 按优先级数值升序排列；同一优先级下，主条目先于额外条目。
4. 执行 `preActions`。
5. 主循环每轮复用一次截图，按优先级检查条件；执行第一个满足条件的动作后立即重新从最高优先级开始检查。
6. 本轮没有动作满足条件时等待约 200 毫秒再检查。
7. 超过 BetterGI 战斗配置的 `Timeout`，或动作中 `check` 检测到战斗结束时退出。
8. 根据战斗配置执行万叶/琴聚物和掉落物扫描等战后流程。

`morePriorities` 是并存入口，不会覆盖原 `index`。例如：

```json
{
  "name": "爱可菲Q",
  "character": "爱可菲",
  "action": "q",
  "condition": { "expression": "low-hp && q-ready" },
  "index": 20,
  "morePriorities": [
    { "expression": "in-party(芙宁娜) && q-ready", "priority": 8 }
  ]
}
```

该动作同时在 8 和 20 两个位置参与竞争，满足哪个入口的条件就从哪个位置执行。

## 4. 条件对象与求值规则

`condition` 必须是对象，表达式写在 `condition.expression` 中。空表达式返回 `true`。表达式错误会记录警告，并按 `false` 处理，不会中断整个任务。

支持布尔值和数值：`true` 转为 `1`，`false` 转为 `0`；数值大于 `0` 转为 `true`，小于等于 `0` 转为 `false`。支持 `!`、`&&`、`||`、`>`、`<`、`=`、`+`、`-`、`*`、`/` 和括号，优先级从高到低为：括号、一元运算、乘除、加减、比较、与、或。除数为 0 时数值结果为 0，浮点相等比较误差小于 `0.0001`。

### 布尔函数

| 函数 | 说明 |
| --- | --- |
| `q-ready()` / `q-ready` | 检测当前动作所属角色的 Q；`q-ready(角色名)` 检测指定角色。Q 图标由画面识别，后台角色和场上角色结果合并。 |
| `e-ready()` / `e-ready` | 检测当前动作所属角色 E 是否就绪；可传角色名。状态来自 E 冷却跟踪器。 |
| `e-cd()` | 该角色 E 剩余冷却秒数；可传角色名。返回 `0` 表示就绪。 |
| `low-hp` | 检测当前场上角色是否低血，不是全队任意角色低血。 |
| `in-party(角色名)` | 判断角色是否在当前队伍。角色名按一个标识符解析，使用中文正式名或本体别名。 |
| `last-exec(秒数, greater?, index?)` | 判断指定动作距离上次执行是否超过（默认）或少于秒数。省略索引时指当前动作；未执行过时，`greater=true` 返回 `true`，`greater=false` 返回 `false`。目标参数只支持数字索引。 |

### 数值函数

| 函数 | 说明 |
| --- | --- |
| `t` | 当前 JSON 战斗开始后的秒数。 |
| `battle-time(秒数, greater?)` | 与 `t` 相同语义的布尔判断；默认判断是否已超过给定秒数。 |
| `since(index?)` | 距动作上次执行的秒数；省略索引时指当前动作。未执行过返回正无穷。 |
| `count(index?, start?, end?)` | 统计动作在 `[start,end]` 秒区间内的执行次数；索引默认当前动作，起点默认 0，终点默认当前 `t`。 |

示例：

```text
q-ready && since > 15
in-party(芙宁娜) && q-ready(芙宁娜)
count(100, t-10, t) < 2
since(104) > 8 || since(104) > since(105)
```

当前 JSON 求值器没有实现 `onfield`、`last-check`，也不支持按动作名称传递 `since`、`count` 或 `last-exec` 的目标；这些写法会得到错误结果或按 `false` 处理。

## 5. 动作指令与 TXT 的边界

JSON 的 `action` 字段最终复用 BetterGI 的 `CombatScriptParser.ParseLinePart` 和 `CombatCommand`，因此动作指令仍是逗号分隔的字符串，而不是 JSON 数组。常用形式包括：

| 指令 | 参数 | 示例 |
| --- | --- | --- |
| `e` / `skill` | 可选 `hold`、`wait`、`fast` | `e(hold)` |
| `q` / `burst` | 无 | `q` |
| `attack` | 可选秒数 | `attack(0.6)` |
| `charge` | 可选秒数 | `charge(0.35)` |
| `wait` / `after` | 秒数 | `wait(0.2)` |
| `walk` | 方向、秒数 | `walk(s,0.2)` |
| `w`、`a`、`s`、`d` | 秒数 | `d(0.5)` |
| `dash` | 可选秒数 | `dash(0.2)` |
| `jump` | 无 | `jump` |
| `mousedown`、`mouseup`、`click` | 可选按键 | `click` |
| `moveby` | x、y 整数 | `moveby(100,-50)` |
| `keydown`、`keyup`、`keypress` | 一个 VirtualKeyCodes 按键名 | `keypress(E)` |
| `scroll` / `verticalscroll` | 整数格数 | `scroll(-1)` |
| `check` / `检测` | 无 | `check` |
| `ready` / `完成` | 无 | `ready` |

`round(...)` 只用于 TXT 脚本的回合标记；JSON 动作字符串不会把它变成独立可执行动作。动作中的 `check` 仅在 BetterGI 的战斗结束检测开关开启时触发检查。

## 6. 结束条件、拾取和异常

- JSON 任务本身使用当前战斗配置的超时秒数；超时后退出主循环并记录日志。
- `check` 会按战斗配置执行编队界面检测，或在启用旋转寻敌时调用寻敌检测。
- 万叶/琴拾取、掉落物扫描、经验值判断等属于 BetterGI 战后配置，不由 JSON 文件中的 `info.config` 控制。
- 解析失败、索引重复、未知条件函数会记录错误或警告；动作执行异常只记录动作名并释放按键，任务是否继续取决于后续循环。

## 7. 格式兼容性

- 编辑器导出 `.json` 为标准 JSON；策略目录中的 `.json5` 主要用于导入单动作补丁，BetterGI 不直接读取 `.json5`。
- 编辑器导入支持对象、对象数组和多选批量导入；合并单动作时会把缺失的 `condition` 规范化为空表达式。
- BetterGI JSON 解析器使用大小写不敏感的 C# 属性映射，但建议统一使用文档中的小写字段名。
- 未声明字段通常会被 Newtonsoft.Json 忽略；字段名称拼写错误不会自动提示，保存前应检查生成文件。
