import { __name } from "../rolldown-runtime.js";
import {
  findImageWithinBounds,
  findTextWithinBounds,
  findTextWithinListView,
} from "../@bettergi+utils.js";

// src/modules/drawing.ts
const pens = {
  default: new Pen(Color.red, 2),
  text: new Pen(Color.royalBlue, 2),
  img: new Pen(Color.mediumSeaGreen, 2),
  detect: new Pen(Color.orchid, 2),
};
const drawingBoard = {
  draw: (region, group) => {
    if (region) region.drawSelf(`${group || Date.now()}`, pens.default);
    return region;
  },
  text: (region) => {
    if (region) region.drawSelf("group_text", pens.text);
    return region;
  },
  img: (region) => {
    if (region) region.drawSelf("group_img", pens.img);
    return region;
  },
  detect: (region) => {
    if (region) region.drawSelf("group_detect", pens.detect);
    return region;
  },
};

// src/modules/onnx.ts
const onnxManager = {
  /** 模型注册 */
  uiDet: yolo.createPredictor("assets/models/ui-det.onnx", {
    confidence: 0.7,
    iou: 0.45,
  }),
  /** 释放模型资源 */
  dispose: () => {
    onnxManager.uiDet.dispose();
  },
};
const findYoloRegion = (list, predicate) => {
  for (let i = 0; i < list.count; i++) if (list[i]?.isExist() && predicate(list[i])) return list[i];
};

