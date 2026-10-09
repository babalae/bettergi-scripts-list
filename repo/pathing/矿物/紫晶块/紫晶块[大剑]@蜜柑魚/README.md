# 紫晶块之大剑矿闻录 注意事项
## 一、前言
- 本地图追蹤以稻妻、渊下宫 解谜全解 与 宝箱全收集 情况下制作
- 制作脚本时，以**钟剑诺艾尔**作为行走位
- 部份地图追蹤會使用玛薇卡趕路
- 队伍 : 诺艾尔、玛薇卡、爱可菲、芭芭拉

- 预期用时 1小时35分~40分 / 235~275 个

## 二、配置简介
- 生存位技能 : 芭芭拉
- CD : `300`

- 以下为战斗脚本

    ```
    诺艾尔 e
    哥伦比娅 attack(0.01),keypress(q),attack(0.2),e,wait(0.2),attack(0.4),keypress(e),charge(0.2),keypress(q),charge(0.12),attack(0.08),keypress(e),keypress(q),w(0.01),attack(0.2),keypress(e),keypress(q)
    莉奈娅 attack(0.18),keypress(q),wait(0.1), ready,attack(0.05), e,attack(0.65), keypress(q),wait(0.1) ,keypress(q),attack(0.1)
    玛薇卡 attack(0.01),e
    爱可菲 e,wait(0.26),attack(0.15),wait(0.26),keypress(q),keypress(q),wait(0.3),keypress(q),wait(0.3),keypress(q),wait(0.3),keypress(q),wait(0.2),keypress(q),attack(0.01)
    芭芭拉 attack(0.2),wait(0.3),keypress(e), wait(0.2),keypress(e), click(middle), keypress(q),wait(0.2), keypress(q),keypress(e),wait(0.2), keypress(q) ,attack(0.6),charge(0.6),keypress(e),wait(0.3)
    玛薇卡 check,q
    罗莎莉亚 e,attack(0.4),keypress(q),attack(0.4),keypress(q),e
    迪希雅 e, attack(0.3), keypress(e), wait(0.3), wait(0.3)
    诺艾尔 e,check,q,ready,charge(2.3)
    枫原万叶 attack(0.01),wait(0.25),e(hold),click(middle),wait(0.48),attack,wait(0.3),keypress(q),wait(0.3),keypress(q),wait(0.3),keypress(q),wait(0.1),keydown(E),wait(0.55),keyup(E),click(middle),wait(0.45),attack,w(0.01),wait(0.19)
    ```

- 開啟 更快檢查結束戰鬥
- 自動撿取掉落物 : 關閉
- 戰鬥超時為`45`秒
- **战斗脚本 与 战斗超时时间 请以个人配队练度及实力自行调整**


## 三、预期数量

- **鸣神岛** : 42
  - 鸣神岛 无战斗 = 27
  - 鸣神岛 有战斗 = 15
- **神无冢** : 35
  - 神无冢 无战斗 = 29
  - 神无冢 有战斗 = 6
- **八酝岛** : 27
  - 八酝岛 无战斗 = 23
  - 八酝岛 有战斗 = 4
- **海衹岛** : 24
  - 海衹岛 无战斗 = 20
  - 海衹岛 有战斗 = 4
- **清籁岛** : 35
  - 清籁岛 无战斗 = 27
  - 清籁岛 有战斗 = 8
- **鹤观**   : 26
  - 鹤观   无战斗 = 24
  - 鹤观   有战斗 = 2
- **渊下宫** : 46
  - 渊下宫 无战斗 = 20
  - 渊下宫 有战斗 = 26

**预期总计：235 个**


**去除战斗脚本 (-67) = 168个**