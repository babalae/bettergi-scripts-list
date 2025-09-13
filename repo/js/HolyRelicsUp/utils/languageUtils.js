function getLanguageMap() {
    let LanguageMap = new Map([
        ['简体中文', 'zh-cn']
    ])
    return LanguageMap
}

function getLanguageALLConfigMap() {
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
            }
        ],
    ])
    return LanguageALLConfigMap
}

this.languageUtils = {
    getLanguageMap,
    getLanguageALLConfigMap,
};