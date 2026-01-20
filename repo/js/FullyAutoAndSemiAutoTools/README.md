# FullyAutoAndSemiAutoTools

**全自动 + 半自动路径任务工具箱**  
BetterGI 平台下功能最全面的路径批量执行解决方案之一

## 项目概述

FullyAutoAndSemiAutoTools 是一套高度模块化、可高度自定义的自动化路径执行工具箱，主要用于原神（BetterGI平台）的日常、周常、素材收集等重复性任务自动化。

支持**全自动**与**半自动**两种运行模式，核心目标包括：

- 智能扫描 & 多层级管理大量路径文件（支持任意深度目录结构）
- 精细的冷却时间控制（小时制 + Cron，需要外部解析服务）
- 根据路径特性自动切换战斗/元素队伍
- 集成丰富的实时辅助功能
- 执行记录防重复 + 择优优先未完成路径
- 支持黑白名单、多 UID 隔离记录与路径缓存

### 核心亮点（最新版）

- **路径扫描全面重构**：支持任意层级目录，父子关系清晰，性能稳定
- **按 UID 缓存路径列表**（`path-json-by-uid.json`），多账号切换极快
- 小时制 & Cron 双冷却系统（需搭配 bettergi-scripts-tools）
- 智能队伍切换（战斗/七元素）
- 实时任务：自动对话跳过、自动拾取、自动战斗
- 择优执行 + 执行记录 + 错误路径追踪
- 半自动快捷键干预（继续/跳过）
- 开发者模式 + 详细日志 + UID自动识别

## 文件结构一览

```
FullyAutoAndSemiAutoTools/
├── config/
│   ├── SevenElement.json           # 七元素路径→队伍映射
│   ├── cd-pathing.json             # 路径冷却规则（hours/cron）
│   ├── record.json                 # 本次执行记录
│   ├── PathRecord.json             # 历史路径执行记录
│   ├── uidSettings.json            # 用户配置快照（多UID支持）
│   ├── path-json-by-uid.json       # 按UID缓存的路径JSON列表
│   └── RefreshSettings.json        # 刷新配置缓存（可选）
├── utils/
│   ├── SwitchTeam.js               # 队伍切换核心
│   ├── cron.js                     # Cron 解析工具
│   └── uid.js                      # UID 识别模块
├── pathing/                        # ★ 所有路径文件目录（需符号链接）
├── SymLink.bat                     # 一键创建 pathing 链接
├── main.js                         # 主程序入口（已重构路径扫描）
├── manifest.json                   # 脚本元信息 & 版本标识
└── settings.json                   # 配置模板（用户界面依据）
```

## 核心流程图

### 1. 整体流程图（graph TD 风格，适合看结构与分支）

```mermaid
graph TD
    A[启动脚本] --> B[初始化<br>配置/工具/记录/密钥检查]
    B --> C{运行模式?}
    C -->|刷新配置| D[扫描 pathing 目录<br>构建树状结构<br>生成多选配置项<br>应用黑白名单]
    D --> E[保存用户配置<br>到 uidSettings.json + path-json-by-uid.json]
    C -->|加载配置| F[读取 uidSettings.json & path-json-by-uid.json<br>快速恢复上次选择 & 路径缓存]
    C -->|开始执行| G[核心执行流程]

    subgraph 核心执行流程
        G --> H[读取 CD 配置<br>加载执行记录 & UID路径缓存]
        H --> I[构建 needRunMap<br>遍历路径组 & 过滤]
        I --> J{CD 检查<br>hours/cron}
        J -->|仍在CD| K[移除该路径]
        J -->|可执行| L[加入执行队列]
        L --> M[启动实时任务<br>自动对话/拾取/战斗]
        M --> N{择优模式?}
        N -->|开启| O[优先从未跑过/最久未跑的路径]
        N -->|关闭| P[按顺序执行]
        O --> P
        P --> Q[遍历路径组]
        Q --> R[遍历单条路径]
        R --> S{已跑过?}
        S -->|是| T[跳过 & 记录日志]
        S -->|否| U{需要战斗?}
        U -->|是| V[切换战斗队伍]
        U -->|否| W{需要特定元素?}
        W -->|是| X[切换七元素队伍]
        W -->|否| Y[直接执行路径]
        V --> Y
        X --> Y
        Y --> Z{半自动模式?}
        Z -->|是| AA[等待快捷键<br>继续/跳过]
        Z -->|否| AB[正常完成]
        AA --> AB
        AB --> AC[记录执行结果<br>成功/失败/时间戳]
        AC --> AD{还有剩余路径?}
        AD -->|是| R
        AD -->|否| AE[保存最终记录<br>结束本次执行]
    end

    style A fill: #e3f2fd, stroke: #1976d2
    style G fill: #f3e5f5, stroke: #7b1fa2
    style AE fill: #c8e6c9, stroke: #2e7d32, stroke-width: 3px
```

### 2. 执行时序图（sequenceDiagram 风格，适合看交互顺序）

