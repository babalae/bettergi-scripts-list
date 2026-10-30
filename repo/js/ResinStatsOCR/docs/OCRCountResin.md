# OCRCountResin 实现说明

> **用途**：实现文档，随本脚本一起分发。面向玩家的说明见上层目录的 `README.md`，两者分工：README 讲「是什么、怎么用」，本文讲「代码怎么写的、为什么这么写、改哪里」。
> **对象**：脚本目录（`main.js` + `src/resin.js` + `src/utils.js` + `manifest.json` + `settings.json` + `assets/icon/`）
> **当前版本**：v6.1
> **最后更新**：2026-10-30

---

## 一句话

主界面 → F1 开冒险手册 → 点左侧「秘境」→ 同屏读**原粹 + 浓缩** → 点原粹旁的「+」→ 弹窗读**须臾 + 脆弱** → 输出并通知。

全程不点固定坐标：定位靠「比例区域 + OCR 文本 + 模板匹配」，点击一律 `Region.click()`。

---

## 文件分工

| 文件 | 行数 | 职责 |
|---|---|---|
| `main.js` | 130 | 入口：拿数据 → 释放资源 → 回主界面 → 打印结果并发通知 |
| `src/resin.js` | 729 | **工具1**：截图 / OCR / 点击 / 模板匹配 + 四步流程，导出 `collectResin()` |
| `src/utils.js` | 444 | **工具2**：常量、纯函数（解析 / 校验 / 文案）、模板 Mat 的懒加载与统一释放 |

依赖单向：`main.js` → `src/resin.js` → `src/utils.js`；`main.js` 另从 `src/utils.js` 取文案与昵称函数。

根目录只留入口与元数据（`main.js` / `manifest.json` / `settings.json` / `README.md`），代码模块放 `src/`。`main.js` 用 `./src/resin.js`、`./src/utils.js`；`resin.js` 与 `utils.js` 同目录，互相引用仍是 `./utils.js`。模板路径 `assets/icon/*.png` 从脚本根算，不随模块移动而变。

`collectResin()` 的返回：

```js
{ ok, uid, resin: { original, condensed, transient, fragile },
  transientDays, steps: { openSecret, clickPlus, dialogClosed }, error?, errorStack? }
```

- 不抛异常：①/③ 失败返回 `ok:false` + `error`，已读到的项照常带回
- `resin.js` 内保留四个模块级变量（`resinCounts` / `transientExpireDays` / `frameWidth` / `frameHeight`），与拆分前一致
- `main.js` 只认返回值，不读 `resin.js` 内部状态；昵称由 `readNickname()`（在 `utils.js`）在入口读取

---

## 1. 运行前提

| 项 | 要求 | 说明 |
|---|---|---|
| 分辨率 | 16:9，推荐 ≥1920×1080 | 低于 1600×900 部分功能异常（官方 resolution.html） |
| 截图坐标系 | ≤1920×1080 | `captureGameRegion()` 高于 1080P 时缩放到 1920×1080 |
| JS 通知权限 | 需在调度器通用设置里勾选 | 不勾则 `notification.send` 被拦，脚本侧无法自救 |
| 游戏状态 | 需能回主界面 | 开头调 `genshin.returnMainUi()` |

`setGameMetrics(1920, 1080, 1)` 只是声明脚本环境，BGI 会按实际窗口自动适配，不是把游戏锁比分辩率。

---

## 2. 四步流程

| 步 | 函数 | 做什么 | 失败后果 |
|---|---|---|---|
| ① | `openSecretPage()` | 开冒险手册 + 点左侧「秘境」标签 | 中止流程，返回 `ok:false`（不发统计结果） |
| ② | `readSecretPageResin()` | 秘境页全屏 OCR，读原粹 + 浓缩 | 单项为「未知」，继续 |
| ③ | `clickReplenishButton()` | 模板匹配「+」并点击 | 中止流程，返回 `ok:false` |
| ④ | `readReplenishDialog()` | 弹窗全屏 OCR，读须臾 + 脆弱（顺带给原粹/浓缩兜底） | 单项为「未知」，继续 |
| 退出 | `closeReplenishDialog()` | ESC 关弹窗（不验证） | 无（失败由 `returnMainUi` 兜底） |

调用链：

