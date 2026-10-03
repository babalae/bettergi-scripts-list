1.不要设置行走位
2.战斗策略里不要设置玛薇卡的战斗策略，驰轮车重击会提前碎矿导致少捡，另外会打乱火神赶路的节奏
3.本脚本为大剑挖矿，不推荐带钟离，雷泽等技能范围挖矿的角色
4.路线里的怪物难度都不高，没太大生存压力。
5.下面为携带角色的推荐：
刚需：玛薇卡（其实你没有也能跑这个脚本，慢一点罢了）
盾位：伊涅芙/茜特菈莉/莱依拉/绮良良
其他（按优先级推荐）：芙宁娜/爱可菲/菈乌玛/艾梅莉埃/那维莱特（不推荐有水免怪）/
注意：非常不推荐携带夜兰，希诺宁等使用技能会进行位移的角色，很容易漏矿（火神除外）



萌新不知道怎么删除玛薇卡战斗策略的可以用下面这个：


// 作者：火山
// 描述：万能战斗策略（新手推荐）。需要在，调度器→配置组→设置→战斗配置（开启）→自动检测战斗结束（开启）→更快检查结束战斗（开启）→旋转寻找敌人位置（开启）→检查战斗结束的延时（0.1）→按键触发后检查延时（0.35）→盾奶角色优先释放技能（开启，设置你的盾位）→战斗结束后使用万叶长E手机掉落物（开启）

// 盾（刚需）
茜特菈莉 attack,e,wait(0.2),keypress(q),wait(0.2),keypress(q),wait(0.2),keypress(q),attack(0.2)
伊涅芙 e,attack(0.22),keypress(q),wait(0.1),keypress(q),attack(0.2),keypress(q),attack(0.2)
钟离 s(0.2), e(hold), wait(0.2), w(0.2),keypress(q),wait(0.2),keypress(q),attack(0.1)
莱依拉 e,wait(0.2), keypress(q),wait(0.2),keypress(q),attack(0.2),keypress(q),attack(0.2)
绮良良 e,attack(0.2), keypress(q),attack(0.2),keypress(q),wait(0.2),keypress(q),attack(0.2)
托马 e,attack(0.22),keypress(q),wait(0.1),keypress(q),attack(0.2),keypress(q),attack(0.2)
蓝砚 e,attack(0.15), click(middle),attack(0.15),click(middle),attack(0.15),click(middle),wait(0.2).dash(0.1),attack(0.2)

// 后台、挂元素、副C、先手
迪希雅 e,attack(0.2),e
香菱 e,wait(0.3),keypress(q),attack(0.2),keypress(q),wait(0.2),keypress(q),attack(0.2)
仆人 attack,e
那维莱特 attack(0.23),e
纳西妲 e(hold),click(middle),keypress(q),wait(0.3),keypress(q),attack(0.3),keypress(q),attack(0.2)
艾梅莉埃 e,attack(0.2), keypress(q),attack(0.2),keypress(q),wait(0.2),keypress(q),attack(0.2)
丝柯克 attack(0.2),click(middle),keypress(q),wait(0.05),keypress(q),attack(0.05),click(middle),keydown(E),wait(0.22),attack(0.08),click(middle),keyup(E),keypress(q),wait(0.08),keypress(q)
芙宁娜 e,attack(0.2), keypress(q),attack(0.2),keypress(q),wait(0.2),keypress(q),attack(0.2)
白术 e,attack(0.2)
芭芭拉 e,attack(0.2)
希格雯 e(hold),wait(0.2),keypress(q),wait(0.2),keypress(q)
爱可菲 e,attack(0.2), keypress(q),attack(0.2),keypress(q),wait(0.2),keypress(q),attack(0.2)
菲谢尔 e
欧洛伦 e,attack(0.3), keypress(q),wait(0.2),attack(0.3),keypress(q),wait(0.2),attack(0.3),keypress(q),wait(0.3)
雷电将军 e,attack(0.22),keypress(q),wait(0.1),keypress(q),attack(0.2),keypress(q),attack(0.2)
久岐忍 e,wait(0.2),keypress(q),attack(0.15),keypress(q),e
瓦雷莎 e, attack(1.25),wait(0.45), s(0.4), click(middle), e, attack(1.25), wait(0.3),keypress(q), wait(0.45)


