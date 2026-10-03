
### action：单个卡牌效果（以下仅影响出牌决策，具体效果不进行推算，数据实时获取）

1. dealDamage：(boolean)是否造成伤害
2. instantDamage：(boolean)是否是即时伤害
3. clickTwice：（boolean）是否需要二次点击
	例如指定敌方的召唤牌
	
4. damage：（int）伤害
	正数为攻击、负数为治疗
5. residueDegree：（int）剩余次数
6. consumption：(int) 生效后减少的可用次数

7. effectType：（String）生效类型
	 - 我方出战角色为...（角色被动）user_main_card\[card_name\]
	 - 我方...卡牌入场（名称、类型）user_card_income\[card_name\]
	 - 敌方...卡牌入场（名称、类型）enemy_card_income\[card_name\]
	 - 我方切换角色 user_switch
	 - 敌方切换角色 enemy_switch
	 - 我方造成元素攻击 user_element_dmg
	 - 敌方造成元素攻击 enemy_element_dmg
	 - 我方造成穿透伤害 user_real_dmg
	 - 敌方造成穿透伤害 enemy_real_dmg
	 - 回合结束 round_over
8. elementType：（String）元素类型(元素附着)
	 - 无 None
	 - 火 Pyro
	 - 水 Hydro
	 - 风 Anemo
	 - 雷 Electro
	 - 草 Dendro
	 - 冰 Cryo
	 - 岩 Geo
9. targetType：（String）目标
	 - 敌方出战卡牌 enemy_main_card
	 - 我方出战卡牌 user_main_card
	 - 敌方下一个角色卡牌 enemy_next_card
	 - 我方下一个角色卡牌 user_next_card
	 - 敌方所有后台卡牌 enemy_other_card
	 - 我方所有后台卡牌 user_other_card
	 - 敌方支援牌 enemy_location
	 - 敌方召唤牌 enemy_summon
	 - 我方支援牌 user_location
	 - 我方召唤牌 user_summon
10. specialEffect：（String）特殊效果
	例如本回合禁止对方使用行动牌（秘传卡牌等）