```
main()  ← async IIFE
├─ collectResin()（src/resin.js，工具1）
│  ├─ setGameMetrics(1920,1080,1) / resetState() / returnMainUi() / initFrame()（测首帧宽高供比例换算）
│  ├─ readUid()                     在主界面取，UID 只有这里可见
│  ├─ openSecretPage()          ① 手册 → 秘境标签
│  ├─ readSecretPageResin()     ② 原粹 / 浓缩
│  ├─ clickReplenishButton()    ③ 点「+」
│  ├─ readReplenishDialog()     ④ 须臾 / 脆弱（第②步为 null 时顺带兜底原粹）
│  ├─ closeReplenishDialog()    ESC 一下即走，不做截图验证
│  └─ 返回 { ok, uid, resin, transientDays, steps }
│
└─ main() 收尾：finally 释放模板 Mat → returnMainUi →
   ok 时 displayResults(results, readNickname())，否则 notification.error
（四项全 null 时，结果通知之后再补一条错误通知）
```

每个节点的内部分支见第 3 节。

---

## 3. 每步细节

### ① `openSecretPage()` — 打开秘境页

**对外只有一步**：调用方不关心手册是怎么开的。

- `ensureHandbookOpen()` 三条路：
  1. `keyPress("F1")` → 等 `BOOK_OPEN_DELAY`(2200ms) → `isHandbookOpen()`
  2. 失败则 `ESCAPE` → 等 1800ms → 在 `RATIO.BOOK_ITEM_IN_ESC` 区域 OCR 找「冒险之证」→ `derive(0, offsetY)` 后点击（实测点击点在文本中心上方 50px，比例 `-0.0463`）
  3. 都失败再 `returnMainUi` + F1 一次
- `isHandbookOpen()` 判据：在左侧竖排标签列 OCR，「见闻 / 委托 / 秘境 / 讨伐 / 向导 / 备战」**命中 ≥2 个**才认为开了。单个命中不算，避免把其他界面的孤立文字误判成手册。
- `clickSecretDomainTab()`：同一标签列找「秘境」，命中即 `click()`。**没有固定坐标兜底**，找不到直接返回 false（v3.1 起删掉了 `(297,437)` 硬点）。

### ② `readSecretPageResin()` — 原粹 + 浓缩

一次全屏 OCR 供两者共用（`lastItems` 缓存）。

**原粹** `readResinCount("original", items)`：
1. 先按 `x/200` 格式正则：`/(\d{1,4})\s*[\/／]\s*200/`（放宽到 4 位，越界值交给校验丢弃）
2. 读不到就记「未知」（不做名称匹配：界面里没有「原粹树脂」这行文字，强行按名称找只会串到别人的数字）

之所以要先走格式：曾出现「原粹」标签的最近纯数字是脆弱树脂的 12，把原粹读成 12。

**浓缩** `readCondensedByIcon()`：
- 秘境页的浓缩**只有图标没有文字**，也不做名称匹配
- `region.find(getCondensedIconRo())` 匹配 `assets/icon/condensed_resin.png`
- 数字区 = **「第二个口」**：与图标矩形同尺寸，紧贴其右侧（`x = icon.x + icon.w`，纵向以图标中心对齐）
  - 口诀：图标矩形是第一个口，数字就在紧挨着的第二个口里
  - 早期版本试过「边长×2、左边中点对齐图标中心」，框里同时含图标和数字，OCR 反而读成乱码（如 `DD`），已废弃
- 数字区里**先用白色数字模板** `num0_white`~`num5_white` 匹配（得分门槛 `DIGIT_MATCH_MIN` 0.78）：
  1. 命中 → 直接返回该数字（实测真值 1 得分 0.92，次高仅 0.62，区分度足够）
  2. 未命中 → 退回 OCR，走 `pickClosestNumber()`：
     a. `toHalfWidth()` 全角转半角，去掉空格
     b. 含 `/`、`／`、`:`、`：` 的取前半段（`0/5` → `0`）
     c. 只保留数字字符，结果是 1~3 位纯数字才算数，否则丢弃该条
     d. 坐标统一成「框内相对坐标」再算分：`item.x >= rect.x - 4` 判为绝对坐标，减去 `rect.x/rect.y`；
        否则视为相对识别区域的坐标，原样使用（两种基准都能算对）
     e. 排序分 = `1 - 到框中心的距离 / 半对角线`，`< 0.5` 视为没读到