```mermaid
sequenceDiagram
    participant U as 用户
    participant S as 脚本设置界面
    participant Init as 初始化模块
    participant Scan as 路径扫描（重构版）
    participant CD as 冷却检查
    participant Exec as 执行引擎
    participant RT as 实时任务
    participant Team as 队伍切换
    participant Path as 路径执行
    participant Record as 记录系统
    U ->> S: 启动脚本 → 选择模式

    alt 模式 = 刷新配置
        S ->> Scan: 扫描 pathing 目录（支持任意深度）
        Scan -->> S: 返回完整树状结构 & 文件列表
        S ->> S: 生成多选配置项<br>应用黑白名单精确过滤（Set优化）
        S -->> U: 显示配置界面供勾选
        U ->> S: 保存配置
        S ->> Record: 写入 uidSettings.json + path-json-by-uid.json
    else 模式 = 加载配置
        S ->> Record: 读取 uidSettings.json & path-json-by-uid.json
        Record -->> S: 返回上次配置 & 缓存路径列表
        S -->> U: 快速恢复配置界面
    else 模式 = 执行
        S ->> Init: 开始执行
        Init ->> Record: 加载历史记录 & UID路径缓存
        Init ->> CD: 读取 cd-pathing.json
        CD -->> Init: 返回冷却状态

        loop 遍历所有勾选路径组
            Init ->> CD: 检查当前组是否在CD中
            alt 仍在CD
                CD -->> Init: 跳过该组
            else 可执行
                CD -->> Init: 允许执行
                Init ->> RT: 启动实时任务<br>(自动对话/拾取/战斗)
                RT -->> Init: 实时任务就绪

                alt 择优模式开启
                    Init ->> Record: 查询未跑/最久未跑路径
                    Record -->> Init: 返回优先队列
                end

                loop 遍历路径组内的单条路径
                    Init ->> Exec: 准备执行单条路径
                    Exec ->> Record: 检查是否已跑过
                    alt 已跑过
                        Record -->> Exec: 跳过
                    else 未跑过
                        Exec ->> Team: 检查战斗/元素需求
                        alt 需要战斗
                            Team ->> Team: 切换战斗队伍(team_fight)
                        else 需要特定元素
                            Team ->> Team: 切换七元素队伍
                        else 无特殊需求
                            Team -->> Exec: 使用当前队伍
                        end

                        Team -->> Exec: 队伍已就位
                        Exec ->> Path: 执行路径脚本<br>pathingScript.runFile()
                        Path -->> Exec: 路径执行完成/异常

                        alt 半自动模式
                            Exec ->> U: 暂停等待快捷键(继续/跳过)
                            U -->> Exec: 按键响应
                        end

                        Exec ->> Record: 记录执行结果<br>(成功/失败/时间戳)
                    end
                end
            end
        end

        Exec ->> Record: 保存最终记录
        Record -->> S: 执行完成
        S -->> U: 显示执行完毕
    end
```

## 重要配置项一览（settings.json）

| 配置项                 | 类型  | 主要作用                                                        | 推荐默认/示例                                    |
|---------------------|-----|-------------------------------------------------------------|--------------------------------------------|
| config_uid          | 复选框 | 当前配置uid:{无}(仅仅显示配置uid无其他作用)                                 | xxx                                        |
| key                 | 文本  | 脚本密钥                                                        | xxx                                        |
| config_run          | 下拉  | 运行模式：刷新 / 加载 / 执行                                           | 刷新 → 首次，加载 → 日常                            |
| refresh_record      | 复选框 | 配置模式-刷新-清空运行记录                                              |                                            |
| refresh_record_mode | 下拉  | 清空运行记录模式 全部                                                 | UID                                        |                                            |
| loading_level       | 文本  | 路径层级深度（≥1，实际支持更高深度）                                         | 2 或 3                                      |
| order_rules         | 文本  | 执行顺序规则（可留空）<br>语法：父文件夹名称->文件夹名称=顺序整数,...<br>示例：食材与炼金->晶蝶=1, | ""（默认按扫描顺序）或 "食材与炼金->晶蝶=1,pathing->地方特产=2" |
| config_white_list   | 文本  | 白名单（逗号分隔）                                                   | 晶蝶,特产                                      |
| config_black_list   | 文本  | 黑名单（优先级更高）                                                  | 其他,锄地专区,周本                                 |
| open_cd             | 复选框 | 启用冷却控制                                                      | 建议开启                                       |
| http_api            | 文本  | Cron 解析服务地址                                                 | http://127.0.0.1:8081/...                  |
| real_time_missions  | 多选  | 实时辅助（对话/战斗/拾取）                                              | 至少开「自动拾取」                                  |
| choose_best         | 复选框 | 择优模式（优先未跑/最久未跑路径）                                           | 推荐开启                                       |
| mode                | 下拉  | 全自动 / 半自动                                                   | 全自动（日常）                                    |
| auto_semi_key_mode  | 下拉  | 半自动快捷键行为（继续/跳过）                                             | 继续运行                                       |
| auto_key            | 文本  | 半自动干预快捷键                                                    | F10 / F11（避免冲突）                            |
| team_fight          | 文本  | 战斗/通用行走队伍名称                                                 | 必须填写                                       |
| team_hoe_ground     | 文本  | 锄地特化队伍配置（语法：父文件夹->子文件夹=队伍名,...）                             | 敌人与魔物->蕈兽=蕈兽队                              |
| team_seven_elements | 文本  | 七元素队伍（矿物,火,水,风,雷,草,冰,岩）                                     | 按顺序填写                                      |
| is_debug            | 复选框 | 开发者模式（详细日志）                                                 | 调试时开启                                      |
## 语法说明
- order_rules 执行顺序规则
    1. `rootName` 根目录下层文件夹名称，`parentName` 父目录名称，`name` 文件夹名称
    2. 建议语法：`rootName->parentName->name=1,rootName->parentName->name2=2`
    3. `rootName=parentName`时 语法`rootName->parentName->name=1`不可用， 请使用 `parentName->name=1` 语法
    4. `rootName->name=1` 语法不支持, `name=1`语法支持
    5. 匹配精度：`rootName->parentName->name` > `parentName->name`>  `name` > 默认顺序 
