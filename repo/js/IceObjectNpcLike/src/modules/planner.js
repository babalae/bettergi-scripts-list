import {
    HIGH_YIELD_MIN_LIKES,
    HIGH_YIELD_ONLY,
    ORDER_BY_LIKES
} from "../constants.js";

export function buildRouteGroups(points) {
    const groups = [];

    for (const point of points) {
        if (!point.continueFromPrevious) {
            groups.push({
                points: [point],
                firstNumber: point.number,
                requiresRestoreStart: point.requiresRestoreStart,
                likeCount: 0,
                hasCompleteLikeData: true
            });
        } else {
            groups[groups.length - 1].points.push(point);
        }
    }

    return groups;
}

function createSelectedGroup(sourceGroup, selectedPoints) {
    if (selectedPoints.length === 0) {
        return null;
    }

    const selectedGroup = {
        points: selectedPoints,
        firstNumber: selectedPoints[0].number,
        requiresRestoreStart: sourceGroup.requiresRestoreStart,
        likeCount: 0,
        hasCompleteLikeData: true
    };

    for (const point of selectedPoints) {
        if (point.likeCount === null) {
            selectedGroup.hasCompleteLikeData = false;
        } else {
            selectedGroup.likeCount += point.likeCount;
        }
    }

    return selectedGroup;
}

function selectStationRouteGroup(group, point09AlternatePath) {
    const point07 = group.points.find(point => point.number === 7);
    const point08 = group.points.find(point => point.number === 8);
    const point09 = group.points.find(point => point.number === 9);

    if (!point07 || !point08 || !point09) {
        return null;
    }

    if (!point07.enabled) {
        log.info(`[${point07.name}] 已在 JS 自定义设置中关闭`);
        if (point08.enabled) {
            log.warn(`[${point08.name}] 依赖 ${point07.name} 的当前位置，已自动跳过`);
        }
        if (point09.enabled) {
            log.warn(`[${point09.name}] 依赖 ${point07.name} 的当前位置，已自动跳过`);
        }
        return { handled: true, group: null };
    }

    const selectedPoints = [point07];

    if (point08.enabled) {
        selectedPoints.push(point08);
    } else {
        log.info(`[${point08.name}] 已关闭，将在需要时使用备用路线绕过`);
    }

    if (point09.enabled) {
        if (point08.enabled) {
            selectedPoints.push(point09);
        } else {
            selectedPoints.push({
                ...point09,
                path: point09AlternatePath,
                alternatePathReason: "Point 08 已关闭，从 Point 07 直接前往 Point 09"
            });
            log.info("[RouteGroup] Point 07 → Point 09 将使用备用路线，跳过 Point 08");
        }
    } else {
        log.info(`[${point09.name}] 已在 JS 自定义设置中关闭`);
    }

    return {
        handled: true,
        group: createSelectedGroup(group, selectedPoints)
    };
}

export function applyRouteSwitches(groups, point09AlternatePath) {
    const selectedGroups = [];

    for (const group of groups) {
        const stationSelection = selectStationRouteGroup(group, point09AlternatePath);
        if (stationSelection) {
            if (stationSelection.group) {
                selectedGroups.push(stationSelection.group);
            }
            continue;
        }

        const selectedPoints = [];
        let dependencyBrokenBy = null;

        for (const point of group.points) {
            if (dependencyBrokenBy) {
                log.warn(`[${point.name}] 依赖已跳过的 ${dependencyBrokenBy.name}，连续路线已自动跳过`);
                continue;
            }

            if (!point.enabled) {
                log.info(`[${point.name}] 已在 JS 自定义设置中关闭`);
                dependencyBrokenBy = point;
                continue;
            }

            selectedPoints.push(point);
        }

        const selectedGroup = createSelectedGroup(group, selectedPoints);
        if (selectedGroup) {
            selectedGroups.push(selectedGroup);
        }
    }

    return selectedGroups;
}

export function routeGroupName(group) {
    return group.points.map(point => point.name).join(" → ");
}

export function orderRouteGroups(groups, orderMode) {
    let ordered = groups.slice();

    if (orderMode === HIGH_YIELD_ONLY) {
        ordered = ordered.filter(group => {
            if (!group.hasCompleteLikeData) {
                log.warn(
                    `[RouteGroup] “${routeGroupName(group)}”缺少完整点赞标签，` +
                    "无法判断是否达到高收益门槛，已跳过"
                );
                return false;
            }
            if (group.likeCount < HIGH_YIELD_MIN_LIKES) {
                log.info(
                    `[RouteGroup] “${routeGroupName(group)}”预计 ${group.likeCount} 赞，` +
                    `低于高收益门槛 ${HIGH_YIELD_MIN_LIKES} 赞，已跳过`
                );
                return false;
            }
            return true;
        });
    }

    if (orderMode === ORDER_BY_LIKES || orderMode === HIGH_YIELD_ONLY) {
        ordered.sort((a, b) => {
            if (a.hasCompleteLikeData !== b.hasCompleteLikeData) {
                return a.hasCompleteLikeData ? -1 : 1;
            }
            if (a.hasCompleteLikeData && a.likeCount !== b.likeCount) {
                return b.likeCount - a.likeCount;
            }
            return a.firstNumber - b.firstNumber;
        });
    } else {
        ordered.sort((a, b) => a.firstNumber - b.firstNumber);
    }

    return ordered;
}

export function validateRouteGroups(groups, restoreEveryPoints) {
    for (const group of groups) {
        if (group.points.length > 6) {
            throw new Error(
                `连续路线组“${routeGroupName(group)}”包含 ${group.points.length} 个 Point，` +
                "超过已确认的60点热能容量；请拆分为可以重新传送的独立路线"
            );
        }
        if (group.points.length > restoreEveryPoints) {
            log.warn(
                `[RouteGroup] “${routeGroupName(group)}”长度超过恢复间隔 ${restoreEveryPoints}，` +
                "为保持连续位置，将在组开始前恢复并完整执行该组"
            );
        }
    }
}

export function logExecutionPlan(groups, orderMode, restoreEveryPoints) {
    const plan = groups.map(group => {
        const likes = group.hasCompleteLikeData ? `${group.likeCount}赞` : "点赞未完整标注";
        return `${routeGroupName(group)}（${likes}）`;
    }).join(" | ");

    log.info(`[Config] 路线运行模式：${orderMode}`);
    log.info(`[Config] 每 ${restoreEveryPoints} 个成功 Point 恢复一次热能`);
    log.info(`[Plan] ${plan}`);
}