- **不做字母→数字的形近字猜测**（旧版 `OCR_CONFUSABLE` 已删）：浓缩框里图标被读成 `DD` 时，
  `D→0` 会把它猜成 `00` 并当成有效读数返回，比直接认不出（退回模板 / 记未知）更糟
- 图标坐标超出截图范围 → 判定坐标系不符，放弃读数（宁可「未知」不填错数）
- 日志打印每个数字模板的得分，模板比 OCR 稳：认不出时返回空，不像 OCR 会硬凑一个结果
- **评分必须按「到框中心距离」（上面 e 项）**：旧算法按「贴左边」算（`1 - |文字中心x - 框左边x| / 半宽`），
  但数字实际是居中的（框 921~1001、文字 944~977），`leftFit` 只有 0.01、总分 0.42 被丢弃，
  于是「框里读到 22」判成没读到 —— 这就是脆弱曾读成 2 的原因

**为什么不用 OCR 自带置信度**：`Region` 只暴露 `text` 与 `matchScore`（后者仅模板匹配有值），OCR 置信度拿不到，排序只能自己算。

模板匹配坐标与 OCR 坐标同基准（官方：Region 坐标相对游戏捕获区域），所以拼接合法；
但框内 OCR（`RecognitionObject.ocr(x,y,w,h)`）返回的坐标实测可能仍以识别区域左上角为原点，
`pickClosestNumber()` 因此对两种基准都做了归一化，别假设只有一种。

### ③ `clickReplenishButton()` — 点「+」

- `clickTemplate(getReplenishButtonRo(), ...)` 轮询匹配 `assets/icon/replenish_resin_button.png`（就是 `67/200` 右边那个圆形＋）
- 轮询上限 `TEMPLATE_TIMEOUT`(3000ms)，间隔 300ms
- 匹配到即 `result.click()`；**匹配成功本身即「秘境页已就绪」的判据**，不再额外校验页面
- 点击后等 `DIALOG_DELAY`(1500ms) 让弹窗出现
- 失败 → 抛错「没找到原粹树脂旁的「+」按钮」

### ④ `readReplenishDialog()` — 须臾 + 脆弱

- **须臾 / 脆弱共用一条链**：先 `region.find(templateMatch(...))` 匹配 `transient_resin.png` / `fragile_resin.png`
  （实测两者得分都是 1.0），数字区 = 图标**正下方**、同宽：
  `{ x: icon.x, y: icon.y + icon.h, w: icon.w, h: icon.h × OTHER_NUM_HEIGHT_SCALE(0.75) }`
  （上游写死 60px / 图标 80px，改成比例后不依赖绝对像素）
  - 数字区内先 OCR（`pickClosestNumber`），读到即返回；两位数照样读得出（实测脆弱框内读到 `22`）
  - 图标没匹配到 → 该项记「未知」，每次尝试都重新截图重试
- **数字模板兜底只给须臾**（`readOtherResinByIcon(kind, useDigitFallback)`，脆弱传 `false`）
  - `matchDigitTemplates()` 是「每个模板在框内找一个最佳匹配、取分最高者」，只返回单个 0~9，
    读不出 `12` / `22`。脆弱常见两位数，模板会给出其中一位（实测 22 → 2），比记未知更糟
  - 须臾上限 9，永远一位数，模板兜底成立
- 脆弱上限 999（游戏里没有硬上限，只是把明显误读判废）
- **弹窗里只有「须臾树脂」这一行名称**（实测 @908,586 居中），没有「脆弱树脂」字样，所以脆弱只能靠图标定位
- 四种树脂的名称 OCR 匹配已整套删掉（v5.9），现在只有两条路：原粹看 `x/200` 格式，其余看图标锚点
- **须臾有效期**：文案与须臾数字同屏，不单独划区域。读完须臾/脆弱后，
  `parseTransientExpireDays()` 直接吃整屏 OCR 的结果 `lastItems`（`ocrWholeScreen()` 本来就拍过），
  把文本拼成一行后匹配 `(\d{1,3})天后过期`，`(\d{1,2})小时后过期` 记 0 天，都没有则 `transientExpireDays = null`
- 解析前若还没扫过整屏，补拍一次 `ocrWholeScreen()`
- 原粹 / 浓缩若第②步是 null，这里用弹窗结果补一次（弹窗里通常没有浓缩，属保险）
- `debug=true` 时打印全部细节；正常只输出步骤标题 + 四项结果 + 警告错误

