import { COMMISSION_TYPE, PATHS } from "../config/index.js";
import { parseLocationDir } from "../utils/location-dir.js";

function baseName(path) {
    return path.split("/").pop().split("\\").pop();
}

function readSubDirectories(path) {
    try {
        return Array.from(file.readPathSync(path) || []).filter((item) => file.isFolder(item));
    } catch (error) {
        log.debug("读取目录失败 [{path}]: {err}", path, error.message);
        return [];
    }
}

export function getProcessTypeDir(type) {
    return type === COMMISSION_TYPE.BASIC ? "Basic" : "NPC";
}

export function listProcessCountries() {
    return readSubDirectories(PATHS.PROCESS_ROOT)
        .map(baseName)
        .filter((name) => name && name !== "config");
}

export function buildProcessBasePath(country, type) {
    return `${PATHS.PROCESS_ROOT}/${country}/${getProcessTypeDir(type)}`;
}

export function buildCommissionScope(scope) {
    const typeDir = getProcessTypeDir(scope.type);
    const locationDir = scope.locationDir || scope.location || "";
    const parsed = scope.type === COMMISSION_TYPE.BASIC
        ? parseLocationDir(locationDir)
        : { location: locationDir, ordinal: null };

    return {
        key: `${scope.country}::${scope.type}::${scope.commissionName}::${locationDir}`,
        country: scope.country,
        type: scope.type,
        typeDir,
        commissionName: scope.commissionName,
        location: parsed.location,
        locationDir,
        ordinal: parsed.ordinal,
        label: `${scope.country} | ${typeDir} | ${locationDir}`,
    };
}

export function buildCommissionScopeFromContext(context) {
    if (!context || !context.commissionName || !context.type || !context.country) {
        return null;
    }

    if (context.type === COMMISSION_TYPE.BASIC) {
        if (!context.processDir) {
            return null;
        }
        return buildCommissionScope({
            country: context.country,
            type: context.type,
            commissionName: context.commissionName,
            locationDir: baseName(context.processDir),
        });
    }

    if (!context.location) {
        return null;
    }
    return buildCommissionScope({
        country: context.country,
        type: context.type,
        commissionName: context.commissionName,
        locationDir: context.location,
    });
}

export function scanCommissionScopes() {
    const list = [];
    const byName = {};

    for (const country of listProcessCountries()) {
        for (const type of [COMMISSION_TYPE.NPC, COMMISSION_TYPE.BASIC]) {
            const baseDir = buildProcessBasePath(country, type);
            const commissionDirs = readSubDirectories(baseDir);

            for (const commissionDir of commissionDirs) {
                const commissionName = baseName(commissionDir);
                const locationDirs = readSubDirectories(commissionDir);

                for (const locationDirPath of locationDirs) {
                    const scope = buildCommissionScope({
                        country,
                        type,
                        commissionName,
                        locationDir: baseName(locationDirPath),
                    });
                    list.push(scope);
                    if (!Array.isArray(byName[commissionName])) {
                        byName[commissionName] = [];
                    }
                    byName[commissionName].push(scope);
                }
            }
        }
    }

    return { list, byName };
}
