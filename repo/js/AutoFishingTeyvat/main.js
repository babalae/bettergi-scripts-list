(async function () {
    const area_list = ['蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔', '至冬']
    const fish_list = ['花鳉', '波波心羽鲈', '烘烘心羽鲈', '维护机关·水域清理者', '维护机关·态势控制者', '维护机关·澄金领队型', '海涛斧枪鱼', '维护机关·初始能力型', '维护机关·白金典藏型', '吹沙角鲀', '甜甜花鳉', '擒霞客', '水晶宴', '斗棘鱼', '炮鲀', '流纹褐蝶鱼', '锖假龙', '金赤假龙', '玉玉心羽鲈', '赤魔王', '长生仙', '苦炮鲀', '肺棘鱼', '流纹京紫蝶鱼', '琉璃花鳉', '伪装鲨鲨独角鱼', '繁花斗士急流鱼', '深潜斗士急流鱼', '晚霞翻车鲀', '青浪翻车鲀', '拟似燃素独角鱼', '炽岩斗士急流鱼', '蓝染花鳉', '鸩棘鱼', '流纹茶蝶鱼', '雪中君', '真果角鲀', '青金斧枪鱼', '暮云角鲀', '翡玉斧枪鱼', '沉波蜜桃']
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
        '璃月-垂钓点-云来海璃月港东南-甜甜花鳉_擒霞客_水晶宴_斗棘鱼_炮鲀-果酿饵_赤糜饵_飞蝇假饵-普通',
        '璃月-垂钓点-沉玉谷·上谷古树茶坡-花鳉_斗棘鱼_流纹褐蝶鱼_锖假龙_金赤假龙_玉玉心羽鲈-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵_酸桔饵-普通',
        '璃月-垂钓点-沉玉谷·上谷古树茶坡东-花鳉_擒霞客_水晶宴_斗棘鱼_锖假龙_玉玉心羽鲈-果酿饵_赤糜饵_飞蝇假饵_酸桔饵-普通',
        '璃月-垂钓点-沉玉谷·南陵悬练山西南-甜甜花鳉_擒霞客_赤魔王_金赤假龙_玉玉心羽鲈-果酿饵_赤糜饵_飞蝇假饵_酸桔饵-普通',
        '璃月-垂钓点-珉林天遒谷-花鳉_水晶宴_斗棘鱼-果酿饵_赤糜饵-普通',
        '璃月-垂钓点-珉林奥藏山-花鳉_甜甜花鳉_擒霞客_水晶宴_长生仙-果酿饵_蠕虫假饵-普通',
        '璃月-垂钓点-珉林琥牢山东-花鳉_甜甜花鳉_擒霞客_水晶宴_斗棘鱼_流纹褐蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '璃月-垂钓点-琼玑野归离原东北-甜甜花鳉_斗棘鱼_赤魔王_金赤假龙_錆假龙_流纹褐蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '璃月-垂钓点-琼玑野渌华池-甜甜花鳉_斗棘鱼_赤魔王_金赤假龙_錆假龙_流纹褐蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '璃月-垂钓点-碧水原奥藏山东-花鳉_擒霞客_水晶宴_流纹褐蝶鱼-果酿饵_蠕虫假饵-普通',
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
        '蒙德-垂钓点-坠星山谷低语森林南-蓝染花鳉_水晶宴_鸩棘鱼_锖假龙_流纹茶蝶鱼-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-坠星山谷望风山地-花鳉_蓝染花鳉_擒霞客_水晶宴_鸩棘鱼_金赤假龙_流纹茶蝶-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-明冠山地风龙废墟北-花鳉_蓝染花鳉_擒霞客_水晶宴-果酿饵-普通',
        '蒙德-垂钓点-明冠山地风龙废墟南-花鳉_蓝染花鳉_擒霞客_流纹茶蝶鱼-果酿饵_蠕虫假饵-普通',
        '蒙德-垂钓点-苍风高地晨曦酒庄西南-蓝染花鳉_擒霞客_鸩棘鱼_赤魔王_流纹茶蝶鱼_炮鲀_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-苍风高地清泉镇北-花鳉_蓝染花鳉_鸩棘鱼_赤魔王_流纹茶蝶鱼_炮鲀_苦炮鲀-果酿饵_赤糜饵_蠕虫假饵_飞蝇假饵-普通',
        '蒙德-垂钓点-风啸山坡风起地南-花鳉 蓝染花鳉 鸩棘鱼 流纹茶蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '蒙德-垂钓点-龙脊雪山寒天之钉西-花鳉_鸩棘鱼_雪中君_流纹茶蝶鱼-果酿饵_赤糜饵_蠕虫假饵-普通',
        '须弥-垂钓点-下风蚀地活力之家西南-花鳉_擒霞客_赤魔王_真果角鲀_青金斧枪鱼-果酿饵_赤糜饵_甘露饵-普通',
        '须弥-垂钓点-下风蚀地阿如村-花鳉_水晶宴_吹沙角鲀_暮云角鲀_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-千壑沙地「五绿洲」的孑遗-真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-甘露饵-普通',
        '须弥-垂钓点-护世森无郁稠林-沉波蜜桃_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-甘露饵-普通',
        '须弥-垂钓点-桓那兰那觉王之殿北-花鳉_青果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-荒石苍漠铁穆山南-擒霞客_真果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-道成林天臂池-赤魔王_青果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-赤糜饵_甘露饵-普通',
        '须弥-垂钓点-道成林维摩庄北-花鳉_青果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-道成林须弥城南-擒霞客_吹沙角鲀_暮云角鲀_青金斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-阿陀河谷奥摩斯港北-水晶宴_青果角鲀_吹沙角鲀_暮云角鲀_青金斧枪鱼_翡玉斧枪鱼-果酿饵_甘露饵-普通',
        '须弥-垂钓点-阿陀河谷降诸魔山-擒霞客_青果角鲀_暮云角鲀_翡玉斧枪鱼-果酿饵_甘露饵-普通'
    ]


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
            let path_sort_material = typeof(settings.path_sort_material) === 'undefined' ? "无" : settings.path_sort_material;

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

            if (path_sort_material === "无(默认)") {
                for  (const path of path_pathing) {
                    if (regex_area.test(path) && regex_fish.test(path) && regex_bait.test(path)) {
                        path_list.push(path);
                    }
                }
            } else {
                for (const [material_name, fish_msg] of Object.entries(material_msg)) {
                    // 目标材料正则表达式
                    const check_regex = new RegExp(material_name);
                    
                    if (check_regex.test(path_sort_material)) {
                        log.info(`目标材料: ${material_name}\n鱼类: ${fish_msg}`);
                        for  (const path of path_pathing) {
                            const fish_sort_regex = new RegExp(fish_msg.join("|"));
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

    async function run_file(file_name) {
        const base_path_pathing = "assets/Pathing/";
        const base_path_gcm = "assets/KeyMouseScript/";

        await pathingScript.runFile(base_path_pathing + file_name + ".json");

        // 执行键鼠脚本
        if (/GCM/g.test(file_name)) {
            await keyMouseScript.runFile(base_path_gcm + file_name + ".json");

        }
        // 调用自动钓鱼
        await dispatcher.runTask(new SoloTask("AutoFishing"));
        // await genshin.autofishing();
    }

    async function main() {
        // 筛选路径
        let path_filter = pathing_filter();
        log.info(`本次总计 ${path_filter.length} 个钓鱼点`);

        for (let i = 0; i < path_filter.length; i++) {
            try {

                // 路径详细信息
                const path_msg = get_pathing_msg(path_filter[i]);
                // 文件名
                let file_path = `${path_msg["area"]}-${path_msg["type"]}-${path_msg["detail"]}`

                log.info(`当前钓鱼点: ${path_msg["area"]}-${path_msg["detail"]}(进度: ${i + 1}/${path_filter.length})`);

                let f_type = path_msg["addition"] === "path" ? "path" : "gcm"; // test
                await run_file(file_path, f_type);
            } catch (e) {
                log.info(`路径: ${file_path} 执行时出错，已跳过...`)
            }

        }
    }

    await main();
})();