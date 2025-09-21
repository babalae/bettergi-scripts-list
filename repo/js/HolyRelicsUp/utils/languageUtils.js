function getLanguageMsgMap() {
    let LanguageMsgMap = new Map([
        ['简体中文', '未找到[language-key]语言配置,支持语言：[languageList-key]'],
        ['繁體中文', '未找到[language-key]語言配置，支持語言：[languageList-key]'],
        ['日本語', '[language-key]の言語設定が見つかりません。サポートされている言語：[languageList-key]'],
        ['한국어', '[language-key] 언어 구성을 찾을 수 없습니다. 지원 언어: [languageList-key]'],
        ['English', 'Language configuration for [language-key] not found. Supported languages: [languageList-key]'],
    ])
    return LanguageMsgMap
}

function getLanguageMap() {
    let LanguageMap = new Map([
        ['简体中文', 'zh-cn']
    ])
    return LanguageMap
}

function getLanguageALLConfigMap() {
    //key 值为 ./assets/language 下的语言 文件夹 value为配置json
    let LanguageALLConfigMap = new Map([
        ['zh-cn',
            {
                attributeMap: new Map([
                    ['%', '百分比'],
                    ['生命', '生命值'],
                    ['防御', '防御力'],
                    ['攻击', '攻击力'],
                    ['暴率', '暴击率'],
                    ['爆率', '暴击率'],
                    ['暴伤', '暴击伤害'],
                    ['爆伤', '暴击伤害'],
                    ['物伤', '物理伤害加成'],
                    ['风伤', '风元素伤害加成'],
                    ['水伤', '水元素伤害加成'],
                    ['雷伤', '雷元素伤害加成'],
                    ['岩伤', '岩元素伤害加成'],
                    ['草伤', '草元素伤害加成'],
                    ['冰伤', '冰元素伤害加成'],
                    ['火伤', '火元素伤害加成'],
                    ['治疗', '治疗加成'],
                    ['精通', '元素精通'],
                    ['充能', '元素充能效率'],
                ]),
                attributeList: [
                    '物理伤害加成'
                    , '风元素伤害加成'
                    , '水元素伤害加成'
                    , '雷元素伤害加成'
                    , '岩元素伤害加成'
                    , '草元素伤害加成'
                    , '冰元素伤害加成'
                    , '火元素伤害加成'
                    , '治疗加成'
                    // , '元素精通'
                    // , '元素充能效率'
                ],
                attributeFixedMap: new Map([
                    ['生之花', ['生命值']],
                    ['死之羽', ['攻击力']],
                ]),
                attributeHolyRelickeys: ['生命值', '防御力', '攻击力'],
                holyRelicPartsAsMap: new Map([
                    ['花', '生之花'],
                    ['羽', '死之羽'],
                    ['羽毛', '死之羽'],
                    ['冠', '理之冠'],
                    ['沙', '时之沙'],
                    ['杯', '空之杯'],
                    ['杯子', '空之杯'],
                ]),
                holyRelicParts: ['生之花', '死之羽', '理之冠', '时之沙', '空之杯'],
                //languageMap 不同语言请保持 key值不变
                languageMap: new Map([
                    // ['ascending_order', {name: '升序', type: '.jpg'}],
                    ['attribute_sort_rules', {name: '属性排序规则', type: '.jpg'}],
                    ['filtered', {name: '已经筛选', type: '.jpg'}],
                    ['saint_relic_backpack_selected', {name: '已选中圣遗物背包', type: '.jpg'}],
                    // ['open_the_function', {name: '开启阶段放入功能', type: '.jpg'}],
                    ['strengthen', {name: '强化', type: '.jpg'}],
                    // ['quickly_put_in', {name: '快捷放入', type: '.jpg'}],
                    ['stage_put_in', {name: '阶段放入', type: '.jpg'}],
                    ['morra_is_not_enough', {name: '摩拉不足', type: '.jpg'}],
                    ['ascending_order_not_selected', {name: '未选中升序1', type: '.jpg'}],
                    ['consecration_oil_paste', {name: '祝圣油膏', type: '.jpg'}],
                    ['consecration_essence', {name: '祝圣精华', type: '.jpg'}],
                    ['level_sort', {name: '等级顺序排序', type: '.jpg'}],
                    // ['level_not_max', {name: '筛选未满级', type: '.jpg'}],
                    ['info', {name: '详情', type: '.jpg'}],
                    // ['up_materials_select', {name: '请选择升级材料', type: '.jpg'}],
                    // ['morra_need', {name: '需要摩拉', type: '.jpg'}],
                ]),
                //魔法值 不同语言请保持 key值不变
                mana: new Map([
                    ['holyRelicsNoMax', '未满级'],
                    ['holyRelicsLockMark', '标记'],
                    ['holyRelicsLockY', '仅锁定'],
                    ['holyRelicsLockN', '未锁定'],
                    ['holyRelicsEquipY', '已装备'],
                    ['holyRelicsEquipN', '未装备'],
                    ['holyRelicsSourceFrostSaint', '祝圣之霜定义'],

                    ['desc_order', '降序'],
                    ['asc_order', '升序'],

                    ['quality_order', '品质顺序'],

                    ['percentage', '百分比'],
                    ['toBeActivated', '（待激活）']
                ]),
                settings:JSON.stringify([
                    {
                        "name": "refreshSettingsByLanguage",
                        "type": "checkbox",
                        "label": "根据语言刷新设置列表|根據語言重新整理設置列表|Refresh the settings list based on language|言語に基づいて設定リストを更新する|언어에 따라 설정 목록을 새로 고침",
                        "default": false
                    },
                    {
                        "name": "language",
                        "type": "select",
                        "label": "语言|語言|Language|言語|언어",
                        "options": [
                            "简体中文",
                            "繁體中文",
                            "English",
                            "日本語",
                            "한국어",
                        ],
                        "default": "简体中文"
                    },
                    {
                        "name": "toBag",
                        "type": "checkbox",
                        "label": "启用自动进入背包",
                        "default": true
                    },
                    {
                        "name": "enableBatchUp",
                        "type": "checkbox",
                        "label": "启用批量强化(注:可单独使用单独使用时\n请处于圣遗物背包筛选未满级状态后)",
                        "default": false
                    },
                    {
                        "name": "enableInsertionMethod",
                        "type": "checkbox",
                        "label": "自动启用放入方式 快捷放入/阶段放入(优先级高)",
                        "default": false
                    },
                    {
                        "name": "insertionMethod",
                        "type": "select",
                        "label": "放入方式(默认:自动识别,\n注意:最大强化等级设置为4,8,16时\n强制使用放入方式为阶段放入)",
                        "options": [
                            "默认",
                            "快捷放入",
                            "阶段放入"
                        ],
                        "default": "默认"
                    },
                    {
                        "name": "material",
                        "type": "select",
                        "label": "选择素材(默认:自动识别)\n(消失太快无法识别禁用)",
                        "options": [
                            "默认",
                            "1星素材",
                            "2星及以下素材",
                            "3星及以下素材",
                            "4星及以下素材"
                        ],
                        "default": "默认"
                    },
                    {
                        "name": "upMaxCount",
                        "type": "input-text",
                        "label": "最大圣遗物强化个数",
                        "default": ""
                    },
                    {
                        "name": "upMax",
                        "type": "select",
                        "label": "最大强化等级(默认4)",
                        "options": [
                            "4",
                            "8",
                            "16",
                            "20"
                        ],
                        "default": "4"
                    },
                    {
                        "name": "enableAttributeHolyRelic",
                        "type": "checkbox",
                        "label": "启用命中属性\n(默认关闭,不支持在升序情况下使用)-实验功能",
                        "default": false
                    },
                    {
                        "name": "coverAttributeHolyRelic",
                        "type": "checkbox",
                        "label": "启用自定义命中属性覆盖通用命中属性\n(默认开启,以部件为单位,不启用则使用自定义命中属性)-实验功能",
                        "default": true
                    },
                    {
                        "name": "commonAttributeHolyRelic",
                        "type": "input-text",
                        "label": "通用命中属性\n(编写语法请查看文档)-实验功能",
                        "default": "@花*爆率*爆伤|@羽*爆率*爆伤|@沙*爆率*爆伤|@冠#爆率#爆伤&*爆率*爆伤|@杯#物伤#风伤#水伤#火伤#雷伤#岩伤#冰伤#草伤&*爆率*爆伤"
                    },
                    {
                        "name": "inputAttributeHolyRelic",
                        "type": "input-text",
                        "label": "自定义命中属性\n(编写语法请查看文档)-实验功能",
                        "default": ""
                    },
                    {
                        "name": "coverSiftAttributeHolyRelic",
                        "type": "checkbox",
                        "label": "启用筛选圣遗物自定义命中属性覆盖筛选圣遗物通用命中属性\n(默认开启,以部件为单位,不启用则使用自定义属性)-实验功能",
                        "default": true
                    },
                    {
                        "name": "meetAllSiftAttributeHolyRelic",
                        "type": "checkbox",
                        "label": "启用筛选圣遗物满足所有指定的子属性命中条件\n(默认关闭)-实验功能",
                        "default": false
                    },
                    {
                        "name": "commonSiftAttributeHolyRelic",
                        "type": "input-text",
                        "label": "筛选圣遗物通用命中属性\n(编写语法请查看文档)-实验功能",
                        "default": "@花*爆率*爆伤|@羽*爆率*爆伤|@沙*爆率*爆伤|@冠#爆率#爆伤&*爆率*爆伤|@杯#物伤#风伤#水伤#火伤#雷伤#岩伤#冰伤#草伤&*爆率*爆伤"
                    },
                    {
                        "name": "inputSiftAttributeHolyRelic",
                        "type": "input-text",
                        "label": "筛选圣遗物自定义命中属性\n(编写语法请查看文档)-实验功能",
                        "default": ""
                    },
                    {
                        "name": "toSort",
                        "type": "checkbox",
                        "label": "启用自动排序(未启用时以下配置 排序 均无效)",
                        "default": true
                    },
                    {
                        "name": "sortAttribute",
                        "type": "input-text",
                        "label": "属性排序(使用|分割)\n可使用简称如: 生命%|雷伤|充能",
                        "default": ""
                    },
                    {
                        "name": "sortMain",
                        "type": "select",
                        "label": "主排序",
                        "options": [
                            "升序",
                            "降序",
                        ],
                        "default": "升序"
                    },
                    {
                        "name": "sortAuxiliary",
                        "type": "select",
                        "label": "辅助排序",
                        "options": [
                            "等级顺序",
                            "品质顺序",
                        ],
                        "default": "等级顺序"
                    },
                    {
                        "name": "toSift",
                        "type": "checkbox",
                        "label": "启用筛选圣遗物开关(未启用时以下配置 圣遗物筛选 均无效)",
                        "default": true
                    },
                    {
                        "name": "suit",
                        "type": "input-text",
                        "label": "圣遗物筛选(使用|分割 的模糊匹配 <无个数限制>如: 如雷|苍白|...)",
                        "default": ""
                    },
                    {
                        "name": "countMaxByHoly",
                        "type": "select",
                        "label": "筛选圣遗物界面最大翻页次数 (默认4)",
                        "options": [
                            "1",
                            "2",
                            "3",
                            "4",
                            "5",
                            "6",
                            "7",
                            "8",
                        ],
                        "default": "4"
                    },
                    {
                        "name": "holyRelicsLockMark",
                        "type": "checkbox",
                        "label": "圣遗物筛选:(锁定状态)|标记",
                        "default": false
                    },
                    {
                        "name": "holyRelicsLockY",
                        "type": "checkbox",
                        "label": "圣遗物筛选:(锁定状态)|仅锁定",
                        "default": false
                    },
                    {
                        "name": "holyRelicsLockN",
                        "type": "checkbox",
                        "label": "圣遗物筛选:(锁定状态)|未锁定",
                        "default": false
                    },
                    {
                        "name": "holyRelicsEquipY",
                        "type": "checkbox",
                        "label": "圣遗物筛选:(装备状态)|已装备",
                        "default": false
                    },
                    {
                        "name": "holyRelicsEquipN",
                        "type": "checkbox",
                        "label": "圣遗物筛选:(装备状态)|未装备",
                        "default": false
                    },
                    {
                        "name": "holyRelicsSourceFrostSaint",
                        "type": "checkbox",
                        "label": "圣遗物筛选:(来源)|祝圣之霜定义",
                        "default": false
                    },
                    {
                        "name": "knapsackKey",
                        "type": "input-text",
                        "label": "打开背包按键(不填，默认：B)",
                        "default": "B"
                    },
                    {
                        "name": "log_off",
                        "type": "checkbox",
                        "label": "日志开关(用于开发者调试-日志输出为中文)",
                        "default": false
                    }
                ])
                ,

            }
        ],
    ])
    return LanguageALLConfigMap
}

this.languageUtils = {
    getLanguageMap,
    getLanguageALLConfigMap,
    getLanguageMsgMap,
};