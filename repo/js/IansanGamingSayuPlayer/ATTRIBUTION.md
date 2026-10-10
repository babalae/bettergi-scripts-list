# 参考来源与许可记录

- 交互基线：雷柯刻自动牌手0.4.6代码。复用了手牌/骰子/HP识别、输入确认与日志等实现，并为伊嘉早独立改造。
- 攻略：派大星，米游社原作，17173于2026-02-26转载的[《月之五：一套牌如何轻松高效打穿七圣召唤PVE？（第三季）》](https://news.17173.com/content/02262026/233102589.shtml)。策略参考，未收录文章正文。
- 规则核对：[piovium/genius-invokation](https://github.com/piovium/genius-invokation/tree/7590c11e2c1bd7fd6ae9c2d5395432dd49217898/packages/data/src)，固定提交 `7590c11e2c1bd7fd6ae9c2d5395432dd49217898`。读取三角色、武器、圣遗物、支援、事件、料理及公共状态的定义核实费用与条件；未复制该AGPL项目的模拟器实现。本版仍需以实际游戏规则与运行结果验收。
- 官方脚本仓库参考：`bettergi-scripts-list` 的 `repo/tcg/刻晴雷神甘雨.txt`，以及 `repo/js/DSTCG/main.js` 的元素状态布局、起手与手牌输入。保留上游署名和资产来源记录，卡牌费用不采用旧DSTCG字典。

`assets/dice/`、`assets/num/`、`assets/state/`、`assets/charge.png`、`assets/uncharge.png`、`assets/disable.png`、`assets/user_turn.png`、`assets/enemy_turn.png` 等位图沿用0.4.6包中的DSTCG资产。DSTCG原作者提瓦特钓鱼玳师 / Hijiwos；基线记录上游提交 `500f2a6ec564bc5f008594fb68cb8c1ae51eb58c`。`assets/core/` 与 `dice/Native*` 来自本机BetterGI0.66.0资产；`hand_rim.png` 沿用0.4.6。

基线GPL-3.0许可正文保存在 `LICENSE-GPL-3.0.txt`，包内提供可读的JavaScript源码。游戏画面、角色卡牌等权利属于原权利人。
