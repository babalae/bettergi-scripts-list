const config = {
    //setting设置放在这个json
    domain: {
        config: ''
    },
    info: {
        manifest:{},
        settings: undefined
    },
    //
    path: {
        manifest: "manifest.json",
        domain: `./config/domain.json`
    },
    //所有秘境信息
    domainList: [],
    //所有秘境名称
    domainNames: new Set(),
    //物品名称(只记录顶级的名称->金色物品名称)
    itemNames: new Set(),
    //秘境名称映射物品列表
    domainMap: new Map(),
    //秘境名称映射秘境列表顺序
    domainOrderMap: new Map(),
    //物品名称映射秘境名称
    domainItemsMap: new Map(),
}

/**
 * 初始化设置函数
 * 从配置文件中读取设置信息并返回
 * @returns {Object} 返回解析后的JSON设置对象
 */
async function initSettings() {
    // 默认设置文件路径
    let settings_ui = "settings.json";
    try {
        // 读取并解析manifest.json文件
        config.info.manifest = JSON.parse(file.readTextSync(config.path.manifest));
        // 调试日志：输出manifest内容
        log.debug("manifest={key}", config.info.manifest);
        // 调试日志：输出manifest中的settings_ui配置
        log.debug("settings_ui={key}", config.info.manifest.settings_ui);
        log.info(`|脚本名称:{name},版本:{version}`, config.info.manifest.name, config.info.manifest.version);
        if (config.info.manifest.bgi_version) {
            log.info(`|最小可执行BGI版本:{bgi_version}`, config.info.manifest.bgi_version);
        }
        log.info(`|脚本作者:{authors}\n`, config.info.manifest.authors.map(a => a.name).join(","));
        // 更新settings_ui变量为manifest中指定的路径
        settings_ui = config.info.manifest.settings_ui
    } catch (error) {
        // 捕获并记录可能的错误
        log.warn("{error}", error.message);
    }
    // 读取并解析设置文件
    const settingsJson = JSON.parse(file.readTextSync(settings_ui));
    // 如果configSettings未定义，则将其设置为解析后的设置对象
    if (!config.info.settings) {
        config.info.settings = settingsJson
    }
    // 调试日志：输出最终解析的设置对象
    log.debug("settingsJson={key}", settingsJson);
    // 返回设置对象
    return settingsJson
}
/**
 * 获取多复选框的映射表
 * 该函数会从初始化的设置中提取所有类型为"multi-checkbox"的条目，
 * 并将这些条目的名称和对应的选项值存储在一个Map对象中返回
 * @returns {Promise<Map>} 返回一个Promise对象，解析为包含多复选框配置的Map
 */
async function getMultiCheckboxMap() {
    // 如果configSettings存在则使用它，否则调用initSettings()函数获取
    const settingsJson = config.info.settings ? config.info.settings : await initSettings();
    // 创建一个新的Map对象用于存储多复选框的配置
    // Map结构为: {名称: 选项数组}
    let multiCheckboxMap = new Map();
    // 遍历设置JSON中的每个条目
    settingsJson.forEach((entry) => {
        // 如果条目没有name属性或者类型不是"multi-checkbox"，则跳过该条目
        if (!entry.name || entry.type !== "multi-checkbox") return;
        // 解构条目中的name和label属性，便于后续使用
        const {name, label} = entry;
        // 获取当前name对应的设置值，如果存在则转换为数组，否则使用空数组
        const options = settings[name] ? Array.from(settings[name]) : [];
        // 记录调试信息，包含名称、标签、选项和选项数量
        log.debug("name={key1},label={key2},options={key3},length={key4}", name, label, JSON.stringify(options), options.length);
        // 将名称和对应的选项数组存入Map
        multiCheckboxMap.set(name, options);
    })
    // 返回包含多复选框配置的Map
    return multiCheckboxMap
}

/**
 * 根据复选框组名称获取对应的值
 * 这是一个异步函数，用于从复选框映射中获取指定名称的值
 * @param {string} name - 复选框组的名称
 * @returns {Promise<any>} 返回一个Promise，解析为复选框组对应的值
 */
async function getValueByMultiCheckboxName(name) {
    // 获取复选框映射表，这是一个异步操作
    let multiCheckboxMap = await getMultiCheckboxMap()
    // log.debug("multiCheckboxMap={key}", JSON.stringify(multiCheckboxMap))
    // multiCheckboxMap.entries().forEach(([name, options]) => {
    //     log.debug("name={key1},options={key2}", name, JSON.stringify(options))
    // })
    // 从映射表中获取并返回指定名称对应的值
    let values = multiCheckboxMap.get(name);
    log.debug("values={key}", JSON.stringify(values))
    return values
}
async function initConfig() {
    /*  const domainList = [
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
      ]*/

    const domainList = JSON.parse(file.readTextSync(config.path.domain)) || []

    config.domainList.push(...domainList)

    config.domainList.forEach(item => {
        if (!config.domainNames.has(item.name)) {
            config.domainNames.add(item.name)
        }
        config.domainMap.set(item.name, item.list);
        if (item?.hasOrder) {
            let index = 1
            //设置顺序
            item.list.forEach(item2 => {
                if (!config.itemNames.has(item2)) {
                    config.itemNames.add(item2)
                }
                config.domainOrderMap.set(item2, index)
                config.domainItemsMap.set(item2, item.name)
                index++
            })
        }

    })
    config.domain.config = settings.domain_config || config.domain.config
    if (config.domainList.length <= 0) {
        throw new Error("配置文件缺失或读取异常!")
    }
}

export {
    config,
    initSettings,
    getMultiCheckboxMap,
    getValueByMultiCheckboxName,
    initConfig
}