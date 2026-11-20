# JSON 战斗策略编写指南

本指南面向本仓库编辑器和 BetterGI JSON 执行器。先确认 BetterGI 版本包含 `AutoFightJsonTask`；如果版本只有 TXT 战斗脚本，则应阅读 TXT 脚本说明，不能直接使用本文的 JSON 文件。

## 一、先建立最小可运行策略

```json
{
  "info": {
    "name": "示例策略",
    "author": "作者",
    "config": {},
    "preActions": []
  },
  "actions": [
    {
      "name": "钟离开盾",
      "character": "钟离",
      "action": "e(hold),wait(0.2),check",
      "condition": { "expression": "e-ready" },
      "index": 10,
      "ensureCast": true,
      "morePriorities": []
    },
    {
      "name": "兜底等待",
      "character": "",
      "action": "wait(0.2)",
      "condition": { "expression": "" },
      "index": 999
    }
  ]
}
```

编写时必须满足：

- `info` 存在，`actions` 至少有一项。
- 每个动作的 `index` 是整数且全文件唯一。
- `character` 使用 BetterGI 识别到的正式角色名或别名；留空表示当前角色。
- `action` 是逗号分隔的指令字符串，不是指令数组。
- 至少保留一个较大 `index` 的空条件兜底动作，避免条件全部不满足时频繁空转。

## 二、动作编排模型

JSON 执行器每轮从最高优先级开始检查，遇到第一个条件为真的动作就执行，执行完立即重新从头检查。`index` 越小越优先；动作数组顺序不决定运行顺序。

`character` 不在当前队伍时，动作在战斗开始时被过滤；通用动作的 `character` 留空。指定角色的动作执行前会自动切换角色，连续同角色指令不会重复切人。

### 主条件与额外优先级

用 `morePriorities` 让一个动作在多个优先级位置参与竞争：

```json
{
  "name": "芙宁娜E",
  "character": "芙宁娜",
  "action": "e",
  "condition": { "expression": "since > 20" },
  "index": 40,
  "morePriorities": [
    { "expression": "since > 28", "priority": 15 }
  ]
}
```

正常情况下动作在 40 检查；超过 28 秒后还会在 15 参与竞争。额外条件不会改写主条件，两者满足任意一个即可执行。相同优先级时主条件排在额外条件前。

## 三、动作指令写法

动作指令之间用逗号分隔；包含参数的指令使用半角括号。参数中的逗号会被解析器合并，建议不要添加多余括号。

| 类别 | 写法 | 说明 |
| --- | --- | --- |
| 技能 | `e`、`e(hold)`、`e(wait)`、`e(fast)` | `hold` 长按；`wait` 等待 E 冷却结束；`fast` 在 E 未就绪时跳过。 |
| 爆发 | `q` | 释放 Q。 |
| 普攻/重击 | `attack`、`attack(0.6)`、`charge`、`charge(0.35)` | 参数为秒数。 |
| 等待 | `wait(0.2)`、`after(0.2)` | 参数为秒数，必须大于等于可解析数值。 |
| 移动 | `walk(s,0.2)`、`w(0.5)`、`a(0.5)`、`s(0.5)`、`d(0.5)` | `walk` 需要方向和秒数；单方向指令只需要秒数。 |
| 位移 | `dash`、`dash(0.2)`、`jump` | 冲刺可选持续时间，跳跃无参数。 |
| 鼠标 | `mousedown`、`mouseup`、`click` | 可传按键名。 |
| 鼠标移动 | `moveby(100,-50)` | 需要两个整数参数，分别为 x、y。 |
| 键盘 | `keydown(E)`、`keyup(E)`、`keypress(E)` | 按键必须是 BetterGI `VirtualKeyCodes` 中的名称。 |
| 滚轮 | `scroll(1)`、`scroll(-1)` | 参数必须是整数格数。 |
| 检查/完成 | `check`、`ready` | `check` 在结束检测开启时触发战斗结束检查；`ready` 标记动作完成。 |

动作中发生异常时，BetterGI 记录该动作并释放所有按键；应尽量把复杂连招拆成可定位的动作节点。

## 四、条件表达式

条件为空表示 `true`。表达式支持布尔和数值混合运算：布尔转数值时 `true=1`、`false=0`；数值转布尔时只有大于 0 才为真。

运算优先级从高到低：括号、`!`/一元负号、`*` `/`、`+` `-`、`>` `<` `=`、`&&`、`||`。`&&` 和 `||` 支持短路求值；除以 0 返回 0。

