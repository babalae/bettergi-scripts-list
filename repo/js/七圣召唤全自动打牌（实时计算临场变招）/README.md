[我不是牌神]

# 七圣召唤全自动打牌（实时计算临场变招）

六套七圣召唤PVE牌组，自动完成换牌、选人、重投、出牌、元素调和、技能、角色接力和回合推进。

当前版本 **2.0.0**。先按下表选牌手、导入对应牌组，再在启动配置中选择牌手。脚本每次处理一局，结束后由你手动进入下一局。

## 开局准备

- 使用 **BetterGI 0.66.0 或更新版本**，游戏语言为**简体中文**。
- 游戏客户区使用 **1920×1080、2560×1440 或 2560×1600**。开局前设定分辨率，整局保持不变；切换分辨率后先重启 BetterGI 捕获器。
- **需要比较高的画质。目前已知渲染精度至少 0.8，建议 1.0 或更高。** 过低画质会影响手牌、费用、充能和阶段图标的识别。
- 导入对应分享码，核对角色从左到右的顺序。每套的角色顺序和行动牌见下文。

## 启动一局

1. 在配置的「使用牌手」中选择本局牌组，核对完整牌手名及括号内的特色标签。
2. 手动进入挑战，停在**初始手牌、首次选人或首次掷骰**页面。
3. 启动本脚本。先看一条 **`[启动摘要]`**，核对牌手、标签、版本、时限、换牌与行动页入口配置。
4. 脚本接着自动换牌、选择首发并开始对局。运行中不要同时手动出牌或运行另一个操作脚本。
5. 出现胜负后本次运行结束。中途需要停止时，使用 BetterGI 的停止按钮或热键。

如果刚进入我方行动页且双方都还没有出牌、放技能、切人或调和，可以在配置中选择「确认新开局未行动」后启动。已进行过行动的旧局请重新开局，不从中途接管。

## 选哪套牌手

