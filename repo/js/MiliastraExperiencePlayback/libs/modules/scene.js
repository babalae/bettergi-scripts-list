import { __name } from "../rolldown-runtime.js";
import { findSinglePlayerBtn } from "../constants/regions.js";

//#region src/modules/scene.ts
const ensureMultiPlayer = () => {
  if (findSinglePlayerBtn()) log.warn("当前处于{sp}状态，无法进入千星奇域", "禁止联机");
};

//#endregion
export { ensureMultiPlayer };