### 条件函数

| 函数 | 示例 | 编写要点 |
| --- | --- | --- |
| Q 就绪 | `q-ready`、`q-ready(钟离)` | 无参数使用当前动作角色；画面识别每轮缓存一次。 |
| E 就绪 | `e-ready`、`e-ready(钟离)` | 使用 E 冷却跟踪器；无记录时视为就绪。 |
| E 剩余 CD | `e-cd(芙宁娜) < 5` | 数值单位为秒，0 表示就绪。 |
| 当前角色低血 | `low-hp` | 只检查当前场上角色，不代表全队。 |
| 队伍成员 | `in-party(芙宁娜)` | 用于角色存在性分支。 |
| 上次执行 | `last-exec(15)`、`last-exec(10,false,20)` | 默认判断“超过”；第三参数是数字 `index`，不是动作名。 |
| 战斗时间 | `t > 30`、`battle-time(5,false)` | 单位为秒；`battle-time` 返回布尔值。 |
| 距上次动作 | `since`、`since(20) > 8` | 单位为秒；从未执行返回正无穷。 |
| 执行次数 | `count(20,t-10,t) < 2` | 统计闭区间内执行次数。 |

`last-exec` 未执行过时，默认的“超过”判断为真，适合控制动作首次进入；若需要首次不触发，应额外用 `count(index)=0` 或其他条件限制。

## 五、常用编排模式

### 1. 技能冷却循环

```json
{
  "name": "万叶E",
  "character": "枫原万叶",
  "action": "e(hold),attack(0.2)",
  "condition": { "expression": "e-ready && since > 8" },
  "index": 40
}
```

`e-ready` 依赖 OCR 冷却记录，`since` 记录动作自身的执行间隔；两者同时满足可减少误触发。

### 2. 限制时间窗口内次数

```json
{
  "name": "芙宁娜普攻",
  "character": "芙宁娜",
  "action": "attack(0.6)",
  "condition": { "expression": "count(100,t-10,t) < 2" },
  "index": 100
}
```

此动作最近 10 秒执行次数少于 2 次时才会进入队列。`count` 的索引必须对应被统计动作的 `index`。

### 3. 用空动作作为状态标记

```json
{
  "name": "火神Q就绪标记",
  "character": "玛薇卡",
  "action": "",
  "condition": { "expression": "q-ready" },
  "index": 40
}
```

空动作执行后仍会记录 `index` 的执行时间，因此其他动作可以用 `since(40)` 或 `count(40)` 读取该状态。必须确保该标记不会因空条件而每 200 毫秒重复触发。

### 4. 技能刷新关系

```text
since(104) > 8 || since(104) > since(105)
```

用于表达动作 105 可能刷新动作 104：自然冷却超过 8 秒，或动作 105 最近一次执行时间晚于动作 104。

## 六、`preActions` 与战斗结束

`info.preActions` 在队伍识别完成后按数组顺序执行，不经过动作条件和优先级。例如：

```json
"preActions": [
  "钟离 e(hold),wait(0.2)",
  "芙宁娜 q"
]
```

战斗结束主要由两处控制：

- 在动作中加入 `check`，由当前 BetterGI 战斗结束检测配置判断是否结束。
- 超过战斗配置的 `Timeout` 后强制退出。

JSON 文件的 `info.config` 不会覆盖这些本体配置；结束检测、旋转寻敌、掉落物扫描、万叶/琴拾取等都应在 BetterGI 的配置组中设置。

## 七、编辑器工作流与检查清单

1. 在编辑器中导入 `.json`；`.json5` 单动作文件通过“合并子动作”导入。
2. 为每个动作填写唯一 `index`，再按优先级检查动作列表。
3. 用快速填充插入指令和条件，使用“格式化”统一括号和逗号。
4. 为没有其他条件满足的情况保留最大索引兜底动作。
5. 保存前处理编辑器提示的重复索引、无效引用和括号错误。
6. 将生成的 `.json` 放入 BetterGI `User\\AutoFight`，在本体策略选择框中选择具体名称。

保存前还应确认：

- 当前 BetterGI 版本确实包含 JSON 执行器。
- 没有同名 `.txt` 抢占策略选择。
- 角色名与本体 `combat_avatar.json` 的正式名/别名一致。
- 需要 `low-hp` 时确认它指的是场上角色，而不是全队。
- `since` 首次为正无穷，`last-exec` 首次默认返回真。
- 未使用 `onfield`、`last-check` 或按动作名引用索引等未实现语法。