| 牌手 | 角色站位（从左到右） | 核心特色 | 适用场景 |
| --- | --- | --- | --- |
| [雷柯刻](#raiden) | 雷电将军 → 柯莱 → 刻晴 | 充能连爆 | 常规多敌 |
| [伊嘉早](#iansan) | 伊安珊 → 嘉明 → 早柚 | 全能速通 | 日常通用 |
| [月绽放](#moonbloom) | 菈乌玛 → 哥伦比娅 → 奈芙尔 | 赚骰爆发 | 集中爆发 |
| [莫早卢](#mozailu) | 莫娜 → 早柚 → 迪卢克 | 扩散清场 | 多敌对局 |
| [爱林水](#ailin) | 爱可菲 → 林尼 → 水形幻人 | 反应接力 | 通用快攻 |
| [圣骸兽](#consecrated) | 圣骸毒蝎 → 圣骸飞蛇 → 圣骸角鳄 | 单次核爆 | 高血单体 |

日常想少做选择，可以先用伊嘉早；敌人较多时试雷柯刻或莫早卢；喜欢赚骰与集中输出可选月绽放；爱林水以召唤物和角色接力打反应；高血单体可选圣骸兽蓄块爆发。

## 牌组分享码

在游戏的牌组编辑界面复制导入下列分享码，再核对后文角色顺序。雷柯刻新手版按[新手牌表](#raiden)手动配置；它与完全版都选择「雷神柯莱刻晴（充能连爆）」。

<a id="share-raiden"></a>

### 雷柯刻（完全版）

```text
AhAA8i8PASDA81gPBjCw9JcPCUBw9ZkPCVCR9qMPJWDA+OUPDpFQC+YQDrFgDPEQD+AA
```

<a id="share-iansan"></a>

### 伊嘉早

```text
H/CivxYTFGEBNkQNFKBA8oYPCCBg9I4PCEHgCJcQCYFxOzATE7IBBzMgFXFx1FcdC8AA
```

<a id="share-moonbloom"></a>

### 月绽放

```text
JUBC+WwQJGGQBn0YB6HQipcdG7GR27khIeLSHkMjDoKwOOskJHJSR0UlD+IgXvQRDyAA
```

<a id="share-mozailu"></a>

### 莫早卢

```text
AECxxEAMAZAQyU0NBBDR0UQNFKBA8oYPCCBg9JcPCUFxCDAQE4EBO1cTFbFwir8YDKAA
```

<a id="share-ailin"></a>

### 爱林水

```text
IaFRwxkPIBCy8RgPITCA85cPCUBx9DMTE7ExupMbGaIwA8YgDDJgBtEgDWER1EodFEAA
```

<a id="share-consecrated"></a>

### 圣骸兽

```text
F5ERZ3IWInAi1yUhItBR8noPFyCh9HsPF0Cw+JsPCYGwirMYC6IwB8EgDHEQCskQDKAA
```

## 安装

在 BetterGI 的「脚本仓库 → Git一键更新」中选择自定义渠道，填写发布仓库地址：

```text
https://github.com/sxy8161-debug/bettergi-tcg-scripts-release
```

更新仓库后，订阅 **「七圣召唤全自动打牌（实时计算临场变招）」**。后续使用「一键更新订阅」更新。

也可从 [Releases](https://github.com/sxy8161-debug/bettergi-tcg-scripts-release/releases) 下载 `TCGPlayerSuite.zip`，将其中的 `TCGPlayerSuite` 文件夹解压到 BetterGI 的 `User/JsScript/`，确保 `manifest.json` 直接位于该目录根部。安装这一包即可，不需要其他独立牌手、开发目录或 Node.js。已有旧六套包可以保留，运行时选择这个新入口。

## 三个配置

| 配置 | 默认值 | 如何使用 |
| --- | --- | --- |
| 使用牌手 | 雷神柯莱刻晴（充能连爆） | 按完整牌手名选择，括号显示特色；每次启动只运行所选一套 |
| 从行动阶段启动 | 禁止从行动页启动 | 仅在刚开局、双方未行动时选择「确认新开局未行动」 |
| 单局超时保护 | 15 分钟 | 可选 10、15、20、30、45 分钟，长挑战在启动前调整 |

六套均自动换牌，不需要另开换牌开关。雷柯刻按「优先装备与启动牌」留牌；其他套使用各自的起手规则。

例如选择「爱可菲林尼水形幻人（反应快攻）」、20 分钟并允许新开局行动页入口，启动日志会显示：

```text
[启动摘要] 爱可菲林尼水形幻人｜反应快攻｜版本2.0.0｜超时20分钟｜起手自动换牌｜行动页入口：确认新开局未行动
```

## 六套牌组与打法

所有牌表均为 **30 张行动牌**。对局中生成的雷楔、料理、能量块、诳言之核和后续倒计时阶段，不额外加入初始牌组。

<a id="raiden"></a>

### 雷柯刻 · 充能连爆

**角色顺序：雷电将军 → 柯莱 → 刻晴。首发雷电将军。**

[复制本套分享码](#share-raiden)

雷电将军积攒充能，用爆发为队友补能；柯莱挂草、布置猫猫秘宝，刻晴衔接激化、附魔普攻和爆发穿透。雷楔可返场释放战技。装备、充能与调和服务后续可支付的输出，残局由存活角色接力。

#### 新手版

15 种行动牌，每种 2 张。可以先手动配这一套，再逐步换成完全版；两版使用同一个「雷神柯莱刻晴（充能连爆）」配置。

| 行动牌 | 数量 |
| --- | ---: |
| 元素共鸣：交织之雷 | 2 |
| 元素共鸣：强能之雷 | 2 |
| 换班时间 | 2 |
| 交给我吧！ | 2 |
| 最好的伙伴！ | 2 |
| 运筹帷幄 | 2 |
| 星天之兆 | 2 |
| 白垩之术 | 2 |
| 莲花酥 | 2 |
| 蒙德土豆饼 | 2 |
| 甜甜花酿鸡 | 2 |
| 北地烟熏鸡 | 2 |
| 兽肉薄荷卷 | 2 |
| 赌徒的耳环 | 2 |
| 飞叶迴斜 | 2 |

#### 完全版

| 行动牌 | 数量 |
| --- | ---: |
| 元素幻变：雷草祝佑 | 1 |
| 赦免宣告 | 1 |
| 元素共鸣：交织之雷 | 2 |
| 元素共鸣：强能之雷 | 2 |
| 换班时间 | 2 |
| 交给我吧！ | 2 |
| 最好的伙伴！ | 2 |
| 一掷乾坤 | 2 |
| 运筹帷幄 | 2 |
| 星天之兆 | 1 |
| 白垩之术 | 1 |
| 本大爷还没有输！ | 2 |
| 流放者头冠 | 2 |
| 赌徒的耳环 | 2 |
| 莲花酥 | 2 |
| 北地烟熏鸡 | 1 |
| 蒙德土豆饼 | 1 |
| 飞叶迴斜 | 1 |
| 抵天雷罚 | 1 |

完全版增加雷草祝佑的减费选择、流放者补能与赦免宣告治疗。雷楔、碎霆和锐核均为生成牌。缺牌可先按组牌规则填满 30 张，未支持的牌在可靠识别后可用于调和。

<a id="iansan"></a>

### 伊嘉早 · 全能速通

**角色顺序：伊安珊 → 嘉明 → 早柚。首发按起手选择。**

[复制本套分享码](#share-iansan)

伊安珊挂雷、补增伤，嘉明打火伤和返场追击，早柚处理扩散与群体输出并提供治疗。起手寻找武器、天赋和装备启动组件，用减费、换装返骰及快速交接增加攻击机会。奇瑰之汤按当前血量与后续技能选效果。

| 行动牌 | 数量 |
| --- | ---: |
| 偷懒的新方法 | 2 |
| 狼的末路 | 2 |
| 贯月矢 | 2 |
| 赌徒的耳环 | 2 |
| 饰金之梦 | 2 |
| 黄金剧团的奖赏 | 2 |
| 灵光明烁之心 | 1 |
| 欧庇克莱歌剧院 | 2 |
| 黄金屋 | 2 |
| 运筹帷幄 | 2 |
| 琴音之诗 | 2 |
| 野猪公主 | 2 |
| 旧时庭园 | 1 |
| 「狂欢节奏」 | 2 |
| 换班时间 | 2 |
| 奇瑰之汤 | 1 |
| 纵声欢唱 | 1 |

缺牌时还支持常见治疗与减伤料理、最好的伙伴、交给我吧、星天之兆、白缨枪和铁影阔剑等替换牌。基础方向参考派大星[第三季 PVE 攻略完整转载](https://news.17173.com/content/02262026/233102589.shtml)。

<a id="moonbloom"></a>

### 月绽放 · 赚骰爆发

**角色顺序：菈乌玛 → 哥伦比娅 → 奈芙尔。**

[复制本套分享码](#share-moonbloom)

菈乌玛、哥伦比娅铺草水反应和召唤物，奈芙尔使用诳言之核接力。减费、返骰与生成牌让资源集中到连续输出，按当前费用和附着选择反应铺垫、爆发或补刀。

| 行动牌 | 数量 | 行动牌 | 数量 |
| --- | ---: | --- | ---: |
| 盈满之实 | 2 | 赌徒的耳环 | 1 |
| 「悬木人」 | 2 | 「沙中遗事」 | 1 |
| 元素幻变：绽放祝佑 | 1 | 元素共鸣：交织之草 | 2 |
| 月兆·满辉 | 2 | 换班时间 | 1 |
| 运筹帷幄 | 2 | 白垩之术 | 1 |
| 藏锋何处 | 2 | 幻戏倒计时：3 | 2 |
| 困困冥想术 | 2 | 水仙十字大冒险 | 2 |
| 天才的改造法 | 2 | 清扫时间 | 2 |
| 科研的动力 | 2 | 刺身拼盘 | 1 |

牌表与方向参考就是艺术派大星的[月绽放攻略](https://www.miyoushe.com/ys/article/78355185)。

<a id="mozailu"></a>

### 莫早卢 · 扩散清场

**角色顺序：莫娜 → 早柚 → 迪卢克。首发莫娜。**

[复制本套分享码](#share-mozailu)

起手找迪娜泽黛、蒂玛乌斯、立本、倒计时与过牌。莫娜先挂水并快速交接，早柚用扩散、准备踢和爆发处理多敌，迪卢克以蒸发、连续战技或爆发收尾。伙伴与装备发育同时保留挂水和输出资金。

| 行动牌 | 数量 |
| --- | ---: |
| 流火焦灼 | 2 |
| 偷懒的新方法 | 2 |
| 狼的末路 | 2 |
| 赌徒的耳环 | 2 |
| 饰金之梦 | 2 |
| 黄金剧团的奖赏 | 2 |
| 黄金屋 | 1 |
| 蒂玛乌斯 | 2 |
| 立本 | 2 |
| 迪娜泽黛 | 2 |
| 旧时庭园 | 1 |
| 换班时间 | 2 |
| 运筹帷幄 | 2 |
| 琴音之诗 | 2 |
| 野猪公主 | 2 |
| 幻戏倒计时：3 | 2 |

牌表与方向参考爱打牌的派大星（就是艺术派大星）的[第二季 PVE 攻略](https://www.miyoushe.com/ys/article/62002873)，分享码来自原攻略置顶评论。

<a id="ailin"></a>

### 爱林水 · 反应快攻

**角色顺序：爱可菲 → 林尼 → 水形幻人。**

[复制本套分享码](#share-ailin)

爱可菲留下冰召唤物和料理，林尼用隐具魔术箭积累余数、战技释放余数，水形幻人触发召唤物接力。起手找甜点茶话、零费装备和伙伴，调骰牌合计留一张。四种生成料理按各自图案识别，料理、装备和伙伴围绕下一次攻击使用。「魔女M的祝福」选择已有真实召唤物。

| 行动牌 | 数量 |
| --- | ---: |
| 虹彩缤纷的甜点茶话 | 2 |
| 赌徒的耳环 | 2 |
| 灵光明烁之心 | 2 |
| 角斗士的凯旋 | 2 |
| 卯师傅 | 2 |
| 迪娜泽黛 | 2 |
| 西尔弗和迈勒斯 | 2 |
| 归火圣夜巡礼 | 1 |
| 最好的伙伴！ | 2 |
| 一掷乾坤 | 2 |
| 运筹帷幄 | 2 |
| 野猪公主 | 1 |
| 强劲冲浪拍档！ | 2 |
| 「邪龙」的苏醒 | 2 |
| 「魔女M的祝福」 | 2 |
| 奇瑰之汤 | 2 |

牌表与方向参考派大星的[第三季 PVE 攻略](https://www.miyoushe.com/ys/article/73568256)。鎏金殿堂、雾凇秋分、白浪拂沙和一捧绿野为对局生成料理。

<a id="consecrated"></a>

### 圣骸兽 · 对单核爆

**角色顺序：圣骸毒蝎 → 圣骸飞蛇 → 圣骸角鳄。首发飞蛇。**

[复制本套分享码](#share-consecrated)

起手保留璃月港口、风龙废墟、倒计时、立本、运筹帷幄与沙中遗事。飞蛇用战技和星天补能，毒蝎、角鳄接替承伤并发展支援；后台天赋补充能量块。以块数、绝缘、仙跳墙和清洁工作组织飞蛇爆发，随后用现有骰子、补能和角色接力继续输出。敌人复苏后按新血量重新规划，无需切换挑战模式。

| 行动牌 | 数量 |
| --- | ---: |
| 亡水溢流 | 2 |
| 亡雷凝蓄 | 2 |
| 亡风啸卷 | 2 |
| 绝缘之旗印 | 2 |
| 璃月港口 | 2 |
| 风龙废墟 | 2 |
| 立本 | 2 |
| 白手套和渔夫 | 2 |
| 便携营养袋 | 1 |
| 「沙中遗事」 | 1 |
| 换班时间 | 2 |
| 运筹帷幄 | 2 |
| 星天之兆 | 2 |
| 幻戏倒计时：3 | 2 |
| 「狂欢节奏」 | 2 |
| 仙跳墙 | 2 |

牌表与方向参考就是艺术派大星的[第三季 PVE 攻略 Part 3](https://www.miyoushe.com/ys/article/73568256)。能量块、清洁工作和后续倒计时阶段为生成牌。

## 日志与问题排查

BetterGI 日志中的 **`[启动摘要]`** 用来核对本次配置；结束或停止后的 **`[对局摘要]`** 显示结束情况、最后处理阶段、耗时及动作提交和确认状态。

完整对局日志保存在 `TCGPlayerSuite/logs/run-slot-01.log` 至 `run-slot-10.log`，循环保留最近十次启动。按首条 `start` 的时间找到对应一局，不按槽位数字判断新旧；再次运行前及时取出需要反馈的日志。

遇到问题可先检查：

- **起手或技能后停住**：核对牌手标签与实际牌组、角色顺序、游戏语言、客户区尺寸及画质。
- **反复补读同一张牌**：提供本次完整日志；若仍保留现场，再附一张未经裁剪的完整原图。
- **超时结束**：在启动前调长时限，提供本局摘要与日志，便于区分对局耗时和重复操作。
- **截图失败**：核对是否切出、最小化或关闭了游戏；恢复窗口后重新开局。

反馈时附启动摘要、对局摘要和同一局日志，截图前检查个人信息。可到[源码仓库](https://github.com/sxy8161-debug/bettergi-tcg-scripts)查看实现，或在[发布仓库 Issues](https://github.com/sxy8161-debug/bettergi-tcg-scripts-release/issues)反馈。

<a id="attribution"></a>

## 作者、参考与许可

作者：**巨鲸也是咸鱼 / sxy8161-debug**。脚本代码采用 **GPL-3.0**，完整许可全文附在文末。七圣召唤角色、卡牌名称、规则和游戏画面版权属于米哈游及各自权利人，本项目为非官方作品。

- 各牌组的攻略来源分别列在对应章节；牌表及基础方向参考爱打牌的派大星／就是艺术派大星，保留原始牌组分享码。
- 部分交互参考官方脚本仓库的 `repo/tcg/刻晴雷神甘雨.txt`、[DSTCG（牌圣）](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/js/DSTCG)，原作者 **提瓦特钓鱼玳师 / Hijiwos**。骰子、手牌数量、角色状态、充能和行动标记的部分素材来自 DSTCG，参考提交 `500f2a6ec564bc5f008594fb68cb8c1ae51eb58c`。
- 按钮、限制状态与 Native 骰子素材来自 [BetterGI 0.66.0](https://github.com/babalae/better-genshin-impact) 的 `GameTask/AutoGeniusInvokation/Assets/1920x1080`。其他手牌图块、边缘与状态补充模板来自原生游戏画面，部分为本项目牌手间复用。
- 爱林水召唤物界面参考米游社作者 **桐岛同学想要坏心眼**的[牌组演示](https://www.miyoushe.com/ys/article/71277963)。
- 部分卡牌规则参考 [piovium/genius-invokation](https://github.com/piovium/genius-invokation/tree/7590c11e2c1bd7fd6ae9c2d5395432dd49217898/packages/data/src)，对应提交 `7590c11e2c1bd7fd6ae9c2d5395432dd49217898`；仅参考公开规则定义，未复制其 AGPL 模拟器实现。

运行包保留可读 JavaScript 源码。第三方素材的原有权利不因本项目许可证而改变。


<a id="license"></a>

## 许可证全文

<details>
<summary>GNU General Public License v3.0（完整原文）</summary>

```text
                    GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                            Preamble

  The GNU General Public License is a free, copyleft license for
software and other kinds of works.

  The licenses for most software and other practical works are designed
to take away your freedom to share and change the works.  By contrast,
the GNU General Public License is intended to guarantee your freedom to
share and change all versions of a program--to make sure it remains free
software for all its users.  We, the Free Software Foundation, use the
GNU General Public License for most of our software; it applies also to
any other work released this way by its authors.  You can apply it to
your programs, too.

  When we speak of free software, we are referring to freedom, not
price.  Our General Public Licenses are designed to make sure that you
have the freedom to distribute copies of free software (and charge for
them if you wish), that you receive source code or can get it if you
want it, that you can change the software or use pieces of it in new
free programs, and that you know you can do these things.

  To protect your rights, we need to prevent others from denying you
these rights or asking you to surrender the rights.  Therefore, you have
certain responsibilities if you distribute copies of the software, or if
you modify it: responsibilities to respect the freedom of others.

  For example, if you distribute copies of such a program, whether
gratis or for a fee, you must pass on to the recipients the same
freedoms that you received.  You must make sure that they, too, receive
or can get the source code.  And you must show them these terms so they
know their rights.

  Developers that use the GNU GPL protect your rights with two steps:
(1) assert copyright on the software, and (2) offer you this License
giving you legal permission to copy, distribute and/or modify it.

  For the developers' and authors' protection, the GPL clearly explains
that there is no warranty for this free software.  For both users' and
authors' sake, the GPL requires that modified versions be marked as
changed, so that their problems will not be attributed erroneously to
authors of previous versions.

  Some devices are designed to deny users access to install or run
modified versions of the software inside them, although the manufacturer
can do so.  This is fundamentally incompatible with the aim of
protecting users' freedom to change the software.  The systematic
pattern of such abuse occurs in the area of products for individuals to
use, which is precisely where it is most unacceptable.  Therefore, we
have designed this version of the GPL to prohibit the practice for those
products.  If such problems arise substantially in other domains, we
stand ready to extend this provision to those domains in future versions
of the GPL, as needed to protect the freedom of users.

  Finally, every program is threatened constantly by software patents.
States should not allow patents to restrict development and use of
software on general-purpose computers, but in those that do, we wish to
avoid the special danger that patents applied to a free program could
make it effectively proprietary.  To prevent this, the GPL assures that
patents cannot be used to render the program non-free.

  The precise terms and conditions for copying, distribution and
modification follow.

                       TERMS AND CONDITIONS

  0. Definitions.

  "This License" refers to version 3 of the GNU General Public License.

  "Copyright" also means copyright-like laws that apply to other kinds of
works, such as semiconductor masks.

  "The Program" refers to any copyrightable work licensed under this
License.  Each licensee is addressed as "you".  "Licensees" and
"recipients" may be individuals or organizations.

  To "modify" a work means to copy from or adapt all or part of the work
in a fashion requiring copyright permission, other than the making of an
exact copy.  The resulting work is called a "modified version" of the
earlier work or a work "based on" the earlier work.

  A "covered work" means either the unmodified Program or a work based
on the Program.

  To "propagate" a work means to do anything with it that, without
permission, would make you directly or secondarily liable for
infringement under applicable copyright law, except executing it on a
computer or modifying a private copy.  Propagation includes copying,
distribution (with or without modification), making available to the
public, and in some countries other activities as well.

  To "convey" a work means any kind of propagation that enables other
parties to make or receive copies.  Mere interaction with a user through
a computer network, with no transfer of a copy, is not conveying.

  An interactive user interface displays "Appropriate Legal Notices"
to the extent that it includes a convenient and prominently visible
feature that (1) displays an appropriate copyright notice, and (2)
tells the user that there is no warranty for the work (except to the
extent that warranties are provided), that licensees may convey the
work under this License, and how to view a copy of this License.  If
the interface presents a list of user commands or options, such as a
menu, a prominent item in the list meets this criterion.

  1. Source Code.

  The "source code" for a work means the preferred form of the work
for making modifications to it.  "Object code" means any non-source
form of a work.

  A "Standard Interface" means an interface that either is an official
standard defined by a recognized standards body, or, in the case of
interfaces specified for a particular programming language, one that
is widely used among developers working in that language.

  The "System Libraries" of an executable work include anything, other
than the work as a whole, that (a) is included in the normal form of
packaging a Major Component, but which is not part of that Major
Component, and (b) serves only to enable use of the work with that
Major Component, or to implement a Standard Interface for which an
implementation is available to the public in source code form.  A
"Major Component", in this context, means a major essential component
(kernel, window system, and so on) of the specific operating system
(if any) on which the executable work runs, or a compiler used to
produce the work, or an object code interpreter used to run it.

  The "Corresponding Source" for a work in object code form means all
the source code needed to generate, install, and (for an executable
work) run the object code and to modify the work, including scripts to
control those activities.  However, it does not include the work's
System Libraries, or general-purpose tools or generally available free
programs which are used unmodified in performing those activities but
which are not part of the work.  For example, Corresponding Source
includes interface definition files associated with source files for
the work, and the source code for shared libraries and dynamically
linked subprograms that the work is specifically designed to require,
such as by intimate data communication or control flow between those
subprograms and other parts of the work.

  The Corresponding Source need not include anything that users
can regenerate automatically from other parts of the Corresponding
Source.

  The Corresponding Source for a work in source code form is that
same work.

  2. Basic Permissions.

  All rights granted under this License are granted for the term of
copyright on the Program, and are irrevocable provided the stated
conditions are met.  This License explicitly affirms your unlimited
permission to run the unmodified Program.  The output from running a
covered work is covered by this License only if the output, given its
content, constitutes a covered work.  This License acknowledges your
rights of fair use or other equivalent, as provided by copyright law.

  You may make, run and propagate covered works that you do not
convey, without conditions so long as your license otherwise remains
in force.  You may convey covered works to others for the sole purpose
of having them make modifications exclusively for you, or provide you
with facilities for running those works, provided that you comply with
the terms of this License in conveying all material for which you do
not control copyright.  Those thus making or running the covered works
for you must do so exclusively on your behalf, under your direction
and control, on terms that prohibit them from making any copies of
your copyrighted material outside their relationship with you.

  Conveying under any other circumstances is permitted solely under
the conditions stated below.  Sublicensing is not allowed; section 10
makes it unnecessary.

  3. Protecting Users' Legal Rights From Anti-Circumvention Law.

  No covered work shall be deemed part of an effective technological
measure under any applicable law fulfilling obligations under article
11 of the WIPO copyright treaty adopted on 20 December 1996, or
similar laws prohibiting or restricting circumvention of such
measures.

  When you convey a covered work, you waive any legal power to forbid
circumvention of technological measures to the extent such circumvention
is effected by exercising rights under this License with respect to
the covered work, and you disclaim any intention to limit operation or
modification of the work as a means of enforcing, against the work's
users, your or third parties' legal rights to forbid circumvention of
technological measures.

  4. Conveying Verbatim Copies.

  You may convey verbatim copies of the Program's source code as you
receive it, in any medium, provided that you conspicuously and
appropriately publish on each copy an appropriate copyright notice;
keep intact all notices stating that this License and any
non-permissive terms added in accord with section 7 apply to the code;
keep intact all notices of the absence of any warranty; and give all
recipients a copy of this License along with the Program.

  You may charge any price or no price for each copy that you convey,
and you may offer support or warranty protection for a fee.

  5. Conveying Modified Source Versions.

  You may convey a work based on the Program, or the modifications to
produce it from the Program, in the form of source code under the
terms of section 4, provided that you also meet all of these conditions:

    a) The work must carry prominent notices stating that you modified
    it, and giving a relevant date.

    b) The work must carry prominent notices stating that it is
    released under this License and any conditions added under section
    7.  This requirement modifies the requirement in section 4 to
    "keep intact all notices".

    c) You must license the entire work, as a whole, under this
    License to anyone who comes into possession of a copy.  This
    License will therefore apply, along with any applicable section 7
    additional terms, to the whole of the work, and all its parts,
    regardless of how they are packaged.  This License gives no
    permission to license the work in any other way, but it does not
    invalidate such permission if you have separately received it.

    d) If the work has interactive user interfaces, each must display
    Appropriate Legal Notices; however, if the Program has interactive
    interfaces that do not display Appropriate Legal Notices, your
    work need not make them do so.

  A compilation of a covered work with other separate and independent
works, which are not by their nature extensions of the covered work,
and which are not combined with it such as to form a larger program,
in or on a volume of a storage or distribution medium, is called an
"aggregate" if the compilation and its resulting copyright are not
used to limit the access or legal rights of the compilation's users
beyond what the individual works permit.  Inclusion of a covered work
in an aggregate does not cause this License to apply to the other
parts of the aggregate.

  6. Conveying Non-Source Forms.

  You may convey a covered work in object code form under the terms
of sections 4 and 5, provided that you also convey the
machine-readable Corresponding Source under the terms of this License,
in one of these ways:

    a) Convey the object code in, or embodied in, a physical product
    (including a physical distribution medium), accompanied by the
    Corresponding Source fixed on a durable physical medium
    customarily used for software interchange.

    b) Convey the object code in, or embodied in, a physical product
    (including a physical distribution medium), accompanied by a
    written offer, valid for at least three years and valid for as
    long as you offer spare parts or customer support for that product
    model, to give anyone who possesses the object code either (1) a
    copy of the Corresponding Source for all the software in the
    product that is covered by this License, on a durable physical
    medium customarily used for software interchange, for a price no
    more than your reasonable cost of physically performing this
    conveying of source, or (2) access to copy the
    Corresponding Source from a network server at no charge.

    c) Convey individual copies of the object code with a copy of the
    written offer to provide the Corresponding Source.  This
    alternative is allowed only occasionally and noncommercially, and
    only if you received the object code with such an offer, in accord
    with subsection 6b.

    d) Convey the object code by offering access from a designated
    place (gratis or for a charge), and offer equivalent access to the
    Corresponding Source in the same way through the same place at no
    further charge.  You need not require recipients to copy the
    Corresponding Source along with the object code.  If the place to
    copy the object code is a network server, the Corresponding Source
    may be on a different server (operated by you or a third party)
    that supports equivalent copying facilities, provided you maintain
    clear directions next to the object code saying where to find the
    Corresponding Source.  Regardless of what server hosts the
    Corresponding Source, you remain obligated to ensure that it is
    available for as long as needed to satisfy these requirements.

    e) Convey the object code using peer-to-peer transmission, provided
    you inform other peers where the object code and Corresponding
    Source of the work are being offered to the general public at no
    charge under subsection 6d.

  A separable portion of the object code, whose source code is excluded
from the Corresponding Source as a System Library, need not be
included in conveying the object code work.

  A "User Product" is either (1) a "consumer product", which means any
tangible personal property which is normally used for personal, family,
or household purposes, or (2) anything designed or sold for incorporation
into a dwelling.  In determining whether a product is a consumer product,
doubtful cases shall be resolved in favor of coverage.  For a particular
product received by a particular user, "normally used" refers to a
typical or common use of that class of product, regardless of the status
of the particular user or of the way in which the particular user
actually uses, or expects or is expected to use, the product.  A product
is a consumer product regardless of whether the product has substantial
commercial, industrial or non-consumer uses, unless such uses represent
the only significant mode of use of the product.

  "Installation Information" for a User Product means any methods,
procedures, authorization keys, or other information required to install
and execute modified versions of a covered work in that User Product from
a modified version of its Corresponding Source.  The information must
suffice to ensure that the continued functioning of the modified object
code is in no case prevented or interfered with solely because
modification has been made.

  If you convey an object code work under this section in, or with, or
specifically for use in, a User Product, and the conveying occurs as
part of a transaction in which the right of possession and use of the
User Product is transferred to the recipient in perpetuity or for a
fixed term (regardless of how the transaction is characterized), the
Corresponding Source conveyed under this section must be accompanied
by the Installation Information.  But this requirement does not apply
if neither you nor any third party retains the ability to install
modified object code on the User Product (for example, the work has
been installed in ROM).

  The requirement to provide Installation Information does not include a
requirement to continue to provide support service, warranty, or updates
for a work that has been modified or installed by the recipient, or for
the User Product in which it has been modified or installed.  Access to a
network may be denied when the modification itself materially and
adversely affects the operation of the network or violates the rules and
protocols for communication across the network.

  Corresponding Source conveyed, and Installation Information provided,
in accord with this section must be in a format that is publicly
documented (and with an implementation available to the public in
source code form), and must require no special password or key for
unpacking, reading or copying.

  7. Additional Terms.

  "Additional permissions" are terms that supplement the terms of this
License by making exceptions from one or more of its conditions.
Additional permissions that are applicable to the entire Program shall
be treated as though they were included in this License, to the extent
that they are valid under applicable law.  If additional permissions
apply only to part of the Program, that part may be used separately
under those permissions, but the entire Program remains governed by
this License without regard to the additional permissions.

  When you convey a copy of a covered work, you may at your option
remove any additional permissions from that copy, or from any part of
it.  (Additional permissions may be written to require their own
removal in certain cases when you modify the work.)  You may place
additional permissions on material, added by you to a covered work,
for which you have or can give appropriate copyright permission.

  Notwithstanding any other provision of this License, for material you
add to a covered work, you may (if authorized by the copyright holders of
that material) supplement the terms of this License with terms:

    a) Disclaiming warranty or limiting liability differently from the
    terms of sections 15 and 16 of this License; or

    b) Requiring preservation of specified reasonable legal notices or
    author attributions in that material or in the Appropriate Legal
    Notices displayed by works containing it; or

    c) Prohibiting misrepresentation of the origin of that material, or
    requiring that modified versions of such material be marked in
    reasonable ways as different from the original version; or

    d) Limiting the use for publicity purposes of names of licensors or
    authors of the material; or

    e) Declining to grant rights under trademark law for use of some
    trade names, trademarks, or service marks; or

    f) Requiring indemnification of licensors and authors of that
    material by anyone who conveys the material (or modified versions of
    it) with contractual assumptions of liability to the recipient, for
    any liability that these contractual assumptions directly impose on
    those licensors and authors.

  All other non-permissive additional terms are considered "further
restrictions" within the meaning of section 10.  If the Program as you
received it, or any part of it, contains a notice stating that it is
governed by this License along with a term that is a further
restriction, you may remove that term.  If a license document contains
a further restriction but permits relicensing or conveying under this
License, you may add to a covered work material governed by the terms
of that license document, provided that the further restriction does
not survive such relicensing or conveying.

  If you add terms to a covered work in accord with this section, you
must place, in the relevant source files, a statement of the
additional terms that apply to those files, or a notice indicating
where to find the applicable terms.

  Additional terms, permissive or non-permissive, may be stated in the
form of a separately written license, or stated as exceptions;
the above requirements apply either way.

  8. Termination.

  You may not propagate or modify a covered work except as expressly
provided under this License.  Any attempt otherwise to propagate or
modify it is void, and will automatically terminate your rights under
this License (including any patent licenses granted under the third
paragraph of section 11).

  However, if you cease all violation of this License, then your
license from a particular copyright holder is reinstated (a)
provisionally, unless and until the copyright holder explicitly and
finally terminates your license, and (b) permanently, if the copyright
holder fails to notify you of the violation by some reasonable means
prior to 60 days after the cessation.

  Moreover, your license from a particular copyright holder is
reinstated permanently if the copyright holder notifies you of the
violation by some reasonable means, this is the first time you have
received notice of violation of this License (for any work) from that
copyright holder, and you cure the violation prior to 30 days after
your receipt of the notice.

  Termination of your rights under this section does not terminate the
licenses of parties who have received copies or rights from you under
this License.  If your rights have been terminated and not permanently
reinstated, you do not qualify to receive new licenses for the same
material under section 10.

  9. Acceptance Not Required for Having Copies.

  You are not required to accept this License in order to receive or
run a copy of the Program.  Ancillary propagation of a covered work
occurring solely as a consequence of using peer-to-peer transmission
to receive a copy likewise does not require acceptance.  However,
nothing other than this License grants you permission to propagate or
modify any covered work.  These actions infringe copyright if you do
not accept this License.  Therefore, by modifying or propagating a
covered work, you indicate your acceptance of this License to do so.

  10. Automatic Licensing of Downstream Recipients.

  Each time you convey a covered work, the recipient automatically
receives a license from the original licensors, to run, modify and
propagate that work, subject to this License.  You are not responsible
for enforcing compliance by third parties with this License.

  An "entity transaction" is a transaction transferring control of an
organization, or substantially all assets of one, or subdividing an
organization, or merging organizations.  If propagation of a covered
work results from an entity transaction, each party to that
transaction who receives a copy of the work also receives whatever
licenses to the work the party's predecessor in interest had or could
give under the previous paragraph, plus a right to possession of the
Corresponding Source of the work from the predecessor in interest, if
the predecessor has it or can get it with reasonable efforts.

  You may not impose any further restrictions on the exercise of the
rights granted or affirmed under this License.  For example, you may
not impose a license fee, royalty, or other charge for exercise of
rights granted under this License, and you may not initiate litigation
(including a cross-claim or counterclaim in a lawsuit) alleging that
any patent claim is infringed by making, using, selling, offering for
sale, or importing the Program or any portion of it.

  11. Patents.

  A "contributor" is a copyright holder who authorizes use under this
License of the Program or a work on which the Program is based.  The
work thus licensed is called the contributor's "contributor version".

  A contributor's "essential patent claims" are all patent claims
owned or controlled by the contributor, whether already acquired or
hereafter acquired, that would be infringed by some manner, permitted
by this License, of making, using, or selling its contributor version,
but do not include claims that would be infringed only as a
consequence of further modification of the contributor version.  For
purposes of this definition, "control" includes the right to grant
patent sublicenses in a manner consistent with the requirements of
this License.

  Each contributor grants you a non-exclusive, worldwide, royalty-free
patent license under the contributor's essential patent claims, to
make, use, sell, offer for sale, import and otherwise run, modify and
propagate the contents of its contributor version.

  In the following three paragraphs, a "patent license" is any express
agreement or commitment, however denominated, not to enforce a patent
(such as an express permission to practice a patent or covenant not to
sue for patent infringement).  To "grant" such a patent license to a
party means to make such an agreement or commitment not to enforce a
patent against the party.

  If you convey a covered work, knowingly relying on a patent license,
and the Corresponding Source of the work is not available for anyone
to copy, free of charge and under the terms of this License, through a
publicly available network server or other readily accessible means,
then you must either (1) cause the Corresponding Source to be so
available, or (2) arrange to deprive yourself of the benefit of the
patent license for this particular work, or (3) arrange, in a manner
consistent with the requirements of this License, to extend the patent
license to downstream recipients.  "Knowingly relying" means you have
actual knowledge that, but for the patent license, your conveying the
covered work in a country, or your recipient's use of the covered work
in a country, would infringe one or more identifiable patents in that
country that you have reason to believe are valid.

  If, pursuant to or in connection with a single transaction or
arrangement, you convey, or propagate by procuring conveyance of, a
covered work, and grant a patent license to some of the parties
receiving the covered work authorizing them to use, propagate, modify
or convey a specific copy of the covered work, then the patent license
you grant is automatically extended to all recipients of the covered
work and works based on it.

  A patent license is "discriminatory" if it does not include within
the scope of its coverage, prohibits the exercise of, or is
conditioned on the non-exercise of one or more of the rights that are
specifically granted under this License.  You may not convey a covered
work if you are a party to an arrangement with a third party that is
in the business of distributing software, under which you make payment
to the third party based on the extent of your activity of conveying
the work, and under which the third party grants, to any of the
parties who would receive the covered work from you, a discriminatory
patent license (a) in connection with copies of the covered work
conveyed by you (or copies made from those copies), or (b) primarily
for and in connection with specific products or compilations that
contain the covered work, unless you entered into that arrangement,
or that patent license was granted, prior to 28 March 2007.

  Nothing in this License shall be construed as excluding or limiting
any implied license or other defenses to infringement that may
otherwise be available to you under applicable patent law.

  12. No Surrender of Others' Freedom.

  If conditions are imposed on you (whether by court order, agreement or
otherwise) that contradict the conditions of this License, they do not
excuse you from the conditions of this License.  If you cannot convey a
covered work so as to satisfy simultaneously your obligations under this
License and any other pertinent obligations, then as a consequence you may
not convey it at all.  For example, if you agree to terms that obligate you
to collect a royalty for further conveying from those to whom you convey
the Program, the only way you could satisfy both those terms and this
License would be to refrain entirely from conveying the Program.

  13. Use with the GNU Affero General Public License.

  Notwithstanding any other provision of this License, you have
permission to link or combine any covered work with a work licensed
under version 3 of the GNU Affero General Public License into a single
combined work, and to convey the resulting work.  The terms of this
License will continue to apply to the part which is the covered work,
but the special requirements of the GNU Affero General Public License,
section 13, concerning interaction through a network will apply to the
combination as such.

  14. Revised Versions of this License.

  The Free Software Foundation may publish revised and/or new versions of
the GNU General Public License from time to time.  Such new versions will
be similar in spirit to the present version, but may differ in detail to
address new problems or concerns.

  Each version is given a distinguishing version number.  If the
Program specifies that a certain numbered version of the GNU General
Public License "or any later version" applies to it, you have the
option of following the terms and conditions either of that numbered
version or of any later version published by the Free Software
Foundation.  If the Program does not specify a version number of the
GNU General Public License, you may choose any version ever published
by the Free Software Foundation.

  If the Program specifies that a proxy can decide which future
versions of the GNU General Public License can be used, that proxy's
public statement of acceptance of a version permanently authorizes you
to choose that version for the Program.

  Later license versions may give you additional or different
permissions.  However, no additional obligations are imposed on any
author or copyright holder as a result of your choosing to follow a
later version.

  15. Disclaimer of Warranty.

  THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY
APPLICABLE LAW.  EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT
HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY
OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO,
THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE.  THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM
IS WITH YOU.  SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF
ALL NECESSARY SERVICING, REPAIR OR CORRECTION.

  16. Limitation of Liability.

  IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING
WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MODIFIES AND/OR CONVEYS
THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES, INCLUDING ANY
GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE
USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED TO LOSS OF
DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY YOU OR THIRD
PARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER PROGRAMS),
EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF
SUCH DAMAGES.

  17. Interpretation of Sections 15 and 16.

  If the disclaimer of warranty and limitation of liability provided
above cannot be given local legal effect according to their terms,
reviewing courts shall apply local law that most closely approximates
an absolute waiver of all civil liability in connection with the
Program, unless a warranty or assumption of liability accompanies a
copy of the Program in return for a fee.

                     END OF TERMS AND CONDITIONS

            How to Apply These Terms to Your New Programs

  If you develop a new program, and you want it to be of the greatest
possible use to the public, the best way to achieve this is to make it
free software which everyone can redistribute and change under these terms.

  To do so, attach the following notices to the program.  It is safest
to attach them to the start of each source file to most effectively
state the exclusion of warranty; and each file should have at least
the "copyright" line and a pointer to where the full notice is found.

    <one line to give the program's name and a brief idea of what it does.>
    Copyright (C) <year>  <name of author>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

Also add information on how to contact you by electronic and paper mail.

  If the program does terminal interaction, make it output a short
notice like this when it starts in an interactive mode:

    <program>  Copyright (C) <year>  <name of author>
    This program comes with ABSOLUTELY NO WARRANTY; for details type `show w'.
    This is free software, and you are welcome to redistribute it
    under certain conditions; type `show c' for details.

The hypothetical commands `show w' and `show c' should show the appropriate
parts of the General Public License.  Of course, your program's commands
might be different; for a GUI interface, you would use an "about box".

  You should also get your employer (if you work as a programmer) or school,
if any, to sign a "copyright disclaimer" for the program, if necessary.
For more information on this, and how to apply and follow the GNU GPL, see
<https://www.gnu.org/licenses/>.

  The GNU General Public License does not permit incorporating your program
into proprietary programs.  If your program is a subroutine library, you
may consider it more useful to permit linking proprietary applications with
the library.  If this is what you want to do, use the GNU Lesser General
Public License instead of this License.  But first, please read
<https://www.gnu.org/licenses/why-not-lgpl.html>.

```

</details>