// src/constants/regions.ts
/** 通用：查找确认按钮 */
const findConfirmBtn = () => {
  const txt = findTextWithinBounds("确认", 480, 720, 960, 145);
  return drawingBoard.text(txt);
};
/** 通用：查找标题文字 */
const findHeaderTitle = (title, options) => {
  const txt = findTextWithinBounds(title, 0, 0, 300, 95, options);
  return drawingBoard.text(txt);
};
/** 通用：查找提示文字 */
const findPromptText = (text, options) => {
  const txt = findTextWithinBounds(text, 576, 432, 768, 216, options);
  return drawingBoard.text(txt);
};
/** 通用：查找底部按钮文字 */
const findBottomBtnText = (text, options) => {
  const txt = findTextWithinBounds(text, 0, 980, 1920, 100, options);
  return drawingBoard.text(txt);
};
/** 通用：查找关闭对话框按钮 */
const findCloseDialog = () => {
  const iro = findImageWithinBounds("assets/UI_BtnIcon_Close.png", 410, 160, 1100, 660, {
    useMask: true,
    threshold: 0.85,
  });
  return drawingBoard.img(iro);
};
/** 通用：点击空白处区域继续位置 */
const clickToContinue = (offsetX = 0, offsetY = 0) => {
  click(960 + offsetX, 1070 + offsetY);
};
/** 查找UID文本 */
const findUidText = () => {
  const im = captureGameRegion();
  const ro = RecognitionObject.ocr(1730, 1050, 140, 30);
  return (() => {
    const list = im.findMulti(ro);
    for (let i = 0; i < list.count; i++)
      if (list[i] && list[i].isExist()) {
        const uid = list[i].text.replace(/\D/g, "");
        /** 亚服 4.4 版本注册后的 UID 为 18开头的10位数字 */
        if (uid.length >= 9) {
          drawingBoard.text(list[i]);
          return uid;
        }
      }
  })();
};
/** 检测派蒙图标（判断处于大世界） */
const findPaimon = () => {
  const list = onnxManager.uiDet.detect();
  const iro = findYoloRegion(
    list,
    (item) => item.name === "paimon" && item.x < 960 && item.y + item.height < 120,
  );
  return drawingBoard.detect(iro);
};
/** 检测禁止联机按钮 */
const findSinglePlayerBtn = () => {
  const list = onnxManager.uiDet.detect();
  const iro = findYoloRegion(
    list,
    (item) => item.name === "single player" && item.x < 960 && item.y + item.height < 120,
  );
  return drawingBoard.detect(iro);
};
/** 检测奇域派蒙图标（判断处于奇域大厅） */
const findBeyondPaimon = () => {
  const list = onnxManager.uiDet.detect();
  const iro = findYoloRegion(
    list,
    (item) => item.name === "beyond paimon" && item.x < 960 && item.y + item.height < 120,
  );
  return drawingBoard.detect(iro);
};
/** 检测奇域大厅按钮（判断处于奇域大厅） */
const findBeyondHall = () => {
  const list = onnxManager.uiDet.detect();
  const iro = findYoloRegion(
    list,
    (item) => item.name === "beyond hall" && item.x < 960 && item.y + item.height < 120,
  );
  return drawingBoard.detect(iro);
};
/** 房间：查找搜索奇域按钮 */
const findAllWonderlandsBtn = () => {
  const txt = findTextWithinBounds("搜索", 1320, 0, 600, 95, { contains: true });
  return drawingBoard.text(txt);
};
/** 房间：查找奇域搜索输入框 */
const findSearchWonderlandInput = () => {
  const txt = findTextWithinBounds("搜索", 0, 120, 1920, 60, { contains: true });
  return drawingBoard.text(txt);
};
/** 房间：查找奇域搜索输入框清除按钮 */
const findClearInputBtn = () => {
  const txt = findTextWithinBounds("清除", 0, 120, 1920, 60, { contains: true });
  return drawingBoard.text(txt);
};
/** 房间：查找搜索奇域按钮 */
const findSearchWonderlandBtn = () => {
  const txt = findTextWithinBounds("搜索", 0, 120, 1920, 60, { contains: true });
  return drawingBoard.text(txt);
};
/** 房间：查找首行前N个奇域搜索结果名称 */
const findTopNSearchResultTexts = (n) => {
  const boundsN = (n) => [240 + n * 360, 475, 300, 50];
  const ir = captureGameRegion();
  return [...Array(n).keys()]
    .reverse()
    .map((i) => {
      return (() => {
        const ro = RecognitionObject.ocr(...boundsN(i));
        const list = ir.findMulti(ro);
        for (let i = 0; i < list.count; i++)
          if (list[i] && list[i].isExist()) {
            const text = list[i].text.trim();
            if (text) {
              drawingBoard.text(list[i]);
              return text;
            }
          }
      })();
    })
    .reverse();
};
/** 房间：点击选择第一个搜索结果位置 */
const clickToChooseFirstSearchResult = () => {
  click(265, 390);
};
/** 房间：查找进入房间快捷键按钮 */
const findEnterRoomShortcut = () => {
  const txt = findTextWithinBounds("房间", 1580, 110, 320, 390, { contains: true });
  return drawingBoard.text(txt);
};
/** 房间：查找退出房间按钮 */
const findLeaveRoomBtn = () => {
  const iro = findImageWithinBounds("assets/UI_Icon_Leave_Right.png", 1570, 0, 350, 100, {
    threshold: 0.8,
  });
  return drawingBoard.img(iro);
};
/** 房间：查找跳转大厅按钮 */
const findGoToLobbyBtn = () => {
  const txt = findTextWithinBounds("大厅", 880, 840, 1040, 110, { contains: true });
  return drawingBoard.text(txt);
};
/** 房间：查找创建房间按钮 */
const findCreateRoomBtn = () => {
  const txt = findTextWithinBounds("房间", 960, 95, 960, 70, { contains: true });
  return drawingBoard.text(txt);
};
/** 房间：点击加入准备区位置 */
const clickToPrepare = () => {
  click(770, 275);
};
/** 房间：查找编队过滤器按钮 */
const findSetupFilterBtn = () => {
  const iro = findImageWithinBounds("assets/UI_Icon_Setup_Filter.png", 0, 0, 90, 80, {
    threshold: 0.8,
  });
  return drawingBoard.img(iro);
};
/** 房间：点击选择第一位角色位置 */
const clickToChooseFirstCharacter = () => {
  click(100, 195);
};
/** 存档：查找奇域收藏 */
const findBeyondFavoritesBtn = () => {
  const txt = findTextWithinBounds("收藏", 0, 880, 200, 200, { contains: true });
  return drawingBoard.text(txt);
};
/** 存档：查找管理关卡按钮 */
const findManageStagesBtn = () => {
  const txt = findTextWithinBounds("管理", 1320, 0, 600, 95, { contains: true });
  return drawingBoard.text(txt);
};
/** 存档：查找编辑关卡存档按钮 */
const findEditStageSaveBtn = () => {
  const txt = findTextWithinBounds("管理", 1220, 980, 700, 100);
  return drawingBoard.text(txt);
};
/** 存档：查找存档时间占位符 */
const saveListViewBounds = [210, 248, 1650, 670];
const findSaveTimePlaceholder = () => {
  const [x, y, w, h] = saveListViewBounds;
  return findTextWithinBounds("1970年", x, y, w, h, {
    contains: true,
    maxEditDistance: 2,
  });
};
/** 存档：查找要删除的存档位置 */
const findSaveToDeletePos = (keyword) => {
  const [x, y, w, h] = saveListViewBounds;
  return findTextWithinListView(
    keyword,
    {
      x,
      y,
      w,
      h,
      scrollLines: 7,
      lineHeight: 95,
    },
    { contains: true },
  );
};
/** 存档：查找局外存档列头 */
const findExternalSaveColumnPos = () => {
  const txt = findTextWithinBounds("局外", 55, 190, 1810, 50, { contains: true });
  return drawingBoard.text(txt);
};
/** 存档：查找删除局外存档复选框已选中状态 */
const findDeleteExternalSaveChecked = (colPos) => {
  const iro = findImageWithinBounds("assets/Checkbox_Checked.png", colPos, 250, 290, 710, {
    threshold: 0.8,
    use3Channels: true,
  });
  return drawingBoard.img(iro);
};
/** 存档：查找删除关卡存档按钮 */
const findDeleteStageSaveBtn = () => {
  const txt = findTextWithinBounds("删除", 1220, 980, 700, 100, { contains: true });
  return drawingBoard.text(txt);
};
/** 关卡：查找结算跳过按钮 */
const findSkipBtn = () => {
  const txt = findTextWithinBounds("跳过", 1720, 0, 200, 100, { contains: true });
  return drawingBoard.text(txt);
};
/** 关卡：查找绮星盛会投票按钮 */
const findStarlitGalaVoteBtn = () => {
  const txt = findTextWithinBounds("投票", 1180, 650, 740, 330, { contains: false });
  return drawingBoard.text(txt);
};
/** 关卡：检测关卡退出按钮 */
const findLeave = () => {
  const list = onnxManager.uiDet.detect({ confidence: 0.75 });
  const iro = findYoloRegion(list, (item) => item.name === "leave");
  return drawingBoard.detect(iro);
};
/** 关卡：检测关卡加载图标 */
const findLoading = () => {
  const list = onnxManager.uiDet.detect({ confidence: 0.8 });
  const iro = findYoloRegion(list, (item) => {
    return item.name === "beyond stage loading" && item.x > 1075 && item.y > 660;
  });
  return drawingBoard.detect(iro);
};
/** 关卡：查找中断挑战按钮 */
const findExitStageBtn = () => {
  const txt = findTextWithinBounds("中断挑战", 576, 324, 768, 432, {
    contains: true,
    maxEditDistance: 1,
  });
  return drawingBoard.text(txt);
};
/** 退出：查找返回提瓦特按钮 */
const findGotTeyvatBtn = () => {
  const txt = findTextWithinBounds("返回", 1500, 0, 300, 95, { contains: true });
  return drawingBoard.text(txt);
};
/** 纪游：查找诸界纪游按钮 */
const findBeyondBattlepassBtn = () => {
  const list = onnxManager.uiDet.detect();
  const iro = findYoloRegion(
    list,
    (item) => item.name === "beyond battle pass" && item.x > 300 && item.y + item.height < 120,
  );
  return drawingBoard.detect(iro);
};
/** 纪游：查找纪游开屏动画 */
const findBeyondBattlepassPopup = () => {
  const txt = findTextWithinBounds("奖励一览", 0, 0, 960, 1080, {
    contains: true,
    maxEditDistance: 1,
  });
  return drawingBoard.text(txt);
};
/** 绮星盛会：查找奖励按钮 */
const findStarlitGalaRewardBtn = () => {
  const txt = findTextWithinBounds("奖励", 960, 815, 960, 265, { contains: true });
  return drawingBoard.text(txt);
};
/** 绮星盛会：查找奖励对话框 */
const findStarlitGalaRewardDialog = () => {
  const txt = findTextWithinBounds("奖励", 810, 150, 300, 230, { contains: true });
  return drawingBoard.text(txt);
};
/** 绮星盛会：查找盛会人气图标 */
const findFestiveFever = () => {
  const iro = findImageWithinBounds("assets/UI_Icon_FestiveFever.png", 410, 160, 1100, 660, {
    use3Channels: true,
    threshold: 0.8,
  });
  return drawingBoard.img(iro);
};
/** 奖励：查找领取奖励按钮 */
const findFetchRewardBtn = () => {
  const iro = findImageWithinBounds(
    "assets/UI_Img_UGCCultivateReward_FetchHint.png",
    1450,
    100,
    470,
    880,
    {
      useMask: true,
      use3Channels: true,
      threshold: 0.8,
    },
  );
  return drawingBoard.img(iro);
};

