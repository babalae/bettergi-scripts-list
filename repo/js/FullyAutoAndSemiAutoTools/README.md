# FullyAutoAndSemiAutoTools  
**全自动 + 半自动路径任务工具箱**  
BetterGI 平台下功能最全面的路径批量执行解决方案之一

## 项目概述

FullyAutoAndSemiAutoTools 是一套高度模块化、可高度自定义的自动化路径执行工具箱，主要用于原神（BetterGI平台）的日常、周常、素材收集等重复性任务自动化。

支持**全自动**与**半自动**两种运行模式，核心目标包括：

- 智能扫描 & 多层级管理大量路径文件
- 精细的冷却时间控制（小时制 + Cron）
- 根据路径特性自动切换战斗/元素队伍
- 集成丰富的实时辅助功能
- 执行记录防重复 + 择优优先未完成路径
- 支持黑白名单、多 UID 隔离记录

### 核心亮点

- 路径树状扫描 + 多级加载（默认2级，可调）
- 小时制 & Cron 双冷却系统（支持外部 HTTP API）
- 智能队伍切换（战斗/七元素）
- 实时任务：自动对话跳过、自动拾取、自动战斗
- 择优执行 + 执行记录 + 错误路径追踪
- 半自动快捷键干预（继续/跳过）
- 开发者模式 + 详细日志 + UID自动识别

## 文件结构一览

```
FullyAutoAndSemiAutoTools/
├── config/
│   ├── SevenElement.json       # 七元素路径→队伍映射
│   ├── cd-pathing.json         # 路径冷却规则（hours/cron）
│   ├── record.json             # 本次执行记录
│   ├── PathRecord.json         # 历史路径执行记录
│   └── uidSettings.json        # 用户配置快照（多UID支持）
├── utils/
│   ├── SwitchTeam.js           # 队伍切换核心
│   ├── cron.js                 # Cron 解析工具
│   └── uid.js                  # UID 识别模块
├── pathing/                    # ★ 所有路径文件目录（需符号链接）
├── SymLink.bat                 # 一键创建 pathing 链接
├── main.js                     # 主程序入口
├── manifest.json               # 脚本元信息 & 版本标识
└── settings.json               # 配置模板（用户界面依据）
```

## 核心流程图
### 1
```mermaid
graph TD
    A[启动脚本] --> B[初始化<br>配置/工具/记录/密钥检查]

    B --> C{运行模式?}

    C -->|刷新配置| D[扫描 pathing 目录<br>构建树状结构<br>生成多选配置项<br>应用黑白名单]
    D --> E[保存用户配置<br>到 uidSettings.json]

    C -->|加载配置| F[读取 uidSettings.json<br>恢复上次选择 & 记录]

    C -->|开始执行| G[核心执行流程]

    subgraph 核心执行流程
    G --> H[读取 CD 配置<br>加载执行记录]
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

    style A fill:#e3f2fd,stroke:#1976d2
    style G fill:#f3e5f5,stroke:#7b1fa2
    style AE fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
```
### 2
```mermaid
sequenceDiagram
    participant U as 用户
    participant S as 脚本设置界面
    participant Init as 初始化模块
    participant Scan as 路径扫描
    participant CD as 冷却检查
    participant Exec as 执行引擎
    participant RT as 实时任务
    participant Team as 队伍切换
    participant Path as 路径执行
    participant Record as 记录系统

    U->>S: 启动脚本 → 选择模式

    alt 模式 = 刷新配置
        S->>Scan: 扫描 pathing 目录
        Scan-->>S: 返回树状结构 & 文件列表
        S->>S: 生成多选配置项<br>应用黑白名单过滤
        S-->>U: 显示配置界面供勾选
        U->>S: 保存配置
        S->>Record: 写入 uidSettings.json
    else 模式 = 加载配置
        S->>Record: 读取 uidSettings.json
        Record-->>S: 返回上次配置 & 路径选择
        S-->>U: 恢复配置界面
    else 模式 = 执行
        S->>Init: 开始执行
        Init->>Record: 加载历史记录(record & PathRecord)
        Init->>CD: 读取 cd-pathing.json
        CD-->>Init: 返回冷却状态

        loop 遍历所有勾选路径组
            Init->>CD: 检查当前组是否在CD中
            alt 仍在CD
                CD-->>Init: 跳过该组
            else 可执行
                CD-->>Init: 允许执行
                Init->>RT: 启动实时任务<br>(自动对话/拾取/战斗)
                RT-->>Init: 实时任务就绪

                alt 择优模式开启
                    Init->>Record: 查询未跑/最久未跑路径
                    Record-->>Init: 返回优先队列
                end

                loop 遍历路径组内的单条路径
                    Init->>Exec: 准备执行单条路径
                    Exec->>Record: 检查是否已跑过
                    alt 已跑过
                        Record-->>Exec: 跳过
                    else 未跑过
                        Exec->>Team: 检查战斗/元素需求
                        alt 需要战斗
                            Team->>Team: 切换战斗队伍(team_fight)
                        else 需要特定元素
                            Team->>Team: 切换七元素队伍
                        else 无特殊需求
                            Team-->>Exec: 使用当前队伍
                        end

                        Team-->>Exec: 队伍已就位
                        Exec->>Path: 执行路径脚本<br>pathingScript.runFile()
                        Path-->>Exec: 路径执行完成/异常

                        alt 半自动模式
                            Exec->>U: 暂停等待快捷键(继续/跳过)
                            U-->>Exec: 按键响应
                        end

                        Exec->>Record: 记录执行结果<br>(成功/失败/时间戳)
                    end
                end
            end
        end

        Exec->>Record: 保存最终记录
        Record-->>S: 执行完成
        S-->>U: 显示执行完毕
    end
```


