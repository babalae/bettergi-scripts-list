const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// 处理命令行参数
const args = process.argv.slice(2);
const forceFullUpdate = args.includes('--force') || args.includes('-f');

// 在文件开头添加全局变量
const pathingDirsWithoutIcon = new Set();

// 检查是否存在现有的repo.json文件
const repoJsonPath = path.resolve(__dirname, '..', 'repo.json');
let existingRepoJson = null;
let modifiedFiles = [];

// 尝试加载现有的repo.json文件
try {
    if (fs.existsSync(repoJsonPath) && !forceFullUpdate) {
        existingRepoJson = JSON.parse(fs.readFileSync(repoJsonPath, 'utf8'));
        console.log('找到现有的repo.json文件，将执行增量更新');
        
        // 获取Git中修改的文件
        try {
            // 获取当前分支名称
            const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
            console.log(`当前分支: ${currentBranch}`);
            
            // 获取此次变更的文件列表 - 使用更安全的方法
            let cmd = 'git diff --name-only HEAD~1 HEAD';            
            const changedFiles = execSync(cmd).toString().trim().split('\n');
            modifiedFiles = changedFiles.filter(file => file.startsWith('repo/'));
            console.log(`检测到 ${modifiedFiles.length} 个修改的文件:`);
            modifiedFiles.forEach(file => console.log(` - ${file}`));
        } catch (e) {
            console.warn('无法获取Git修改文件列表，将执行全量更新', e);
            modifiedFiles = [];
        }
    } else {
        if (forceFullUpdate) {
            console.log('检测到--force参数，将执行全量更新');
        } else {
            console.log('未找到现有的repo.json文件，将执行全量更新');
        }
    }
} catch (e) {
    console.warn('读取现有repo.json文件出错，将执行全量更新', e);
}

function calculateSHA1(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha1');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function getGitTimestamp(filePath) {
    try {
        // 对路径进行特殊处理，处理路径中的特殊字符
        const relativePath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
        
        let cmd;
        if (process.platform === 'win32') {
            // Windows平台使用双引号
            cmd = `git log -1 --format="%ai" -- "${relativePath.replace(/"/g, '\\"')}"`;
        } else {
            // Linux/Mac平台使用单引号
            const quotedPath = relativePath.replace(/'/g, "'\\''"); // 处理单引号
            cmd = `git log -1 --format="%ai" -- '${quotedPath}'`;
        }
        
        const time = execSync(cmd).toString().trim();
        if (!time) {
            console.warn(`未找到文件 ${filePath} 的提交记录`);
            return null;
        }
        return time;
    } catch (e) {
        console.warn(`无法通过 Git 获取时间: ${filePath}`, e);
        
        // 出错时，尝试使用文件的修改时间作为替代
        try {
            const stats = fs.statSync(filePath);
            const modTime = stats.mtime;
            const formattedTime = modTime.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' +0800');
            console.log(`使用文件修改时间作为替代: ${formattedTime}`);
            return formattedTime;
        } catch (fsErr) {
            console.warn(`无法获取文件修改时间: ${filePath}`, fsErr);
            return null;
        }
    }
}

function formatTime(timestamp) {
    if (!timestamp) return null;
    // 将 "2023-01-01 12:00:00 +0800" 格式化为 "20230101120000"
    return timestamp.replace(/[-: ]/g, '').split('+')[0];
}

// 格式化最后更新时间为标准的北京时间格式：YYYY-MM-DD HH:MM:SS
function formatLastUpdated(timestamp) {
    if (!timestamp) {
        // 如果没有时间戳，使用当前时间作为默认值
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    
    try {
        // 解析Git时间戳格式 (如: "2023-01-01 12:00:00 +0800")
        const dateMatch = timestamp.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
        if (dateMatch) {
            const [_, year, month, day, hour, minute, second] = dateMatch;
            return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        }
        
        // 尝试将时间戳解析为日期对象
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            const second = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        }
        
        return timestamp;
    } catch (e) {
        console.warn(`格式化时间戳出错 ${timestamp}:`, e);
        return timestamp;
    }
}

function convertNewlines(text) {
    return text.replace(/\\n/g, '\n');
}

function extractInfoFromCombatFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const authorMatch = content.match(/\/\/\s*作者\s*:(.*)/);
    const descriptionMatch = content.match(/\/\/\s*描述\s*:(.*)/);
    const versionMatch = content.match(/\/\/\s*版本\s*:(.*)/);
    const characterMatches = content.match(/^(?!\/\/).*?(\S+)(?=\s|$)/gm);

    const tags = [...new Set(characterMatches || [])]
        .map(char => char.trim())
        .filter(char => char.length > 0 && !char.match(/^[,.]$/)); // 过滤掉单个逗号或句号
    
    // 获取最后更新时间
    const gitTimestamp = getGitTimestamp(filePath);
    const lastUpdated = formatLastUpdated(gitTimestamp);
    
    // 优先使用文件中的版本号，其次使用提交时间，最后使用 SHA
    const version = versionMatch ? versionMatch[1].trim() : 
                   (gitTimestamp ? formatTime(gitTimestamp) : 
                    calculateSHA1(filePath).substring(0, 7));
    
    return {
        author: authorMatch ? authorMatch[1].trim() : '',
        description: descriptionMatch ? convertNewlines(descriptionMatch[1].trim()) : '',
        tags: tags,
        version: version,
        lastUpdated: lastUpdated
    };
}

function extractInfoFromJSFolder(folderPath) {
    const manifestPath = path.join(folderPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        try {
            let manifestContent = fs.readFileSync(manifestPath, 'utf8');
            manifestContent = manifestContent.replace(/,(\s*[}\]])/g, '$1');
            const manifest = JSON.parse(manifestContent);
            const combinedDescription = `${manifest.name || ''}~|~${manifest.description || ''}`;
            
            // 查找文件夹中所有文件
            let lastUpdatedTimestamp = null;
            let allFiles = [];
            
            // 递归获取所有文件
            function getAllFiles(dir) {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    if (fs.statSync(filePath).isDirectory()) {
                        getAllFiles(filePath);
                    } else {
                        allFiles.push(filePath);
                    }
                });
            }
            
            getAllFiles(folderPath);
            
            // 获取每个文件的时间戳，找出最新的
            for (const file of allFiles) {
                const timestamp = getGitTimestamp(file);
                if (timestamp) {
                    if (!lastUpdatedTimestamp) {
                        lastUpdatedTimestamp = timestamp;
                    } else {
                        // 比较时间戳，保留较新的
                        try {
                            const date1 = new Date(timestamp);
                            const date2 = new Date(lastUpdatedTimestamp);
                            if (date1 > date2) {
                                lastUpdatedTimestamp = timestamp;
                            }
                        } catch (e) {
                            console.warn(`比较时间戳出错: ${timestamp} vs ${lastUpdatedTimestamp}`, e);
                        }
                    }
                }
            }
            
            // 格式化最后更新时间
            const lastUpdated = formatLastUpdated(lastUpdatedTimestamp);
            
            return {
                version: manifest.version || '',
                description: convertNewlines(combinedDescription),
                author: manifest.authors && manifest.authors.length > 0 ? manifest.authors[0].name : '',
                tags: manifest.tags || [],
                lastUpdated: lastUpdated
            };
        } catch (error) {
            console.error(`解析 ${manifestPath} 时出错:`, error);
            console.error('文件内容:', fs.readFileSync(manifestPath, 'utf8'));
            return { version: '', description: '', author: '', tags: [], lastUpdated: null };
        }
    }
    return { version: '', description: '', author: '', tags: [], lastUpdated: null };
}

function extractInfoFromPathingFile(filePath, parentFolders) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 检测并移除BOM
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.replace(/^\uFEFF/, '');
        try {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`已移除文件BOM标记: ${filePath}`);
        } catch (error) {
            console.error(`移除BOM标记时出错 ${filePath}:`, error);
        }
    }
    
    const contentObj = JSON.parse(content);
    
    // 获取最后更新时间
    const gitTimestamp = getGitTimestamp(filePath);
    const lastUpdated = formatLastUpdated(gitTimestamp);
    
    // 优先使用文件中的版本号，其次使用提交时间，最后使用 SHA
    const version = contentObj.info?.version || 
                   (gitTimestamp ? formatTime(gitTimestamp) : 
                    calculateSHA1(filePath).substring(0, 7));
    
    // 从父文件夹获取默认标签
    let tags = parentFolders.slice(2)
        .filter(tag => !tag.includes('@'))
        .filter((tag, index, self) => self.indexOf(tag) === index);

    // 如果存在自定义标签，与默认标签合并
    if (contentObj.info && contentObj.info.tags && Array.isArray(contentObj.info.tags)) {
        tags = [...tags, ...contentObj.info.tags];
    }

    if (contentObj.positions && Array.isArray(contentObj.positions)) {
        const actions = contentObj.positions.map(pos => pos.action);
        if (actions.includes('nahida_collect')) tags.push('纳西妲');
        if (actions.includes('hydro_collect')) tags.push('水元素力收集');
        if (actions.includes('anemo_collect')) tags.push('风元素力收集');
        if (actions.includes('electro_collect')) tags.push('雷元素力收集');
        if (actions.includes('up_down_grab_leaf')) tags.push('四叶印');
        if (actions.includes('fight')) tags.push('战斗');
    }

    // 确保标签数组中没有重复项
    tags = [...new Set(tags)];

    // 移除 "死亡笔记" 标签
    tags = tags.filter(tag => tag !== '死亡笔记');

    return {
        author: contentObj.info.author || '',
        description: convertNewlines(contentObj.info.description || ''),
        version: version,
        tags: tags,
        lastUpdated: lastUpdated
    };
}

