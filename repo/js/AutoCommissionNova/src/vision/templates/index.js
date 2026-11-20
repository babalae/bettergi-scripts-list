/**
 * RO 模板命名空间
 *
 * 业务调用约定：
 *   静态模板用属性形态：  new BvPage().locator(RO.inMainUI).isExist()
 *   动态模板用方法形态：  page.locator(RO.commissionCompleted(buttonIndex)).isExist()
 *
 * 新增模板：
 *   1) 在 _statics 里加一行（无参数）/ 在下方 RO.xxx 赋值（带参数）
 *   2) 同步在 @typedef RONamespace 里加一行字段声明（让 IDE 能 autocomplete + 拼写检查）
 *
 * 命名规范：与现有 PATHS 常量保持语义对齐（inMainUI / inTalk / track / inBag / ...），
 * 避免 "templateXxx" / "imageXxx" 这类多余前缀
 */
import { staticDef, dynamicDef } from "./define-template.js";
import { PATHS, UI_REGIONS, DIALOG_REGIONS, COMMISSION_STATUS_REGIONS } from "../../config/index.js";

/**
 * 静态模板集合 —— 这里集中声明，下面用 Object.defineProperty 全部包成 getter 挂到 RO
 *
 * 每条 value 是 staticDef 返回的 thunk；getter 调用它即触发懒加载 / 命中缓存
 */
const _statics = {
    /** 主界面派蒙图标（左上角 500x500 区域内匹配） */
    inMainUI:            staticDef({ path: PATHS.PAIMON_MENU_IMAGE, region: UI_REGIONS.PAIMON_MENU_SEARCH }),
    /** 大地图界面标识 */
    inMap:               staticDef({ path: PATHS.IN_MAP_IMAGE, region: [19, 425, 55, 230] }),
    /** 对话气泡图标（左上角对话指示器） */
    inTalk:              staticDef({ path: PATHS.INTALK_IMAGE, region: [254, 19, 80, 52] }),
    /** 大地图 - 选中委托后的"追踪"按钮 */
    track:               staticDef({ path: PATHS.TRACK_IMAGE, region: UI_REGIONS.TRACK_BUTTON }),
    /** 背包左下角的固定图标（用于判定背包已打开） */
    inBag:               staticDef({ path: "Data/RecognitionObject/bag/inBag.png", region: [39, 975, 76, 84] }),
    /** 地图上的大型委托图标（蓝色菱形） */
    iconBigmap:          staticDef({ path: PATHS.ICON_BIGMAP_COMMISSION }),
    /** 地图上的基础委托图标（中心限定区域，启用 mask） */
    iconBase:            staticDef({ path: PATHS.ICON_BASE_COMMISSION, region: [423, 197, 1055, 542] }),
    /** 地图上的基础委托图标（全屏匹配，启用 mask） */
    iconBaseFull:        staticDef({ path: PATHS.ICON_BASE_COMMISSION }),
    /** 地图上的问号委托图标 */
    iconQuestion:        staticDef({ path: PATHS.ICON_QUESTION_COMMISSION }),
    /** 地图上的普通任务委托图标 */
    iconTask:            staticDef({ path: PATHS.ICON_TASK_COMMISSION }),
    /** 乐流奔引 - 月光交互图标 */
    moonLightIcon:       staticDef({ path: PATHS.MOON_LIGHT_ICON }),
    /** 成就搜索界面 - "无搜索结果"占位图（用于判定搜索没有任何匹配） */
    achievementNoResult: staticDef({ path: PATHS.HAS_NO_RESULT_IMAGE, region: [1221, 415, 115, 157] }),
    /** 对话选项 - 退出对话气泡（DIALOG_REGIONS.TALK_ICON 内匹配，useMask） */
    talkExit:            staticDef({ path: PATHS.TALK_EXIT_IMAGE, region: DIALOG_REGIONS.TALK_ICON, useMask: true }),
    /** 对话选项 - 普通气泡图标（DIALOG_REGIONS.TALK_ICON 内匹配） */
    talkIcon:            staticDef({ path: PATHS.TALK_ICON_IMAGE, region: DIALOG_REGIONS.TALK_ICON }),
};

/**
 * @typedef {Object} RONamespace
 * @property {Object} inMainUI                                                  主界面派蒙图标
 * @property {Object} inMap                                                     大地图界面标识
 * @property {Object} inTalk                                                    对话气泡图标
 * @property {Object} track                                                     大地图 - 委托追踪按钮
 * @property {Object} inBag                                                     背包已打开标识
 * @property {Object} iconBigmap                                                大地图委托图标
 * @property {Object} iconBase                                                  基础委托图标（中心限定区域）
 * @property {Object} iconBaseFull                                              基础委托图标（全屏匹配）
 * @property {Object} iconQuestion                                              问号委托图标
 * @property {Object} iconTask                                                  普通任务委托图标
 * @property {Object} moonLightIcon                                             乐流奔引月光交互图标
 * @property {Object} achievementNoResult                                       成就搜索无结果占位
 * @property {Object} talkExit                                                  对话退出气泡
 * @property {Object} talkIcon                                                  对话普通气泡
 * @property {(index: number) => Object} commissionCompleted                    委托已完成（按 buttonIndex 0-3 选区域）
 * @property {(index: number) => Object} commissionUncompleted                  委托未完成（按 buttonIndex 0-3 选区域）
 * @property {(arg: {tab: string, item: string}) => Object} bagItem             背包道具图标（按 tab + 道具名）
 */

/** @type {RONamespace} */
export const RO = {};

// 静态：所有 _statics 用 Object.defineProperty 包成 getter，让 RO.xxx 像属性
for (const [name, thunk] of Object.entries(_statics)) {
    Object.defineProperty(RO, name, {
        get: thunk,
        enumerable: true,
    });
}

// 动态：直接挂载为方法
RO.commissionCompleted = dynamicDef({
    path: PATHS.COMPLETED_IMAGE,
    regionFn: (index) => COMMISSION_STATUS_REGIONS[index],
});
RO.commissionUncompleted = dynamicDef({
    path: PATHS.UNCOMPLETED_IMAGE,
    regionFn: (index) => COMMISSION_STATUS_REGIONS[index],
});
RO.bagItem = dynamicDef({
    pathFn: ({ tab, item }) => `Data/RecognitionObject/bag/items/${tab}/${item}.png`,
    region: [112, 118, 1158, 839],
});

export { releaseAllTemplates } from "./define-template.js";
