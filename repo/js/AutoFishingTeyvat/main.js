(async function () { // CD读写仍有优化空间

    const area_list = ['蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔', '至冬', '挪德卡莱', '层岩巨渊·地下矿区', '渊下宫']
    const fish_list = ['花鳉', '波波心羽鲈', '烘烘心羽鲈', '维护机关·水域清理者', '维护机关·态势控制者', '维护机关·澄金领队型', '海涛斧枪鱼', '维护机关·初始能力型', '维护机关·白金典藏型', '吹沙角鲀', '甜甜花鳉', '擒霞客', '水晶宴', '斗棘鱼', '炮鲀', '流纹褐蝶鱼', '锖假龙', '金赤假龙', '玉玉心羽鲈', '赤魔王', '长生仙', '苦炮鲀', '肺棘鱼', '流纹京紫蝶鱼', '琉璃花鳉', '伪装鲨鲨独角鱼', '繁花斗士急流鱼', '深潜斗士急流鱼', '晚霞翻车鲀', '青浪翻车鲀', '拟似燃素独角鱼', '炽岩斗士急流鱼', '蓝染花鳉', '鸩棘鱼', '流纹茶蝶鱼', '雪中君', '真果角鲀', '青金斧枪鱼', '暮云角鲀', '翡玉斧枪鱼', '沉波蜜桃', '雷鸣仙', '佛玛洛鳐', '迪芙妲鳐', '秘源机关·巡戒使', '蓝昼明眼鱼', '冷冽巨斧鱼', '夜色明眼鱼', '炽铁巨斧鱼', '虹光凶凶鲨', '无奇巨斧鱼', '素素凶凶鲨']
    const bait_list = ['果酿饵', '酸桔饵', '维护机关频闪诱饵', '甘露饵', '赤糜饵', '飞蝇假饵', '蠕虫假饵', '澄晶果粒饵', '温火饵', '槲梭饵', '清白饵']
    const material_msg = {
        "风缠": ["花鳉", "蓝染花鳉", "鸩棘鱼", "流纹茶蝶鱼"],
        "愿者": ["花鳉", "甜甜花鳉", "斗棘鱼", "流纹褐蝶鱼"],
        "鸣川鹈饲": ["花鳉", "琉璃花鳉", "肺棘鱼", "流纹京紫蝶鱼"],
        "盘缘": ["花鳉", "真果角鲀", "暮云角鲀", "吹沙角鲀"],
        "穿浪斗枪": ["维护机关·初始能力型", "维护机关·水域清理者", "维护机关·态势控制者", "海涛斧枪鱼"],
        "长犀圆鸟和扁鱼": ["炽岩斗士急流鱼", "拟似燃素独角鱼", "青浪翻车鲀", "晚霞翻车鲀"],
        "渔获": ["雷鸣仙", "金赤假龙", "锖假龙"],
        "赤穗酒枡": ["雷鸣仙", "炮鲀", "苦炮鲀"],
        "竭泽": ["沉波蜜桃", "青金斧枪鱼", "翡玉斧枪鱼"],
        "原海鱼油": ["沉波蜜桃", "青金斧枪鱼", "翡玉斧枪鱼"],
        "灰河渡手": ["维护机关·白金典藏型", "波波心羽鲈", "烘烘心羽鲈", "海涛斧枪鱼"],
        "马腾斯万能护养剂": ["维护机关·白金典藏型", "波波心羽鲈", "烘烘心羽鲈", "海涛斧枪鱼"],
        "谧晖白枝": ["无奇巨斧鱼", "素素凶凶鲨", "蓝昼明眼鱼", "夜色明眼鱼"]
    }
    const time_msg = {
        '白天': ['烘烘心羽鲈', '维护机关·水域清理者', '吹沙角鲀', '水晶宴', '流纹褐蝶鱼', '赤魔王', '长生仙', '流纹京紫蝶鱼', '深潜斗士急流鱼', '青浪翻车鲀', '流纹茶蝶鱼', '真果角鲀', '沉波蜜桃', '蓝昼明眼鱼', '冷冽巨斧鱼'],
        '夜晚': ['波波心羽鲈', '维护机关·态势控制者', '维护机关·白金典藏型', '擒霞客', '斗棘鱼', '肺棘鱼', '繁花斗士急流鱼', '晚霞翻车鲀', '鸩棘鱼', '雪中君', '暮云角鲀', '雷鸣仙', '夜色明眼鱼', '炽铁巨斧鱼', '虹光凶凶鲨'],
        '全天': ['花鳉', '维护机关·澄金领队型', '海涛斧枪鱼', '维护机关·初始能力型', '甜甜花鳉', '炮鲀', '锖假龙', '金赤假龙', '玉玉心羽鲈', '苦炮鲀', '琉璃花鳉', '伪装鲨鲨独角鱼', '拟似燃素独角鱼', '炽岩斗士急流鱼', '蓝染花鳉', '青金斧枪鱼', '翡玉斧枪鱼', '佛玛洛鳐', '迪芙妲鳐', '秘源机关·巡戒使', '无奇巨斧鱼', '素素凶凶鲨']
    }
    const fish_msg = { // 可能有误，需要检查
        '花鳉': {'bait': '果酿饵', 'time': '全天'},
        '波波心羽鲈': {'bait': '酸桔饵', 'time': '夜晚'},
        '烘烘心羽鲈': {'bait': '酸桔饵', 'time': '白天'},
        '维护机关·水域清理者': {'bait': '维护机关频闪诱饵', 'time': '白天'},
        '维护机关·态势控制者': {'bait': '维护机关频闪诱饵', 'time': '夜晚'},
        '维护机关·澄金领队型': {'bait': '维护机关频闪诱饵', 'time': '全天'},
        '海涛斧枪鱼': {'bait': '甘露饵', 'time': '全天'},
        '维护机关·初始能力型': {'bait': '维护机关频闪诱饵', 'time': '全天'},
        '维护机关·白金典藏型': {'bait': '维护机关频闪诱饵', 'time': '夜晚'},
        '吹沙角鲀': {'bait': '甘露饵', 'time': '白天'},
        '甜甜花鳉': {'bait': '果酿饵', 'time': '全天'},
        '擒霞客': {'bait': '果酿饵', 'time': '夜晚'},
        '水晶宴': {'bait': '果酿饵', 'time': '白天'},
        '斗棘鱼': {'bait': '赤糜饵', 'time': '夜晚'},
        '炮鲀': {'bait': '飞蝇假饵', 'time': '全天'},
        '流纹褐蝶鱼': {'bait': '蠕虫假饵', 'time': '白天'},
        '锖假龙': {'bait': '飞蝇假饵', 'time': '全天'},
        '金赤假龙': {'bait': '飞蝇假饵', 'time': '全天'},
        '玉玉心羽鲈': {'bait': '酸桔饵', 'time': '全天'},
        '赤魔王': {'bait': '赤糜饵', 'time': '白天'},
        '长生仙': {'bait': '蠕虫假饵', 'time': '白天'},
        '苦炮鲀': {'bait': '飞蝇假饵', 'time': '全天'},
        '肺棘鱼': {'bait': '赤糜饵', 'time': '夜晚'},
        '流纹京紫蝶鱼': {'bait': '蠕虫假饵', 'time': '白天'},
        '琉璃花鳉': {'bait': '果酿饵', 'time': '全天'},
        '伪装鲨鲨独角鱼': {'bait': '澄晶果粒饵', 'time': '全天'},
        '繁花斗士急流鱼': {'bait': '澄晶果粒饵', 'time': '夜晚'},
        '深潜斗士急流鱼': {'bait': '澄晶果粒饵', 'time': '白天'},
        '晚霞翻车鲀': {'bait': '澄晶果粒饵', 'time': '夜晚'},
        '青浪翻车鲀': {'bait': '澄晶果粒饵', 'time': '白天'},
        '拟似燃素独角鱼': {'bait': '温火饵', 'time': '全天'},
        '炽岩斗士急流鱼': {'bait': '温火饵', 'time': '全天'},
        '蓝染花鳉': {'bait': '果酿饵', 'time': '全天'},
        '鸩棘鱼': {'bait': '赤糜饵', 'time': '夜晚'},
        '流纹茶蝶鱼': {'bait': '蠕虫假饵', 'time': '白天'},
        '雪中君': {'bait': '赤糜饵', 'time': '夜晚'},
        '真果角鲀': {'bait': '甘露饵', 'time': '白天'},
        '青金斧枪鱼': {'bait': '甘露饵', 'time': '全天'},
        '暮云角鲀': {'bait': '甘露饵', 'time': '夜晚'},
        '翡玉斧枪鱼': {'bait': '甘露饵', 'time': '全天'},
        '沉波蜜桃': {'bait': '甘露饵', 'time': '白天'},
        '雷鸣仙': {'bait': '蠕虫假饵', 'time': '夜晚'},
        '佛玛洛鳐': {'bait': '飞蝇假饵', 'time': '全天'},
        '迪芙妲鳐': {'bait': '飞蝇假饵', 'time': '全天'},
        '秘源机关·巡戒使': {'bait': '温火饵', 'time': '全天'},
        '蓝昼明眼鱼': {'bait': '清白饵', 'time': '白天'},
        '夜色明眼鱼': {'bait': '清白饵', 'time': '夜晚'},
        '无奇巨斧鱼': {'bait': '槲梭饵', 'time': '全天'},
        '素素凶凶鲨': {'bait': '清白饵', 'time': '全天'},
        '炽铁巨斧鱼': {'bait': '槲梭饵', 'time': '夜晚'},
        '虹光凶凶鲨': {'bait': '清白饵', 'time': '夜晚'},
        '冷冽巨斧鱼': {'bait': '槲梭饵', 'time': '白天'}
    }
    const path_pathing = [
        '枫丹-垂钓点-伊黎耶林区幽林雾道西南-花鳉_波波心羽鲈_烘烘心羽鲈_维护机关·水域清理者_维护机关·态势控制者_维护机关·澄金领队型-果酿饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-伊黎耶林区柔灯港西北-海涛斧枪鱼_波波心羽鲈_维护机关·水域清理者_维护机关·澄金领队型-甘露饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-枫丹动能工程科学研究院区中央实验室遗址南-花鳉_海涛斧枪鱼_波波心羽鲈_维护机关·初始能力型_维护机关·水域清理者-果酿饵_甘露饵_酸桔饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-枫丹廷区茉洁站西南-海涛斧枪鱼_烘烘心羽鲈_维护机关·初始能力型_维护机关·态势控制者-甘露饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-枫丹廷区枫丹廷东北-海涛斧枪鱼_波波心羽鲈_烘烘心羽鲈_维护机关·水域清理者_维护机关·态势控制者-甘露饵_酸橘饵_维护机关频闪诱饵-GCM',
        '枫丹-垂钓点-枫丹廷区枫丹廷南-花鳉_海涛斧枪鱼_维护机关·水域清理者_维护机关·态势控制者-果酿饵_甘露饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-白露区白淞镇西南-花鳉_波波心羽鲈_烘烘心羽鲈_维护机关·水域清理者_维护机关·白金典藏型-果酿饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-翡黎区芒索斯山东麓东-海涛斧枪鱼_烘烘心羽鲈_维护机关·初始能力型_维护机关·态势控制者-甘露饵_酸桔饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-苍晶区厄里那斯东-海涛斧枪鱼_波波心羽鲈_烘烘心羽鲈_维护机关·初始能力型-甘露饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-苍晶区厄里那斯东北-吹沙角鲀_波波心羽鲈_维护机关·初始能力型_维护机关·水域清理者_维护机关·态势控制者-甘露饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-苍晶区海露港北-海涛斧枪鱼_波波心羽鲈_烘烘心羽鲈_维护机关·水域清理者_维护机关·态势控制者-甘露饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-莫尔泰区卡布狄斯堡遗迹南-花鳉_波波心羽鲈_烘烘心羽鲈_维护机关·态势控制者_维护机关·澄金领队型-果酿饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-莫尔泰区欧庇克莱歌剧院南-海涛斧枪鱼_烘烘心羽鲈_维护机关·水域清理者_维护机关·态势控制者_维护机关·澄金领队型-甘露饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-诺思托伊区佩特莉可镇南-海涛斧枪鱼_波波心羽鲈_烘烘心羽鲈_维护机关·初始能力型_维护机关·水域清理者_维护机关·态势控制者_维护机关·澄金领队型-甘露饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-枫丹廷区欧庇克莱歌剧院西-海涛斧枪鱼_波波心羽鲈_烘烘心羽鲈_维护机关·初始能力型-甘露饵_酸橘饵_维护机关频闪诱饵-GCM',
        '璃月-垂钓点-云来海璃月港东南-甜甜花鳉_擒霞客_水晶宴_斗棘鱼_炮鲀-果酿饵_赤糜饵_飞蝇假饵-普通',
        '璃月-垂钓点-沉玉谷·上谷古树茶坡-花鳉_斗棘鱼_流纹褐蝶鱼_锖假龙_金赤假龙_玉玉心羽鲈-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵_酸桔饵-普通',
        '璃月-垂钓点-沉玉谷·上谷古树茶坡东-花鳉_擒霞客_水晶宴_斗棘鱼_锖假龙_玉玉心羽鲈-果酿饵_赤糜饵_飞蝇假饵_酸桔饵-普通',
        '璃月-垂钓点-沉玉谷·南陵悬练山西南-甜甜花鳉_擒霞客_赤魔王_金赤假龙_玉玉心羽鲈-果酿饵_赤糜饵_飞蝇假饵_酸桔饵-普通',
        '璃月-垂钓点-珉林天遒谷-花鳉_水晶宴_斗棘鱼-果酿饵_赤糜饵-战斗',
        '璃月-垂钓点-珉林奥藏山-花鳉_甜甜花鳉_擒霞客_水晶宴_长生仙-果酿饵_蠕虫假饵-普通',
        '璃月-垂钓点-珉林琥牢山东-花鳉_甜甜花鳉_擒霞客_水晶宴_斗棘鱼_流纹褐蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '璃月-垂钓点-琼玑野归离原东北-甜甜花鳉_斗棘鱼_赤魔王_金赤假龙_錆假龙_流纹褐蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '璃月-垂钓点-琼玑野渌华池-甜甜花鳉_斗棘鱼_赤魔王_金赤假龙_錆假龙_流纹褐蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '璃月-垂钓点-碧水原奥藏山东-花鳉_擒霞客_水晶宴_流纹褐蝶鱼-果酿饵_蠕虫假饵-战斗',
        '璃月-垂钓点-碧水原无妄坡南-花鳉_甜甜花鳉_擒霞客_流纹褐蝶鱼-果酿饵_蠕虫假饵-战斗',
        '璃月-垂钓点-碧水原望舒客栈西-甜甜花鳉_斗棘鱼_赤魔王_金赤假龙_锖假龙_流纹褐蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '璃月-垂钓点-碧水原药蝶谷东-花鳉_斗棘鱼_流纹褐蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '璃月-垂钓点-碧水原轻策庄东北-甜甜花鳉_擒霞客_水晶宴_斗棘鱼_流纹褐蝶鱼_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '层岩巨渊·地下矿区-垂钓点-地下水泽西-花锵_斗棘鱼_赤魔王_流纹褐蝶鱼_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '层岩巨渊·地下矿区-垂钓点-无名遗迹西-甜甜花锵_擒霞客_水晶宴_赤魔王_炮鲀-果酿饵_赤糜饵_飞蝇假饵-战斗',
        '稻妻-垂钓点-八酝岛名椎滩北-花鳉_肺棘鱼_流纹京紫蝶鱼_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-战斗',
        '稻妻-垂钓点-海祇岛水月池东-花鳉_琉璃花鳉_擒霞客_水晶宴_肺棘鱼_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵-战斗',
        '稻妻-垂钓点-海祇岛珊瑚宫北-花鳉_琉璃花鳉_擒霞客_水晶宴_肺棘鱼_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '稻妻-垂钓点-清籁岛天云峠北-花鳉_擒霞客_水晶宴_流纹京紫蝶鱼_炮鲀-果酿饵_蠕虫假饵_飞蝇假饵-普通',
        '稻妻-垂钓点-清籁岛越石村东南-琉璃花鳉_肺棘鱼_赤魔王_金赤假龙_锖假龙_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '稻妻-垂钓点-神无冢甘金岛南-琉璃花鳉_肺棘鱼_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '稻妻-垂钓点-鸣神岛离岛西-琉璃花鳉_肺棘鱼_赤魔王_炮鲀_苦炮鲀-果酿饵_赤糜饵_飞蝇假饵-普通',
        '稻妻-垂钓点-鹤观千来神祠西-花鳉_琉璃花鳉_擒霞客_水晶宴-果酿饵-普通',
        '稻妻-垂钓点-鹤观逢岳之野西南-花鳉_肺棘鱼_赤魔王_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '稻妻-垂钓点-神无冢九条阵屋东南-雷鸣仙-蠕虫假饵-GCM',
        '渊下宫-垂钓点-蛇肠之路南-水晶宴_肺棘鱼_佛玛洛鳐_迪芙妲鳐-果酿饵_赤糜饵_飞蝇假饵-普通',
        '渊下宫-垂钓点-蛇心之地北-擒霞客_赤魔王_佛玛洛鳐_迪芙妲鳐-果酿饵_赤糜饵_飞蝇假饵-战斗',
        '渊下宫-垂钓点-蛇心之地西北-擒霞客_流纹京紫鲽鱼_佛玛洛鳐_迪芙妲鳐-果酿饵_蠕虫假饵_飞蝇假饵-普通',
        '纳塔-垂钓点-境壁山浮羽之湾东-伪装鲨鲨独角鱼_花鳉_繁花斗士急流鱼_深潜斗士急流鱼_晚霞翻车鲀_青浪翻车鲀-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔东-花鳉_青浪翻车鲀_晚霞翻车鲀_伪装鲨鲨独角鱼-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔东北-青浪翻车鲀_繁花斗士急流鱼_伪装鲨鲨独角鱼-澄晶果粒饵-战斗',
        '纳塔-垂钓点-奥奇卡纳塔北-花鳉_晚霞翻车鲀_伪装鲨鲨独角鱼_深潜斗士急流鱼-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔南-花鳉_繁花斗士急流鱼_深潜斗士急流鱼_青浪翻车鲀_晚霞翻车鲀-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔西-深潜斗士急流鱼_繁花斗士急流鱼_伪装鲨鲨独角鱼-澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔西北-拟似燃素独角鱼_炽岩斗士急流鱼-温火饵-普通',
        '纳塔-垂钓点-涌流地溶水域-炽岩斗士急流鱼_拟似燃素独角鱼-温火饵-普通',
        '纳塔-垂钓点-翘枝崖花羽会北-晚霞翻车鲀_深潜斗士急流鱼_伪装鲨鲨独角鱼-澄晶果粒饵-普通',
        '纳塔-垂钓点-翘枝崖花羽会西-花鳉_繁花斗士急流鱼_深潜斗士急流鱼_晚霞翻车鲀_伪装鲨鲨独角鱼-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-距石山祖遗庙宇东-炽岩斗士急流鱼_拟似燃素独角鱼-温火饵-普通',
        '纳塔-垂钓点-安饶之野西-拟似燃素独角鱼_秘源机关·巡戒使-温火饵-普通',
        '纳塔-垂钓点-安饶之野西北-炽岩斗士急流鱼_拟似燃素独角鱼_秘源机关·巡戒使-温火饵-普通',
        '纳塔-垂钓点-安饶之野东-花鳉_繁花斗士急流鱼_青浪翻车鲀_晚霞翻车鲀_伪装鲨鲨独角鱼-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-悠悠度假村彩彩崖北-花鳉_繁花斗士急流鱼_青浪翻车鲀_伪装鲨鲨独角鱼-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-悠悠度假村呼呼丘西南-繁花斗士急流鱼_深潜斗士急流鱼_晚霞翻车鲀_伪装鲨鲨独角鱼-澄晶果粒饵-普通',
        '纳塔-垂钓点-悠悠度假村悠悠集市西南-花鳉_深潜斗士急流鱼_青浪翻车鲀_晚霞翻车鲀-果酿饵_澄晶果粒饵-普通',
        // '远古圣山-垂钓点-分流识海-炽岩斗士急流鱼_秘源机关·巡戒使-温火饵-普通',
        '蒙德-垂钓点-龙脊雪山寒天之钉西-花鳉_鸩棘鱼_雪中君_流纹茶蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '蒙德-垂钓点-坠星山谷低语森林南-蓝染花鳉_水晶宴_鸩棘鱼_锖假龙_流纹茶蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-坠星山谷望风山地-花鳉_蓝染花鳉_擒霞客_水晶宴_鸩棘鱼_金赤假龙_流纹茶蝶-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-明冠山地风龙废墟北-花鳉_蓝染花鳉_擒霞客_水晶宴-果酿饵-战斗',
        '蒙德-垂钓点-明冠山地风龙废墟南-花鳉_蓝染花鳉_擒霞客_流纹茶蝶鱼-果酿饵_蠕虫假饵-普通',
        '蒙德-垂钓点-苍风高地晨曦酒庄西南-蓝染花鳉_擒霞客_鸩棘鱼_赤魔王_流纹茶蝶鱼_炮鲀_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-战斗',
        '蒙德-垂钓点-苍风高地清泉镇北-花鳉_蓝染花鳉_鸩棘鱼_赤魔王_流纹茶蝶鱼_炮鲀_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-风啸山坡风起地南-花鳉_蓝染花鳉_鸩棘鱼_流纹茶蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '须弥-垂钓点-下风蚀地活力之家西南-花鳉_擒霞客_赤魔王_真果角鲀_青金斧枪鱼-果酿饵_赤糜饵_甘露饵-普通',
        '须弥-垂钓点-下风蚀地阿如村-花鳉_水晶宴_吹沙角鲀_暮云角鲀_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-千壑沙地「五绿洲」的孑遗-真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-甘露饵-战斗',
        '须弥-垂钓点-护世森无郁稠林-沉波蜜桃_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-甘露饵-普通',
        '须弥-垂钓点-桓那兰那觉王之殿北-花鳉_真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-荒石苍漠铁穆山南-擒霞客_真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-道成林天臂池-赤魔王_真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-赤糜饵_甘露饵-普通',
        '须弥-垂钓点-道成林维摩庄北-花鳉_真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-道成林须弥城南-擒霞客_吹沙角鲀_暮云角鲀_青金斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-阿陀河谷奥摩斯港北-水晶宴_真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-阿陀河谷降诸魔山-擒霞客_真果角鲀_暮云角鲀_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '挪德卡莱-垂钓点-伦波岛叮铃哐啷蛋卷工坊北-花鳉_蓝昼明眼鱼_夜色明眼鱼_无奇巨斧鱼_素素凶凶鲨-果酿饵_槲梭饵_清白饵-普通',
        '挪德卡莱-垂钓点-伦波岛空寂走廊西北-花鳉_蓝昼明眼鱼_夜色明眼鱼-果酿饵_清白饵-普通',
        '挪德卡莱-垂钓点-伦波岛蓝珀湖-无奇巨斧鱼_冷冽巨斧鱼_炽铁巨斧鱼_素素凶凶鲨_虹光凶凶鲨-槲梭饵_清白饵-普通',
        '挪德卡莱-垂钓点-伦波岛那夏镇西南-花鳉_无奇巨斧鱼_冷冽巨斧鱼_夜色明眼鱼-果酿饵_槲梭饵_清白饵-普通',
        '挪德卡莱-垂钓点-帕哈岛月矩力实验设计局北-花鳉_蓝昼明眼鱼_素素凶凶鲨_虹光凶凶鲨-果酿饵_清白饵-普通',
        '挪德卡莱-垂钓点-帕哈岛月矩力实验设计局东南-花鳉_无奇巨斧鱼_冷冽巨斧鱼_夜色明眼鱼-果酿饵_槲梭饵_清白饵-普通',
        '挪德卡莱-垂钓点-希汐岛沐光之台西南-素素凶凶鲨_虹光凶凶鲨_蓝昼明眼鱼_夜色明眼鱼-槲梭饵_清白饵-普通',
        '挪德卡莱-垂钓点-希汐岛霜月之坊东北-冷冽巨斧鱼_蓝昼明眼鱼_夜色明眼鱼_虹光凶凶鲨-槲梭饵_清白饵-普通',
        '挪德卡莱-垂钓点-希汐岛霜月之坊西-花鳉_蓝昼明眼鱼_夜色明眼鱼-果酿饵_清白饵-战斗'
    ]
    const fishing_time_dic = {
        "全天": {"name": "All", "param": 0},
        "白天": {"name": "Daytime", "param": 1},
        "夜晚": {"name": "Nighttime", "param": 2},
        "禁用": {"name": "Block", "param": ""},
    }
    // const positions = {
    //     "quick_change_state": [169, 1019],
    //     "return_btn": [78, 1023],
    //     "bottom1": [235, 1013],
    //     "bottom2": [360, 1013],
    //     "bottom3" : [485, 1013],
    //     "bottom4": [610, 1013],
    //     "upper1_pos": [117, 152, 124, 74],
    //     "upper2_pos": [263, 152, 124, 74],
    //     "upper3_pos": [409, 152, 124, 74],
    //     "upper4_pos": [555, 152, 124, 74],
    //     "bottom1_pos": [193, 970, 85, 85],
    //     "bottom2_pos": [318, 970, 85, 85],
    //     "bottom3_pos": [443, 970, 85, 85],
    //     "bottom4_pos": [568, 970, 85, 85],
    //     "confirm_btn": [1733, 1020]
    // }
    const statue_name = "蒙德-七天神像-苍风高地";
    // 存储本次任务中的所有鱼类，作为调节时间的关键参考
    let list_fish = [];

    // 偽造日志
    async function fakeLog(name, isJs, isStart, duration) {
        await sleep(10);
        const currentTime = Date.now();
        // 参数检查
        if (typeof name !== 'string') {
            log.error("参数 'name' 必须是字符串类型！");
            return;
        }
        if (typeof isJs !== 'boolean') {
            log.error("参数 'isJs' 必须是布尔型！");
            return;
        }
        if (typeof isStart !== 'boolean') {
            log.error("参数 'isStart' 必须是布尔型！");
            return;
        }
        if (typeof currentTime !== 'number' || !Number.isInteger(currentTime)) {
            log.error("参数 'currentTime' 必须是整数！");
            return;
        }
        if (typeof duration !== 'number' || !Number.isInteger(duration)) {
            log.error("参数 'duration' 必须是整数！");
            return;
        }

        // 将 currentTime 转换为 Date 对象并格式化为 HH:mm:ss.sss
        const date = new Date(currentTime);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
        const formattedTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;

        // 将 duration 转换为分钟和秒，并保留三位小数
        const durationInSeconds = duration / 1000; // 转换为秒
        const durationMinutes = Math.floor(durationInSeconds / 60);
        const durationSeconds = (durationInSeconds % 60).toFixed(3); // 保留三位小数

        // 使用四个独立的 if 语句处理四种情况
        if (isJs && isStart) {
            // 处理 isJs = true 且 isStart = true 的情况
            const logMessage = `正在伪造js开始的日志记录\n\n` +
                `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
                `------------------------------\n\n` +
                `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
                `→ 开始执行JS脚本: "${name}"`;
            log.debug(logMessage);
        }
        if (isJs && !isStart) {
            // 处理 isJs = true 且 isStart = false 的情况
            const logMessage = `正在伪造js结束的日志记录\n\n` +
                `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
                `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
                `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
                `------------------------------`;
            log.debug(logMessage);
        }
        if (!isJs && isStart) {
            // 处理 isJs = false 且 isStart = true 的情况
            const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
                `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
                `------------------------------\n\n` +
                `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
                `→ 开始执行地图追踪任务: "${name}"`;
            log.debug(logMessage);
        }
        if (!isJs && !isStart) {
            // 处理 isJs = false 且 isStart = false 的情况
            const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
                `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
                `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
                `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
                `------------------------------`;
            log.debug(logMessage);
        }
        // 交互或拾取："XXXX"
        if (duration == 9527) {
            // const logMessage = `正在 交互或拾取 的日志记录\n\n` +
            //     `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            //     `------------------------------\n\n` +
            //     `[${formattedTime}] [INF] BetterGenshinImpact.Service.AutoPick.AutoPickTrigger\n` +
            //     `交互或拾取："${name}"`;
            // log.debug(logMessage);
            log.info(`交互或拾取："${name}"`);
        }

    }

    /**
     *
     * 向上/下滑动一或多个页面[主要物品选择页面](有误差)
     *
     * @param {string} [direction]: 滑动方向
     * @param {bigint} [pages]: 页数
     * @returns {Promise<void>} true 成功滑动/未滑动到底部 false 异常/滑动到底部
     */
    async function scroll_pages_main(direction = "down", pages = 1) {
        const slide_bar_upRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/slide_bar_main_up.png"), 1282, 112, 13, 840);
        const slide_bar_downRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/slide_bar_main_down.png"), 1282, 112, 13, 840);
        slide_bar_upRo.threshold = 0.6;
        slide_bar_downRo.threshold = 0.6;
        for (let i = 0; i < pages; i++) {
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
            await sleep(200);
            const gameRegion = captureGameRegion();
            let slide_bar_up = gameRegion.Find(slide_bar_upRo); // 当前页面模板匹配
            let slide_bar_down = gameRegion.Find(slide_bar_downRo); // 当前页面模板匹配
            gameRegion.dispose();
            if (slide_bar_up.isExist() && slide_bar_down.isExist()) {
                log.info(`定位到滑块...(${slide_bar_up.x}, ${slide_bar_up.y})-滑动方向: ${direction}`);
                if (slide_bar_down.y > 920 && direction === "down") {
                    log.info(`滑块已经滑动到底部...`);
                    return i !== 0;
                } else if (slide_bar_up.y < 125 && direction === "up") {
                    log.info(`滑块已经滑动到顶部...`);
                    return i !== 0;
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
     * 将毫秒形式的字符串转换为更清晰的时间格式
     *
     * @param ms
     * @returns {string}
     */
    function formatTimeDifference(ms) {
        ms = Number(ms);
        // 计算天、小时、分钟、秒
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        // 计算剩余的小时、分钟、秒
        const remainingHours = hours % 24;
        const remainingMinutes = minutes % 60;
        const remainingSeconds = seconds % 60;

        // 返回格式化字符串
        return `${days}天 ${remainingHours}小时 ${remainingMinutes}分钟 ${remainingSeconds}秒`;
    }

    /**
     *
     * 垂钓点CD存档写入
     *
     * @param {string} pathing_name 路径名称
     * @param {string} time_status 垂钓点时间状态（白天，夜晚）
     * @param {string} timestamp 时间戳
     * @param {string} user_id 原神UID
     */
    function write_archive(pathing_name, time_status, timestamp, user_id) {
        let assets_dir = Array.from(file.readPathSync("assets"));
        let content = {};
        if (assets_dir.includes("assets\\archive.json")) {
            content = JSON.parse(file.readTextSync("assets/archive.json"));
            if (!Object.keys(content).includes(user_id)) {
                content[user_id] = {};
            }
            if (!Object.keys(content[user_id]).includes(pathing_name)) {
                content[user_id][pathing_name] = {};
            }
            if (time_status === "全天") {
                content[user_id][pathing_name]["Daytime"] = timestamp;
                content[user_id][pathing_name]["Nighttime"] = timestamp;
            } else if (time_status === "白天") {
                content[user_id][pathing_name]["Daytime"] = timestamp;
                content[user_id][pathing_name]["Nighttime"] = Object.keys(content[user_id][pathing_name]).includes("Nighttime") ? content[user_id][pathing_name]["Nighttime"]: null;
            } else if (time_status === "夜晚") {
                content[user_id][pathing_name]["Daytime"] = Object.keys(content[user_id][pathing_name]).includes("Daytime") ? content[user_id][pathing_name]["Daytime"]: null;
                content[user_id][pathing_name]["Nighttime"] = timestamp;
            }

        } else {
            content[user_id] = {};
            content[user_id][pathing_name] = {
                "Daytime": time_status === "白天" || time_status === "全天" ? timestamp : null,
                "Nighttime": time_status === "夜晚" || time_status === "全天" ? timestamp : null
            };

        }

        file.WriteTextSync("assets/archive.json", JSON.stringify(content, null, 2), false);
    }

    /**
     *
     * 垂钓点CD存档读取
     *
     * @param {string} pathing_name 路径名称
     * @param {string} user_id 原神UID
     *
     * @return Daytime/Nighttime 字典
     */
    function read_archive(pathing_name, user_id) {
        let assets_dir = Array.from(file.readPathSync("assets"));

        if (assets_dir.includes("assets\\archive.json")) {
            let content = JSON.parse(file.readTextSync("assets/archive.json"));
            if (Object.keys(content).includes(user_id)) {
                if (Object.keys(content[user_id]).includes(pathing_name)) {
                    return content[user_id][pathing_name];
                } else {
                    return null;
                }
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    /**
     * 获取路径包含的信息
     *
     * @param {string} pathing_name - 包含路径信息的字符串，格式如"地区-类型-详细位置-鱼类_种类-饵类_种类-附加信息"
     * @returns {Object} 包含解析后路径信息的对象，具有以下属性：
     *  - name {string} 全名
     *  - area {string} 地区
     *  - type {string} 类型
     *  - detail {string} 详细位置
     *  - fish_type {Array.<string>} 鱼类种类数组
     *  - bait_type {Array.<string>} 饵类种类数组
     *  - addition {string} 附加信息
     */
    function get_pathing_msg(pathing_name) {
        let msg_dic = {};
        let path_message = pathing_name.split('-');

        msg_dic["name"] = pathing_name; // 全名
        msg_dic["area"] = path_message[0]; // 地区
        msg_dic["type"] = path_message[1]; // 类型
        msg_dic["detail"] = path_message[2]; // 详细位置
        msg_dic["fish_type"] = path_message[3].split('_'); // 鱼类
        msg_dic["bait_type"] = path_message[4].split('_'); // 饵类
        msg_dic["addition"] = path_message[5]; // 附加信息

        return msg_dic;
    }

    // 根据脚本配置筛选路径并显示配置
    function pathing_filter() {
        try {
            // 存储筛选后的路径
            let path_list = [];
            // 正则表达式
            let regex_area, regex_fish, regex_bait;

            // 读取地区
            let path_sort_area = typeof(settings.path_sort_area) === 'undefined' || settings.path_sort_area === "" ? [] : settings.path_sort_area.split(' ');
            // 读取鱼类
            let path_sort_fish = typeof(settings.path_sort_fish) === 'undefined' || settings.path_sort_fish === "" ? [] : settings.path_sort_fish.split(' ');
            // 读取鱼饵
            let path_sort_bait = typeof(settings.path_sort_bait) === 'undefined' || settings.path_sort_bait === "" ? [] : settings.path_sort_bait.split(' ');
            // 读取兑换材料
            let path_sort_material = typeof(settings.path_sort_material) === 'undefined' ? "无(默认)" : settings.path_sort_material;
            // 读取调试信息
            let path_select = typeof(settings.path_select) === 'undefined' ? "无(默认)" : settings.path_select;

            // 调式模式
            if (path_select !== "无(默认)") {
                let temp_path_msg = path_select.split("-");
                const regex_path = new RegExp(`${temp_path_msg[0]}-${temp_path_msg[1]}-${temp_path_msg[2]}`);
                for (const path of path_pathing) {
                    if (regex_path.test(path)) {
                        path_list.push(path);
                        return path_list;
                    }
                }
                log.error("错误，调试路径不存在");
                return path_list;
            }
            // 生成正则表达式
            if (path_sort_area.length !== 0) { // 地区
                regex_area = new RegExp(path_sort_area.join("|"));
            } else {
                regex_area = new RegExp(area_list.join("|"));
            }
            if (path_sort_fish.length !== 0) { // 鱼类
                regex_fish = new RegExp(path_sort_fish.join("|"));
            } else {
                regex_fish = new RegExp(fish_list.join("|"));
            }
            if (path_sort_bait.length !== 0) { // 鱼饵
                regex_bait = new RegExp(path_sort_bait.join("|"));
            } else {
                regex_bait = new RegExp(bait_list.join("|"));
            }
            // 额外判断（空项）
            let default_set = path_sort_area.length === 0 && path_sort_fish.length === 0 && path_sort_bait.length === 0 && path_sort_material === "无";
            // 排除计算的饵类（根据已选的鱼类计算）
            let bait_exclude = [];
            // 排除后剩下的饵类
            let bait_include = [];
            // 正则表达式-排除饵类后余下的饵类
            let regex_bait_include = regex_bait;

            if (path_sort_material === "无(默认)" || default_set) {
                // 加入时间调节参照数组
                if (path_sort_fish.length !== 0) {
                    list_fish = path_sort_fish;
                    for (const each_fish of list_fish) {
                        if (!bait_exclude.includes(fish_msg[each_fish]["bait"])) { // 已含有相同饵类就跳过
                            bait_exclude.push(fish_msg[each_fish]["bait"]);
                        }
                    }
                    bait_include = path_sort_bait.filter(item => !bait_exclude.includes(item))
                    // 根据 全部饵类 排除掉 排除计算的饵类 后剩下的饵类生成正则表达式
                    regex_bait_include = new RegExp(bait_include.join("|"));
                }

                for (const [name, msg] of Object.entries(fish_msg)) {
                    if (bait_exclude.length === 0 && regex_bait.test(msg["bait"])) { // 用户未限制鱼类，根据饵类添加鱼类
                        list_fish.push(name);
                    } else if (bait_include.length !== 0) { // 根据排除后的饵类计算添加的鱼类
                        if (regex_bait_include.test(msg["bait"])) {
                            list_fish.push(name);
                        }
                    }
                }

                for  (const path of path_pathing) {
                    if (regex_area.test(path) && regex_fish.test(path) && regex_bait_include.test(path)) { // 逻辑薄弱点，可能导致bug
                        path_list.push(path);
                    }
                }
            } else {
                for (const [material_name, msg] of Object.entries(material_msg)) {
                    // 目标材料正则表达式
                    const check_regex = new RegExp(material_name);

                    if (check_regex.test(path_sort_material)) {
                        // 作为时间调节参照数组
                        list_fish = msg;
                        log.info(`目标材料: ${material_name}\n鱼类: ${msg}`);
                        for  (const path of path_pathing) {
                            const fish_sort_regex = new RegExp(msg.join("|"));
                            if (fish_sort_regex.test(path)) {
                                path_list.push(path);
                            }
                        }
                        break;
                    }
                }
            }
            return path_list;
        } catch (error) {
            log.error(`JS脚本配置读取错误，请检查脚本配置格式: ${error}`);
            return null;
        }
    }

    async function run_file(path_msg, time_out_throw, time_out_whole, is_con, block_gcm, block_fight, block_tsurumi, tsurumi_method, auto_skip, fishing_cd, uid = "default_user", is_time_kill, time_target, kill_hour, kill_minute) {
        const base_path_pathing = "assets/pathing/";
        const base_path_gcm = "assets/KeyMouseScript/";
        const base_path_statues = "assets/pathing_others/";
        const file_name = `${path_msg["area"]}-${path_msg["type"]}-${path_msg["detail"]}`;

        // 检测禁用键鼠设置
        if (block_gcm && !is_con && path_msg["addition"] === "GCM") {
            log.info(`跳过键鼠路线: ${file_name}`)
            return null;
        }
        // 检测禁用战斗设置
        if (!block_fight && !is_con && path_msg["addition"] === "战斗") {
            log.info(`跳过战斗路线: ${file_name}`)
            return null;
        }
        // 检测禁用鹤观设置
        if (!block_tsurumi && !is_con && /鹤观/.test(path_msg["detail"])) {
            log.info(`跳过鹤观路线: ${file_name}`)
            return null;
        }

        // 时间调节
        let fishing_time = "全天";
        // 读取调试模式的时间
        let path_time = typeof(settings.path_time) === 'undefined' ? "全天" : settings.path_time;
        // 需要的鱼类
        let fish_need = list_fish.filter(item => path_msg["fish_type"].includes(item));
        // 正则-全天出现的鱼
        const regex_all = new RegExp(time_msg["全天"].join("|"));


        // 区分调试模式和非调试模式
        if (is_con) { // 调式
            log.info(`该钓鱼点包含的鱼类: ${path_msg["fish_type"].join("-")}`);
        } else {
            log.info(`该钓鱼点需要的鱼类: ${fish_need}`);
        }


        if (!fish_need.some(item => regex_all.test(item)) && !is_con) { // 不是 全天 的情况
            // 正则-白天出现的鱼
            const regex_daytime = new RegExp(time_msg["白天"].join("|"));
            // 正则-夜晚出现的鱼
            const regex_nighttime = new RegExp(time_msg["夜晚"].join("|"));
            // 判断昼夜出没的鱼是否存在
            const is_daytime = fish_need.some(item => regex_daytime.test(item));
            const is_nighttime = fish_need.some(item => regex_nighttime.test(item));

            // 调式模式不弹出未匹配钓鱼时间的报错
            if (!is_daytime && !is_nighttime && (typeof(settings.path_select) === 'undefined' || settings.path_select === "无(默认)")) {
                log.error("出错：未找到匹配的钓鱼时间")
                return null;
            } else if (is_daytime && !is_nighttime){ // 只有白天的鱼
                fishing_time = "白天";
            } else if (!is_daytime && is_nighttime){ // 只有夜晚的鱼
                fishing_time = "夜晚";
            }
            // 昼夜都有则还是 全天
        } else if (is_con) { // 调式时间
            if (path_time === "全天(默认)") {
                path_time = "全天";
            }
            fishing_time = path_time;
        }

        if (auto_skip) {
            // log.info(`[DEBUG] 开始自动领取月卡`);
            // 4点自动领取月卡
            let time_now = new Date();
            let time_4 = new Date(time_now.getFullYear(), time_now.getMonth(), time_now.getDate(), 4, 0, 0); // 4点
            // log.info(`[DEBUG] time_now: ${time_now}`);
            // log.info(`[DEBUG] time_4: ${time_4}`);
            let time_predict_end; // 根据超时时间预测本次钓鱼结束时间（加1分钟容错）
            if (fishing_time === "全天") {
                time_predict_end = new Date(time_now.getTime() + (time_out_whole * 2 + 60) * 1000);
            } else {
                time_predict_end = new Date(time_now.getTime() + (time_out_whole + 60) * 1000);
            }
            // log.info(`[DEBUG] time_predict_end: ${time_predict_end}`);
            // log.info(`[DEBUG] ${time_now < time_4} | ${time_predict_end >= time_4}`);
            // 30s点击一次，等待领取月卡
            let step_flag = 0; // 领取月卡步骤标志
            while (time_now < time_4 && time_predict_end >= time_4) {
                log.info(`等待领取月卡(剩余${Math.floor((time_4 - new Date()) / 1000)}s)...`);
                if (step_flag === 0) {
                    // 传送到七天神像
                    await pathingScript.runFile(base_path_statues + statue_name + ".json");
                    step_flag += 1;
                }
                await sleep(30000);
                keyPress("ESCAPE");
                await sleep(2000);
                keyPress("ESCAPE");

                time_now = new Date();

            }
            // 本次已经到达4点(5s容错)
            if (new Date() > time_4.setSeconds(time_4.getSeconds()) && new Date() < time_4.setSeconds(time_4.getSeconds() + 5)) {
                await sleep(5000);
                step_flag += 1;
            } else { // 启用CD统计后每轮跳过额外等待10ms
                await sleep(10);
            }
            // 领取月卡(点击两次)
            if (step_flag === 2) {
                // step_flag = 0;
                await sleep(5000); // 补回容错时间
                await click(1450, 1020); // 点击时间调节的确认按钮的位置
                await sleep(5000); // 等待月卡动画时间
                await click(1450, 1020);
                await sleep(1000);
                await click(1450, 1020);
                await sleep(1000);
                await click(1450, 1020);
                await sleep(1000);
            }
        }

        // 检查是否到达终止时间
        if (is_time_kill && new Date() >= time_target) {
            let time_now_str = `${new Date().getHours()}:${new Date().getMinutes()}`;
            log.info(`预定时间(${kill_hour}:${kill_minute})已到(当前时间：${time_now_str})，终止运行...`);
            return "time_kill"; // 返回特殊标记
        }

        log.info(`该钓鱼点的时间: ${fishing_time}`);

        // 检查垂钓点CD(调式模式跳过)
        if (fishing_cd && !is_con) {
            let current_cd = read_archive(file_name, uid);
            if (current_cd !== null) {
                const now = Date.now();
                // 计算垂钓点再次可用的时间戳
                let critical_time_date = new Date(current_cd["Daytime"]);
                critical_time_date.setHours(0, 0, 0, 0);
                critical_time_date.setDate(critical_time_date.getDate() + 3);
                let critical_time = critical_time_date.getTime();

                if (fishing_time === "全天") {
                    let daytime = true;
                    if (current_cd["Daytime"] !== null) {
                        let critical_time_date = new Date(current_cd["Daytime"]);
                        critical_time_date.setHours(0, 0, 0, 0);
                        critical_time_date.setDate(critical_time_date.getDate() + 3);
                        let critical_time = critical_time_date.getTime();
                        if (now < critical_time) {
                            log.info(`该垂钓点(白天)处于冷却状态，剩余时间: ${formatTimeDifference(critical_time - now)}`);
                            log.info(`${file_name}(白天) 已跳过...`);
                            daytime = false;
                            fishing_time = "夜晚";
                        } else {
                            log.info(`该垂钓点(白天)未处于冷却状态，闲置时间: ${formatTimeDifference(now - critical_time)}`);
                        }
                    }
                    
                    if (current_cd["Nighttime"] !== null) {
                        let critical_time_date = new Date(current_cd["Nighttime"]);
                        critical_time_date.setHours(0, 0, 0, 0);
                        critical_time_date.setDate(critical_time_date.getDate() + 3);
                        let critical_time = critical_time_date.getTime();

                        if (now < critical_time) {
                            log.info(`该垂钓点(夜晚)处于冷却状态，剩余时间: ${formatTimeDifference(critical_time - now)}`);
                            log.info(`${file_name}(夜晚) 已跳过...`);
                            if (daytime) {
                                fishing_time = "白天";
                            } else {
                                return null;
                            }
                        } else {
                            log.info(`该垂钓点(夜晚)未处于冷却状态，闲置时间: ${formatTimeDifference(now - critical_time)}`);
                        }
                    }
                } else if (fishing_time === "白天") {
                    if (current_cd["Daytime"] !== null) {
                        let critical_time_date = new Date(current_cd["Daytime"]);
                        critical_time_date.setHours(0, 0, 0, 0);
                        critical_time_date.setDate(critical_time_date.getDate() + 3);
                        let critical_time = critical_time_date.getTime();

                        if (now < critical_time) {
                            log.info(`该垂钓点(白天)处于冷却状态，剩余时间: ${formatTimeDifference(critical_time - now)}`);
                            log.info(`${file_name}(白天) 已跳过...`);
                            return null;
                        } else {
                            log.info(`该垂钓点(白天)未处于冷却状态，闲置时间: ${formatTimeDifference(now - critical_time)}`);
                        }
                    }
                } else if (fishing_time === "夜晚") {
                    if (current_cd["Nighttime"] !== null) {
                        let critical_time_date = new Date(current_cd["Nighttime"]);
                        critical_time_date.setHours(0, 0, 0, 0);
                        critical_time_date.setDate(critical_time_date.getDate() + 3);
                        let critical_time = critical_time_date.getTime();

                        if (now < critical_time) {
                            log.info(`该垂钓点(夜晚)处于冷却状态，剩余时间: ${formatTimeDifference(critical_time - now)}`);
                            log.info(`${file_name}(夜晚) 已跳过...`);
                            return null;
                        } else {
                            log.info(`该垂钓点(夜晚)未处于冷却状态，闲置时间: ${formatTimeDifference(now - critical_time)}`);
                        }
                    }
                }
            }
        }

        // 偽造地图追踪开始
        await fakeLog(file_name, false, true, 0);
        await pathingScript.runFile(base_path_pathing + file_name + ".json");

        if (file_name === "稻妻-垂钓点-鹤观逢岳之野西南") {
            const base_other_path = "assets/pathing_others/";
            const image_path = "assets/peculiar_pinion.png";
            const image_world_path = "assets/peculiar_pinion_world.png";

            if (tsurumi_method === "1") {
                keyPress("B");
                await sleep(2000);
                click(1055, 48);
                await sleep(1000);

                let imageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(image_path), 0, 95, 1278, 883);
                let ocrRo = RecognitionObject.Ocr(1626, 990, 150, 52);
                imageRo.threshold = 0.9;

                // // 记录原有快捷更换的4个小道具及装备状态
                // click(positions["quick_change_state"][0], positions["quick_change_state"][1]);
                // await sleep(500);
                // let ori_gadget_region = captureGameRegion();
                // let ori_gadget = {};
                // let equipped = false;
                //
                // for (let i = 1; i <=4; i++) {
                //     const currentBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/bottom_ico.png"), positions[`bottom${i}_pos`][0], positions[`bottom${i}_pos`][1], positions[`bottom${i}_pos`][2], positions[`bottom${i}_pos`][3]);
                //     const currentEquipRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/current_ico.png"), positions[`bottom${i}_pos`][0], positions[`bottom${i}_pos`][1], positions[`bottom${i}_pos`][2], positions[`bottom${i}_pos`][3]);
                //     if (!(ori_gadget_region.Find(currentBottomRo).isExist())) {
                //         ori_gadget[i] = ori_gadget_region.DeriveCrop(positions[`upper${i}_pos`][0], positions[`upper${i}_pos`][1], positions[`upper${i}_pos`][2], positions[`upper${i}_pos`][3]);
                //         if (ori_gadget_region.Find(currentEquipRo).isExist()) {
                //             equipped = i;
                //         }
                //
                //     } else {
                //         ori_gadget[i] = false;
                //     }
                // }
                // await sleep(100);
                // click(positions["return_btn"][0], positions["return_btn"][1]);
                // await sleep(200);

                // 在本页面中寻找奇特的羽毛[DEBUG]下滑使用AEscoffier_chef内的scroll_pages_main修改后实现)
                let page_state = true;
                // while (page_state) {
                    moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
                    let gadget_region = captureGameRegion();
                    let gadget = gadget_region.Find(imageRo);
                    gadget_region.dispose();

                    // 如果当前页面存在奇特的羽毛
                    if (gadget.isExist()) {
                        gadget.Click();
                        await sleep(500);
                        moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
                        let ocr_region = captureGameRegion();
                        let ocrResult = ocr_region.Find(ocrRo);
                        ocr_region.dispose();
                        // 防止卸下奇特的羽毛
                        if (ocrResult.isExist() && ocrResult.text === "装备") {
                            click(1685, 1018);
                        } else {
                            click(1843, 48);
                        }
                        await sleep(2500);
                        // 使用小道具激活垂钓点
                        keyPress("Z");
                        await sleep(1000);

                        // // 恢复原有小道具布局
                        // keyPress("B");
                        // await sleep(2000);
                        // click(1055, 48);
                        // await sleep(1000);
                        // click(positions["quick_change_state"][0], positions["quick_change_state"][1]);
                        // // 清除并还原小道具快捷栏
                        // for (let i = 1; i <=4; i++) {
                        //     if (ori_gadget[i]) {
                        //         await sleep(200);
                        //         click(positions[`bottom${i}`][0], positions[`bottom${i}`][1]);
                        //         await sleep(200);
                        //         const tempRo = RecognitionObject.TemplateMatch(ori_gadget[i], 0, 95, 1278, 883);
                        //         while (true) {
                        //             const tempRegion = captureGameRegion();
                        //             let gadget = tempRegion.Find(tempRo);
                        //             tempRegion.dispose();
                        //             if (gadget.isExist()) {
                        //                 gadget.Click();
                        //                 break;
                        //             } else {
                        //                 if (!(scroll_pages_main("down", 1))) {
                        //                     log.warn(`未找到快捷更换栏原有的${i}号位小道具，已留空...`);
                        //                     break;
                        //                 }
                        //             }
                        //         }
                        //     }
                        // }
                        // await sleep(100);
                        // click(positions["confirm_btn"][0], positions["confirm_btn"][1]);
                        // await sleep(200);
                        // // 装备原先装备的小道具[DEBUG]如果原先未装备小道具或者装备的小道具不位于快捷栏位则装备状态无法还原
                        // if (equipped) {
                        //     while (true) {
                        //         const oriEquippedRo = RecognitionObject.TemplateMatch(ori_gadget[equipped], 0, 95, 1278, 883);
                        //         let gameRegion = captureGameRegion();
                        //         let match_result = gameRegion.Find(oriEquippedRo);
                        //         gameRegion.dispose();
                        //         if (match_result.isExist()) {
                        //             match_result.Click();
                        //             await sleep(200);
                        //             let gameRegion = captureGameRegion();
                        //             let ocr_result = gameRegion.Find(ocrRo);
                        //             gameRegion.dispose();
                        //             if (ocr_result.isExist() && ocr_result.text === "装备") {
                        //                 click(1685, 1018);
                        //             } else {
                        //                 click(1843, 48);
                        //             }
                        //             await sleep(500);
                        //             break;
                        //         } else {
                        //             let page_state = scroll_pages_main("down", 1);
                        //             if (page_state === false) {
                        //                 log.warn("未找到原先装备的小道具...");
                        //                 await sleep(500);
                        //                 click(1843, 48);
                        //                 await sleep(500);
                        //                 break;
                        //             }
                        //         }
                        //     }
                        // }
                        // click(1843, 48); // 关闭背包界面
                        // await sleep(1000);

                        await pathingScript.runFile(base_other_path + file_name + ".json");
                        // break;
                    } else {
                        page_state = scroll_pages_main("down", 1);
                        if (page_state === false) { // [DEBUG]未拥有奇特的羽毛的情况暂未测试(不确定滑到底部未找到是否能触发)
                            log.warn("未找到小道具：奇特的羽毛，该点位已跳过...");
                        }
                        return false;
                    }
                // }
            } else {
                await sleep(1000);
                keyDown("Z");
                await sleep(2000);
                keyUp("Z");
                await sleep(500);

                let imageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(image_world_path), 565, 466, 785, 165);
                imageRo.threshold = 0.9;
                let gameRegion = captureGameRegion();
                let templateResult = gameRegion.Find(imageRo);
                gameRegion.dispose();

                if (templateResult.isExist()) {
                    templateResult.Click();
                    await sleep(1000);
                    // 使用小道具激活垂钓点
                    keyPress("Z");
                    await sleep(1000);

                    await pathingScript.runFile(base_other_path + file_name + ".json");
                } else {
                    keyPress("Z"); // 关闭快捷道具界面
                    await sleep(1000);
                    log.warn("快捷更换栏未找到小道具：奇特的羽毛，该点位已跳过...");
                    return false;
                }
            }
        }

        // 执行键鼠脚本
        if (path_msg["addition"] === "GCM") {
            await keyMouseScript.runFile(base_path_gcm + file_name + ".json");
        }

        // 记录钓鱼开始时间
        const time_start = Date.now();

        // 调用自动钓鱼
        await dispatcher.runTask(new SoloTask("AutoFishing", {
            "fishingTimePolicy": fishing_time_dic[fishing_time]["param"],
            "throwRodTimeOutTimeoutSeconds": time_out_throw,
            "wholeProcessTimeoutSeconds": time_out_whole
        }));

        // 记录钓鱼结束时间
        const time_end = Date.now();

        // 钓鱼是否正常结束，间隔时间大于抛竿超时时间视为正常结束（防止CD跳过导致的混淆）
        const flag = (time_end - time_start) >= time_out_throw * 1000;

        if (fishing_cd && flag) {
            write_archive(file_name, fishing_time, Date.now(), uid);
        } else if (fishing_cd && !flag) {
            log.warn(`本次钓鱼异常，不计算垂钓点CD`);
        }
        // 偽造地图追踪结束
        await fakeLog(file_name, false, false, 0);
    }

    async function main() {
        let time_out_throw, time_out_whole;
        try {
            // 读取超时时间
            time_out_throw = typeof(settings.time_out_throw) === 'undefined' ? 10 : parseInt(settings.time_out_throw, 10);
            time_out_whole = typeof(settings.time_out_whole) === 'undefined' ? 300 : parseInt(settings.time_out_whole, 10);
        } catch (error) {
            log.error(`超时时间读取错误，请检查JS脚本配置: ${error}`);
            return null;
        }
        // 筛选路径
        let path_filter = pathing_filter();
        // 读取要继续的路径
        let path_continue = typeof(settings.path_continue) === 'undefined' ? "无(默认)" : settings.path_continue;
        let is_continue = true;
        // 判断是否是调式模式
        const is_con = !(typeof(settings.path_select) === 'undefined' || settings.path_select === "无(默认)");
        // 键鼠设置读取
        const block_gcm = typeof(settings.block_gcm) === 'undefined' ? false : settings.block_gcm;
        // 战斗设置读取
        const block_fight = typeof(settings.block_fight) === 'undefined' ? false : settings.block_fight;
        // 鹤观设置读取
        const block_tsurumi = typeof(settings.block_tsurumi) === 'undefined' ? false : settings.block_tsurumi;
        // 小道具替换方式读取
        const tsurumi_method = typeof(settings.tsurumi_method) === 'undefined' ? "1" : settings.tsurumi_method.split(".")[0];
        // 读取自动拾取设置
        const auto_pick = typeof(settings.auto_pick) === 'undefined' ? false : settings.auto_pick;
        // 读取4点自动领取月卡的设置
        const auto_skip = typeof(settings.auto_skip) === 'undefined' ? false : settings.auto_skip;
        // 读取垂钓点CD统计
        let fishing_cd = typeof(settings.fishing_cd) === 'undefined' ? false: settings.fishing_cd;
        // 读取终止时间
        const kill_hour = typeof(settings.time_kill_hour) === 'undefined' ? "无" : settings.time_kill_hour;
        const kill_minute = typeof(settings.time_kill_minute) === 'undefined' ? "无" : settings.time_kill_minute;
        const is_time_kill = kill_hour !== "无" && kill_minute !== "无"; // 判断是否启用
        let time_target = new Date();

        // 获取当前用户UID
        let uid = "default_user";
        if (fishing_cd && !is_con) {
            const ocrRoUid = RecognitionObject.Ocr(166, 198, 120, 22);
            const ocrRoText = RecognitionObject.Ocr(1565, 997, 177, 39);

            genshin.returnMainUi();
            await sleep(1000);
            keyPress("Escape");
            await sleep(1000);

            let ro1 = captureGameRegion();
            let ocrUid = ro1.Find(ocrRoUid); // 当前页面OCR
            if (ocrUid.isExist()) {
                uid = ocrUid.text;
            }
            ro1.dispose();

            await genshin.returnMainUi();

            keyPress("F2"); // 按下F2打开多人模式界面
            await sleep(1000);
            let ro2 = captureGameRegion();
            let ocrText = ro2.Find(ocrRoText); // 当前页面OCR
            if (ocrText.isExist() && ocrText.text === "回到单人模式") {
                log.info("当前为多人模式，垂钓点CD统计已失效...");
                fishing_cd = false; // 多人模式下关闭CD记录功能
            }
            ro2.dispose();

            await sleep(500);
            keyPress("Escape");
        }

        if (is_time_kill) {
            let now = new Date();
            time_target.setHours(parseInt(kill_hour, 10));
            time_target.setMinutes(parseInt(kill_minute, 10));
            time_target.setSeconds(0);
            time_target.setMilliseconds(0);
            if (time_target < now) { // 不是当天终止，天数+1
                time_target.setDate(now.getDate() + 1); // 不会超限
            }
            let time_show = `${time_target.getFullYear()}/${time_target.getMonth()}/${time_target.getDate()} ${time_target.getHours()}:${time_target.getMinutes()}`;
            log.info(`定时关闭已启用，将在 ${time_show} 后停止后续任务...`);
            await sleep(2000);
        }
        if (kill_hour !== "无" || kill_minute !== "无") {
            log.warn("如果需要启用定时关闭，请确保同时设置了小时和分钟！\n任务将在5s后继续...");
            await sleep(5000);
        }

        log.info(`本次总计 ${path_filter.length} 个钓鱼点`);
        if (path_continue !== "无(默认)") {
            path_continue = `${path_continue.split("-")[0]}-${path_continue.split("-")[2]}`;
        }

        // 调整分辨率和dpi，适应键鼠配置
        setGameMetrics(1920, 1080, 1.25);
        // 设置自动拾取
        if (auto_pick) {
            dispatcher.addTimer(new RealtimeTimer("AutoPick"));
        }

        for (let i = 0; i < path_filter.length; i++) {
            // 检查时间
            if (is_time_kill && time_target < new Date()) {
                let time_now = `${new Date().getHours()}:${new Date().getMinutes()}`;
                log.info(`预定时间(${kill_hour}:${kill_minute})已到(当前时间：${time_now})，终止运行...`);
                return null;
            }
            // 路径详细信息
            const path_msg = get_pathing_msg(path_filter[i]);
            // try {
                let current_msg = `${path_msg["area"]}-${path_msg["detail"]}`
                log.info(`当前钓鱼点: ${current_msg}(进度: ${i + 1}/${path_filter.length})`);
                // For ABGI only
                log.debug(`当前进度：${current_msg}(进度: ${i + 1}/${path_filter.length})`);
                if (path_continue === current_msg) {
                    is_continue = false;
                }

                // 从选择的点位继续
                if (path_continue !== "无(默认)" && !is_con && is_continue && path_filter.length === path_pathing.length) {
                    log.info("跳过...");
                    continue;
                }

                const run_result = await run_file(path_msg, time_out_throw, time_out_whole, is_con, block_gcm, block_fight, block_tsurumi, tsurumi_method, auto_skip, fishing_cd, uid, is_time_kill, time_target, kill_hour, kill_minute);

                // 新增：检查 run_file 是否因为到达终止时间而返回特殊标记
                if (run_result === "time_kill") {
                    return null; // 直接退出整个任务
                }
            // } catch (error) {
            //     const file_name = `${path_msg["area"]}-${path_msg["type"]}-${path_msg["detail"]}`;
            //     log.info(`路径: ${file_name} 执行时出错，已跳过...\n错误信息: ${error}`)
            // }
        }
    }

    await main();
})();
