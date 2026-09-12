# 采集 CD 管理路线工具

这是一个独立的 Windows 桌面工具，用于维护 `采集cd管理` 的路线文件、简单 Schedule 和子 JS。界面采用 WPF + WebView2，文件选择、校验和写入均由 C# 后端完成；HTML 页面不直接访问文件系统。

## 运行要求

- Windows 10/11
- .NET 8 Desktop Runtime
- Microsoft Edge WebView2 Runtime

开发构建：

```powershell
dotnet build .\CollectCdRouteTool.csproj -c Release
```

构建产物位于 `bin/Release/net8.0-windows/`。

生成可分发的 win-x64 单文件 EXE 和 ZIP，可以直接双击 `build.bat`。用于自动化构建时可跳过末尾暂停：

```bat
build.bat --no-pause
```

打包产物位于 `output/`。ZIP 只包含单文件 EXE；目标机器仍需安装 .NET 8 Desktop Runtime 和 WebView2 Runtime。

## 命令行更新

需要由脚本或计划任务自动分发路线时，可以使用无界面模式：

```powershell
& '.\bin\Release\net8.0-windows\采集cd管理路线工具.exe' --sync-all 'C:\路径\采集cd管理'
```

该模式不会创建 WPF 或 WebView2 窗口，只读取目标目录中已经保存的 `route-manager/mappings.json`，清空并重建全部路径组及各组 `route-index.json`，然后自动退出。

| 退出码 | 含义 |
|---:|---|
| `0` | 全部更新成功 |
| `1` | 目标目录、映射或源文件校验失败，未完成更新 |
| `2` | 命令行参数格式错误 |

无参数启动时仍进入图形界面。命令行模式必须显式提供目标文件夹，不会读取 WebView2 的 `localStorage` 缓存。

## 使用流程

1. 启动工具，选择 `采集cd管理` 脚本文件夹。工具会校验 `manifest.json`、`main.js` 和 `settings.json`。
2. 在“路径组编辑”中新增路径组。路径组名称同时就是 `pathing` 下的一级文件夹名称，不再单独配置显示名称。添加路线源目录后，在内置浏览器中设置文件夹和路线文件的“选择 / 禁用”规则；也可以添加 Schedule 文件映射。
3. 点击“保存并重建当前路径组”，或使用右侧按钮保存并重建全部路径组。
4. 需要生成 Schedule 时，在“Schedule 编辑”中选择子 JS 文件夹，设置参数后保存。
5. 将保存于 `schedules/` 的 Schedule 作为映射加入路径组，再执行路径组更新。

页面的 `localStorage` 只记录最后一次选择的 `采集cd管理` 路径。映射规则保存在目标脚本自己的 `route-manager/mappings.json` 中。

## 路径组映射

- 添加文件夹映射时，先使用 Windows 文件夹选择器指定一个源根目录，再通过工具内的单目录浏览器选择其中的路线 `.json` 文件。浏览器每次只显示当前文件夹及其直接子项，可使用返回上级或顶部路径导航。
- 源根目录、子文件夹和路线文件都可以设置“选择”或“禁用”。文件自身没有显式规则时会逐级向上查找，以距离最近的规则决定是否参与；始终没有规则的文件不参与。新建映射和更换源目录后默认不选择任何内容。
- 文件夹映射可以指定目标子目录，入选文件会保留其相对于源根目录的目录结构。
- Schedule 映射只处理一个现有 `.json` 文件，可指定目标文件名或相对路径。
- “刷新状态”只重新扫描源文件和实际输出，不会丢弃当前未保存的规则。
- 路径组状态统一为“未保存、源失效、待重建、已是最新”；重建预览只显示将写入、将覆盖和将删除的文件。
- 同步按路径组中的映射顺序处理；多个映射指向同一目标时，后面的映射覆盖前面的映射。
- 更新路径组时会先清空对应的 `pathing/<路径组>/`，再完全按当前映射重建；原目录中的未受管文件和手工修改都会被清除或覆盖。
- 存在失效的源目录或 Schedule 时不会开始重建。删除路径组时会同时删除其映射配置、同步状态和对应的 `pathing/<路径组>/` 文件夹。

配置文件：

```text
route-manager/
└─ mappings.json
```

旧版本生成的 `sync-state.json` 不再参与状态判断，打开目标脚本时会自动移除。

每次成功更新路径组后，还会在该组根目录生成 `route-index.json`。它只声明实际 JSON 文件的相对路径和 `info.description`，不包含路线正文，也不会被 `采集cd管理` 当作路线执行。

## Schedule 编辑

工具只生成一个同步 `start` 动作和一个 JS 任务的简单 Schedule，不提供通用 Schedule 编排。

- 子 JS 文件夹必须包含有效的 `manifest.json` 和入口文件。
- 支持读取 `settings.json` 中的 `input-text`、`checkbox`、`select`、`multi-checkbox` 和 `separator`。
- 保存时会完整复制子 JS 到 `subJs/_managed/<脚本名-源路径哈希>/`。
- Schedule 源文件只能保存到 `schedules/`；支持打开已有的简单 Schedule、保存和另存为。
- `schedules/` 中的文件不会自动执行，必须先作为 Schedule 映射同步到某个 `pathing/<路径组>/`。

目标脚本的 `manifest.saved_files` 需要包含：

```json
[
  "pathing/",
  "subJs/",
  "schedules/",
  "route-manager/"
]
```

`settings.json` 是随脚本分发的静态配置定义，不需要作为运行数据保留。
