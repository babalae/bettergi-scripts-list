import {
    HIGH_YIELD_ONLY,
    ORDER_BY_LIKES,
    ORDER_BY_POINT,
    PATHS
} from "../constants.js";
import { runPoint } from "./actions.js";
import {
    configureRuntimeTimings,
    parsePointIntegerOverrides,
    readInteger,
    readSelect
} from "./config.js";
import { discoverPoints, preflight, restoreHeat } from "./pathing.js";
import {
    applyRouteSwitches,
    buildRouteGroups,
    logExecutionPlan,
    orderRouteGroups,
    routeGroupName,
    validateRouteGroups
} from "./planner.js";
import { errorText } from "../utils/common.js";

export async function runTask() {
    try {
        log.info("[System] 冰造物 NPC 点赞自动化开始");
        configureRuntimeTimings();

        const points = discoverPoints();
        preflight(points);

        const orderMode = readSelect(
            "executionOrderMode",
            ORDER_BY_POINT,
            [ORDER_BY_POINT, ORDER_BY_LIKES, HIGH_YIELD_ONLY]
        );
        const restoreEveryPoints = readInteger("restoreEveryPoints", 4, 1, 6);
        const xOverrides = parsePointIntegerOverrides("cameraOffsetXOverrides", -10000, 10000);
        const pitchOverrides = parsePointIntegerOverrides("cameraPitchFromTopOverrides", 0, 10000);

        const allGroups = buildRouteGroups(points);
        const selectedGroups = applyRouteSwitches(allGroups, PATHS.point09FromPoint07);
        const orderedGroups = orderRouteGroups(selectedGroups, orderMode);

        if (orderedGroups.length === 0) {
            log.warn("[System] 没有启用任何可执行路线，脚本结束");
            return;
        }

        validateRouteGroups(orderedGroups, restoreEveryPoints);
        logExecutionPlan(orderedGroups, orderMode, restoreEveryPoints);

        await restoreHeat("脚本启动");

        let completedSinceRestore = 0;
        let completedPoints = 0;
        let expectedLikes = 0;
        let pointsWithoutLikeTag = 0;

        for (const group of orderedGroups) {
            const groupSize = group.points.length;
            const insufficientHeatQuota = completedSinceRestore > 0 &&
                completedSinceRestore + groupSize > restoreEveryPoints;
            const mustReturnToRestoreStart = group.requiresRestoreStart && completedSinceRestore > 0;

            if (insufficientHeatQuota || mustReturnToRestoreStart) {
                const reason = mustReturnToRestoreStart
                    ? `${routeGroupName(group)} 需要从恢复点开始`
                    : `下一个连续组有 ${groupSize} 个 Point，当前剩余额度不足`;
                await restoreHeat(reason);
                completedSinceRestore = 0;
            }

            if (group.points.length > 1) {
                log.info(`[RouteGroup] 开始连续执行：${routeGroupName(group)}`);
            }

            for (const point of group.points) {
                if (point.continueFromPrevious) {
                    log.info(`[${point.name}] 连续路线：从上一个 Point 的当前位置继续`);
                }

                await runPoint(point, xOverrides, pitchOverrides);
                completedSinceRestore += 1;
                completedPoints += 1;

                if (point.likeCount === null) {
                    pointsWithoutLikeTag += 1;
                } else {
                    expectedLikes += point.likeCount;
                    log.info(`[${point.name}] 标签预计获得 ${point.likeCount} 赞`);
                }

                log.info(`[Heat] 本轮已完成 ${completedSinceRestore}/${restoreEveryPoints} 个 Point`);
            }
        }

        if (pointsWithoutLikeTag === 0) {
            log.info(`[System] 全部完成：执行 ${completedPoints} 个 Point，标签预计总计 ${expectedLikes} 赞`);
        } else {
            log.info(
                `[System] 全部完成：执行 ${completedPoints} 个 Point，已标注路线预计 ${expectedLikes} 赞，` +
                `${pointsWithoutLikeTag} 个 Point 未填写点赞标签`
            );
        }
    } catch (error) {
        log.error(`[System] 脚本终止：${errorText(error)}`);
        throw error;
    }
}
