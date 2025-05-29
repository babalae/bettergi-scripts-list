(async function () { // 若料理选择重复，以最后一个的数量为准，后续改进【根据food_dic.json自动生成头部的预生成数组，使更新更加便捷】
    const base_path = "saves/"
    let data_dic = {} // 存储进度和周期设置-食谱解锁情况(food)和食材刷新周期(material)食材加工周期(ingredient)和部分购买周期(buy)
    // 预生成数组（数据来源为food_dic，均使用read_json_file.py更新）
    const type = ['正常料理', '部族惊喜', '特殊料理', '活动料理', '饮品', '探索获取', '购买料理'];
    const category = ['生命上限提升', '元素充能效率提升', '其他', '持续恢复', '复活', '恢复血量', '提升暴击', '恢复体力', '提升防御', '提升治疗效果', '减少体力消耗', '提升攻击', '提升护盾', '提升伤害', '环境交互恢复', '不可制作', '减少严寒消耗'];
    // 英文版本（不含不可制作）
    const category_en = ['Max HP Boost', 'Elemental Recharge Boost', 'Others', 'Continuous Heal', 'Revive', 'HP Heal', 'Crit Rate Boost', 'Stamina Regen', 'Defense Boost', 'Healing Boost', 'Stamina Cost Reduction', 'Attack Boost', 'Shield Boost', 'Damage Boost', 'Env. Interaction Heal', 'Chill Cost Reduction']
    const area = ['纳塔', '稻妻', '璃月', '其他', '蒙德', '枫丹', '须弥', '至冬'];
    const character = ['伊安珊', '瓦雷莎', '梦见月瑞希', '茜特菈莉', '玛薇卡', '蓝砚', '恰斯卡', '欧洛伦', '希诺宁', '玛拉妮', '基尼奇', '卡齐娜', '艾梅莉埃', '希格雯', '克洛琳德', '赛索斯', '阿蕾奇诺', '千织', '闲云', '嘉明', '娜维娅', '夏沃蕾', '夏洛蒂', '芙宁娜', '那维莱特', '莱欧斯利', '菲米尼', '林尼', '琳妮特', '绮良良', '白术', '卡维', '米卡', '迪希雅', '艾尔海森', '瑶瑶', '珐露珊', '流浪者', '纳西妲', '莱依拉', '妮露', '赛诺', '坎蒂丝', '柯莱', '多莉', '提纳里', '鹿野院平藏', '久岐忍', '夜兰', '神里绫人', '八重神子', '申鹤', '云堇', '五郎', '荒泷一斗', '托马', '九条裟罗', '珊瑚宫心海', '埃洛伊', '神里绫华', '宵宫', '早柚', '枫原万叶', '优菈', '烟绯', '罗莎莉亚', '胡桃', '魈', '甘雨', '阿贝多', '钟离', '达达利亚', '辛焱', '迪奥娜', '温迪', '砂糖', '雷泽', '琴', '香菱', '菲谢尔', '迪卢克', '七七', '芭芭拉', '诺艾尔', '重云', '丽莎', '行秋', '莫娜', '可莉', '北斗', '班尼特', '凝光', '安柏', '凯亚', '刻晴'];
    const name_all = ['酪香蟹蟹锅', '丰稔之赐', '沃陆果饮', '金牌健康餐', '粒果膨膨棒', '酪烤菇菇串', '菇菇山脉（单人份）', '乌乌黑蛋', '「一梦治愈」', '钱汤馒头', '梅落雪间醉', '「独门秘法」', '「簇火赞歌」', '炎岩之颂', '清心花饼', '玉剪着花', '奇瑰之汤', '纵声欢唱', '歇止一刻', '山与海与天空', '火山蛋糕', '蜜汁腌鱼', '粒果裹裹', '果味奶糖', '苦水', '串烤牛心', '宝石闪闪', '温泉时光', '咚咚嘭嘭', '苹果金条条', '塔塔可', '兽肉旋风', '巧克力', '龙龙饼干', '奇旅馔匣', '夹心土豆泥', '炸虾豆球', '好运传递', '火焰炖肉', '猎龙者的犒赏', '「强水」', '苹果卷卷', '多彩之森', '粒果肉汤', '齐齐整整', '粒果片片', '酸汁腌鱼', '薄荷酱烤鱼', '粒果杯', '膨膨冰淇淋', '魔术特调', '酥酥羊角包', '香馥繁味', '奶油炖鸡', '膳食均衡餐', '桔香鸭胸肉', '「猎获」', '烤肉香香香卷', '炉火的往迹', '泡泡舒芙蕾', '摇滚团子牛奶', '肉满满寿司', '「时装秀」', '八宝福禄鸭', '茶好月圆', '知足常乐', '四喜圆满', '红烧肉圆', '繁弦急管', '宾至如归', '金玉满堂', '茶熏乳鸽', '油爆双脆', '古华鱼羊鲜', '玉纹茶叶蛋', '沉玉茶露', '得闲饮茶', '蜜汁叉烧', '千灵慕斯', '「选你喜欢的！」', '缤纷马卡龙', '圈圈圆圆', '罪恶·非必要处理型', '独家秘闻·美食专栏', '「普茹斯蒂司」', '致水神', '羊杂哈吉斯', '桔桔薄饼', '港湾牛肚', '咖啡芭芭露', '卡苏莱砂锅', '纳博内番茄盅', '「纯洁之水」', '「缥雨一滴」', '百味一缕', '苹果黑布丁', '秘烤肋排', '香烤肋排', '杏仁鳟鱼', '韦西鸡', '花果三重奏', '果果仙酪', '鱼鱼咏唱派', '炸鱼薯条', '生肉塔塔', '肉酱千层面', '「海鸟的驻足」', '白淞鲜汤', '膨膨泡芙', '双果清露', '果果软糖', '方块戏法', '午后闲茶', '晶螺糕', '枫丹肥肝', '枫达', '奶油蘑菇汤', '塔塞斯杂烩', '浮露白霜', '蒜香面包棍', '水乡肉冻', '枫丹洋葱汤', '油封鸭腿', '朝气盒饭', '琼玉果汤', '清热降火汤', '悉心一作', '脆饼珐提', '超级至尊披萨', '蜜金泡果', '测绘员蛋堡', '薄荷曼果茶', '镀金锅', '炽金之锅', '「理想情况」', '秘香肉团', '萨布兹炖肉', '轻策家常菜', '鳄鱼肉干', '古法秘制椰炭饼', '真味茶泡饭', '萨巴桑炸角', '哈瓦玛玛兹', '蔷薇奶糊', '安眠奢想', '帕蒂沙兰布丁', '婆娑一舞', '椰炭饼', '决斗之魂', '千层酥酥', '假日果酿', '枣椰蜜糖', '气泡酸莓汁', '阿如拌饭', '关怀备至', '唐杜尔烤鸡', '肉肉烤蘑菇披萨', '兽米香香', '土豆船', '口袋饼', '奶香菌菇脆塔', '憧憬', '米圆塔', '黄油鸡', '日落莓莓茶', '摩拉急速来', '雨林沙拉', '绿汁脆球', '咖喱虾', '奶酱鲜鱼', '烤肉卷', '马萨拉芝士球', '杂菇荟萃', '巡林官精选', '薄荷豆汤', '兰巴德鱼卷', '唯一的真相', '蛋包饭圆舞曲', '沾露虾仁', '紫苑云霓', '「静寂闲雅」', '炸肉排三明治', '山家烧', '福内乌冬', '乌冬面', '丰年有余', '龙须面', '连心面', '云遮玉', '五宝腌菜', '常胜传说', '鳗肉茶泡饭', '绯樱虾仙贝', '强者之道', '树莓水馒头', '鲜鱼炖萝卜', '若竹煮', '「暖意」', '荞麦面', '辣肉窝窝头', '蛋包饭', '米饭布丁', '文心豆腐', '活力喵饭', '日落鲷鱼烧', '红烩兽肉', '多多烧', '蒲烧鳗肉', '团子牛奶', '永恒的信仰', '甜虾寿司', '「奇策」', '饱腹感凝胶', '鸟蛋寿司', '刺身拼盘', '黄油蟹蟹', '「红炉一点雪」', '绀田煮', '绯樱饼', '兽骨拉面', '夏祭游鱼', '三彩团子', '特制风味烤蘑菇披萨', '绯樱天妇罗', '串串三味', '渡来禽肉', '市井杂煮', '什锦炒面', '金枪鱼寿司', '饭团', '头晕回避术·改', '蟹黄壳壳烧', '鸟蛋烧', '干烧香鱼', '雨奇晴好', '味噌汤', '鸡豆花', '清炒虾仁', '米窝窝', '骇浪派', '干锅腊肉', '蟹黄豆腐', '「自有方圆」', '干炒鱼河', '大黄金吮指鸡', '兽肉薄荷卷', '脆脆鸡腿堡', '鲜虾脆薯盏', '香浓土豆泥', '审判的晚宴', '凉拌薄荷', '薄荷果冻', '明月蛋', '海灯节特色扣三丝', '海灯节特色来来菜', '海灯节特色禽蛋羹', '幽幽大行军', '素鲍鱼', '海灯节特色热卤面', '「美梦」', '海灯节特色炸萝卜丸子', '岩港三鲜', '海灯节特色白玉汤', '海灯节特色烤吃虎鱼', '盛世太平', '四方和平', '绝云锅巴', '「林之梦」', '黄油煎鱼', '稠汁蔬菜炖肉', '天枢肉', '月亮派', '金丝虾球', '北地苹果焖肉', '文火慢炖腌笃鲜', '腌笃鲜', '扣三丝', '冒险家蛋堡', '莲花酥', '极致一钓', '摇·滚·鸡！', '绝对不是下酒菜', '仙跳墙', '翡玉什锦袋', '黄金蟹', '圣水', '真·风神杂烩菜', '中原杂碎', '蜜酱胡萝卜煎肉', '风神杂烩菜', '蟹黄火腿焗时蔬', '伍玖叁式营养餐', '蒙德土豆饼', '爪爪土豆饼', '松鼠鱼', '提神醒脑披萨', '水煮黑背鲈', '万民堂水煮鱼', '烤蘑菇披萨', '祝圣交响乐', '冷肉拼盘', '黄油松茸', '轻策农家菜', '「蒙德往事」', '「堆高高」', '来来菜', '没有未来菜', '嘟嘟莲海鲜羹', '白汁时蔬烩肉', '莲子禽蛋羹', '辣味时蔬烩肉', '厚云朵松饼', '庄园烤松饼', '山珍热卤面', '山珍凉卤面', '北地烟熏鸡', '松茸酿肉卷', '甜甜花酿鸡', '魔法肉酱面', '水晶虾', '火火肉酱面', '江湖百味', '苹果酿', '炸萝卜丸子', '杏仁豆腐', '冰钩钩果汁', '香嫩椒椒鸡', '满足沙拉', '至高的智慧（生活）', '树莓薄荷饮', '鱼香吐司', '珍珠翡翠白玉汤', '渔人吐司', '蒙德烤鱼', '炝炒肉片', '提瓦特焦蛋', '摩拉肉', '爆炒肉片', '乾坤摩拉肉', '提瓦特煎蛋', '烤肉排', '侦察骑士烤肉！', '果香串烤', '野菇鸡肉串', '烤吃虎鱼', '绝境求生烤鱼', '萝卜时蔬汤', '大碗茶'];
    const name_character_food = ['金牌健康餐', '菇菇山脉（单人份）', '「一梦治愈」', '「独门秘法」', '「簇火赞歌」', '玉剪着花', '歇止一刻', '蜜汁腌鱼', '果味奶糖', '好运传递', '猎龙者的犒赏', '齐齐整整', '香馥繁味', '膳食均衡餐', '「猎获」', '烤肉香香香卷', '炉火的往迹', '「时装秀」', '四喜圆满', '得闲饮茶', '「选你喜欢的！」', '罪恶·非必要处理型', '独家秘闻·美食专栏', '「普茹斯蒂司」', '「缥雨一滴」', '秘烤肋排', '「海鸟的驻足」', '方块戏法', '午后闲茶', '朝气盒饭', '清热降火汤', '悉心一作', '测绘员蛋堡', '炽金之锅', '「理想情况」', '轻策家常菜', '古法秘制椰炭饼', '真味茶泡饭', '哈瓦玛玛兹', '安眠奢想', '婆娑一舞', '决斗之魂', '关怀备至', '憧憬', '摩拉急速来', '巡林官精选', '唯一的真相', '蛋包饭圆舞曲', '沾露虾仁', '「静寂闲雅」', '福内乌冬', '连心面', '云遮玉', '常胜传说', '强者之道', '「暖意」', '永恒的信仰', '「奇策」', '饱腹感凝胶', '「红炉一点雪」', '夏祭游鱼', '头晕回避术·改', '雨奇晴好', '骇浪派', '「自有方圆」', '审判的晚宴', '幽幽大行军', '「美梦」', '盛世太平', '「林之梦」', '文火慢炖腌笃鲜', '极致一钓', '摇·滚·鸡！', '绝对不是下酒菜', '真·风神杂烩菜', '伍玖叁式营养餐', '爪爪土豆饼', '提神醒脑披萨', '万民堂水煮鱼', '祝圣交响乐', '「蒙德往事」', '没有未来菜', '辣味时蔬烩肉', '厚云朵松饼', '山珍凉卤面', '魔法肉酱面', '江湖百味', '至高的智慧（生活）', '鱼香吐司', '炝炒肉片', '提瓦特焦蛋', '乾坤摩拉肉', '侦察骑士烤肉！', '果香串烤', '绝境求生烤鱼']
    const name_can_make = ['酪香蟹蟹锅', '丰稔之赐', '沃陆果饮', '粒果膨膨棒', '酪烤菇菇串', '乌乌黑蛋', '钱汤馒头', '梅落雪间醉', '炎岩之颂', '清心花饼', '奇瑰之汤', '纵声欢唱', '山与海与天空', '火山蛋糕', '粒果裹裹', '苦水', '串烤牛心', '宝石闪闪', '温泉时光', '咚咚嘭嘭', '苹果金条条', '塔塔可', '兽肉旋风', '巧克力', '龙龙饼干', '奇旅馔匣', '夹心土豆泥', '炸虾豆球', '火焰炖肉', '「强水」', '苹果卷卷', '多彩之森', '粒果肉汤', '粒果片片', '酸汁腌鱼', '薄荷酱烤鱼', '粒果杯', '膨膨冰淇淋', '酥酥羊角包', '奶油炖鸡', '桔香鸭胸肉', '泡泡舒芙蕾', '肉满满寿司', '八宝福禄鸭', '茶好月圆', '知足常乐', '红烧肉圆', '繁弦急管', '宾至如归', '金玉满堂', '茶熏乳鸽', '油爆双脆', '古华鱼羊鲜', '玉纹茶叶蛋', '沉玉茶露', '蜜汁叉烧', '千灵慕斯', '缤纷马卡龙', '圈圈圆圆', '致水神', '羊杂哈吉斯', '桔桔薄饼', '港湾牛肚', '咖啡芭芭露', '卡苏莱砂锅', '纳博内番茄盅', '「纯洁之水」', '百味一缕', '苹果黑布丁', '香烤肋排', '杏仁鳟鱼', '韦西鸡', '花果三重奏', '果果仙酪', '鱼鱼咏唱派', '炸鱼薯条', '生肉塔塔', '肉酱千层面', '白淞鲜汤', '膨膨泡芙', '双果清露', '果果软糖', '晶螺糕', '枫丹肥肝', '奶油蘑菇汤', '塔塞斯杂烩', '浮露白霜', '蒜香面包棍', '水乡肉冻', '枫丹洋葱汤', '油封鸭腿', '琼玉果汤', '脆饼珐提', '超级至尊披萨', '蜜金泡果', '薄荷曼果茶', '镀金锅', '秘香肉团', '萨布兹炖肉', '萨巴桑炸角', '蔷薇奶糊', '帕蒂沙兰布丁', '椰炭饼', '千层酥酥', '假日果酿', '枣椰蜜糖', '阿如拌饭', '唐杜尔烤鸡', '肉肉烤蘑菇披萨', '兽米香香', '土豆船', '口袋饼', '奶香菌菇脆塔', '米圆塔', '黄油鸡', '日落莓莓茶', '雨林沙拉', '绿汁脆球', '咖喱虾', '奶酱鲜鱼', '烤肉卷', '马萨拉芝士球', '杂菇荟萃', '薄荷豆汤', '兰巴德鱼卷', '紫苑云霓', '炸肉排三明治', '山家烧', '乌冬面', '丰年有余', '龙须面', '五宝腌菜', '鳗肉茶泡饭', '绯樱虾仙贝', '树莓水馒头', '鲜鱼炖萝卜', '若竹煮', '荞麦面', '辣肉窝窝头', '蛋包饭', '米饭布丁', '文心豆腐', '活力喵饭', '日落鲷鱼烧', '红烩兽肉', '多多烧', '蒲烧鳗肉', '甜虾寿司', '鸟蛋寿司', '刺身拼盘', '黄油蟹蟹', '绀田煮', '绯樱饼', '兽骨拉面', '三彩团子', '绯樱天妇罗', '串串三味', '渡来禽肉', '市井杂煮', '什锦炒面', '金枪鱼寿司', '饭团', '蟹黄壳壳烧', '鸟蛋烧', '干烧香鱼', '味噌汤', '鸡豆花', '清炒虾仁', '米窝窝', '干锅腊肉', '蟹黄豆腐', '干炒鱼河', '大黄金吮指鸡', '兽肉薄荷卷', '脆脆鸡腿堡', '鲜虾脆薯盏', '香浓土豆泥', '凉拌薄荷', '薄荷果冻', '明月蛋', '素鲍鱼', '岩港三鲜', '四方和平', '绝云锅巴', '黄油煎鱼', '稠汁蔬菜炖肉', '天枢肉', '月亮派', '金丝虾球', '北地苹果焖肉', '腌笃鲜', '扣三丝', '冒险家蛋堡', '莲花酥', '仙跳墙', '翡玉什锦袋', '黄金蟹', '中原杂碎', '蜜酱胡萝卜煎肉', '风神杂烩菜', '蟹黄火腿焗时蔬', '蒙德土豆饼', '松鼠鱼', '水煮黑背鲈', '烤蘑菇披萨', '冷肉拼盘', '黄油松茸', '轻策农家菜', '「堆高高」', '来来菜', '嘟嘟莲海鲜羹', '白汁时蔬烩肉', '莲子禽蛋羹', '庄园烤松饼', '山珍热卤面', '北地烟熏鸡', '松茸酿肉卷', '甜甜花酿鸡', '水晶虾', '火火肉酱面', '炸萝卜丸子', '杏仁豆腐', '香嫩椒椒鸡', '满足沙拉', '珍珠翡翠白玉汤', '渔人吐司', '蒙德烤鱼', '摩拉肉', '爆炒肉片', '提瓦特煎蛋', '烤肉排', '野菇鸡肉串', '烤吃虎鱼', '萝卜时蔬汤']
    // 模板匹配图片路径
    const pic_path = {
        "slide_bar_main_up": "assets\\others\\slide_bar_main_up.png",
        "slide_bar_main_down": "assets\\others\\slide_bar_main_down.png",
        "slide_bar_cooking": "assets\\others\\slide_bar_cooking.png",
        "claim": "assets\\others\\claim.png",
        "auto_cooking": {
            "best0": "assets\\others\\best0.png",
            "best1": "assets\\others\\best1.png",
            "best2": "assets\\others\\best2.png"
        }
    }
    // category和food_name对照字典
    const sort_dic = {
        "Max_HP_Boost": ["酪香蟹蟹锅", "金玉满堂", "「普茹斯蒂司」", "致水神", "镀金锅", "炽金之锅", "绯樱虾仙贝"],
        "Elemental_Recharge_Boost": ["酪香蟹蟹锅"],
        "Others": ["丰稔之赐", "奇瑰之汤", "纵声欢唱", "宝石闪闪", "温泉时光", "咚咚嘭嘭", "魔术特调", "枫达", "圣水"],
        "Continuous_Heal": ["沃陆果饮", "夹心土豆泥", "齐齐整整", "粒果片片", "粒果杯", "膳食均衡餐", "泡泡舒芙蕾", "摇滚团子牛奶", "「时装秀」", "知足常乐", "沉玉茶露", "得闲饮茶", "蜜汁叉烧", "咖啡芭芭露", "杏仁鳟鱼", "「海鸟的驻足」", "白淞鲜汤", "浮露白霜", "朝气盒饭", "蔷薇奶糊", "安眠奢想", "决斗之魂", "米圆塔", "奶酱鲜鱼", "树莓水馒头", "「暖意」", "荞麦面", "活力喵饭", "日落鲷鱼烧", "团子牛奶", "特制风味烤蘑菇披萨", "饭团", "头晕回避术·改", "味噌汤", "干炒鱼河", "鲜虾脆薯盏", "文火慢炖腌笃鲜", "腌笃鲜", "提神醒脑披萨", "水煮黑背鲈", "万民堂水煮鱼", "烤蘑菇披萨", "魔法肉酱面", "水晶虾", "火火肉酱面", "江湖百味", "苹果酿", "萝卜时蔬汤", "大碗茶"],
        "HP_Heal": ["粒果膨膨棒", "乌乌黑蛋", "龙龙饼干", "奇旅馔匣", "粒果肉汤", "薄荷酱烤鱼", "粒果杯", "炉火的往迹", "肉满满寿司", "茶好月圆", "茶熏乳鸽", "秘烤肋排", "香烤肋排", "生肉塔塔", "肉酱千层面", "塔塞斯杂烩", "油封鸭腿", "「理想情况」", "秘香肉团", "萨布兹炖肉", "萨巴桑炸角", "口袋饼", "奶香菌菇脆塔", "憧憬", "咖喱虾", "兰巴德鱼卷", "常胜传说", "蒲烧鳗肉", "「奇策」", "饱腹感凝胶", "鸟蛋寿司", "兽骨拉面", "夏祭游鱼", "三彩团子", "金枪鱼寿司", "干烧香鱼", "雨奇晴好", "米窝窝", "脆脆鸡腿堡", "审判的晚宴", "薄荷果冻", "海灯节特色烤吃虎鱼", "盛世太平", "四方和平", "北地苹果焖肉", "蒙德土豆饼", "爪爪土豆饼", "松鼠鱼", "松茸酿肉卷", "甜甜花酿鸡", "果香串烤", "野菇鸡肉串", "烤吃虎鱼", "绝境求生烤鱼"],
        "Crit_Rate_Boost": ["酪烤菇菇串", "菇菇山脉（单人份）", "「簇火赞歌」", "炎岩之颂", "苹果金条条", "火焰炖肉", "猎龙者的犒赏", "「强水」", "繁弦急管", "油爆双脆", "千灵慕斯", "「纯洁之水」", "「缥雨一滴」", "百味一缕", "韦西鸡", "果果软糖", "方块戏法", "水乡肉冻", "超级至尊披萨", "千层酥酥", "唐杜尔烤鸡", "肉肉烤蘑菇披萨", "马萨拉芝士球", "丰年有余", "鲜鱼炖萝卜", "刺身拼盘", "渡来禽肉", "鸡豆花", "干锅腊肉", "大黄金吮指鸡", "海灯节特色来来菜", "岩港三鲜", "天枢肉", "摇·滚·鸡！", "仙跳墙", "翡玉什锦袋", "「蒙德往事」", "「堆高高」", "来来菜", "没有未来菜", "香嫩椒椒鸡", "满足沙拉", "至高的智慧（生活）", "树莓薄荷饮"],
        "Stamina_Regen": ["「一梦治愈」", "钱汤馒头", "清心花饼", "玉剪着花", "果味奶糖", "串烤牛心", "兽肉旋风", "巧克力", "桔香鸭胸肉", "「猎获」", "独家秘闻·美食专栏", "炸鱼薯条", "阿如拌饭", "关怀备至", "五宝腌菜", "米饭布丁", "文心豆腐", "海灯节特色热卤面", "山珍热卤面", "山珍凉卤面", "北地烟熏鸡"],
        "Defense_Boost": ["梅落雪间醉", "粒果裹裹", "苦水", "膨膨冰淇淋", "八宝福禄鸭", "宾至如归", "古华鱼羊鲜", "羊杂哈吉斯", "枫丹肥肝", "枫丹洋葱汤", "薄荷曼果茶", "哈瓦玛玛兹", "枣椰蜜糖", "兽米香香", "杂菇荟萃", "巡林官精选", "若竹煮", "辣肉窝窝头", "黄油蟹蟹", "市井杂煮", "骇浪派", "海灯节特色白玉汤", "月亮派", "莲花酥", "极致一钓", "黄金蟹", "嘟嘟莲海鲜羹", "鱼香吐司", "珍珠翡翠白玉汤", "渔人吐司"],
        "Healing_Boost": ["梅落雪间醉", "膨膨冰淇淋", "圈圈圆圆", "罪恶·非必要处理型", "羊杂哈吉斯", "午后闲茶", "晶螺糕", "琼玉果汤", "清热降火汤", "真味茶泡饭", "假日果酿", "兽米香香", "鳗肉茶泡饭", "黄油蟹蟹", "黄金蟹"],
        "Stamina_Cost_Reduction": ["歇止一刻", "山与海与天空", "酥酥羊角包", "「选你喜欢的！」", "缤纷马卡龙", "桔桔薄饼", "苹果黑布丁", "花果三重奏", "蜜金泡果", "帕蒂沙兰布丁", "婆娑一舞", "雨林沙拉", "蛋包饭圆舞曲", "紫苑云霓", "山家烧", "云遮玉", "蛋包饭", "兽肉薄荷卷", "海灯节特色禽蛋羹", "真·风神杂烩菜", "中原杂碎", "蜜酱胡萝卜煎肉", "风神杂烩菜", "白汁时蔬烩肉", "莲子禽蛋羹", "辣味时蔬烩肉"],
        "Revive": ["金牌健康餐", "「独门秘法」", "火山蛋糕", "塔塔可", "多彩之森", "玉纹茶叶蛋", "港湾牛肚", "果果仙酪", "鱼鱼咏唱派", "奶油蘑菇汤", "悉心一作", "脆饼珐提", "古法秘制椰炭饼", "椰炭饼", "气泡酸莓汁", "土豆船", "绿汁脆球", "薄荷豆汤", "福内乌冬", "乌冬面", "强者之道", "永恒的信仰", "甜虾寿司", "「红炉一点雪」", "绀田煮", "绯樱饼", "什锦炒面", "鸟蛋烧", "蟹黄豆腐", "「自有方圆」", "明月蛋", "幽幽大行军", "素鲍鱼", "金丝虾球", "绝对不是下酒菜", "蟹黄火腿焗时蔬", "伍玖叁式营养餐", "厚云朵松饼", "庄园烤松饼", "蒙德烤鱼", "炝炒肉片", "提瓦特焦蛋", "摩拉肉", "爆炒肉片", "乾坤摩拉肉", "提瓦特煎蛋", "烤肉排", "侦察骑士烤肉！"],
        "Attack_Boost": ["蜜汁腌鱼", "苹果金条条", "酸汁腌鱼", "香馥繁味", "奶油炖鸡", "烤肉香香香卷", "四喜圆满", "红烧肉圆", "千灵慕斯", "纳博内番茄盅", "「纯洁之水」", "双果清露", "蒜香面包棍", "测绘员蛋堡", "轻策家常菜", "鳄鱼肉干", "唐杜尔烤鸡", "肉肉烤蘑菇披萨", "黄油鸡", "日落莓莓茶", "摩拉急速来", "烤肉卷", "唯一的真相", "炸肉排三明治", "丰年有余", "龙须面", "连心面", "刺身拼盘", "串串三味", "蟹黄壳壳烧", "鸡豆花", "大黄金吮指鸡", "香浓土豆泥", "凉拌薄荷", "「美梦」", "海灯节特色炸萝卜丸子", "冒险家蛋堡", "仙跳墙", "翡玉什锦袋", "黄油松茸", "轻策农家菜", "炸萝卜丸子", "杏仁豆腐", "冰钩钩果汁"],
        "Shield_Boost": ["炸虾豆球", "好运传递", "八宝福禄鸭", "卡苏莱砂锅", "沾露虾仁", "「静寂闲雅」", "辣肉窝窝头", "绯樱天妇罗", "清炒虾仁", "骇浪派", "海灯节特色扣三丝", "「林之梦」", "黄油煎鱼", "月亮派", "扣三丝"],
        "Damage_Boost": ["「强水」", "韦西鸡", "膨膨泡芙", "超级至尊披萨", "红烩兽肉", "多多烧", "绝云锅巴", "天枢肉", "祝圣交响乐", "冷肉拼盘"],
        "Env_Interaction_Heal": ["苹果卷卷"],
        "Chill_Cost_Reduction": ["稠汁蔬菜炖肉"]
    }
    // 食物数据
    const food_dic = JSON.parse(file.readTextSync("assets/food_dic.json"));

    /**
     *
     * 按照原神物品名长度显示裁剪字符串[主物品显示界面适用]（用于OCR）
     *
     * @param string 原字符串
     * @returns {Promise<*|string>} 处理后的字符串
     */
    async function deal_string(string) {
        if (string.length <= 6) {
            return string; // 如果字符串长度是6位或以下，原形返回
        } else {
            return string.substring(0, 5) + '..'; // 如果字符串长度超过6位，保留前5位并加上'..'
        }
    }

    /**
     *
     * 检测当前页面是否是烹饪界面
     *
     * @returns {Promise<boolean>} 烹饪界面返回true，否则返回false
     */
    async function is_cooking_page() {
        const ocrleftupperRo = RecognitionObject.Ocr(142, 32, 52, 31);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocrleftupper = captureGameRegion().Find(ocrleftupperRo); // 当前页面OCR
        return ocrleftupper.isExist() && ocrleftupper.text === "烹饪" ? true: false;
    }

    /**
     *
     * 检测当前页面是否是料理制作界面
     *
     * @returns {Promise<boolean>} 料理制作界面返回true，否则返回false
     */
    async function is_food_page() {
        const ocrleftupperRo = RecognitionObject.Ocr(137, 34, 107, 29);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocrleftupper = captureGameRegion().Find(ocrleftupperRo); // 当前页面OCR
        return ocrleftupper.isExist() && ocrleftupper.text === "料理制作" ? true: false;
    }

    /**
     *
     * 检测当前页面是否是食材加工界面
     *
     * @returns {Promise<boolean>} 食材加工界面返回true，否则返回false
     */
    async function is_ingredient_page() {
        const ocrleftupperRo = RecognitionObject.Ocr(137, 34, 107, 29);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocrleftupper = captureGameRegion().Find(ocrleftupperRo); // 当前页面OCR
        return ocrleftupper.isExist() && ocrleftupper.text === "食材加工" ? true: false;
    }

    /**
     *
     * 点击料理制作页面按钮或者食材加工界面按钮
     *
     * @param option food或ingredient对应点击料理制作页面按钮和食材加工界面按钮
     * @returns {Promise<void>}
     */
    async function click_food_or_ingredient(option) {
        let food_page_btn = [913, 49];
        let ingredient_page_btn = [1009, 49];

        if (option === "food") {
            click(food_page_btn[0], food_page_btn[1]);
        } else {
            click(ingredient_page_btn[0], ingredient_page_btn[1]);
        }
    }

    /**
     *
     * 检测是否解锁自动烹饪(二次验证，仅在烹饪界面可用)
     *
     * @returns {Promise<void>}
     */
    async function is_unlock() {
        const ocrRo = RecognitionObject.Ocr(736, 999, 114, 30);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().Find(ocrRo); // 当前页面OCR
        return ocr.isExist() && ocr.text === "自动烹饪" ? true: false;
    }

    /**
     *
     * 查找并点击烹饪角色(烹饪界面角色选择界面弹出状态下可用)
     *
     * @param name 角色名
     * @returns {Promise<string|boolean>} 成功返回true否则返回false, "error"表示未返回任何匹配结果
     */
    async function recognize_cooking_character(name) {
        const ocrRo = RecognitionObject.Ocr(148, 95, 764, 936);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().FindMulti(ocrRo); // 当前页面OCR
        if (ocr.count !== 0) {
            for (let i = 0; i < ocr.count; i++) {
                if (ocr[i].text.includes(name)) {
                    log.info(`找到了 ${name} ！`);
                    ocr[i].Click();
                    await sleep(100);
                    return true;
                }
            }
            log.info(`当前页面未找到 ${name} ...`)
            return false;
        } else {
            log.error(`当前页面未能识别到任何文本（烹饪角色匹配)`);
            return "error";
        }
    }

    /**
     *
     * 调整加工食材到指定数量(1-999)后点击确定
     *
     * @param num 加工食材数量
     * @returns {Promise<void>}
     */
    async function set_ingredient_num(num, mode="input") { // 后续改成inputText
        const left_btn = [606, 591];
        const right_btn = [1316, 591];
        if (mode === "input") {
            click(961, 454); // 选中输入框
            await sleep(100);
            inputText(`${num}`);
        } else { // 参数为 click 时使用点击
            for (let i = 0; i < num - 1; i++) {
                await click(right_btn[0], right_btn[1]);
                await sleep(25);
            }
        }
        await sleep(500);
        await click(1190, 760); // 确认
        await sleep(200);
    }

    /**
     *
     * 识别烹饪完成后显示的品质
     *
     * @returns {string} 完成、成功、完美、无(没匹配到)
     */
    async function check_quality() {
        const ocrRo = RecognitionObject.Ocr(930, 263, 59, 32);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().Find(ocrRo); // 当前页面OCR
        if (ocr.isExist()) {
            log.info(`烹饪品质: ${ocr.text}`);
            if (ocr.text === "") {
                return "无";
            } else {
                return ocr.text;
            }
        } else {
            log.info("未匹配到烹饪完成后的品质");
            return "无";
        }
    }

    /**
     *
     * 获取当前食材的熟练度
     *
     * @param ui main主要物品选择界面，finish烹饪结束后弹出的界面
     * @returns {Promise<number[]>} 返回熟练度数组 [当前熟练度, 总熟练度]
     */
    async function check_proficiency(ui="main") {
        let ocrRo = RecognitionObject.Ocr(0, 0, genshin.width, genshin.height);
        if (ui === "main") {
            ocrRo = RecognitionObject.Ocr(1424, 422, 82, 37);
        } else if (ui === "finish") {
            ocrRo = RecognitionObject.Ocr(953, 300, 92, 26);
        }

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().Find(ocrRo); // 当前页面OCR
        if (ocr.isExist()) {
            log.info(`当前熟练度: ${ocr.text}`);
            let ocr_nums = ocr.text.split("/").map(Number);
            if (ocr_nums.count < 2) {
                log.error(`熟练度OCR异常: ${ocr_nums.join(" - ")}`);
                return [0, 0];
            }
            return ocr.text.split("/").map(Number);
        } else {
            log.info("未匹配到熟练度");
            return [0, 0];
        }

    }

    /**
     *
     * 识别当前物品名称(界面右侧标签)
     *
     * @returns {Promise<*|boolean>} 物品名称, 未识别到返回false
     */
    async function recognize_item_name() {
        const ocrRo = RecognitionObject.Ocr(1332, 125, 444, 48);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().Find(ocrRo); // 当前页面OCR
        if (ocr.isExist()) {
            return ocr.text;
        } else {
            log.error("未匹配到当前物品名称");
            return false;
        }
    }

    /**
     *
     * 根据食物名选择食物（主要物品选择页面）
     *
     * @param food_name 食物全名
     * @returns {Promise<string|boolean>} 布尔值代表当前页面找到/未找到指定菜品，"error"表示没有任何OCR结果(视为异常)
     */
    async function select_food_by_fullname(food_name) {
        log.info(`在当前页面寻找 ${food_name} ...`);
        const ocrRo = RecognitionObject.Ocr(0, 0, genshin.width, genshin.height);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().FindMulti(ocrRo); // 当前页面OCR
        if (ocr.count !== 0) {
            for (let i = 0; i < ocr.count; i++) {
                if (ocr[i].text === food_name) {
                    log.info(`找到了 ${food_name} ！`);
                    ocr[i].Click();
                    return true;
                }
            }
            log.info(`当前页面未找到 ${food_name} ...`)
            return false;
        } else {
            log.error(`当前页面未能识别到任何文本`);
            return "error";
        }
    }

    /**
     *
     * 根据角色名选择角色（烹饪角色选择页面）
     *
     * @param name 角色全名
     * @returns {Promise<string|boolean>} 布尔值代表当前页面找到/未找到指定角色，"error"表示没有任何OCR结果(视为异常)
     */
    async function select_character_by_fullname(name) {
        log.info(`在当前页面寻找 ${name} ...`);
        const ocrRo = RecognitionObject.Ocr(141, 111, 785, 915);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().FindMulti(ocrRo); // 当前页面OCR
        if (ocr.count !== 0) {
            for (let i = 0; i < ocr.count; i++) {
                if (ocr[i].text === name) {
                    log.info(`找到了 ${name} ！`);
                    ocr[i].Click();
                    return true;
                }
            }
            log.info(`当前页面未找到 ${name} ...`)
            return false;
        } else {
            log.error(`当前页面未能识别到任何文本`);
            return "error";
        }
    }

    /**
     *
     * 向上/下滑动一或多个页面[主要物品选择页面](有误差)
     *
     * @param {string} direction: 滑动方向
     * @param {bigint} pages: 页数
     * @returns {Promise<void>}
     */
    async function scroll_pages_main(direction = "down", pages = 1) {
        const slide_bar_upRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path["slide_bar_main_up"]), 1282, 112, 13, 840);
        const slide_bar_downRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path["slide_bar_main_down"]), 1282, 112, 13, 840);
        slide_bar_upRo.threshold = 0.6;
        slide_bar_downRo.threshold = 0.6;
        for (let i = 0; i < pages; i++) {
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
            await sleep(200);
            let slide_bar_up = captureGameRegion().Find(slide_bar_upRo); // 当前页面模板匹配
            let slide_bar_down = captureGameRegion().Find(slide_bar_downRo); // 当前页面模板匹配
            if (slide_bar_up.isExist() && slide_bar_down.isExist()) {
                log.info(`定位到滑块...(${slide_bar_up.x}, ${slide_bar_up.y})-滑动方向: ${direction}`);
                if (slide_bar_down.y > 920 && direction === "down") {
                    log.info(`滑块已经滑动到底部...`);
                    if (i != 0) {
                        return true;
                    } else {
                        return false;
                    }
                } else if (slide_bar_up.y < 125 && direction === "up") {
                    log.info(`滑块已经滑动到顶部...`);
                    if (i != 0) {
                        return true;
                    } else {
                        return false;
                    }
                }
                click(1289, direction === "down" ? slide_bar_down.y + 15 : slide_bar_up.y - 15); // 向上下滑动（点击）
                await sleep(100);
            } else {
                log.error("未找到滑块，无法执行页面滑动操作！");
                return false;
            }
        }
        return true;
    }

    /**
     *
     * 向上/下滑动一或多个页面[烹饪角色选择界面](有误差)
     *
     * @param {string} direction: 滑动方向
     * @param {bigint} pages: 页数
     * @returns {Promise<void>}
     */
    async function scroll_pages_cooking(direction = "down", pages = 1) {
        const slide_barRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(pic_path["slide_bar_cooking"]), 929, 107, 13, 913);
        slide_barRo.threshold = 0.6;
        for (let i = 0; i < pages; i++) {
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
            await sleep(200);
            let slide_bar = captureGameRegion().Find(slide_barRo); // 当前页面模板匹配
            if (slide_bar.isExist()) {
                log.info(`定位到滑块...(${slide_bar.x}, ${slide_bar.y})-滑动方向: ${direction}`);
                if (slide_bar.y > 880 && direction === "down") {
                    log.info(`滑块已经滑动到底部...`);
                    if (i != 0) {
                        return true;
                    } else {
                        return false;
                    }
                } else if (slide_bar.y < 120 && direction === "up") {
                    log.info(`滑块已经滑动到顶部...`);
                    if (i != 0) {
                        return true;
                    } else {
                        return false;
                    }
                }
                click(936, direction === "down" ? slide_bar.y + 137 : slide_bar.y - 10); // 88 + 175 = 263
                await sleep(10);
            } else {
                log.error("未找到滑块，无法执行页面滑动操作！");
                return false;
            }
        }
        return true;
    }

    /**
     *
     * 读取JS脚本配置
     *
     * @returns {{food_choice_single_select: (string|*), food_choice_multi_input: (*[]|*), food_num: (number|number), cook_character_choice: (string|*), food_character_select: (string|*), food_character_multi_name_input: (*[]|*), food_character_multi_cname_input: (*[]|*), food_character_num: (number|number), extra_time: (number|number)}|boolean}
     */
    function get_js_settings() {
        let food_choice_single_select;
        let food_Max_HP_Boost;
        let food_num_Max_HP_Boost;
        let food_Elemental_Recharge_Boost;
        let food_num_Elemental_Recharge_Boost;
        let food_Others;
        let food_num_Others;
        let food_Continuous_Heal;
        let food_num_Continuous_Heal;
        let food_Revive;
        let food_num_Revive;
        let food_HP_Heal;
        let food_num_HP_Heal;
        let food_Crit_Rate_Boost;
        let food_num_Crit_Rate_Boost;
        let food_Stamina_Regen;
        let food_num_Stamina_Regen;
        let food_Defense_Boost;
        let food_num_Defense_Boost;
        let food_Healing_Boost;
        let food_num_Healing_Boost;
        let food_Stamina_Cost_Reduction;
        let food_num_Stamina_Cost_Reduction;
        let food_Attack_Boost;
        let food_num_Attack_Boost;
        let food_Shield_Boost;
        let food_num_Shield_Boost;
        let food_Damage_Boost;
        let food_num_Damage_Boost;
        let food_Env_Interaction_Heal;
        let food_num_Env_Interaction_Heal;
        let food_Chill_Cost_Reduction;
        let food_num_Chill_Cost_Reduction;
        let food_choice_multi_input;
        let food_num;
        let cook_character_choice;
        let food_character_select;
        let food_character_multi_name_input;
        let food_character_multi_cname_input;
        let food_character_num;
        let select_cooking_mode;
        let extraTime;
        let check_quality;
        let prime_cooking;
        try {
            food_choice_single_select = typeof(settings.food_choice_single_select) === "undefined" ? "无(默认)": settings.food_choice_single_select;
        } catch(error) {
            log.error(`food_choice_single_select 读取错误: ${error}`);
            return false;
        }
        try {
            food_Max_HP_Boost = typeof(settings.food_Max_HP_Boost) === "undefined" ? "无(默认)": settings.food_Max_HP_Boost;
        } catch(error) {
            log.error(`food_Max_HP_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Max_HP_Boost = typeof(settings.food_num_Max_HP_Boost) === "undefined" || settings.food_num_Max_HP_Boost === "" ? 1: parseInt(settings.food_num_Max_HP_Boost, 10);
        } catch(error) {
            log.error(`food_num_Max_HP_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_Elemental_Recharge_Boost = typeof(settings.food_Elemental_Recharge_Boost) === "undefined" ? "无(默认)": settings.food_Elemental_Recharge_Boost;
        } catch(error) {
            log.error(`food_Elemental_Recharge_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Elemental_Recharge_Boost = typeof(settings.food_num_Elemental_Recharge_Boost) === "undefined" || settings.food_num_Elemental_Recharge_Boost === "" ? 1: parseInt(settings.food_num_Elemental_Recharge_Boost, 10);
        } catch(error) {
            log.error(`food_num_Elemental_Recharge_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_Others = typeof(settings.food_Others) === "undefined" ? "无(默认)": settings.food_Others;
        } catch(error) {
            log.error(`food_Others 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Others = typeof(settings.food_num_Others) === "undefined" || settings.food_num_Others === "" ? 1: parseInt(settings.food_num_Others, 10);
        } catch(error) {
            log.error(`food_num_Others 读取错误: ${error}`);
            return false;
        }
        try {
            food_Continuous_Heal = typeof(settings.food_Continuous_Heal) === "undefined" ? "无(默认)": settings.food_Continuous_Heal;
        } catch(error) {
            log.error(`food_Continuous_Heal 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Continuous_Heal = typeof(settings.food_num_Continuous_Heal) === "undefined" || settings.food_num_Continuous_Heal === "" ? 1: parseInt(settings.food_num_Continuous_Heal, 10);
        } catch(error) {
            log.error(`food_num_Continuous_Heal 读取错误: ${error}`);
            return false;
        }
        try {
            food_Revive = typeof(settings.food_Revive) === "undefined" ? "无(默认)": settings.food_Revive;
        } catch(error) {
            log.error(`food_Revive 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Revive = typeof(settings.food_num_Revive) === "undefined" || settings.food_num_Revive === "" ? 1: parseInt(settings.food_num_Revive, 10);
        } catch(error) {
            log.error(`food_num_Revive 读取错误: ${error}`);
            return false;
        }
        try {
            food_HP_Heal = typeof(settings.food_HP_Heal) === "undefined" ? "无(默认)": settings.food_HP_Heal;
        } catch(error) {
            log.error(`food_HP_Heal 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_HP_Heal = typeof(settings.food_num_HP_Heal) === "undefined" || settings.food_num_HP_Heal === "" ? 1: parseInt(settings.food_num_HP_Heal, 10);
        } catch(error) {
            log.error(`food_num_HP_Heal 读取错误: ${error}`);
            return false;
        }
        try {
            food_Crit_Rate_Boost = typeof(settings.food_Crit_Rate_Boost) === "undefined" ? "无(默认)": settings.food_Crit_Rate_Boost;
        } catch(error) {
            log.error(`food_Crit_Rate_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Crit_Rate_Boost = typeof(settings.food_num_Crit_Rate_Boost) === "undefined" || settings.food_num_Crit_Rate_Boost === "" ? 1: parseInt(settings.food_num_Crit_Rate_Boost, 10);
        } catch(error) {
            log.error(`food_num_Crit_Rate_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_Stamina_Regen = typeof(settings.food_Stamina_Regen) === "undefined" ? "无(默认)": settings.food_Stamina_Regen;
        } catch(error) {
            log.error(`food_Stamina_Regen 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Stamina_Regen = typeof(settings.food_num_Stamina_Regen) === "undefined" || settings.food_num_Stamina_Regen === "" ? 1: parseInt(settings.food_num_Stamina_Regen, 10);
        } catch(error) {
            log.error(`food_num_Stamina_Regen 读取错误: ${error}`);
            return false;
        }
        try {
            food_Defense_Boost = typeof(settings.food_Defense_Boost) === "undefined" ? "无(默认)": settings.food_Defense_Boost;
        } catch(error) {
            log.error(`food_Defense_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Defense_Boost = typeof(settings.food_num_Defense_Boost) === "undefined" || settings.food_num_Defense_Boost === "" ? 1: parseInt(settings.food_num_Defense_Boost, 10);
        } catch(error) {
            log.error(`food_num_Defense_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_Healing_Boost = typeof(settings.food_Healing_Boost) === "undefined" ? "无(默认)": settings.food_Healing_Boost;
        } catch(error) {
            log.error(`food_Healing_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Healing_Boost = typeof(settings.food_num_Healing_Boost) === "undefined" || settings.food_num_Healing_Boost === "" ? 1: parseInt(settings.food_num_Healing_Boost, 10);
        } catch(error) {
            log.error(`food_num_Healing_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_Stamina_Cost_Reduction = typeof(settings.food_Stamina_Cost_Reduction) === "undefined" ? "无(默认)": settings.food_Stamina_Cost_Reduction;
        } catch(error) {
            log.error(`food_Stamina_Cost_Reduction 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Stamina_Cost_Reduction = typeof(settings.food_num_Stamina_Cost_Reduction) === "undefined" || settings.food_num_Stamina_Cost_Reduction === "" ? 1: parseInt(food_num_Stamina_Cost_Reduction.undefined, 10);
        } catch(error) {
            log.error(`food_num_Stamina_Cost_Reduction 读取错误: ${error}`);
            return false;
        }
        try {
            food_Attack_Boost = typeof(settings.food_Attack_Boost) === "undefined" ? "无(默认)": settings.food_Attack_Boost;
        } catch(error) {
            log.error(`food_Attack_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Attack_Boost = typeof(settings.food_num_Attack_Boost) === "undefined" || settings.food_num_Attack_Boost === "" ? 1: parseInt(settings.food_num_Attack_Boost, 10);
        } catch(error) {
            log.error(`food_num_Attack_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_Shield_Boost = typeof(settings.food_Shield_Boost) === "undefined" ? "无(默认)": settings.food_Shield_Boost;
        } catch(error) {
            log.error(`food_Shield_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Shield_Boost = typeof(settings.food_num_Shield_Boost) === "undefined" || settings.food_num_Shield_Boost === "" ? 1: parseInt(settings.food_num_Shield_Boost, 10);
        } catch(error) {
            log.error(`food_num_Shield_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_Damage_Boost = typeof(settings.food_Damage_Boost) === "undefined" ? "无(默认)": settings.food_Damage_Boost;
        } catch(error) {
            log.error(`food_Damage_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Damage_Boost = typeof(settings.food_num_Damage_Boost) === "undefined" || settings.food_num_Damage_Boost === "" ? 1: parseInt(settings.food_num_Damage_Boost, 10);
        } catch(error) {
            log.error(`food_num_Damage_Boost 读取错误: ${error}`);
            return false;
        }
        try {
            food_Env_Interaction_Heal = typeof(settings.food_Env_Interaction_Heal) === "undefined" ? "无(默认)": settings.food_Env_Interaction_Heal;
        } catch(error) {
            log.error(`food_Env_Interaction_Heal 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Env_Interaction_Heal = typeof(settings.food_num_Env_Interaction_Heal) === "undefined" || settings.food_num_Env_Interaction_Heal === "" ? 1: parseInt(settings.food_num_Env_Interaction_Heal, 10);
        } catch(error) {
            log.error(`food_num_Env_Interaction_Heal 读取错误: ${error}`);
            return false;
        }
        try {
            food_Chill_Cost_Reduction = typeof(settings.food_Chill_Cost_Reduction) === "undefined" ? "无(默认)": settings.food_Chill_Cost_Reduction;
        } catch(error) {
            log.error(`food_Chill_Cost_Reduction 读取错误: ${error}`);
            return false;
        }
        try {
            food_num_Chill_Cost_Reduction = typeof(settings.food_num_Chill_Cost_Reduction) === "undefined" || settings.food_num_Chill_Cost_Reduction === "" ? 1: parseInt(settings.food_num_Chill_Cost_Reduction, 10);
        } catch(error) {
            log.error(`food_num_Chill_Cost_Reduction 读取错误: ${error}`);
            return false;
        }
        try {
            food_choice_multi_input = typeof(settings.food_choice_multi_input) === "undefined" || settings.food_choice_multi_input === "" ? []: settings.food_choice_multi_input.split(" ");
        } catch(error) {
            log.error(`food_choice_multi_input 读取错误: ${error}`);
            return false;
        }
        try {
            food_num = typeof(settings.food_num) === "undefined" || settings.food_num === "" ? 1: parseInt(settings.food_num, 10);
        } catch(error) {
            log.error(`food_num 读取错误: ${error}`);
            return false;
        }
        try {
            cook_character_choice = typeof(settings.cook_character_choice) === "undefined" ? "角色列表第一个角色(默认)": settings.cook_character_choice;
        } catch(error) {
            log.error(`cook_character_choice 读取错误: ${error}`);
            return false;
        }
        try {
            food_character_select = typeof(settings.food_character_select) === "undefined" ? "无(默认)": settings.food_character_select;
        } catch(error) {
            log.error(`food_character_select 读取错误: ${error}`);
            return false;
        }
        try {
            food_character_multi_name_input = typeof(settings.food_character_multi_name_input) === "undefined" || settings.food_character_multi_name_input === "" ? []: settings.food_character_multi_name_input.split(" ");
        } catch(error) {
            log.error(`food_character_multi_name_input 读取错误: ${error}`);
            return false;
        }
        try {
            food_character_multi_cname_input = typeof(settings.food_character_multi_cname_input) === "undefined" || settings.food_character_multi_cname_input === "" ? []: settings.food_character_multi_cname_input.split(" ");
        } catch(error) {
            log.error(`food_character_multi_cname_input 读取错误: ${error}`);
            return false;
        }
        try {
            food_character_num = typeof(settings.food_character_num) === "undefined" || settings.food_character_num === "" ? 1: parseInt(settings.food_character_num, 10);
        } catch(error) {
            log.error(`food_character_num 读取错误: ${error}`);
            return false;
        }
        try {
            select_cooking_mode = typeof(settings.select_cooking_mode) === "undefined" ? "优先自动烹饪(默认)": settings.select_cooking_mode;
        } catch(error) {
            log.error(`select_cooking_mode读取错误: ${error}`);
            return false;
        }
        try {
            extraTime = typeof(settings.extraTime) === "undefined" || settings.extraTime === "" ? 0: parseInt(settings.extraTime, 10);
        } catch(error) {
            log.error(`extraTime 读取错误: ${error}`);
            return false;
        }
        try {
            check_quality = typeof(settings.check_quality) === "undefined" ? false: settings.check_quality;
        } catch(error) {
            log.error(`check_quality 读取错误: ${error}`);
            return false;
        }
        try {
            prime_cooking = typeof(settings.prime_cooking) === "undefined" ? false: settings.prime_cooking;
        } catch(error) {
            log.error(`prime_cooking 读取错误: ${error}`);
            return false;
        }
        return {
            "food_choice_single_select": food_choice_single_select,
            "food_Max_HP_Boost": food_Max_HP_Boost,
            "food_num_Max_HP_Boost": food_num_Max_HP_Boost,
            "food_Elemental_Recharge_Boost": food_Elemental_Recharge_Boost,
            "food_num_Elemental_Recharge_Boost": food_num_Elemental_Recharge_Boost,
            "food_Others": food_Others,
            "food_num_Others": food_num_Others,
            "food_Continuous_Heal": food_Continuous_Heal,
            "food_num_Continuous_Heal": food_num_Continuous_Heal,
            "food_Revive": food_Revive,
            "food_num_Revive": food_num_Revive,
            "food_HP_Heal": food_HP_Heal,
            "food_num_HP_Heal": food_num_HP_Heal,
            "food_Crit_Rate_Boost": food_Crit_Rate_Boost,
            "food_num_Crit_Rate_Boost": food_num_Crit_Rate_Boost,
            "food_Stamina_Regen": food_Stamina_Regen,
            "food_num_Stamina_Regen": food_num_Stamina_Regen,
            "food_Defense_Boost": food_Defense_Boost,
            "food_num_Defense_Boost": food_num_Defense_Boost,
            "food_Healing_Boost": food_Healing_Boost,
            "food_num_Healing_Boost": food_num_Healing_Boost,
            "food_Stamina_Cost_Reduction": food_Stamina_Cost_Reduction,
            "food_num_Stamina_Cost_Reduction": food_num_Stamina_Cost_Reduction,
            "food_Attack_Boost": food_Attack_Boost,
            "food_num_Attack_Boost": food_num_Attack_Boost,
            "food_Shield_Boost": food_Shield_Boost,
            "food_num_Shield_Boost": food_num_Shield_Boost,
            "food_Damage_Boost": food_Damage_Boost,
            "food_num_Damage_Boost": food_num_Damage_Boost,
            "food_Env_Interaction_Heal": food_Env_Interaction_Heal,
            "food_num_Env_Interaction_Heal": food_num_Env_Interaction_Heal,
            "food_Chill_Cost_Reduction": food_Chill_Cost_Reduction,
            "food_num_Chill_Cost_Reduction": food_num_Chill_Cost_Reduction,
            "food_choice_multi_input": food_choice_multi_input,
            "food_num": food_num,
            "cook_character_choice": cook_character_choice,
            "food_character_select": food_character_select,
            "food_character_multi_name_input": food_character_multi_name_input,
            "food_character_multi_cname_input": food_character_multi_cname_input,
            "food_character_num": food_character_num,
            "select_cooking_mode": select_cooking_mode,
            "extra_time": extraTime,
            "check_quality": check_quality,
            "prime_cooking": prime_cooking
        }
    }

    /**
     *
     * 解析JS脚本配置为任务列表字典
     *
     * @param setting_dic JS脚本配置字典
     * @returns {{cooking: {}, character: {}, buff: string, other_settings: {}}}
     */
    function parse_js_settings(setting_dic) {
        let task_dic = {
            "cooking": {},
            "character": {},
            "buff": "",
            "other_settings": {}
        }
        // 烹饪
        // 普通料理
        if (setting_dic["food_choice_single_select"] === "全部料理") {
            for (let i = 0; i < name_can_make.length; i++) {
                task_dic["cooking"][name_can_make[i]] = setting_dic["food_num"];
            }
        } else {
            task_dic["cooking"][setting_dic["food_choice_single_select"]] = setting_dic["food_num"];
        }
        if (setting_dic["food_Max_HP_Boost"] == "全部料理") {
            for (let i = 0; i < sort_dic["Max_HP_Boost"].length; i++) {
                task_dic["cooking"][sort_dic["Max_HP_Boost"][i]] = setting_dic["food_num_Max_HP_Boost"];
            }
        } else if (setting_dic["food_Max_HP_Boost"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Max_HP_Boost"]] = setting_dic["food_num_Max_HP_Boost"];
        }
        if (setting_dic["food_Elemental_Recharge_Boost"] == "全部料理") {
            for (let i = 0; i < sort_dic["Elemental_Recharge_Boost"].length; i++) {
                task_dic["cooking"][sort_dic["Elemental_Recharge_Boost"][i]] = setting_dic["food_num_Elemental_Recharge_Boost"];
            }
        } else if (setting_dic["food_Elemental_Recharge_Boost"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Elemental_Recharge_Boost"]] = setting_dic["food_num_Elemental_Recharge_Boost"];
        }
        if (setting_dic["food_Others"] == "全部料理") {
            for (let i = 0; i < sort_dic["Others"].length; i++) {
                task_dic["cooking"][sort_dic["Others"][i]] = setting_dic["food_num_Others"];
            }
        } else if (setting_dic["food_Others"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Others"]] = setting_dic["food_num_Others"];
        }
        if (setting_dic["food_Continuous_Heal"] == "全部料理") {
            for (let i = 0; i < sort_dic["Continuous_Heal"].length; i++) {
                task_dic["cooking"][sort_dic["Continuous_Heal"][i]] = setting_dic["food_num_Continuous_Heal"];
            }
        } else if (setting_dic["food_Continuous_Heal"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Continuous_Heal"]] = setting_dic["food_num_Continuous_Heal"];
        }
        if (setting_dic["food_Revive"] == "全部料理") {
            for (let i = 0; i < sort_dic["Revive"].length; i++) {
                task_dic["cooking"][sort_dic["Revive"][i]] = setting_dic["food_num_Revive"];
            }
        } else if (setting_dic["food_Revive"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Revive"]] = setting_dic["food_num_Revive"];
        }
        if (setting_dic["food_HP_Heal"] == "全部料理") {
            for (let i = 0; i < sort_dic["HP_Heal"].length; i++) {
                task_dic["cooking"][sort_dic["HP_Heal"][i]] = setting_dic["food_num_HP_Heal"];
            }
        } else if (setting_dic["food_HP_Heal"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_HP_Heal"]] = setting_dic["food_num_HP_Heal"];
        }
        if (setting_dic["food_Crit_Rate_Boost"] == "全部料理") {
            for (let i = 0; i < sort_dic["Crit_Rate_Boost"].length; i++) {
                task_dic["cooking"][sort_dic["Crit_Rate_Boost"][i]] = setting_dic["food_num_Crit_Rate_Boost"];
            }
        } else if (setting_dic["food_Crit_Rate_Boost"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Crit_Rate_Boost"]] = setting_dic["food_num_Crit_Rate_Boost"];
        }
        if (setting_dic["food_Stamina_Regen"] == "全部料理") {
            for (let i = 0; i < sort_dic["Stamina_Regen"].length; i++) {
                task_dic["cooking"][sort_dic["Stamina_Regen"][i]] = setting_dic["food_num_Stamina_Regen"];
            }
        } else if (setting_dic["food_Stamina_Regen"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Stamina_Regen"]] = setting_dic["food_num_Stamina_Regen"];
        }
        if (setting_dic["food_Defense_Boost"] == "全部料理") {
            for (let i = 0; i < sort_dic["Defense_Boost"].length; i++) {
                task_dic["cooking"][sort_dic["Defense_Boost"][i]] = setting_dic["food_num_Defense_Boost"];
            }
        } else if (setting_dic["food_Defense_Boost"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Defense_Boost"]] = setting_dic["food_num_Defense_Boost"];
        }
        if (setting_dic["food_Healing_Boost"] == "全部料理") {
            for (let i = 0; i < sort_dic["Healing_Boost"].length; i++) {
                task_dic["cooking"][sort_dic["Healing_Boost"][i]] = setting_dic["food_num_Healing_Boost"];
            }
        } else if (setting_dic["food_Healing_Boost"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Healing_Boost"]] = setting_dic["food_num_Healing_Boost"];
        }
        if (setting_dic["food_Stamina_Cost_Reduction"] == "全部料理") {
            for (let i = 0; i < sort_dic["Stamina_Cost_Reduction"].length; i++) {
                task_dic["cooking"][sort_dic["Stamina_Cost_Reduction"][i]] = setting_dic["food_num_Stamina_Cost_Reduction"];
            }
        } else if (setting_dic["food_Stamina_Cost_Reduction"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Stamina_Cost_Reduction"]] = setting_dic["food_num_Stamina_Cost_Reduction"];
        }
        if (setting_dic["food_Attack_Boost"] == "全部料理") {
            for (let i = 0; i < sort_dic["Attack_Boost"].length; i++) {
                task_dic["cooking"][sort_dic["Attack_Boost"][i]] = setting_dic["food_num_Attack_Boost"];
            }
        } else if (setting_dic["food_Attack_Boost"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Attack_Boost"]] = setting_dic["food_num_Attack_Boost"];
        }
        if (setting_dic["food_Shield_Boost"] == "全部料理") {
            for (let i = 0; i < sort_dic["Shield_Boost"].length; i++) {
                task_dic["cooking"][sort_dic["Shield_Boost"][i]] = setting_dic["food_num_Shield_Boost"];
            }
        } else if (setting_dic["food_Shield_Boost"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Shield_Boost"]] = setting_dic["food_num_Shield_Boost"];
        }
        if (setting_dic["food_Damage_Boost"] == "全部料理") {
            for (let i = 0; i < sort_dic["Damage_Boost"].length; i++) {
                task_dic["cooking"][sort_dic["Damage_Boost"][i]] = setting_dic["food_num_Damage_Boost"];
            }
        } else if (setting_dic["food_Damage_Boost"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Damage_Boost"]] = setting_dic["food_num_Damage_Boost"];
        }
        if (setting_dic["food_Env_Interaction_Heal"] == "全部料理") {
            for (let i = 0; i < sort_dic["Env_Interaction_Heal"].length; i++) {
                task_dic["cooking"][sort_dic["Env_Interaction_Heal"][i]] = setting_dic["food_num_Env_Interaction_Heal"];
            }
        } else if (setting_dic["food_Env_Interaction_Heal"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Env_Interaction_Heal"]] = setting_dic["food_num_Env_Interaction_Heal"];
        }
        if (setting_dic["food_Chill_Cost_Reduction"] == "全部料理") {
            for (let i = 0; i < sort_dic["Chill_Cost_Reduction"].length; i++) {
                task_dic["cooking"][sort_dic["Chill_Cost_Reduction"][i]] = setting_dic["food_num_Chill_Cost_Reduction"];
            }
        } else if (setting_dic["food_Chill_Cost_Reduction"] !== "无(默认)") {
            task_dic["cooking"][setting_dic["food_Chill_Cost_Reduction"]] = setting_dic["food_num_Chill_Cost_Reduction"];
        }
        // 多选
        for (let i = 0; i < setting_dic["food_choice_multi_input"].length; i++) {
            let current_food = setting_dic["food_choice_multi_input"][i].split("-");
            if (current_food.length === 1) {
                task_dic["cooking"][current_food[0]] = setting_dic["food_num"];
            } else if (current_food.length === 2) {
                task_dic["cooking"][current_food[0]] = parseInt(current_food[1], 10);
            }
        }
        // 特色料理
        if (setting_dic["food_character_multi_name_input"].length === 0 && setting_dic["food_character_multi_cname_input"].length === 0) {
            if (setting_dic["food_character_select"] === "无(默认)") {
                task_dic["character"] = {};
            } else if (setting_dic["food_character_select"] === "全部角色") {
                for (let i = 0; i < name_character_food.length; i++) {
                    task_dic["character"][name_character_food[i]] = setting_dic["food_character_num"];
                }
            } else {
                for (const [name, detail] of Object.entries(food_dic)) {
                    if (detail["character"] === setting_dic["food_character_select"]) {
                        task_dic["character"][name] = setting_dic["food_character_num"];
                    }
                }
            }
        } else {
            if (setting_dic["food_character_multi_name_input"].length !== 0) {
                // 角色名：数量
                let character_detail_dic = {};
                // 生成 角色名：数量 字典
                for (let i = 0; i < setting_dic["food_character_multi_name_input"].length; i++) {
                    let current_character = setting_dic["food_character_multi_name_input"][i].split("-");
                    if (current_character.length === 1) {
                        character_detail_dic[current_character[0]] = setting_dic["food_character_num"];
                    } else if (current_character.length === 2) {
                        character_detail_dic[current_character[0]] = parseInt(current_character[1], 10);
                    }
                }
                // 所有需求的角色字符串数组
                let all_character = Object.keys(character_detail_dic);
                for (const [name, detail] of Object.entries(food_dic)) {
                    if (all_character.includes(detail["character"])) {
                        task_dic["character"][name] = character_detail_dic[detail["character"]];
                    }
                }
            }
            if (setting_dic["food_character_multi_cname_input"].length !== 0) {
                // 临时存储 料理名：数量 对照字典
                let temp_character_food_dic = {}
                for (let i = 0; i < setting_dic["food_character_multi_cname_input"].length; i++) {
                    let current_food = setting_dic["food_character_multi_cname_input"][i].split("-");
                    if (current_food.length === 1) {
                        temp_character_food_dic[current_food[0]] = setting_dic["food_character_num"];
                    } else if (current_food.length === 2) {
                        temp_character_food_dic[current_food[0]] = parseInt(current_food[1], 10);

                    }
                }
                for (const [name, num] of Object.entries(temp_character_food_dic)) {
                    if (!Object.keys(task_dic["character"]).includes(name)) {
                        task_dic["character"][name] = num;
                    }
                }
            }
        }
        // 增益
        task_dic["buff"] = setting_dic["cook_character_choice"];
        // 其它设置
        task_dic["other_settings"]["cooking_mode"] = setting_dic["select_cooking_mode"];
        task_dic["other_settings"]["extra_time"] = setting_dic["extra_time"];
        task_dic["other_settings"]["check_quality"] = setting_dic["check_quality"];
        task_dic["other_settings"]["prime_cooking"] = setting_dic["prime_cooking"];

        return task_dic;
    }

    /**
     *
     * 自动执行手动烹饪(源于JS脚本: 烹饪熟练度一键拉满-(柒叶子-https://github.com/511760049))
     *
     * @param setting_dic 解析后的JS配置字典
     * @returns {Promise<number>}
     */
    async function auto_cooking_bgi(setting_dic) {
        await sleep(350);
        await click(1005, 1011); // 点击手动烹饪
        await sleep(1000); // 等待画面稳定
        const extraTime = setting_dic["other_settings"]["extra_time"] + 300;
        const checkPoints = [
            {x: 741, y: 772}, // 原始点1
            {x: 758, y: 766}, // 中间点1-2
            {x: 776, y: 760}, // 原始点2
            {x: 793, y: 755}, // 中间点2-3
            {x: 810, y: 751}, // 原始点3
            {x: 827, y: 747}, // 中间点3-4
            {x: 845, y: 744}, // 原始点4
            {x: 861, y: 742}, // 中间点4-5
            {x: 878, y: 740}, // 原始点5
            {x: 897, y: 737}, // 中间点5-6
            {x: 916, y: 735}, // 原始点6
            {x: 933, y: 735}, // 中间点6-7
            {x: 950, y: 736}, // 原始点7
            {x: 968, y: 736}, // 中间点7-8
            {x: 986, y: 737}, // 原始点8
            {x: 1002, y: 738}, // 中间点8-9
            {x: 1019, y: 740}, // 原始点9
            {x: 1038, y: 742}, // 中间点9-10
            {x: 1057, y: 744}, // 原始点10
            {x: 1074, y: 748}, // 中间点10-11
            {x: 1092, y: 752}, // 原始点11
            {x: 1107, y: 757}, // 中间点11-12
            {x: 1122, y: 762}, // 原始点12
            {x: 1138, y: 766}, // 中间点12-13
            {x: 1154, y: 770}, // 原始点13
            {x: 1170, y: 774}, // 中间点13-14
            {x: 1193, y: 779} // 原始点14
        ];

        // 区域大小
        const regionSize = 60;

        // 加载模板图片
        const templateMat0 = file.readImageMatSync(pic_path["auto_cooking"]["best0"]);
        const templateMat1 = file.readImageMatSync(pic_path["auto_cooking"]["best1"]);
        const templateMat2 = file.readImageMatSync(pic_path["auto_cooking"]["best2"]);

        // 创建模板匹配识别对象
        const templateRo0 = RecognitionObject.templateMatch(templateMat0);
        const templateRo1 = RecognitionObject.templateMatch(templateMat1);
        const templateRo2 = RecognitionObject.templateMatch(templateMat2);
        templateRo0.threshold = 0.9;
        templateRo0.Use3Channels = true;
        templateRo1.threshold = 0.9;
        templateRo1.Use3Channels = true;
        templateRo2.threshold = 0.9;
        templateRo2.Use3Channels = true;
        // 捕获游戏区域
        const gameRegion = captureGameRegion();

        // 检查每个点
        for (let i = 0; i < checkPoints.length; i++) {
            const point = checkPoints[i];

            // 裁剪出当前检测区域
            const region = gameRegion.deriveCrop(
                point.x - regionSize/2,
                point.y - regionSize/2,
                regionSize,
                regionSize
            );

            let result;
            if (i < 9) {
                result = region.find(templateRo0);
            } else if (i >= 18) {
                result = region.find(templateRo2);
            } else {
                result = region.find(templateRo1);
            }

            if (!result.isEmpty()) {
                const segmentTime = 66;
                const waitTime = Math.round(i * segmentTime+extraTime);
                log.info(`找到点位${i}号区域`);
                await sleep(waitTime);
                keyPress("VK_SPACE");
                return 0;
            }
        }
        // log.info(`未找到点位区域，烹饪结束`);
        // keyPress("ESCAPE");
        // await sleep(1000);
        // keyPress("ESCAPE");
        // throw new Error("人家才不是错误呢>_<");
    }

    /**
     *
     * 自动烹饪（位于物品主选择界面使用[需要确保已经选择选择当前料理，结合select_food_from_food_page使用]）
     *
     * @param food_name 料理名[全名] 普通料理和特色料理
     * @param setting_dic 解析的JS脚本配置字典
     * @returns {Promise<boolean>} 成功返回true否则false
     */
    async function auto_cooking(food_name, setting_dic) {
        let current_item_name = await recognize_item_name();
        // 检测界面
        if (!is_food_page()) return false;
        // 二次验证食材名
        if (food_dic[food_name]["belonging"] === "无") { // 普通料理
            if (current_item_name === food_name) {
                log.info(`二次验证成功: ${food_name}`);
            } else {
                log.error(`二次验证失败: ${food_name}\n可能原因: OCR识别错误 或 食谱不匹配`);
                return false;
            }
        } else { // 特色料理
            if (current_item_name !== food_dic[food_name]["belonging"]) {
                log.error(`二次验证失败: ${food_dic[food_name]["belonging"]}\n可能原因: OCR识别错误 或 食谱不匹配`);
                return false;
            }
        }
        // 识别熟练度
        let proficiency = await check_proficiency();
        if (proficiency[1] === 0) {
            log.error(`熟练度识别失败: ${proficiency[0]}/${proficiency[1]}`);
        } else {
            log.info(`熟练度识别成功: ${proficiency[0]}/${proficiency[1]}`);
        }
        for (let i = 0; i < 3; i++) {
            await click(1688, 1014); // 点击按钮进入烹饪界面
            await sleep(1000);
            if (is_cooking_page()) break;
        }
        if (is_cooking_page()) {
            await click(1841, 179); // 点击角色选择按钮
            await sleep(500);
            if (food_dic[food_name]["belonging"] === "无"){ // 普通
                if (setting_dic["buff"] === "角色列表第一个角色(默认)") {
                    await click(98, 168); // 点击列表第一个角色(可能没有必要)
                    await sleep(100);
                    await click(1555, 860);
                } else if (setting_dic["buff"] === "完美烹饪对应类型12%概率2倍产出") {
                    let flag = await select_character_by_fullname("2倍");
                    if (!flag) {
                        await click(98, 168); // 点击列表第一个角色
                    } else {
                        await recognize_cooking_character("2倍");
                    }
                    await sleep(100);
                    await click(1555, 860);
                } else if (setting_dic["buff"] === "完美烹饪18%概率额外产出产出「奇怪的」同种料理") {
                    let flag = await select_character_by_fullname("奇怪");
                    if (!flag) {
                        await click(98, 168); // 点击列表第一个角色
                    } else {
                        await recognize_cooking_character("奇怪");
                    }
                    await sleep(100);
                    await click(1555, 860);
                }
                await sleep(500);
            } else { // 特色
                let select_character = await select_character_from_cooking_page(food_dic[food_name]["character"]);
                if (select_character) {
                    log.info(`角色选择成功: ${food_dic[food_name]["character"]}`);
                } else {
                    log.error(`角色选择失败: ${food_dic[food_name]["character"]}`);
                    // 退回主选择界面
                    await click(1724, 49); // 关闭角色选择界面
                    await sleep(500);
                    if (is_cooking_page()) await keyPress("VK_ESCAPE");
                    await sleep(200);
                    return false;
                }
            }
            let unlock = await is_unlock(); // 二次检测自动烹饪是否解锁
            log.info(`自动烹饪模式: ${setting_dic["other_settings"]["cooking_mode"]}`);
            if (setting_dic["other_settings"]["food_detail"]) { // 显示料理详情
                log.info(`${food_name} 的详情如下:\n${food_dic[food_name]["detail"]}`);
            }
            // JS脚本配置关于烹饪方式的配置
            if (setting_dic["other_settings"]["cooking_mode"] === "优先自动烹饪(默认)") {
                // 识别当前buff(判断烹饪产物)
                let current_buff = get_current_buff();
                if (unlock || (proficiency[0] === proficiency[1] && proficiency[1] !== 0)) { // 解锁了自动烹饪
                    const loop_time = Math.floor(setting_dic["cooking"][food_name] / 99) + 1; // 总计循环数，一次最大99
                    let cook_num = setting_dic["cooking"][food_name] + 0; // 设定的数量
                    for (let i = 0; i < loop_time; i++) {
                        let cook_time = i !== loop_time - 1 ? 99: cook_num - i * 99; // 本次烹饪数
                        await click(890, 1016); // 点击自动烹饪
                        await sleep(500);
                        if (food_dic[food_name]["belonging"] === "无") { // 普通
                            await set_ingredient_num(cook_time);
                        } else { // 特色(需要结合检测产物)
                            await set_ingredient_num(cook_time);
                        }
                        await sleep(500);
                        await click(1186, 756); // 点击确认
                        await sleep(2500); // 等待自动烹饪
                        if (setting_dic["other_settings"]["check_quality"]) {
                            let result_dic = await check_cooking_result(); // OCR识别烹饪结果
                            if (result_dic["quality"] !== "无" && result_dic["num"] !== 0) { // 结果正常
                                let temp_result_string = "";
                                for (let i = 0; i < result_dic["detail"]; i++) {
                                    temp_result_string += `${result_dic["detail"][0]}(${result_dic["detail"][1]})`;
                                }
                                log.info(`自动烹饪成功: 烹饪次数(${cook_time})\n详情: ${temp_result_string}`);
                            } else {
                                log.warn(`烹饪结果识别异常: ${result_dic["quality"] === "无" ? "品质未识别": ""} ${result_dic["num"] === 0 ? "数量未识别": ""}\n详情: ${result_dic["quality"]}-${result_dic["num"]}`);
                                for (const [result_name, result_num] of Object.entries(result_dic["detail"])) {
                                    log.info(`${result_name}(${result_num})`);
                                }
                            }
                        }
                        await sleep(100);
                        click(1555, 860);
                        if (await is_cooking_page()) {
                            click(1555, 860); // 退出烹饪结果界面，返回烹饪界面
                        }
                        await sleep(200);
                    }
                } else { // 未解锁自动烹饪
                    const max_loop_time = food_dic[food_name]["lvl"] * 5;
                    let cook_num = setting_dic["cooking"][food_name] + 0; // 设定的数量
                    let unlock_flag = false
                    for (let i = 0; i < max_loop_time; i++) {
                        if (!unlock) {
                            await auto_cooking_bgi(setting_dic); // 调用手动烹饪
                            if (setting_dic["other_settings"]["check_quality"]) {
                                let result_dic = await check_cooking_result(); // OCR识别烹饪结果
                                if (result_dic["quality"] !== "无" && result_dic["num"] !== 0) { // 结果正常
                                    let temp_result_string = "";
                                    for (let i = 0; i < result_dic["detail"]; i++) {
                                        temp_result_string += `${result_dic["detail"][0]}(${result_dic["detail"][1]})`;
                                    }
                                    log.info(`自动烹饪成功: 烹饪次数(${cook_time})\n详情: ${temp_result_string}`);
                                } else {
                                    log.warn(`烹饪结果识别异常: ${result_dic["quality"] === "无" ? "品质未识别": ""} ${result_dic["num"] === 0 ? "数量未识别": ""}\n详情: ${result_dic["quality"]}-${result_dic["num"]}`);
                                    for (const [result_name, result_num] of Object.entries(result_dic["detail"])) {
                                        log.info(`${result_name}(${result_num})`);
                                    }
                                }
                            }
                            await sleep(100);
                            click(1555, 860);
                            if (await is_cooking_page()) {
                                click(1555, 860); // 退出烹饪结果界面，返回烹饪界面
                            }
                            await sleep(200);
                        } else {
                            unlock_flag = true;
                            break;
                        }
                        cook_num--; // 剩余烹饪次数-1
                        unlock = await is_unlock(); // 检测当前食材是否已经解锁
                    }
                    if (unlock_flag) {
                        const loop_time = Math.floor(cook_num / 99) + 1; // 总计循环数，一次最大99
                        let cook_num = setting_dic["cooking"][food_name] + 0; // 设定的数量
                        for (let i = 0; i < loop_time; i++) {
                            let cook_time = i !== loop_time - 1 ? 99: cook_num - i * 99; // 本次烹饪数
                            await click(890, 1016); // 点击自动烹饪
                            await sleep(500);
                            if (food_dic[food_name]["belonging"] === "无") { // 普通
                                await set_ingredient_num(cook_time);
                            } else { // 特色(需要结合检测产物)
                                await set_ingredient_num(cook_time);
                            }
                            await sleep(500);
                            await click(1186, 756); // 点击确认
                            await sleep(2500); // 等待自动烹饪
                            if (setting_dic["other_settings"]["check_quality"]) {
                                let result_dic = await check_cooking_result(); // OCR识别烹饪结果
                                if (result_dic["quality"] !== "无" && result_dic["num"] !== 0) { // 结果正常
                                    let temp_result_string = "";
                                    for (let i = 0; i < result_dic["detail"]; i++) {
                                        temp_result_string += `${result_dic["detail"][0]}(${result_dic["detail"][1]})`;
                                    }
                                    log.info(`自动烹饪成功: 烹饪次数(${cook_time})\n详情: ${temp_result_string}`);
                                } else {
                                    log.warn(`烹饪结果识别异常: ${result_dic["quality"] === "无" ? "品质未识别": ""} ${result_dic["num"] === 0 ? "数量未识别": ""}\n详情: ${result_dic["quality"]}-${result_dic["num"]}`);
                                    for (const [result_name, result_num] of Object.entries(result_dic["detail"])) {
                                        log.info(`${result_name}(${result_num})`);
                                    }
                                }
                            }
                            await sleep(100);
                            click(1555, 860);
                            if (await is_cooking_page()) {
                                click(1555, 860); // 退出烹饪结果界面，返回烹饪界面
                            }
                            await sleep(200);
                        }
                    } else {
                        log.error(`当前料理烹饪失败(手动烹饪异常): ${food_name}`);
                    }
                }
            } else if (setting_dic["other_settings"]["cooking_mode"].startsWith("优先手动烹饪")) {
                let cook_num = setting_dic["cooking"][food_name];
                for (let i = 0; i < cook_num; i++) {
                    if (await is_cooking_page()) {
                        await auto_cooking_bgi(setting_dic);
                        if (setting_dic["other_settings"]["check_quality"]) {
                            let result_dic = await check_cooking_result(); // OCR识别烹饪结果
                            if (result_dic["quality"] !== "无" && result_dic["num"] !== 0) { // 结果正常
                                let temp_result_string = "";
                                for (let i = 0; i < result_dic["detail"]; i++) {
                                    temp_result_string += `${result_dic["detail"][0]}(${result_dic["detail"][1]})`;
                                }
                                log.info(`自动烹饪成功: 烹饪次数(${cook_time})\n详情: ${temp_result_string}`);
                            } else {
                                log.warn(`烹饪结果识别异常: ${result_dic["quality"] === "无" ? "品质未识别": ""} ${result_dic["num"] === 0 ? "数量未识别": ""}\n详情: ${result_dic["quality"]}-${result_dic["num"]}`);
                                for (const [result_name, result_num] of Object.entries(result_dic["detail"])) {
                                    log.info(`${result_name}(${result_num})`);
                                }
                            }
                        }
                        await sleep(100);
                        click(1555, 860);
                    } else {
                        log.warn(`食材不够: ${food_name}`);
                        return false;
                    }
                }

            } else if (setting_dic["other_settings"]["cooking_mode"].startsWith("刷满熟练度")) {
                const max_loop_time = food_dic[food_name]["lvl"] * 5 + 1; // 加1次冗余
                for (let i = 0; i < max_loop_time; i++) {
                    if (!unlock) {
                        await auto_cooking_bgi(setting_dic); // 调用手动烹饪
                        if (setting_dic["other_settings"]["check_quality"]) {
                            let result_dic = await check_cooking_result(); // OCR识别烹饪结果
                            if (result_dic["quality"] !== "无" && result_dic["num"] !== 0) { // 结果正常
                                let temp_result_string = "";
                                for (let i = 0; i < result_dic["detail"]; i++) {
                                    temp_result_string += `${result_dic["detail"][0]}(${result_dic["detail"][1]})`;
                                }
                                log.info(`自动烹饪成功: 烹饪次数(${cook_time})\n详情: ${temp_result_string}`);
                            } else {
                                log.warn(`烹饪结果识别异常: ${result_dic["quality"] === "无" ? "品质未识别": ""} ${result_dic["num"] === 0 ? "数量未识别": ""}\n详情: ${result_dic["quality"]}-${result_dic["num"]}`);
                                for (const [result_name, result_num] of Object.entries(result_dic["detail"])) {
                                    log.info(`${result_name}(${result_num})`);
                                }
                            }
                        }
                        await sleep(100);
                        click(1555, 860);
                    } else {
                        log.info(`${food_name} 已解锁!`)
                        await sleep(100);
                        if (await is_cooking_page()) {
                            click(1555, 860); // 退出烹饪结果界面，返回烹饪界面
                        }
                        await sleep(200);
                        return true;
                    }
                    unlock = await is_unlock(); // 检测当前食材是否已经解锁
                }
            } else {
                log.error(`cooking_mode值异常: ${setting_dic["other_settings"]["cooking_mode"]}`);
                return false;
            }
        } else {
            log.error("未能成功进入烹饪界面");
            return false;
        }
        if (await is_cooking_page()) { // 检测并退出烹饪界面
            keyPress("VK_ESCAPE");
            await sleep(200);
        }
        return true;
    }

    /**
     *
     * 在料理制作界面自动寻找指定料理（自动滑动页面）
     *
     * @param food_name 食物全名
     * @returns {Promise<boolean>}
     */
    async function select_food_from_food_page(food_name, setting_dic) {
        // 检测是否位于料理制作界面
        let judge_food = is_food_page();
        if (judge_food) {
            log.info("当前处于料理制作界面");
        } else {
            log.error("当前不处于料理制作界面...");
            return false;
        }
        // 滑动到顶部
        await scroll_pages_main("up", 10);
        for (let i = 0; i < 30; i++) {
            let food_choice = await select_food_by_fullname(await deal_string(food_name));
            if (food_choice) {
                return true;
            } else {
                let scroll_result = await scroll_pages_main("down", 1);
                if (!scroll_result) {
                    break;
                }
            }
        }
        log.error(`未找到指定料理，可能原因如下:\n1.没有该食谱: ${food_name}\n2.OCR识别存在误差或者识别错误\n`);
        if (setting_dic["other_settings"]["food_detail"]) {
            log.error(`该料理的获取方式: ${food_dic[food_name]["means"]}`);
        }
        await sleep(2000);
        return false;

    }

    /**
     *
     * 在烹饪角色选择界面自动寻找指定角色（自动滑动页面）
     *
     * @param name 角色名
     * @returns {Promise<boolean>}
     */
    async function select_character_from_cooking_page(name) {
        // 检测是否位于烹饪界面
        let judge_cooking = await is_cooking_page();
        if (judge_cooking) {
            log.info("当前处于烹饪界面");
        } else {
            log.error("当前不处于烹饪界面...");
            return false;
        }
        // 滑动到顶部
        await scroll_pages_cooking("up", 15);
        for (let i = 0; i < 10; i++) {
            let character_choice = await select_character_by_fullname(name);
            if (character_choice) {
                return true;
            } else {
                let scroll_result = await scroll_pages_main("down", 1);
                if (!scroll_result) {
                    break;
                }
            }
        }
        log.info(`未找到指定角色，可能原因如下:\n1.没有该角色: ${name}\n2.OCR识别存在误差`);
        await sleep(2000);
        return false;

    }

    /**
     *
     * 识别烹饪结果(品质+料理名:数量)[存在问题，数字识别不精确，可能无效]
     *
     * @returns {Promise<{quality: Promise<string>, num: number, quantity: number[]}>}
     */
    async function check_cooking_result() {
        let msg_dic = {
            "quality": "",
            "num": 0,
            "detail": []
        }
        let ocrRo = RecognitionObject.Ocr(826, 577, 268, 31);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().FindMulti(ocrRo); // 当前页面OCR
        await sleep(200);
        try {
            msg_dic["quality"] = await check_quality();
            click(927, 525); // 点击左侧料理/中间料理
            await sleep(200);
            let food_name_finish1 = await get_food_name_cooking_finished();
            click(1555, 860); // 退出当前料理详情
            await sleep(200);
            click(991, 525); // 点击右侧料理/中间料理
            await sleep(200);
            let food_name_finish2 = await get_food_name_cooking_finished();
            click(1555, 860); // 退出当前料理详情
            if (food_name_finish1 === food_name_finish2) { // 仅有一个结果
                msg_dic["num"] = 1;
                if (ocr.count == 1) { // OCR结果未转换为整型[此处有待完善]
                    msg_dic["detail"] = {food_name_finish1: ocr[0].text};
                } else {
                    msg_dic["detail"] = {food_name_finish1: 0};
                }
            } else { // 有两个结果
                msg_dic["num"] = 2;
                if (ocr.count == 2) { // OCR结果未转换为整型[此处有待完善]
                    msg_dic["detail"] = {food_name_finish1: ocr[0].text, food_name_finish2: ocr[1].text};
                } else {
                    msg_dic["detail"] = {food_name_finish1: 0, food_name_finish2: 0};
                }
            }
        } catch (error) {
            log.error(`OCR识别料理数出错: ${error}`);
            return {
                "quality": check_quality(),
                "num": 0,
                "detail": {"": 0, "": 0}
            };
        }
        for (let i = 0; i < 3; i++) {
            if (!(await is_cooking_page() && !(await is_food_page()))) {
                await sleep(200);
                keyPress("VK_ESCAPE");
                await sleep(200);
            } else if (await is_cooking_page()) {
                break;
            }
        }
        return msg_dic;
    }

    /**
     *
     * 获取烹饪结束后的料理名(需要点击烹饪完成后的料理图标)
     *
     * @returns {Promise<*|string>} 料理名字符串(附带前缀)
     */
    async function get_food_name_cooking_finished() {
        let ocrRo = RecognitionObject.Ocr(739, 231, 441, 47);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().Find(ocrRo); // 当前页面OCR
        if (ocr.isExist()) {
            return ocr.text;
        } else {
            return "";
        }
    }

    /**
     *
     * 识别当前角色烹饪加成(烹饪界面)
     *
     * @returns {string>} 字符串返回对应的加成
     */
    async function get_current_buff() {
        let ocrRo = RecognitionObject.Ocr(1511, 389, 337, 85);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().FindMulti(ocrRo); // 当前页面OCR
        if (ocr.isExist()) {
            if (ocr.text.includes("2倍产出")) {
                return "2倍产出";
            } else if (ocr.text.includes("奇怪的")) {
                return "奇怪的";
            } else if (ocr.text.includes("特殊料理")) {
                return "特殊料理";
            } else {
                return "无";
            }
        } else {
            return "无";
        }
    }

    /**
     *
     * 检测时长提醒并等待
     *
     * @returns {Promise<void>}
     */
    async function wait_time_remind(wait_time=5) {
        let ocrRo = RecognitionObject.Ocr(689, 13, 537, 30);

        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(200);
        let ocr = captureGameRegion().Find(ocrRo); // 当前页面OCR
        const regex = new RegExp(/(?<=旅行者)[\s\S]*?(?=休息)/);
        if (regex.test(ocr)) {
            await sleep(wait_time * 1000);
        }
    }

    async function main() {
        // 调整分辨率和dpi，适应屏幕操作
        setGameMetrics(1920, 1080);
        // 读取JS脚本配置
        let setting = get_js_settings();
        // 解析JS脚本配置
        let setting_dic = parse_js_settings(setting);

        // ------>* 烹饪 *<------
        if (Object.keys(setting_dic["cooking"]).length !== 0 || Object.keys(setting_dic["character"]).length !== 0) {
            let flag_check_ui = true;
            // 检测是否处于料理制作界面
            for (let n = 0; n < 4; n++) {
                let judge_food = await is_food_page();
                if (judge_food) {
                    log.info("当前处于料理制作界面");
                    break;
                } else {
                    if (n == 3) {
                        log.error(`多次尝试后未能进入料理制作界面，烹饪类 任务已跳过`);
                        flag_check_ui = false;
                        break;
                    }
                    log.warn(`当前未处于料理制作界面，进行第 ${n + 1}/3 次重试`);
                    genshin.returnMainUi(); // 返回主界面
                    // 前往锅
                    await pathingScript.runFile("assets/pathing/蒙德-锅-坠星山谷蒙德城.json");
                    keyPress("F");
                    await sleep(1500);
                }
            }
            if (flag_check_ui) {
                if (setting_dic["other_settings"]["prime_cooking"] && setting_dic["other_settings"]["cooking_mode"] === "刷满熟练度(将选择的可烹饪食物熟练度刷满)") {
                    click(143, 1019); // 点击筛选按钮
                    await sleep(1000);
                    click(186, 1020); // 重置
                    await sleep(500);
                    click(76, 685); // 筛选熟练度未满
                    await sleep(500);
                    click(491, 1019); // 确认筛选
                    await sleep(1500);
                    let current_item_name = await recognize_item_name();
                    while (current_item_name) {
                        current_item_name = await recognize_item_name();
                        let cooking_result = await auto_cooking(current_item_name, setting_dic); // 自动烹饪方法
                        if (cooking_result) {
                            log.info(`${current_item_name} 完成！`);
                            await sleep(500);
                        } else {
                            log.warn(`${current_item_name} 料理过程中出错...`);
                        }
                    }
                } else {
                    for (const [food_name, num] of Object.entries(setting_dic["cooking"])) {
                        // 此处应加一个检测到主界面重新进入料理界面的逻辑
                        if (await is_cooking_page()) { // 检测并退出烹饪界面
                            keyPress("VK_ESCAPE");
                            await sleep(200);
                        }
                        let current_food_name = food_name; // 当前料理名
                        let check_state = await select_food_from_food_page(current_food_name, setting_dic); // 查找食谱
                        if (check_state) {
                            try {
                                let cooking_result = await auto_cooking(current_food_name, setting_dic); // 自动烹饪方法
                                if (cooking_result) {
                                    log.info(`${current_food_name} 完成！`);
                                    await sleep(500);
                                } else {
                                    log.warn(`${current_food_name} 料理过程中出错...`);
                                }
                            } catch (error) {
                                log.error(`${current_food_name} 料理过程中触发异常: ${error}`);
                            }
                        } else {
                            log.warn(`料理 ${current_food_name} 已跳过`);
                        }
                    }
                    for (const [character_name, num] of Object.entries(setting_dic["character"])) {
                        let current_food_name = food_dic[character_name]["belonging"]; // 当前料理名
                        let check_state = await select_food_from_food_page(current_food_name, setting_dic); // 查找食谱
                        if (check_state) {
                            try {
                                let cooking_result = await auto_cooking(current_food_name, setting_dic); // 自动烹饪方法
                                if (cooking_result) {
                                    log.info(`${current_food_name} 完成！`);
                                    await sleep(500);
                                } else {
                                    log.warn(`${current_food_name} 料理过程中出错...`);
                                }
                            } catch (error) {
                                log.error(`${current_food_name} 料理过程中触发异常: ${error}`);
                            }
                        } else {
                            log.warn(`料理 ${current_food_name} 已跳过`);
                        }
                    }
                }
            }
        }
        if (Object.keys(setting_dic["cooking"]).length === 0 && Object.keys(setting_dic["character"]).length === 0) {
            log.warn(`请在JS脚本配置内选择要烹饪的料理...`);
            await sleep(5000);
        }
        if (await is_cooking_page()) {
            keyPress("VK_ESCAPE");
            await sleep(200);
        }
    }

await main();
})();