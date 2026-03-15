// 自动更新settings.json中的options数组
// 使用BetterGI的file对象，不需要Node.js的fs模块

var SETTINGS_FILE = "settings.json";

function updateSettingsOptions() {
    log.info("开始更新settings.json...");
    try {
        var settingsContent = file.readTextSync(SETTINGS_FILE);
        log.info("settings.json内容长度: " + settingsContent.length);
        var settings = JSON.parse(settingsContent);
        log.info("settings.json解析成功，配置项数量: " + settings.length);

        var hasChanges = false;

        var popupDirs = readAllFilePaths("assets/imageClick", 0, 2, [], true)
            .filter(function (dirPath) {
                var entries = readAllFilePaths(dirPath, 0, 0, [], true);
                return entries.some(function (entry) {
                    return normalizePath(entry).endsWith('/icon');
                });
            })
            .filter(function (dirPath) {
                return !normalizePath(dirPath).includes('/其他/');
            })
            .map(function (dirPath) {
                return basename(dirPath);
            })
            .sort();
        log.info("扫描到弹窗目录数量: " + popupDirs.length);

        var popupSetting = settings.find(function (s) {
            return s.name === "PopupNames";
        });
        if (popupSetting) {
            log.info("找到PopupNames配置项");
            var existingOptions = popupSetting.options || [];
            log.info("现有options数量: " + existingOptions.length);

            var existingSet = {};
            for (var k = 0; k < existingOptions.length; k++) {
                existingSet[existingOptions[k]] = true;
            }

            var popupSet = {};
            for (var p = 0; p < popupDirs.length; p++) {
                popupSet[popupDirs[p]] = true;
            }

            var newOptions = [];
            var removedOptions = [];
            for (var m = 0; m < popupDirs.length; m++) {
                if (!existingSet[popupDirs[m]]) {
                    newOptions.push(popupDirs[m]);
                }
            }
            for (var n = 0; n < existingOptions.length; n++) {
                if (!popupSet[existingOptions[n]]) {
                    removedOptions.push(existingOptions[n]);
                }
            }

            log.info("新增options数量: " + newOptions.length);
            log.info("删除options数量: " + removedOptions.length);

            if (newOptions.length > 0 || removedOptions.length > 0) {
                popupSetting.options = popupDirs;
                hasChanges = true;
                if (newOptions.length > 0) {
                    log.info("PopupNames新增选项: " + newOptions.join(', '));
                }
                if (removedOptions.length > 0) {
                    log.info("PopupNames删除选项: " + removedOptions.join(', '));
                }
            } else {
                log.info("PopupNames无新增选项");
            }
        } else {
            log.info("未找到PopupNames配置项");
        }

        var cdCategories = readAllFilePaths("materialsCD", 0, 1, ['.txt'])
            .map(function (filePath) {
                return basename(filePath).replace('.txt', '');
            })
            .sort();

        var cdSetting = settings.find(function (s) {
            return s.name === "CDCategories";
        });
        if (cdSetting) {
            var existingOptions = cdSetting.options || [];
            var existingSet = {};
            for (var k = 0; k < existingOptions.length; k++) {
                existingSet[existingOptions[k]] = true;
            }
            var cdSet = {};
            for (var p = 0; p < cdCategories.length; p++) {
                cdSet[cdCategories[p]] = true;
            }
            var newOptions = [];
            var removedOptions = [];
            for (var m = 0; m < cdCategories.length; m++) {
                if (!existingSet[cdCategories[m]]) {
                    newOptions.push(cdCategories[m]);
                }
            }
            for (var n = 0; n < existingOptions.length; n++) {
                if (!cdSet[existingOptions[n]]) {
                    removedOptions.push(existingOptions[n]);
                }
            }
            if (newOptions.length > 0 || removedOptions.length > 0) {
                cdSetting.options = cdCategories;
                hasChanges = true;
                if (newOptions.length > 0) {
                    log.info("CDCategories新增选项: " + newOptions.join(', '));
                }
                if (removedOptions.length > 0) {
                    log.info("CDCategories删除选项: " + removedOptions.join(', '));
                }
            }
        }

        var pickCategories = readAllFilePaths("targetText", 0, 1, ['.txt'])
            .map(function (filePath) {
                return basename(filePath).replace('.txt', '');
            })
            .sort();

        var pickSetting = settings.find(function (s) {
            return s.name === "PickCategories";
        });
        if (pickSetting) {
            var existingOptions = pickSetting.options || [];
            var existingSet = {};
            for (var k = 0; k < existingOptions.length; k++) {
                existingSet[existingOptions[k]] = true;
            }
            var pickSet = {};
            for (var p = 0; p < pickCategories.length; p++) {
                pickSet[pickCategories[p]] = true;
            }
            var newOptions = [];
            var removedOptions = [];
            for (var m = 0; m < pickCategories.length; m++) {
                if (!existingSet[pickCategories[m]]) {
                    newOptions.push(pickCategories[m]);
                }
            }
            for (var n = 0; n < existingOptions.length; n++) {
                if (!pickSet[existingOptions[n]]) {
                    removedOptions.push(existingOptions[n]);
                }
            }
            if (newOptions.length > 0 || removedOptions.length > 0) {
                pickSetting.options = pickCategories;
                hasChanges = true;
                if (newOptions.length > 0) {
                    log.info("PickCategories新增选项: " + newOptions.join(', '));
                }
                if (removedOptions.length > 0) {
                    log.info("PickCategories删除选项: " + removedOptions.join(', '));
                }
            }
        }

        if (hasChanges) {
            var updatedContent = JSON.stringify(settings, null, 2);
            file.writeTextSync(SETTINGS_FILE, updatedContent, false);
            log.info("settings.json已自动更新");
        } else {
            log.info("settings.json无需更新");
        }
    } catch (error) {
        log.error("自动更新settings.json失败: " + error.message);
    }
}

updateSettingsOptions();