### 退出 `closeReplenishDialog()` — 关弹窗后再发通知

- 读完④立刻 `keyPress("ESCAPE")`，等 `TEXT_RETRY_DELAY + 300` ms 即视为已关
- **不做截图验证**（实测 ESC 一下就关得掉，省一次全屏 OCR）；只想看有没有走到这步就开 `debug`
- **通知一律在退出之后发**：成功通知在 `main()` 的 `returnMainUi` 之后调用 `displayResults()`，失败通知同样排在 `returnMainUi` 之后，避免通知弹在弹窗上面

---

## 4. 读数校验与重试

`readWithRetry(kind, readOnce)` 负责「读 + 校验 + 重试」，最多 `COUNT_RETRY`(3) 次，间隔 600ms，每次都**重新截图**（错误值可能来自瞬时画面变化，重算同一张图没意义）。

`validateCount(kind, value, attempt)` 规则：

| 情况 | 判定 |
|---|---|
| 低于 0 / 非整数 / 非数字 | 无效，重试 |
| ≤ 上限 | 有效 |
| 原粹且 `attempt ≥ 2` 且 `200 < x < 999` | **有效**（原粹可溢出上限） |
| 其余超上限 | 无效，重试 |

校验表 `RESIN_LIMITS`：原粹 200、浓缩 5、须臾 9、脆弱 999。前两项是真实上限；须臾 9、脆弱 999 只是「合理范围」，用于把明显误读判废重试，不作为上限展示。须臾取 9 而不是 10 是因为 10 只会来自误读（游戏里正常就是 1~3 之间跳），顺手也不再有两位数问题。

3 次仍无效 → 输出「未知」（`null`），与真实的 0 区分。

---

## 5. 账号信息

| 项 | 函数 | 来源 | 失败表现 |
|---|---|---|---|
| UID | `readUid()` | `genshin.uid()`（OCR） | `null` → 输出「未知」 |
| 昵称 | `readNickname()` | `settings.nickname` | 留空 → `FALLBACK_NICKNAME`（旅行者） |

`readNickname()` 只读 `settings.nickname`：去空白后非空就用，否则回退「旅行者」。`settings` 在单独运行脚本时可能为 `undefined`，所以先判 `typeof settings !== "undefined"`。

**为什么不用 `context.json`**：v5.11 及之前从脚本目录的 `context.json` 取名字（v5.10 之前还先探 `oneDragonName` / `configGroupName` 等全局变量）。两条路都不通：BGI 不向 JS 暴露配置组名，那些全局变量恒为 `undefined`；`context.json` 要手写一份固定内容，同一条龙跑多个配置组也只能显示同一个名字，起不到区分作用。v5.12 起整段删除，改成设置项——内容本来就由用户决定，放进设置界面比藏一个文件更直接。

---

## 6. 输出与通知

日志：`============ 树脂统计结果 ============` 开框，`UID / 昵称` 一行，四项各一行，再闭合。完整样例见 `README.md`。

通知（`notify()`）三到四行短句：标题「树脂统计」→ 昵称·UID → 原粹/浓缩 → 须臾/脆弱。须臾剩余不足 3 天时，空一行追加提醒（`formatExpireReminder()`，须持有 >0 才提醒），样例同样见 `README.md`。

- 昵称取不到时只留 `UID xxx`；读不到的项写「未知」
- 只有原粹、浓缩带上限（`NOTIFY_CAPS`：200 / 5）；须臾、脆弱游戏里没有硬上限，只写数字
- 须臾额外带剩余天数（`transientExpireDays`，读不到就不带）；`< 3` 天且持有量 `>0` 时追加一行提醒，0 天写作「今天过期」，文案前后各加三个感叹号
- 失败：`树脂统计失败` 换行接原因
- 四项全 null 时，结果通知之后再发一条错误通知
- 全部受 `settings.notify` 一个开关控制（默认开）

`settings.json` 三项：

| 键 | 默认 | 作用 |
|---|---|---|
| `notify` | true | 是否发送通知（成功与失败共用这一个开关） |
| `nickname` | `""` | 通知里显示的名字，留空用「旅行者」 |
| `debug` | false | 详细日志：OCR 原文、模板得分、坐标、点击结果 |