- team_hoe_ground 锄地特化队伍配置
    1. `rootName` 根目录下层文件夹名称，`parentName` 父目录名称，`name` 文件夹名称
    2. 建议语法：`rootName->parentName->name=队伍名,rootName->parentName->name2=队伍名`
    3. `rootName=parentName`时 语法`rootName->parentName->name=队伍名`不可用， 请使用 `parentName->name=队伍名` 语法
    4. `rootName->name=队伍名` 语法不支持, `name=队伍名`语法支持
    5. 匹配精度：`rootName->parentName->name` > `parentName->name`>  `name` > 默认顺序
## (可选)额外json配置

### 配置项order_rules

路径:config/PathOrder.json

```json
[
  {
    "uid": "",
    //账号UID
    "root_name": "",
    //根文件夹下对应的文件夹名称
    "parent_name": "",
    //父文件夹名称
    "name": "",
    //文件夹名称
    "order": 0
    //顺序
  }
]
```

### 配置项team_hoe_ground

路径:config/HoeGround.json

```json
[
  {
    "uid": "",
    //账号UID
    "root_name": "",
    //根文件夹下对应的文件夹名称
    "parent_name": "",
    //父文件夹名称
    "name": "",
    //文件夹名称
    "team_name": ""
    //队伍名称
  }
]
```

## CD 规则示例（cd-pathing.json）

```json
[
  {
    "name": "晶蝶",
    "type": "hours",
    "level": 2,
    "value": 12
  },
  {
    "name": "地方特产",
    "type": "hours",
    "level": 1,
    "value": 46
  },
  {
    "name": "矿物",
    "type": "cron",
    "level": 1,
    "value": "0 0 0 1/3 * ?"
  }
]
```

## Cron 解析服务部署（必须）

**bettergi-scripts-tools** 是 Cron 解析的必要依赖，请至少选择一种方式部署：

### 1. Windows 一键运行

下载 [release](https://github.com/Kirito520Asuna/bettergi-scripts-tools/releases) 中的 windows zip 包 → 解压 → 双击 .exe
运行

### 2. Java 运行

下载 jar 包 → 执行：

```bash
java -jar bettergi-scripts-tools-xxxx.jar
```

### 3. Docker 部署

```bash
docker pull ghcr.io/kirito520asuna/bettergi-scripts-tools:latest
docker run -d -p 8081:8081 --name bettergi-scripts-tools ghcr.io/kirito520asuna/bettergi-scripts-tools:latest
```

**默认 API 地址**：`http://127.0.0.1:8081/bgi/cron/next-timestamp`

## 推荐使用流程

1. 双击 `SymLink.bat` 创建 pathing 链接
2. 首次运行强烈建议先「刷新」一次（生成 path-json-by-uid.json 缓存）
3. 日常使用「加载」模式 → 快速恢复配置 & 路径列表
4. 微调路径组 → 切换「执行」模式 → 一键启动

**多账号特别友好**：每个 UID 都有独立路径缓存，切换账号无需重复扫描

## 小技巧与实用建议

- 最省事组合：全自动 + 择优模式 + 自动拾取 + 冷却控制
- 最安全组合：半自动 + 自动拾取 + 详细日志 + 大量黑名单
- 路径目录再深也没关系，扫描已支持任意层级
- 错误路径反复出现？查看 record.json 加黑名单或修复
- 多UID用户：首次每个号都「刷新」一次，建立独立缓存

## 注意事项

- 首次使用或升级后建议删除旧 `path-json-by-uid.json` 重新生成
- 半自动模式请确保快捷键不与 BetterGI 冲突
- Cron 模式必须部署解析服务，否则冷却检查无效
- 最低兼容版本：BetterGI 0.54.3+

## 版本密钥

| 版本    | 密钥         |
|-------|------------|
| 0.0.1 | PGCSBY37NJ |

## 版本历史（简要）

### 0.0.1 2026.01.18

基本功能完成

**作者**：云端客 (Kirito520Asuna)

祝你使用愉快，素材永远收不完～✨