// 中置位
夏沃蕾 attack(0.08),keypress(q),wait(0.2),keypress(q),wait(0.2),attack(0.2),keydown(e),wait(0.15), moveby(0,900),wait(0.15),keyup(e),attack(0.15)
白术 attack(0.2), keypress(q),attack(0.2),keypress(q),wait(0.2),keypress(q),attack(0.2)
那维莱特 attack(0.08),keypress(q),wait(0.22),keypress(q),wait(0.2),keypress(q),e


//减抗
希诺宁 s(0.2),e,w(0.2),attack(0.35),wait(0.1),attack(0.35),keypress(x), wait(0.2), keypress(q), wait(0.3), keypress(q),keypress(x), wait(0.08), keypress(x),attack(0.2)
枫原万叶 attack(0.08),keypress(q),wait(0.3),keypress(q),wait(0.3),attack(0.2),keydown(E),wait(0.48),keyup(E),attack(0.3), wait(0.5),attack(0.1)
砂糖 e,attack(0.2),keypress(q),attack(0.2),keypress(q),e,attack(0.2)

//收尾，长轴
那维莱特 charge(3),j,wait(0.3)
丝柯克 attack(0.05),keypress(e),wait(0.05),keypress(e),wait(0.2),attack(2.27),keypress(Q),dash,attack(2.27),keydown(S),keypress(Q),dash,keyup(S),attack(2.27),wait(0.11),charge(0.3),attack(1)
迪希雅 keypress(q),attack(0.1),dash(0.2),keypress(q),attack(0.3),keypress(q),attack(0.3),keypress(q),attack(0.3),keydown(S),attack(0.5),keyup(S),keydown(W),attack(0.5),keyup(W),keydown(S),attack(0.5),keyup(S),keydown(W),attack(0.5),keyup(W),keydown(S),attack(0.5),keyup(S),keydown(W),attack(0.5),keyup(W),keydown(S),attack(0.5),keyup(S)
娜维娅 keypress(q),attack(0.1),keypress(q),attack(0.1),keypress(q),attack(0.1),keypress(q),keydown(E),wait(0.8),keyup(E),attack(1.6),keydown(E),wait(0.8),keyup(E),attack(0.1),keydown(S),attack(0.33),keyup(S),keydown(W),attack(0.3),keyup(W),keydown(S),attack(0.3),keyup(S),keydown(W),attack(0.3),keyup(W),keydown(S),attack(0.3),keyup(S),keydown(W),attack(0.3),keyup(W),attack(0.2)
瓦雷莎 e, attack(1.25),wait(0.45), s(0.4), e, attack(1.25), wait(0.3),keypress(q), wait(0.45),s(0.4),e, attack(1.25),wait(0.45), s(0.4), e, attack(1.25), wait(0.3),keypress(q), attack(0.45)
仆人 charge(0.35),j,attack(3.2),j,attack(0.3),attack(0.52),keypress(q),attack(0.2)


2025/9/24/
A02 修个矿点
A08 优化2条火神赶路，修个矿点
A17 修2个矿点
A18 修个矿点
A19 修2个矿点
A23 修2个矿点
A27 去高危(有炸药桶)矿点前先开盾，减少暴毙可能
A29 第一个战斗点位易超时，加入角色先开e提前清小怪。修了一段火神赶路
A33 优化火神赶路，适配无火神队伍，修复易卡死移动点位和矿位
A34 修个矿点
B04 修2个矿点
B05 大改，删除火神赶路改用嵴峰龙赶路
B06 大改，删除火神赶路改用嵴峰龙赶路
B07 小改一下，防止被怪打死
B09 修个矿点
B10 修个矿点
B24 修个矿点
B28 修个矿点
B31 修个矿点，试图避免触发战斗
B35 修正战斗点位
B37 修了火神赶路，防止下车失败
B39 修个矿点