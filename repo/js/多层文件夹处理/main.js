// 定义 readFolder 函数
/*
该函数可以实现输入要处理的文件夹路径后，将其中所有文件/仅json文件按照原顺序存储在一个对象中，具体使用参考主函数
*/
async function readFolder(folderPath, onlyJson) {
    log.info(`开始读取文件夹：${folderPath}`);

    // 新增一个堆栈，初始时包含 folderPath
    const folderStack = [folderPath];

    // 新增一个数组，用于存储文件信息对象
    const files = [];

    // 当堆栈不为空时，继续处理
    while (folderStack.length > 0) {
        // 从堆栈中弹出一个路径
        const currentPath = folderStack.pop();

        // 读取当前路径下的所有文件和子文件夹路径
        const filesInSubFolder = file.ReadPathSync(currentPath);

        // 临时数组，用于存储子文件夹路径
        const subFolders = [];
        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                // 如果是文件夹，先存储到临时数组中
                subFolders.push(filePath);
            } else {
                // 如果是文件，根据 onlyJson 判断是否存储
                if (onlyJson) {
                    if (filePath.endsWith(".json")) {
                        const fileName = filePath.split('\\').pop(); // 提取文件名
                        const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                        files.push({
                            fullPath: filePath,
                            fileName: fileName,
                            folderPathArray: folderPathArray
                        });
                        //log.info(`找到 JSON 文件：${filePath}`);
                    }
                } else {
                    const fileName = filePath.split('\\').pop(); // 提取文件名
                    const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                    files.push({
                        fullPath: filePath,
                        fileName: fileName,
                        folderPathArray: folderPathArray
                    });
                    //log.info(`找到文件：${filePath}`);
                }
            }
        }
        // 将临时数组中的子文件夹路径按原顺序压入堆栈
        folderStack.push(...subFolders.reverse()); // 反转子文件夹路径
    }

    return files;
}

// 主函数
(async function () {
    // 调用 readFolder 函数测试
    const folderPath = settings.folderPath; // 文件夹路径
    const onlyJson = settings.onlyJson; // 是否只返回 JSON 文件

    const files = await readFolder(folderPath, onlyJson);
    log.info(`处理结果：`);
    files.forEach(file => {
        log.info(`完整路径：${file.fullPath}`);
        log.info(`文件名：${file.fileName}`);
        log.info(`文件夹路径数组：${file.folderPathArray.join(", ")}`);//允许通过访问该数组的不同层级，例如判断材料种类等
    });
})();