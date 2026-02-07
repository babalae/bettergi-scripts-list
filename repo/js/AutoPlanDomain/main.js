async function main()
{
    const domainList = [
        {
            name: "无光的深都",
            type: "天赋",
            hasOrder: true,//存在排序(限时/周日)
            list: ["「月光」的哲学", "「乐园」的哲学", "「浪迹」的哲学"]
        },
        {
            name: "蕴火的幽墟",
            type: "天赋",
            hasOrder: true,//存在排序(限时/周日)
            list: ["「角逐」的哲学", "「焚燔」的哲学", "「纷争」的哲学"]
        }
        ,
        {
            name: "苍白的遗荣",
            type: "天赋",
            hasOrder: true,//存在排序(限时/周日)
            list: ["「公平」的哲学", "「正义」的哲学", "「秩序」的哲学"]
        }
        ,
        {
            name: "昏识塔",
            type: "天赋",
            hasOrder: true,//存在排序(限时/周日)
            list: ["「诤言」的哲学", "「巧思」的哲学", "「笃行」的哲学"]
        }
        ,
        {
            name: "董色之庭",
            type: "天赋",
            hasOrder: true,//存在排序(限时/周日)
            list: ["「浮世」的哲学", "「风雅」的哲学", "「天光」的哲学"]
        }
        ,
        {
            name: "太山府",
            type: "天赋",
            hasOrder: true,//存在排序(限时/周日)
            list: ["「繁荣」的哲学", "「勤劳」的哲学", "「黄金」的哲学"]
        }
        ,
        {
            name: "忘却之峡",
            type: "天赋",
            hasOrder: true,//存在排序(限时/周日)
            list: ["「自由」的哲学", "「抗争」的哲学", "「纷争」的哲学"]
        }
//================================
        ,
        {
            name: "失落的月庭",
            type: "武器",
            hasOrder: true,//存在排序(限时/周日)
            list: ["奇巧秘器的真愿", "长夜火的烈辉", "终北遗嗣的煌熠"]
        }
        ,
        {
            name: "深古瞭望所",
            type: "武器",
            hasOrder: true,//存在排序(限时/周日)
            list: ["神合秘烟的启示", "谚妄圣主的神面", "贡祭炽心的荣膺"]
        }
        ,
        {
            name: "深潮的余响",
            type: "武器",
            hasOrder: true,//存在排序(限时/周日)
            list: ["悠古弦音的回响", "纯圣露滴的真粹", "无垢之海的金杯"]
        }
        ,
        {
            name: "有顶塔",
            type: "武器",
            hasOrder: true,//存在排序(限时/周日)
            list: ["谧林涓露的金符", "绿洲花园的真谛", "烈日威权的旧日"]
        }
        ,
        {
            name: "砂流之庭",
            type: "武器",
            hasOrder: true,//存在排序(限时/周日)
            list: ["远海夷地的金枝", "鸣神御灵的勇武", "今昔剧画之鬼人"]
        }
        ,
        {
            name: "震雷连山密宫",
            type: "武器",
            hasOrder: true,//存在排序(限时/周日)
            list: ["孤云寒林的神体", "雾海云间的转还", "漆黑陨铁的一块"]
        }
        ,
        {
            name: "塞西莉亚苗圃",
            type: "武器",
            hasOrder: true,//存在排序(限时/周日)
            list: ["高塔孤王的碎梦", "凛风奔狼的怀乡", "狮牙斗士的理想"]
        }
//================================
        ,
        {
            name: "月童的库藏",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["风起之日", "晨星与月的晓歌"]
        }
        ,
        {
            name: "霜凝的机枢",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["纺月的夜歌", "穹境示现之夜"]
        }
        ,
        {
            name: "荒废砌造坞",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["深廊终曲", "长夜之誓"]
        }
        ,
        {
            name: "虹灵的净土",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["黑曜秘典", "城勇者绘卷"]
        }
        ,
        {
            name: "褪色的剧场",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["未竟的遐思", "谐律异想断章"]
        }
        ,
        {
            name: "临瀑之城",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["回声之林夜话", "昔时之歌"]
        }
        ,
        {
            name: "罪祸的终末",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["黄金剧团", "逐影猎人"]
        }
        ,
        {
            name: "熔铁的孤塞",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["花海甘露之光", "水仙之梦"]
        }
        ,
        {
            name: "赤金的城墟",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["乐园遗落之花", "沙上楼阁史话"]
        }
        ,
        {
            name: "赤金的城墟",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["乐园遗落之花", "沙上楼阁史话"]
        }
        ,
        {
            name: "缘觉塔",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["饰金之梦", "深林的记忆"]
        }
        ,
        {
            name: "沉眠之庭",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["海染砗磲", "华馆梦醒形骸记"]
        }
        ,
        {
            name: "花染之庭",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["绝缘之旗印", "追忆之注连"]
        }
        ,
        {
            name: "岩中幽谷",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["辰砂往生录", "来歆余响"]
        }
        ,
        {
            name: "华池岩柚",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["染血的骑士道", "昔日宗室之仪"]
        }
        ,
        {
            name: "无妄引答密宫",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["炽烈的炎之魔女", "渡过烈火的贤人"]
        }
        ,
        {
            name: "孤云凌霄之处",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["悠古的磐岩", "逆飞的流星"]
        }
        ,
        {
            name: "山脊守望",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["千岩牢固", "苍白之火"]
        }
        ,
        {
            name: "芬德尼尔之顶",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["冰风迷途的勇士", "沉沦之心"]
        }
        ,
        {
            name: "铭记之谷",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["翠绿之影", "被怜爱的少女"]
        }
        ,
        {
            name: "仲夏庭园",
            type: "圣遗物",
            hasOrder: false,//存在排序(限时/周日)
            list: ["如雷的盛怒", "平息鸣雷的尊者"]
        }
    ]

    const domainMap = new Map();
    const domainOrderMap = new Map();
    const domainNameMap = new Map();

    domainList.forEach(item => {
        domainMap.set(item.name, item.list);
        if (item?.hasOrder) {
            let index = 1
//设置顺序
            item.list.forEach(item2 => {
                domainOrderMap.set(item2, index)
                index++
            })
        }

    })

}

await main()