function extractInfoFromTCGFile(filePath, parentFolder) {
    const content = fs.readFileSync(filePath, 'utf8');
    const authorMatch = content.match(/\/\/\s*作者:(.*)/);
    const descriptionMatch = content.match(/\/\/\s*描述:(.*)/);
    const versionMatch = content.match(/\/\/\s*版本:(.*)/);
    const characterMatches = content.match(/角色\d+\s?=([^|\r\n{]+)/g);

    // 获取最后更新时间
    const gitTimestamp = getGitTimestamp(filePath);
    const lastUpdated = formatLastUpdated(gitTimestamp);

    let tags = characterMatches
        ? characterMatches.map(match => match.split('=')[1].trim())
            .filter(tag => tag && !tag.startsWith('角色'))
        : [];

    if (filePath.includes('惊喜牌组')) {
        tags = ['惊喜牌组', ...tags];
    }
    if (filePath.includes('酒馆挑战')) {
        tags = ['酒馆挑战', ...tags];
    }
    
    // 优先使用文件中的版本号，其次使用提交时间，最后使用 SHA
    const version = versionMatch ? versionMatch[1].trim() : 
                   (gitTimestamp ? formatTime(gitTimestamp) : 
                    calculateSHA1(filePath).substring(0, 7));
    
    return {
        author: authorMatch ? authorMatch[1].trim() : '',
        description: descriptionMatch ? convertNewlines(descriptionMatch[1].trim()) : '',
        tags: [...new Set(tags)],  // 去重
        version: version,
        lastUpdated: lastUpdated
    };
}

// 检查文件是否需要处理（增量更新模式下）
function shouldProcessFile(filePath) {
    // 如果没有现有的repo.json或没有修改文件列表，则处理所有文件
    if (!existingRepoJson || modifiedFiles.length === 0) {
        return true;
    }
    
    // 将filePath转换为相对于仓库根目录的路径
    const relativeFilePath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
    
    // 检查此文件或其所在目录是否在修改列表中
    return modifiedFiles.some(modifiedFile => {
        return relativeFilePath === modifiedFile || 
               relativeFilePath.startsWith(path.dirname(modifiedFile) + '/') || 
               modifiedFile.startsWith(relativeFilePath + '/');
    });
}

// 在目录树中查找节点的辅助函数
function findNodeInTree(tree, nodePath, currentPath = '') {
    if (!tree) return null;
    
    if (tree.type === 'directory') {
        const newPath = currentPath ? `${currentPath}/${tree.name}` : tree.name;
        
        if (newPath === nodePath) {
            return tree;
        }
        
        if (tree.children) {
            for (const child of tree.children) {
                const result = findNodeInTree(child, nodePath, newPath);
                if (result) {
                    return result;
                }
            }
        }
    }
    
    return null;
}

function generateDirectoryTree(dir, currentDepth = 0, parentFolders = []) {
    // 检查是否在增量更新模式下需要处理此目录
    const shouldProcess = shouldProcessFile(dir);
    
    // 如果在增量更新模式下不需要处理此目录，尝试从现有repo.json找到对应节点
    if (!shouldProcess && existingRepoJson && existingRepoJson.indexes) {
        const category = parentFolders[0];
        const relativePath = parentFolders.join('/');
        
        // 在现有repo.json中查找此目录节点
        const categoryTree = existingRepoJson.indexes.find(index => index.name === category);
        if (categoryTree) {
            const existingNode = findNodeInTree(categoryTree, relativePath);
            if (existingNode) {
                console.log(`使用现有数据: ${relativePath}`);
                return existingNode;
            }
        }
    }
    
    const stats = fs.statSync(dir);
    const info = {
        name: path.basename(dir),
        type: stats.isDirectory() ? 'directory' : 'file'
    };

    if (stats.isDirectory()) {
        // 修改检查pathing目录图标的逻辑
        if (parentFolders[0] === 'pathing') {
            const hasIcon = fs.readdirSync(dir).some(file => 
                file.toLowerCase() === 'icon.ico'
            );
            if (!hasIcon) {
                // 使用 path.join 来确保正确的路径分隔符
                const relativePath = path.join('pathing', path.basename(dir));
                pathingDirsWithoutIcon.add(relativePath);
                // console.log(`未找到icon.ico的pathing目录: ${relativePath}`);
            }
        }

        if (parentFolders[0] === 'js' && currentDepth === 1) {
            // 对于 js 文件夹下的直接子文件夹，不再递归
            const manifestPath = path.join(dir, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                const jsInfo = extractInfoFromJSFolder(dir);
                info.hash = calculateSHA1(manifestPath);
                info.version = jsInfo.version || info.hash.substring(0, 7);
                info.author = jsInfo.author;
                info.description = jsInfo.description;
                info.tags = jsInfo.tags;
                info.lastUpdated = jsInfo.lastUpdated;
            }
        } else {
            info.children = fs.readdirSync(dir)
                .filter(child => !['desktop.ini', 'icon.ico'].includes(child)) // 过滤掉 desktop.ini 和 icon.ico
                .map(child => {
                    const childPath = path.join(dir, child);
                    return generateDirectoryTree(childPath, currentDepth + 1, [...parentFolders, info.name]);
                })
                .filter(child => child !== null); // 过滤掉null
        }
    } else {
        // 如果是 desktop.ini 或 icon.ico 文件，直接返回 null
        if (['desktop.ini', 'icon.ico'].includes(info.name)) {
            return null;
        }

        const hash = calculateSHA1(dir);
        info.hash = hash;
        info.version = hash.substring(0, 7);

        const category = parentFolders[0];
        try {
            switch (category) {
                case 'combat':
                    Object.assign(info, extractInfoFromCombatFile(dir));
                    break;
                case 'pathing':
                    Object.assign(info, extractInfoFromPathingFile(dir, parentFolders));
                    info.tags = info.tags.filter(tag => tag !== 'pathing');
                    break;
                case 'tcg':
                    Object.assign(info, extractInfoFromTCGFile(dir, parentFolders[1]));
                    break;
            }
        } catch (error) {
            console.error(`处理文件 ${dir} 时出错:`, error);
            info.error = error.message;
        }
    }

    return info;
}

const repoPath = path.resolve(__dirname, '..', 'repo');

// 定义期望的文件夹顺序
const folderOrder = ['pathing', 'js', 'combat', 'tcg', 'onekey'];

// 读取 repoPath 下的所有文件夹
const topLevelFolders = fs.readdirSync(repoPath)
    .filter(item => fs.statSync(path.join(repoPath, item)).isDirectory());

// 对每个顶级文件夹调用 generateDirectoryTree，并按照指定顺序排序
const result = folderOrder
    .filter(folder => topLevelFolders.includes(folder))
    .map(folder => {
        const folderPath = path.join(repoPath, folder);
        const tree = generateDirectoryTree(folderPath, 0, [folder]);
        
        // 如果是pathing目录，对其子目录进行排序
        if (folder === 'pathing' && tree.children) {
            tree.children.sort((a, b) => {
                const aPath = path.join('pathing', a.name);
                const bPath = path.join('pathing', b.name);
                const aHasNoIcon = pathingDirsWithoutIcon.has(aPath);
                const bHasNoIcon = pathingDirsWithoutIcon.has(bPath);
                
                // 如果两个目录的图标状态不同，则按照有无图标排序
                if (aHasNoIcon !== bHasNoIcon) {
                    return aHasNoIcon ? 1 : -1;
                }
                
                // 使用拼音排序
                return a.name.localeCompare(b.name, 'zh-CN', {
                    numeric: true,
                    sensitivity: 'accent',
                    caseFirst: false
                });
            });
        }
        
        return tree;
    });

const repoJson = {
    "time": new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai'
    }).replace(/[/\s,:]/g, ''),
    "url": "https://github.com/babalae/bettergi-scripts-list/archive/refs/heads/main.zip",
    "file": "repo.json",
    "indexes": result
};

fs.writeFileSync(repoJsonPath, JSON.stringify(repoJson, null, 2));
console.log('repo.json 文件已创建并保存在 repo 同级目录中。');
