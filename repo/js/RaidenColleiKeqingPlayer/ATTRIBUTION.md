# 来源与署名

本脚本作者：巨鲸也是咸鱼。

## 识别模板

- `assets/charge.png`、`uncharge.png`、`disable.png`、`user_turn.png`、`enemy_turn.png`、`assets/num/Hand5.png` 至 `Hand10.png`、`assets/state/StateFreeze.png`：来自本仓库 [DSTCG「牌圣」](https://github.com/babalae/bettergi-scripts-list/tree/main/repo/js/DSTCG) 的对应素材。原作者：提瓦特钓鱼玳师 / [Hijiwos](https://github.com/Hijiwos)。参考提交：`500f2a6ec564bc5f008594fb68cb8c1ae51eb58c`。
- `assets/core/` 的 10 张按钮与状态模板、`assets/dice/NativeRoll*.png` 和 `NativeMain*.png` 的 16 张骰子模板：来自 [BetterGI 0.66.0](https://github.com/babalae/better-genshin-impact/tree/0af68c28f6b0e714d5304625ce644736d508022e/BetterGenshinImpact/GameTask/AutoGeniusInvokation/Assets/1920x1080)。骰子原图只调整文件名。
- `assets/hand_rim.png`：为本脚本低张数手牌识别裁取的游戏牌框模板。

BetterGI 项目采用 GPL-3.0，包内保留其许可正文 [LICENSE-GPL-3.0.txt](LICENSE-GPL-3.0.txt)。DSTCG 目录没有单独的 LICENSE；这里保留原作者和来源，不将其素材声明为本脚本原创，也不作新的许可授权。游戏画面及卡牌素材的权利属于原权利人。

## 设计参考

- 手牌单次展开、连续读取的交互方式参考 DSTCG；规则模块与宿主适配为本脚本实现，不包含其旧卡牌字典与示例策略。
- 卡牌机制核对参考游戏卡牌文本及 [piovium/genius-invokation](https://github.com/piovium/genius-invokation/tree/7590c11e2c1bd7fd6ae9c2d5395432dd49217898/packages/data/src) 的第三方规则实现，仅用于核对费用、充能、雷草祝佑、重投与装备行为，没有将其引擎作为运行依赖。

本脚本开发使用了 AI 辅助，并经过本地回归和原生对局测试。实际验证范围见 README，不把合成回放作为真实游戏通关证据。
