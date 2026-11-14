# VideoMask · 原神攻略视频悬浮窗

**在游戏画面上浮一个视频窗口，边玩边看；播到「该你打怪了」的地方，它自己暂停。**

![version](https://img.shields.io/badge/version-1.6.29-blue) ![platform](https://img.shields.io/badge/BetterGI-%E2%89%A5%200.50.0-brightgreen) ![license](https://img.shields.io/badge/license-MIT-black) ![platform](https://img.shields.io/badge/Windows-10%20%2F%2011-0078D6)

一个 [BetterGI](https://github.com/babalae/better-genshin-impact) 的 **JS 脚本**（不是独立程序）。
装上后，[影月月](https://space.bilibili.com/431073645) 的攻略视频直接浮在游戏上，
鼠标默认穿透给游戏，按住 `Alt` 才临时接管——不挡操作，也能随时拖进度条。

> A [BetterGI](https://github.com/babalae/better-genshin-impact) JS script that overlays a Bilibili
> walkthrough video on Genshin Impact, with auto-pause at fight timestamps. UI is in Chinese.

**文档**：[手动安装教程](https://github.com/xuan251/BetterGI-VideoMask/blob/main/手动安装教程.html) · [使用教程](https://github.com/xuan251/BetterGI-VideoMask/blob/main/使用教程.html) · [给 AI 的安装指令](https://github.com/xuan251/BetterGI-VideoMask/blob/main/给AI的安装指令.md) · [开发记录](https://github.com/xuan251/BetterGI-VideoMask/blob/main/docs/开发记录.md) · [更新日志](https://github.com/xuan251/BetterGI-VideoMask/blob/main/CHANGELOG.md)

<img src="https://raw.githubusercontent.com/xuan251/BetterGI-VideoMask/main/docs/img/demo-play.webp" width="720" alt="攻略视频浮在游戏画面上，边玩边看">

*边玩边看：视频浮在画面上，鼠标默认穿透给游戏，按住 `Alt` 才能操作它。*

<img src="https://raw.githubusercontent.com/xuan251/BetterGI-VideoMask/main/sidebar.png" width="720" alt="侧栏：地图 → 分类 → 版本 → 分P">

*四级侧栏：地图 → 分类（宝箱 / 神瞳 / 主线…）→ 版本 → 分 P。*

---

## 它能干什么

| 功能 | 说明 |
| --- | --- |
| **打怪点自动暂停** | 播到「把怪清一下」就停，你打完点继续。内置 **1526 个**预置点，不是猜的，见下文 |
| **B 站视频直链自播** | 不用下载、不用挂浏览器。能拖进度条、改倍速（0.5×~2×）、切分 P |
| **四级侧栏** | 地图 → 分类（宝箱/神瞳/主线…）→ 版本 → 分 P，一层层点进去；重开侧栏直接回到正在看的那一集 |
| **本地视频也支持** | 把 mp4 丢进 `assets/videos/`，侧栏顶部会多出「本地视频」卡片 |
| **鼠标穿透** | 默认穿透给游戏；按住 `Alt` 临时接管（拖进度条、点暂停），松开 250ms 自动还回去 |
| **不抢游戏焦点** | 启动只显示引导页，**选了地图才开播**；调完设置自动切回穿透，不影响 BetterGI 的自动剧情 |
| **跟 BGI 自带功能共存** | 自动拾取、自动剧情照常工作：BGI 跑 JS 脚本前会把它们关掉，脚本按你原本的设置再挂回来 |
| **自动记忆** | 位置、大小、透明度、音量、倍速、看到第几秒，下次启动直接接上；播完还能「看完续播」下一集 |
| **字幕 + 方向提示** | 主播在说哪句、该往哪走，直接显示在画面下方（需要填 SESSDATA，见下） |
| **顺手的小东西** | 弹幕投影、收藏夹、肝度统计、一键截图校准、分辨率自适应 |

## 30 秒装上

1. 下载 [最新 Release](../../releases/latest) 的 `VideoMask_vX.Y.Z.zip`，解压后把整个 `VideoMask` 文件夹放到
   `BetterGI\User\JsScript\VideoMask\`（放好后 `main.js` 应该正好在这一层，别多套一层）
   > 找不到目录？BetterGI → **全自动 → JS 脚本 → 「打开脚本目录」**，让它自己弹给你。
2. **全自动 → 调度器 → 通用设置**，勾上 **「启用 JS HTTP 权限」**，勾完**重启 BetterGI**
   （侧栏、弹幕、字幕都要用它。不重启会出现"能播但侧栏空白"）
3. 顺便在调度器里 **新增配置组** → 选中它 → **添加 → JS 脚本 → 视频悬浮窗**，这样能进一条龙
4. 在调度器里运行「视频悬浮窗」
5. 按 `Insert` 把鼠标要回来 → 点工具栏 `☰` 开侧栏 → 地图 → 分类 → 版本 → 分 P

> 卡在某一步？直接看下面这份图解教程，每步都写了「怎么验证做对了」。

## 文档

| 想看什么 | 看这个 |
| --- | --- |
| **第一次装，想照着一步步点** | [`手动安装教程.html`](https://github.com/xuan251/BetterGI-VideoMask/blob/main/手动安装教程.html)<br>12 步，每步带 BGI 界面示意图和验证方法，末尾还有 5 条装完自检 + 6 类故障对照（找不到脚本、侧栏空白、双击没反应…） |
| **装好了，想学会怎么用** | [`使用教程.html`](https://github.com/xuan251/BetterGI-VideoMask/blob/main/使用教程.html)<br>选片、热键、打怪点、加自己的 mp4、卡住了怎么办 |
| **懒得动手，让 AI 装** | [`给AI的安装指令.md`](https://github.com/xuan251/BetterGI-VideoMask/blob/main/给AI的安装指令.md)<br>整份发给你自己的 AI 助手，它会找目录、复制文件、改配置、逐项校验 |
| **想知道原理 / 踩过哪些坑** | [`docs/开发记录.md`](https://github.com/xuan251/BetterGI-VideoMask/blob/main/docs/开发记录.md) |
| **每个版本改了什么** | [`CHANGELOG.md`](https://github.com/xuan251/BetterGI-VideoMask/blob/main/CHANGELOG.md) |

> GitHub 网页版不会渲染 `.html` 文件（点开后看到的是源码，不是排版好的教程）。
> 两份 HTML 教程请从 [最新 Release](../../releases/latest) 下载压缩包，解压后**双击用浏览器打开**。

<img src="https://raw.githubusercontent.com/xuan251/BetterGI-VideoMask/main/docs/img/demo-first.webp" width="720" alt="第一次启动：半透明引导页 → 打开节目单 → 地图 → 分类 → 版本 → 分P">

*第一次启动只有一张引导页，选过一集之后就记住了——以后启动直接接着上次那一集播。*

## 热键（都能在浮窗里改）

| 按键 | 作用 |
| --- | --- |
| `~` | 播放 / 暂停（全局生效，游戏有焦点也管用） |
| `Insert` | 缩放模式开关（拖动画面、拉四角改尺寸），再按一下退出 |
| 按住 `Alt` | 临时接管鼠标：拖进度条、点按钮；松开自动还给游戏 |
| `End` | 开 / 关 B 站登录窗 |
| 侧栏 `键` | 快退快进、透明度、上/下集……想绑什么绑什么 |

> 为什么播放/暂停是 `~` 而不是 F9：原神的 `F1`~`F8` 全占了，BGI 用 `F11`，浏览器抢 `F10` `F12` `F5` `F3`，
> 而很多笔记本的 `F9` 是亮度键、按下去先被系统吃掉。

## 1526 个打怪点是怎么来的

不是手标的，也不是让 AI 现场猜的：

1. 把 UP 主全集 **566 集 / 4950 分钟** 的音频下下来（574 个分 P，全转写完成）；
2. `faster-whisper` 转写 → 从字幕里筛出「把怪清一下」这类指令 → 建语料；
3. 统计「说完某类话，之后 35 秒内是否真的开打」，得到一张概率表：
   镇守宝箱 **82%**、裸宝箱 **14%**、限时挑战 **7%**——所以"宝箱"不等于"要打架"；
4. 按概率和时间窗生成时间表，回填进脚本。

评测（留出集）：**精确率 96.1% / 召回率 100%**，最终 1526 个点（打怪 1356 + 看完再停 170）。

顺带一提，「限时挑战 / 打 boss」这种是**看完再停**，不是立刻停——不然你连要打什么都不知道。

## 常见问题（挑几个最容易踩的）

**开了浮窗，BetterGI 的自动拾取 / 自动剧情就不动了？**

两个原因，第一个 v1.6.29 已经在脚本里解决：

1. **BGI 跑 JS 脚本前会把它自己的实时触发全部关掉。** 这是 BGI 的设计，官方 FAQ 原话是
   「你在实时触发里的所有配置都会在 JS 脚本运行前关闭……除非 JS 作者在代码中开启」。
   所以不是"两个功能打架"，是自动拾取/自动剧情压根没启动。
   现在脚本会用 `dispatcher.addTrigger` 按你在 BGI 里**原本的设置**把它们挂回来——
   BGI 里本来就关着的不会被强行打开，设置面板里也能单独关掉这项代管。
2. **抢前台焦点。** 浮窗"可交互"时游戏会失焦，BGI 在没开「后台运行」的情况下点不到游戏。
   v1.6.27 已把两个主要触发从源头掐掉（启动后可拖动秒数默认 0、悬停热区默认关）。
   还不行就：`Insert` 切回穿透，或去 BGI 设置开「**后台运行**」（最彻底）。

另外：这些功能靠截图识别，浮窗如果正好压在**拾取提示**或**对话选项**上，识别区域被视频挡住就会失效。
把窗口挪到画面边角，或在 BGI 启动页把截图方式换成 **WindowsGraphicsCapture**
（只截游戏窗口内容，不把浮窗算进去）。

**装完了，BGI 的脚本列表里找不到「视频悬浮窗」？**

九成是两个原因：一是**多套了一层文件夹**（`main.js` 必须正好在 `VideoMask\` 这一层，
不能是 `VideoMask\VideoMask\main.js`）；二是没刷新脚本列表。逐项自查和 6 类故障对照都在
[`手动安装教程.html`](https://github.com/xuan251/BetterGI-VideoMask/blob/main/手动安装教程.html) 第 4 章和第 10 章。

**一直转圈 / 黑屏？**
取地址 12 秒、起播 25 秒都会超时，画面会直接告诉你原因并给「重试」按钮，不用干等。
提示里写「JS HTTP 权限」就回去勾上。

**字幕是空的？**
B 站 AI 字幕接口匿名返回空，必须填 `SESSDATA`（浏览器登录 B 站 → F12 → Cookie → 复制 `SESSDATA` 的值）。
⚠️ `SESSDATA` 等于你的登录凭证，**只填在自己的 BGI 配置里，别发给任何人**。

**暂停太频繁？**
设置里「暂停点最小间隔」默认 20 秒，改成 30~45 会少停很多；填 0 则不合并。

更多问题（登录、清晰度、缓冲、窗口模式、配置项逐条解释）见
[docs/开发记录.md](https://github.com/xuan251/BetterGI-VideoMask/blob/main/docs/开发记录.md) 和 [`使用教程.html`](https://github.com/xuan251/BetterGI-VideoMask/blob/main/使用教程.html)。

## 仓库结构

```
main.js                 脚本主体（暂停点时间表内嵌在里面）
manifest.json           BGI 清单：版本、HTTP 白名单
settings.json           设置面板的字段定义
assets/player.html      播放器界面（WebView 里跑）
assets/videos/          放你自己的 mp4（默认空）
assets/calib/           截图校准放这里
assets/combat/          战斗检测模板说明
使用教程.html            图解版教程（下载后双击打开）
手动安装教程.html        12 步图解安装（不想让 AI 动自己电脑的看这份）
给AI的安装指令.md         喂给 AI、让它自己装的那份
先看我.txt               解压后第一眼看到的短说明
docs/开发记录.md         实现原理 / 设计取舍 / 踩过的坑
CHANGELOG.md            每个版本改了什么
index.html              文档站入口页（GitHub Pages 用，装脚本时用不到）
```

## 更新日志

见 [CHANGELOG.md](https://github.com/xuan251/BetterGI-VideoMask/blob/main/CHANGELOG.md)。

## 免责声明

- 本仓库**不包含任何视频内容**。视频来自 B 站，版权归原作者（攻略内容出自 UP 主
  [影月月](https://space.bilibili.com/431073645)），脚本只是把公开视频**嵌到浮窗里播放**，
  不下载、不转存、不二次分发。上面两张动图是作者的操作录屏，画面里带到了游戏和攻略视频，
  仅用于展示功能。
- 内置的「打怪点」是**从公开字幕统计出来的时间戳索引**（几点几分该停），不含任何画面或文字原文。
- 本项目与米哈游 / HoYoverse、B 站、BetterGI 官方**均无关联**，属第三方个人作品。
  使用本脚本时请遵守游戏与平台的服务条款，风险自负。
- 通过 `SESSDATA` 使用的登录态只保存在**你自己的** BetterGI 配置里，脚本不上传、不回传任何数据。

## 许可

代码以 [MIT](LICENSE) 协议开源，随便用、随便改，保留版权声明即可。
如果你基于它做了二次分发，希望你也开源——但不是强制的。

## 致谢

- [BetterGI](https://github.com/babalae/better-genshin-impact)：没有它的 JS 脚本 API 和 `htmlMask`，
  这东西根本做不出来；
- [影月月](https://space.bilibili.com/431073645)：攻略视频与字幕，整套暂停点数据的来源；
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)：574 个分 P 的字幕就是它转出来的。