日志默认只留：开始一行、四个步骤标题、四项结果、最终表格；其余细节走 `logDebug()`，开 `debug` 才输出。

---

## 7. 常量速查

**RATIO（比例，0~1，仅用于限定 OCR 搜索范围，不是点击坐标）**

| 键 | 值 | 用途 |
|---|---|---|
| `HANDBOOK_TABS` | x .1115, y .0352, w .0661, h .9093 | 手册左侧竖排标签列 |
| `BOOK_ITEM_IN_ESC` | x .0776, y .7972, w .0490, h .0380 | ESC 菜单「冒险之证」 |
| `BOOK_ITEM_OFFSET_Y` | -0.0463 | 点「冒险之证」的纵向偏移（实测上方 50px / 1080） |
| `CONDENSED_NUM_WIDTH_SCALE` | 1.0 | 浓缩数字区宽 = 图标宽 × 1.0（「第二个口」） |
| `CONDENSED_NUM_HEIGHT_SCALE` | 1.0 | 浓缩数字区高 = 图标高 × 1.0 |
| `OTHER_NUM_HEIGHT_SCALE` | 0.75 | 须臾/脆弱数字区高 = 图标高 × 0.75（上游固定 60px / 80px） |

**CONFIG（时间与次数）**

| 键 | 值 | 用途 |
|---|---|---|
| `SLEEP_INTERVAL` | 300ms | 模板匹配轮询间隔 |
| `UI_DELAY` | 1200ms | 常规 UI 等待 |
| `BOOK_OPEN_DELAY` | 2200ms | 手册打开等待 |
| `DIALOG_DELAY` | 1500ms | 点「+」后弹窗等待 |
| `RETRY` | 3 | OCR 找文本重试 |
| `TEXT_RETRY_DELAY` | 700ms | 找文本重试间隔 |
| `COUNT_RETRY` | 3 | 读数校验重试（含首次） |
| `COUNT_RETRY_DELAY` | 600ms | 读数重试间隔 |
| `TEMPLATE_TIMEOUT` | 3000ms | 模板匹配超时 |
| `KEYWORDS.HANDBOOK` | 见闻 / 委托 / 秘境 / 讨伐 / 向导 / 备战 | 手册判据：标签列里命中 ≥2 个 |
| `KEYWORDS.SECRET_TAB` | `["秘境"]` | 左侧标签要点的那一项 |
| `KEYWORDS.BOOK_ITEM` | `["冒险之证"]` | ESC 菜单里找的条目 |

**限额**

| 键 | 值 | 用途 |
|---|---|---|
| `RESIN_LIMITS` | 原粹 200 / 浓缩 5 / 须臾 9 / 脆弱 999 | 校验上限，超了判废重试；后两项只是「合理范围」 |
| `NOTIFY_CAPS` | 原粹 200 / 浓缩 5 | 通知里只有这两项带上限 |
| `DIGIT_MATCH_MIN` | 0.78 | 数字模板命中门槛 |

**资源**：`condensed_resin.png`（浓缩图标）、`replenish_resin_button.png`（加号）、`transient_resin.png` / `fragile_resin.png`（弹窗须臾/脆弱图标）、`num0~num5_white.png` + `num1~num4.png`（数字模板）。

---

## 8. 仍待留意

| 项 | 说明 |
|---|---|
| 「冒险之证」点击偏移 -50px | ESC 菜单布局若变会偏；F1 正常时不走这条路 |
| 昵称取不到一条龙名 | BGI 未暴露，v5.12 起改为设置项手填 |
| 通知送达 | 依赖调度器勾「JS 通知权限」 |

「+」模板命中（1.0）、`isHandbookOpen` 阈值、浓缩「第二个口」（0.92）、弹窗版式（图标 80×80、数字居中）均已实机验证，实测数据见第 3、4 节。

---

## 9. 改哪里（改动指引）