export {
  clickToChooseFirstCharacter,
  clickToChooseFirstSearchResult,
  clickToContinue,
  clickToPrepare,
  drawingBoard,
  findAllWonderlandsBtn,
  findBeyondBattlepassBtn,
  findBeyondBattlepassPopup,
  findBeyondFavoritesBtn,
  findBeyondHall,
  findBeyondPaimon,
  findBottomBtnText,
  findClearInputBtn,
  findCloseDialog,
  findConfirmBtn,
  findCreateRoomBtn,
  findDeleteExternalSaveChecked,
  findDeleteStageSaveBtn,
  findEditStageSaveBtn,
  findEnterRoomShortcut,
  findExitStageBtn,
  findExternalSaveColumnPos,
  findFestiveFever,
  findFetchRewardBtn,
  findGoToLobbyBtn,
  findGotTeyvatBtn,
  findHeaderTitle,
  findLeave,
  findLeaveRoomBtn,
  findLoading,
  findManageStagesBtn,
  findPaimon,
  findPromptText,
  findSaveTimePlaceholder,
  findSaveToDeletePos,
  findSearchWonderlandBtn,
  findSearchWonderlandInput,
  findSetupFilterBtn,
  findSinglePlayerBtn,
  findSkipBtn,
  findStarlitGalaRewardBtn,
  findStarlitGalaRewardDialog,
  findStarlitGalaVoteBtn,
  findTopNSearchResultTexts,
  findUidText,
  onnxManager,
};