## 重要配置项一览（settings.json）

| 配置项                  | 类型       | 主要作用                               | 推荐默认/示例              |
|-------------------------|------------|----------------------------------------|----------------------------|
| config_run              | 下拉       | 运行模式：刷新 / 加载 / 执行           | 刷新 → 首次，加载 → 日常   |
| loading_level           | 文本       | 路径层级深度（≥1）                     | 2 或 3                     |
| config_white_list       | 文本       | 白名单（逗号分隔）                     | 晶蝶,特产                  |
| config_black_list       | 文本       | 黑名单（优先级更高）                   | 其他,锄地专区,周本         |
| open_cd                 | 复选框     | 启用冷却控制                           | 建议开启                   |
| http_api                | 文本       | Cron 解析服务地址                      | http://127.0.0.1:port/...  |
| real_time_missions      | 多选       | 实时辅助（对话/战斗/拾取）             | 至少开「自动拾取」         |
| choose_best             | 复选框     | 择优模式（优先未跑/最久未跑路径）      | 推荐开启                   |
| mode                    | 下拉       | 全自动 / 半自动                        | 全自动（日常）             |
| auto_semi_key_mode      | 下拉       | 半自动快捷键行为（继续/跳过）          | 继续运行                   |
| auto_key                | 文本       | 半自动干预快捷键                       | F10 / F11（避免冲突）      |
| team_fight              | 文本       | 战斗/通用行走队伍名称                  | 必须填写                   |
| team_seven_elements     | 文本       | 七元素队伍（矿物,火,水,风,雷,草,冰,岩）| 按顺序填写                 |
| is_debug                | 复选框     | 开发者模式（详细日志）                 | 调试时开启                 |

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
    "name": "矿物",
    "type": "cron",
    "level": 1,
    "value": "0 0 0 1/3 * ?"
  },
  {
    "name": "周本",
    "type": "hours",
    "level": 3,
    "value": 168
  }
]
```

## 推荐使用流程

1. **首次准备**  
   双击 `SymLink.bat` 创建 pathing 链接  
   将所有 .json 路径文件放入 pathing 或子目录

2. **第一次完整配置**（建议花 5–10 分钟）  
   → 选择「**刷新**」模式 → 执行  
   → 设置白/黑名单、队伍、CD规则、实时任务、执行模式等  
   → 保存（自动生成 uidSettings.json）

3. **日常执行**（最常用方式）  
   → 打开设置 → 选择「**加载**」模式 → 执行  
   → 微调本次要跑的路径组  
   → 切换到「**执行**」模式 → 一键启动

4. **半自动模式建议**  
   mode = 半自动  
   设置不常用快捷键（推荐 F10/F11）  
   路径完成后暂停，等待按键决定继续或跳过

## 小技巧与实用建议

- 最省事：全自动 + 择优模式 + 自动拾取 + 冷却控制
- 最安全：半自动 + 自动拾取 + 详细日志 + 大量黑名单
- 每1–2周建议执行一次「刷新」同步新路径
- 错误路径反复出现？查看 record.json 加黑名单或修复
- 多UID用户：每个号先「刷新」一次，建立独立配置

## 注意事项

- 需要战斗的路径建议在描述中写「请配置好战斗策略」或放在战斗相关目录
- 半自动模式请确保快捷键不与 BetterGI 冲突
- Cron 模式需要网络正常并正确配置 http_api 地址
- 记录文件自动保存，支持断点续跑与多UID隔离
- 最低兼容版本：BetterGI 0.54.3+

## 版本密钥
| 版本    | 密钥        |
|:------|:----------|
| 0.0.1 | PGCSBY37NJ|

## 版本历史
### 0.0.1 (2026-01-05)
 - 基础功能已完成


**作者**：云端客 (Kirito520Asuna)

祝你使用愉快，素材永远收不完～✨