| 想改什么 | 改哪里（文件） |
|---|---|
| 树脂上限 | `RESIN_LIMITS`（`utils.js`） |
| 重试次数 / 间隔 | `CONFIG.COUNT_RETRY` / `COUNT_RETRY_DELAY`（`utils.js`） |
| 界面搜索范围 | `RATIO` 各项（`utils.js`，比例，不要写成像素） |
| 浓缩数字区宽窄 | `RATIO.CONDENSED_NUM_WIDTH_SCALE` / `HEIGHT_SCALE`（`utils.js`） |
| 弹窗读数规则 | `readReplenishDialog()`（`resin.js`） |
| 昵称来源 | `readNickname()`（`utils.js`，读 `settings.nickname`） |
| 通知文案 | `displayResults()`（`main.js`） |
| 返回给入口的字段 | `collectResin()` 结尾的 `result` 对象（`resin.js`） |
| 「+」识别不到 | 换 `assets/icon/replenish_resin_button.png`，不要加坐标兜底 |

**不要做**：
- 不要 `click(数字, 数字)`
- 不要用 `.length` / `.Count` 读 `findMulti` 结果（用 `.count`）
- 不要给找不到的元素加固定坐标兜底
- 不要混用「拿识别结果 x/y 自己算点击点」—— 要偏移用 `Region.derive()`
- 不要在顶层写执行语句（`file.readImageMatSync` 之类），全部代码包在 `(async function main(){ ... })();` 里（官方 `dev/js/create.html`）
- 不要把 `Mat` / `ImageRegion` 用完不释放，`main()` 的 `finally` 里调 `disposeResources()` 统一 `dispose()`（官方 `dev/js/rec.html`）
- 不要调用 `bettergi.d.ts` 里没有的 API，也不要混用 PascalCase 兼容别名（统一 `templateMatch` / `readImageMatSync` / `readTextSync`）
- 不要在 `utils.js` 里碰游戏界面（`captureGameRegion` / `keyPress` / `genshin`）；识别与点击只留在 `resin.js`
- 不要存成非 UTF-8 或带 BOM 的文件

改完逐个校验语法（`import/export` 在 `node --check` 的普通 `.js` 上下文会报错，复制成 `.mjs` 再检查）：

```
for f in main.js src/resin.js src/utils.js; do cp "$f" "/tmp/$(basename ${f%.js}).mjs"; node --check "/tmp/$(basename ${f%.js}).mjs"; done
```

这些约束的官方依据见 BetterGI 开发文档 `bettergi.com/dev/js/`（分辨率与坐标见 `dev/js/rec.html`）。

---

## 10. 版本历史

玩家向的简版见上层目录 `README.md`；本表保留提交锚点，便于定位回退点。

