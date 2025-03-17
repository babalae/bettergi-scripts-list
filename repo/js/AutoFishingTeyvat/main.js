(async function () {

    const area_list = ['蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔', '至冬', '层岩巨渊·地下矿区', '渊下宫']
    const fish_list = ['花鳉', '波波心羽鲈', '烘烘心羽鲈', '维护机关·水域清理者', '维护机关·态势控制者', '维护机关·澄金领队型', '海涛斧枪鱼', '维护机关·初始能力型', '维护机关·白金典藏型', '吹沙角鲀', '甜甜花鳉', '擒霞客', '水晶宴', '斗棘鱼', '炮鲀', '流纹褐蝶鱼', '锖假龙', '金赤假龙', '玉玉心羽鲈', '赤魔王', '长生仙', '苦炮鲀', '肺棘鱼', '流纹京紫蝶鱼', '琉璃花鳉', '伪装鲨鲨独角鱼', '繁花斗士急流鱼', '深潜斗士急流鱼', '晚霞翻车鲀', '青浪翻车鲀', '拟似燃素独角鱼', '炽岩斗士急流鱼', '蓝染花鳉', '鸩棘鱼', '流纹茶蝶鱼', '雪中君', '真果角鲀', '青金斧枪鱼', '暮云角鲀', '翡玉斧枪鱼', '沉波蜜桃', '雷鸣仙']
    const bait_list = ['果酿饵', '酸桔饵', '维护机关频闪诱饵', '甘露饵', '赤糜饵', '飞蝇假饵', '蠕虫假饵', '澄晶果粒饵', '温火饵']
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
        "马腾斯万能护养剂": ["维护机关·白金典藏型", "波波心羽鲈", "烘烘心羽鲈", "海涛斧枪鱼"]
    }
    const time_msg = {
        '白天': ['烘烘心羽鲈', '维护机关·水域清理者', '吹沙角鲀', '水晶宴', '流纹褐蝶鱼', '赤魔王', '长生仙', '流纹京紫蝶鱼', '深潜斗士急流鱼', '青浪翻车鲀', '流纹茶蝶鱼', '真果角鲀', '沉波蜜桃'],
        '夜晚': ['波波心羽鲈', '维护机关·态势控制者', '维护机关·白金典藏型', '擒霞客', '斗棘鱼', '肺棘鱼', '繁花斗士急流鱼', '晚霞翻车鲀', '鸩棘鱼', '雪中君', '暮云角鲀', '雷鸣仙'],
        '全天': ['花鳉', '维护机关·澄金领队型', '海涛斧枪鱼', '维护机关·初始能力型', '甜甜花鳉', '炮鲀', '锖假龙', '金赤假龙', '玉玉心羽鲈', '苦炮鲀', '琉璃花鳉', '伪装鲨鲨独角鱼', '拟似燃素独角鱼', '炽岩斗士急流鱼', '蓝染花鳉', '青金斧枪鱼', '翡玉斧枪鱼']
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
        '佛玛洛鳐': {'bait': '', 'time': ''},
        '迪芙妲鳐': {'bait': '', 'time': ''}
    }
    const path_pathing = [
        '枫丹-垂钓点-伊黎耶林区幽林雾道西南-花鳉_波波心羽鲈_烘烘心羽鲈_维护机关·水域清理者_维护机关·态势控制者_维护机关·澄金领队型-果酿饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-伊黎耶林区柔灯港西北-海涛斧枪鱼_波波心羽鲈_维护机关·水域清理者_维护机关·澄金领队型-甘露饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-枫丹动能工程科学研究院区中央实验室遗址南-花鳉_海涛斧枪鱼_波波心羽鲈_维护机关·初始能力型_维护机关·水域清理者-果酿饵_甘露饵_酸桔饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-枫丹廷区茉洁站西南-海涛斧枪鱼_烘烘心羽鲈_维护机关·初始能力型_维护机关·态势控制者-甘露饵_酸橘饵_维护机关频闪诱饵-普通',
        '枫丹-垂钓点-枫丹廷区枫丹廷东北-海涛斧枪鱼_波波心羽鲈_烘烘心羽鲈_维护机关·水域清理者_维护机关·态势控制者-甘露饵_酸橘饵_维护机关频闪诱饵-GCM',
        '枫丹-垂钓点-枫丹廷区枫丹廷南-花鳉_海涛斧枪鱼_维护机关·水域清理者_维护机关·态势控制者-果酿饵_甘露饵_维护机关频闪诱饵-GCM',
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
        '稻妻-垂钓点-八酝岛名椎滩北-花鳉_肺棘鱼_流纹京紫蝶鱼_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '稻妻-垂钓点-海祇岛水月池东-花鳉_琉璃花鳉_擒霞客_水晶宴_肺棘鱼_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '稻妻-垂钓点-海祇岛珊瑚宫北-花鳉_琉璃花鳉_擒霞客_水晶宴_肺棘鱼_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '稻妻-垂钓点-清籁岛天云峠北-花鳉_擒霞客_水晶宴_流纹京紫蝶鱼_炮鲀-果酿饵_蠕虫假饵_飞蝇假饵-普通',
        '稻妻-垂钓点-清籁岛越石村东南-琉璃花鳉_肺棘鱼_赤魔王_金赤假龙_锖假龙_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '稻妻-垂钓点-神无冢甘金岛南-琉璃花鳉_肺棘鱼_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '稻妻-垂钓点-鸣神岛离岛西-琉璃花鳉_肺棘鱼_赤魔王_炮鲀_苦炮鲀-果酿饵_赤糜饵_飞蝇假饵-GCM',
        '稻妻-垂钓点-鹤观千来神祠西-花鳉_琉璃花鳉_擒霞客_水晶宴-果酿饵-普通',
        '稻妻-垂钓点-鹤观逢岳之野西南-花鳉_肺棘鱼_赤魔王_流纹京紫蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '稻妻-垂钓点-神无冢九条阵屋东南-雷鸣仙-蠕虫假饵-GCM',
        '纳塔-垂钓点-境壁山浮羽之湾东-伪装鲨鲨独角鱼_花鳉_繁花斗士急流鱼_深潜斗士急流鱼_晚霞翻车鲀_青浪翻车鲀-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔东-花鳉_青浪翻车鲀_晚霞翻车鲀_伪装鲨鲨独角鱼-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔东北-青浪翻车鲀_繁花斗士急流鱼_伪装鲨鲨独角鱼-澄晶果粒饵-战斗',
        '纳塔-垂钓点-奥奇卡纳塔北-花鳉_晚霞翻车鲀_伪装鲨鲨独角鱼_深潜斗士急流鱼-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔南-花鳉_繁花斗士急流鱼_深潜斗士急流鱼_青浪翻车鲀_晚霞翻车鲀-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔西-深潜斗士急流鱼_繁花斗士急流鱼_伪装鲨鲨独角鱼-澄晶果粒饵-普通',
        '纳塔-垂钓点-奥奇卡纳塔西北-拟似燃素独角鱼_炽岩斗士急流鱼-温火饵-GCM',
        '纳塔-垂钓点-涌流地溶水域-炽岩斗士急流鱼_拟似燃素独角鱼-温火饵-GCM',
        '纳塔-垂钓点-翘枝崖花羽会北-晚霞翻车鲀_深潜斗士急流鱼_伪装鲨鲨独角鱼-澄晶果粒饵-普通',
        '纳塔-垂钓点-翘枝崖花羽会西-花鳉_繁花斗士急流鱼_深潜斗士急流鱼_晚霞翻车鲀_伪装鲨鲨独角鱼-果酿饵_澄晶果粒饵-普通',
        '纳塔-垂钓点-距石山祖遗庙宇东-炽岩斗士急流鱼_拟似燃素独角鱼-温火饵-GCM',
        '蒙德-垂钓点-龙脊雪山寒天之钉西-花鳉_鸩棘鱼_雪中君_流纹茶蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '蒙德-垂钓点-坠星山谷低语森林南-蓝染花鳉_水晶宴_鸩棘鱼_锖假龙_流纹茶蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-坠星山谷望风山地-花鳉_蓝染花鳉_擒霞客_水晶宴_鸩棘鱼_金赤假龙_流纹茶蝶-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-明冠山地风龙废墟北-花鳉_蓝染花鳉_擒霞客_水晶宴-果酿饵-普通',
        '蒙德-垂钓点-明冠山地风龙废墟南-花鳉_蓝染花鳉_擒霞客_流纹茶蝶鱼-果酿饵_蠕虫假饵-普通',
        '蒙德-垂钓点-苍风高地晨曦酒庄西南-蓝染花鳉_擒霞客_鸩棘鱼_赤魔王_流纹茶蝶鱼_炮鲀_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-苍风高地清泉镇北-花鳉_蓝染花鳉_鸩棘鱼_赤魔王_流纹茶蝶鱼_炮鲀_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-风啸山坡风起地南-花鳉 蓝染花鳉 鸩棘鱼 流纹茶蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '须弥-垂钓点-下风蚀地活力之家西南-花鳉_擒霞客_赤魔王_真果角鲀_青金斧枪鱼-果酿饵_赤糜饵_甘露饵-普通',
        '须弥-垂钓点-下风蚀地阿如村-花鳉_水晶宴_吹沙角鲀_暮云角鲀_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-千壑沙地「五绿洲」的孑遗-真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-甘露饵-战斗',
        '须弥-垂钓点-护世森无郁稠林-沉波蜜桃_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-甘露饵-普通',
        '须弥-垂钓点-桓那兰那觉王之殿北-花鳉_青果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-荒石苍漠铁穆山南-擒霞客_真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-道成林天臂池-赤魔王_青果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-赤糜饵_甘露饵-普通',
        '须弥-垂钓点-道成林维摩庄北-花鳉_青果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-道成林须弥城南-擒霞客_吹沙角鲀_暮云角鲀_青金斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-阿陀河谷奥摩斯港北-水晶宴_青果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-阿陀河谷降诸魔山-擒霞客_青果角鲀_暮云角鲀_翡玉斧枪鱼-果酿饵_甘露饵-普通'
    ]
    const path_pathing_patch = [
        '层岩巨渊·地下矿区-垂钓点-地下水泽西-花锵_斗棘鱼_赤魔王_流纹褐蝶鱼_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '层岩巨渊·地下矿区-垂钓点-无名遗迹西-甜甜花锵_擒霞客_水晶宴_赤魔王_炮鲀-果酿饵_赤糜饵_飞蝇假饵',
        '渊下宫-垂钓点-蛇肠之路南-水晶宴_肺棘鱼_佛玛洛鳐_迪芙妲鳐-果酿饵_赤糜饵_飞蝇假饵-普通',
        '渊下宫-垂钓点-蛇心之地北-擒霞客_赤魔王_佛玛洛鳐_迪芙妲鳐-果酿饵_赤糜饵_飞蝇假饵-普通',
        '渊下宫-垂钓点-蛇心之地西北-擒霞客_流纹京紫鲽鱼_佛玛洛鳐_迪芙妲鳐-果酿饵_蠕虫假饵_飞蝇假饵-普通'
    ]
    const fishing_time_dic = {
        "全天": {"name": "All", "param": 0},
        "白天": {"name": "Daytime", "param": 1},
        "夜晚": {"name": "Nighttime", "param": 2},
        "禁用": {"name": "Block", "param": ""},
    }
    const statue_name = "蒙德-七天神像-苍风高地";
    // 存储本次任务中的所有鱼类，作为调节时间的关键参考
    let list_fish = [];

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
            let path_sort_area = typeof(settings.path_sort_area) === 'undefined' ? [] : settings.path_sort_area.split(' ');
            // 读取鱼类
            let path_sort_fish = typeof(settings.path_sort_fish) === 'undefined' ? [] : settings.path_sort_fish.split(' ');
            // 读取鱼饵
            let path_sort_bait = typeof(settings.path_sort_bait) === 'undefined' ? [] : settings.path_sort_bait.split(' ');
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
                    // 根据 全部饵类排除掉 排除计算的饵类 后剩下的饵类生成正则表达式
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

    async function run_file(path_msg, time_out_throw, time_out_whole, is_con, block_gcm, block_fight, block_tsurumi, auto_skip) {
        const base_path_pathing = "assets/pathing/";
        const base_path_gcm = "assets/KeyMouseScript/";
        const base_path_statues = "assets/pathing_statues/";
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
        // 读取游戏模式（多人模式则禁用时间调节）[暂时不可用]
        let check_multiplayer = typeof(settings.check_multiplayer) === 'undefined' ? false : settings.check_multiplayer;
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

        // 4点自动领取月卡
        let time_now = new Date();
        let time_4 = new Date(time_now.getFullYear(), time_now.getMonth(), time_now.getDate(), 4, 0, 0); // 4点
        let time_predict_end; // 根据超时时间预测本次钓鱼结束时间（加1分钟容错）
        if (fishing_time === "全天") {
            time_predict_end = time_now.setSeconds(time_now.getSeconds() + time_out_whole * 2 + 60);
        } else {
            time_predict_end = time_now.setSeconds(time_now.getSeconds() + time_out_whole + 60);
        }
        // 30s点击一次，等待领取月卡
        let step_flag = 0; // 领取月卡步骤标志
        while (auto_skip && time_now < time_4 && time_predict_end >= time_4) {
            log.info(`等待领取月卡(剩余${Math.floor((time_4 - new Date()) / 1000)}s)...`);
            if (step_flag == 0) {
                // 传送到七天神像
                await pathingScript.runFile(base_path_pathing + statue_name + ".json");
                step_flag += 1;
            }
            await sleep(30000);
            keyDown("VK_LBUTTON");
            await sleep(100);
            keyUp("VK_LBUTTON");

            // 本次已经到达4点(5s容错)
            if (new Date() > time_4.setSeconds(time_4.getSeconds() - 5)) {
                step_flag += 1;
                auto_skip = false;
            }

        }
        // 领取月卡(点击两次)
        if (step_flag == 2) {
            step_flag = 0;
            await sleep(5); // 补回容错时间
            await click(1450, 1020); // 点击时间调节的确认按钮的位置
            await sleep(5); // 等待月卡动画时间
            await click(1450, 1020);
            await sleep(1);
        }

        log.info(`该钓鱼点的时间: ${fishing_time}`);

        await pathingScript.runFile(base_path_pathing + file_name + ".json");

        // 执行键鼠脚本
        if (path_msg["addition"] === "GCM") {
            await keyMouseScript.runFile(base_path_gcm + file_name + ".json");
        }

        // 调用自动钓鱼
        // await genshin.autofishing(fishing_time_dic[fishing_time]["param"]);
        await dispatcher.runTask(new SoloTask("AutoFishing", {
            "fishingTimePolicy": fishing_time_dic[fishing_time]["param"],
            "throwRodTimeOutTimeoutSeconds": time_out_throw,
            "wholeProcessTimeoutSeconds": time_out_whole
        }));
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
        // 读取自动拾取设置
        const auto_pick = typeof(settings.auto_pick) === 'undefined' ? false : settings.auto_pick;
        // 读取4点自动领取月卡的设置
        const auto_skip = typeof(settings.auto_skip) === 'undefined' ? false : settings.auto_skip;
        // 读取终止时间
        const kill_hour = typeof(settings.time_kill_hour) === 'undefined' ? "无" : settings.time_kill_hour;
        const kill_minute = typeof(settings.time_kill_minute) === 'undefined' ? "无" : settings.time_kill_minute;
        const is_time_kill = kill_hour !== "无" && kill_minute !== "无"; // 判断是否启用
        let time_target = new Date();

        if (is_time_kill) {
            let now = new Date();
            time_target.setHours(parseInt(kill_hour), 10);
            time_target.setMinutes(parseInt(kill_minute), 10);
            time_target.setSeconds(0);
            time_target.setMilliseconds(0);
            if (time_target < now) { // 不是当天终止，天数+1
                time_target.setDate(now.getDate() + 1); // 不会超限
            }
            let time_show = `${time_target.getFullYear()}/${time_target.getMonth()}/${time_target.getDate()} ${time_target.getHours()}:${time_target.getMinutes()}`;
            log.info(`定时关闭已启用，将在 ${time_show} 后停止后续任务...`);
            await sleep(2000);
        } else if (kill_hour !== "无" ^ kill_minute !== "无") {
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
            try {
                let current_msg = `${path_msg["area"]}-${path_msg["detail"]}`
                log.info(`当前钓鱼点: ${current_msg}(进度: ${i + 1}/${path_filter.length})`);
                if (path_continue === current_msg) {
                    is_continue = false;
                }

                // 从选择的点位继续
                if (path_continue !== "无(默认)" && !is_con && is_continue && path_filter.length === path_pathing.length) {
                    log.info("跳过...");
                    continue;
                }

                await run_file(path_msg, time_out_throw, time_out_whole, is_con, block_gcm, block_fight, block_tsurumi, auto_skip);
            } catch (error) {
                const file_name = `${path_msg["area"]}-${path_msg["type"]}-${path_msg["detail"]}`;
                log.info(`路径: ${file_name} 执行时出错，已跳过...\n错误信息: ${error}`)
            }
        }
    }

    await main();
})();