| 版本 | 提交 | 要点 |
|---|---|---|
| 1.0 | `b858a97` | 上游原版（地图 + 点补充树脂按钮 + 说明界面 OCR） |
| 1.1 | `85d3dd8` | 修正则 NaN、失败返回 null、截图 dispose、分辨率缩放 |
| 1.2–1.3 | `eda88ae`/`f147473` | 昵称空壳 → 直接返回配置值 |
| 2.0 | `1edee6e` | 改为「地图缩放后一屏 OCR」，删除全部点击 |
| 2.1 | `d3b644e` | 昵称改取运行上下文名称 |
| 3.0 | `0e65993` | 重建为「冒险手册 → 秘境 → 加号 → 弹窗」 |
| 3.1 | `a345c96` | **去掉全部绝对坐标**，改比例定位 + `Region.click()`；修 `findMulti` 长度读取 |
| 4.0 | `b11a791` | 四步化：秘境页先读原粹 + 浓缩（浓缩不再必然「未知」） |
| 4.1 | `aa2bdc1` | 浓缩改图标锚点读右侧数字 |
| 4.2 | `08339fc` | 上限校验 + 越界重试（最多 3 次），须臾上限 999→10 |
| 4.3 | 未提交 | 数字区改为「图标边长×2、左边中点对齐图标中心」；新增只读识别开关；数字区截图落盘 `debug/` |
| 4.4 | `082629a` | 数字区改为「图标右侧第二个口」；浓缩改用 `num0~num5_white` 白色数字模板（0.92 命中），OCR 降为兜底 |
| 4.5 | `ad48161` | 浓缩固定走数字模板；④ 弹窗整屏截图落盘；只读识别默认关闭 |
| 4.6 | `40191c2` | 须臾/脆弱改回上游做法：图标匹配 → 读图标下方数字（`OTHER_NUM_HEIGHT_SCALE` 0.75），OCR 失败用数字模板兜底 |
| 4.7 | `6c98e2b` | 清理校准脚手架：删除只读模式、`saveRegionShot` 截图落盘、`debug/`、浓缩的关键字兜底（该页无文字，必失效） |
| 4.8 | `e012810` | 日志降噪（细节走 `logDebug`，仅步骤标题与结果常驻）；设置精简为 2 项：`notify`（默认发）、`debug`；删除冒烟测试 |
| 4.9 | `d681c98` | 通知文案改多行：标题 / 昵称·UID / 原粹·浓缩 / 须臾·脆弱 |
| 4.10 | `4cae45f` | 通知只给真上限（原粹 200、浓缩 5），须臾、脆弱只写数字 |
| 4.11 | `60731ab` | 新增 `closeReplenishDialog()`；通知统一排在回主界面之后 |
| 4.12 | `ffcb0ed` | 关弹窗去掉 OCR 验证，ESC 一下即走（实测稳定） |
| 5.0 | `6966d52` | 整理为独立脚本：清理 `main.js` 头部注释（约束移入 README 与本目录记忆），新增 `README.md`，清单更名为「树脂统计（OCR）」 |
| 5.1 | `70edef8` | ④ 增加须臾有效期解析（`N天后过期`），通知显示 `1（9天）`，不足 3 天追加提醒行 |
| 5.2 | `ce18ac1` | 提醒文案前后加「！！！」 |
| 5.3 | `89538df` | 有效期改扫窄带 `DIALOG_DESC`（整屏 → 3% 面积），兜底复用已有整屏 OCR，不再额外多一次全屏识别 |
| 5.4 | `3a4e85b` | 取消窄带：有效期直接复用整屏 OCR（与须臾数字同屏），删除 `RATIO.DIALOG_DESC`；`readReplenishDialog()` 不再返回 `lastItems` |
| 5.5 | `7cd4b91` | 删除 `OCR_CONFUSABLE` 与 quality 三档：`extractNumberFromText()` 只认纯数字（全角转半角 + 斜杠前段 + 只留数字），排序分改为纯位置契合 |
| 5.6 | `47431f9` | 脆弱改走整屏 OCR（关键字「脆弱树脂」→ 同行数字 → 邻近数字），不再走图标匹配；须臾保持图标优先 |
| 5.7 | `57c96a9` | 须臾 `RESIN_LIMITS.transient` 10 → 9：游戏里正常 1~3 跳动，10 只会来自误读，顺带消除两位数隐患 |
| 5.8 | `d39f17c` | 脆弱回退到图标链（界面无「脆弱树脂」字样），数字模板兜底仅须臾启用；`pickClosestNumber()` 评分改为「到框中心距离」并兼容两种坐标基准 |
| 5.9 | `d08decd` | 删掉四种树脂的名称 OCR 匹配（`RESIN_KEYWORDS` / `findNumberByKeyword` / `KEYWORD_RADIUS` / `centerOf` / `ratioToPxWidth`），原粹只认 `x/200` 格式；`readResinCount()` 收拢为 `readOriginalCount()` |
| 5.10 | `1d5ea42` | 删除 OCR 明细采样 `dumpOcrItems()`（含两处调用）；`main.js` 注释改为单行契约式，不再当记事本 |
| 5.11 | `533a14c` | 对齐官方规范：两块模板改懒加载 `getReplenishButtonRo()` / `getCondensedIconRo()` 并在 `finally` 里释放；统一小写 API 名；全屏 OCR 用 `ocrThis`；修 `context.json` 读取（原来用了不存在的 `file.isExists`） |
| 5.12 | `7e08c5e` | 昵称改设置项：删 `readContextName()`（全局变量探测 + `context.json`）与 `CONTEXT_FILE`；`readNickname()` 只读 `settings.nickname`；`settings.json` 增 `nickname` |
| 6.0 | `22852dc` | 拆为三层：`resin.js`（工具1，`collectResin()` 返回数据、不抛异常）/ `utils.js`（工具2，常量与纯函数、模板 Mat 统一释放）/ `main.js`（入口只发通知）；函数体逐字搬迁，点击顺序、延时、重试、上限、日志与通知文案不变 |
| 6.1 | `6e55e27` | 目录调整：`resin.js` / `utils.js` 移入 `src/`（内容零改动，只改 `main.js` 的两条 import）；根目录只留 `main.js` + 三个配置文件；实现文档移入 `docs/` 随包发布并脱敏 |
