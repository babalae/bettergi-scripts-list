const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// 在文件开头添加全局变量
const pathingDirsWithoutIcon = new Set();

function calculateSHA1(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha1');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function getGitTimestamp(filePath) {
    try {
        const time = execSync(`git log -1 --format="%ai" -- ${filePath}`).toString().trim();
        if (!time) {
            console.warn(`未找到文件 ${filePath} 的提交记录`);
            return null;
        }
        return time;
    } catch (e) {
        console.warn(`无法通过 Git 获取时间: ${filePath}`, e);
        return null;
    }
}

function formatTime(timestamp) {
    if (!timestamp) return null;
    // 将 "2023-01-01 12:00:00 +0800" 格式化为 "20230101120000"
    return timestamp.replace(/[-: ]/g, '').split('+')[0];
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
    
    // 优先使用文件中的版本号，其次使用提交时间，最后使用 SHA
    const version = versionMatch ? versionMatch[1].trim() : 
                   (getGitTimestamp(filePath) ? formatTime(getGitTimestamp(filePath)) : 
                    calculateSHA1(filePath).substring(0, 7));
    
    return {
        author: authorMatch ? authorMatch[1].trim() : '',
        description: descriptionMatch ? convertNewlines(descriptionMatch[1].trim()) : '',
        tags: tags,
        version: version
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
            return {
                version: manifest.version || '',
                description: convertNewlines(combinedDescription),
                author: manifest.authors && manifest.authors.length > 0 ? manifest.authors[0].name : '',
                tags: manifest.tags || []
            };
        } catch (error) {
            console.error(`解析 ${manifestPath} 时出错:`, error);
            console.error('文件内容:', fs.readFileSync(manifestPath, 'utf8'));
            return { version: '', description: '', author: '', tags: [] };
        }
    }
    return { version: '', description: '', author: '', tags: [] };
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
    
    // 优先使用文件中的版本号，其次使用提交时间，最后使用 SHA
    const version = contentObj.info?.version || 
                   (getGitTimestamp(filePath) ? formatTime(getGitTimestamp(filePath)) : 
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

    return {
        author: contentObj.info.author || '',
        description: convertNewlines(contentObj.info.description || ''),
        version: version,
        tags: tags
    };
}

function extractInfoFromTCGFile(filePath, parentFolder) {
    const content = fs.readFileSync(filePath, 'utf8');
    const authorMatch = content.match(/\/\/\s*作者:(.*)/);
    const descriptionMatch = content.match(/\/\/\s*描述:(.*)/);
    const versionMatch = content.match(/\/\/\s*版本:(.*)/);
    const characterMatches = content.match(/角色\d+\s?=([^|\r\n{]+)/g);

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
                   (getGitTimestamp(filePath) ? formatTime(getGitTimestamp(filePath)) : 
                    calculateSHA1(filePath).substring(0, 7));
    
    return {
        author: authorMatch ? authorMatch[1].trim() : '',
        description: descriptionMatch ? convertNewlines(descriptionMatch[1].trim()) : '',
        tags: [...new Set(tags)],  // 去重
        version: version
    };
}

function generateDirectoryTree(dir, currentDepth = 0, parentFolders = []) {
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
            }
        } else {
            info.children = fs.readdirSync(dir)
                .filter(child => !['desktop.ini', 'icon.ico'].includes(child)) // 过滤掉 desktop.ini 和 icon.ico
                .map(child => {
                    const childPath = path.join(dir, child);
                    return generateDirectoryTree(childPath, currentDepth + 1, [...parentFolders, info.name]);
                });
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

const repoJsonPath = path.resolve(__dirname, '..', 'repo.json');
fs.writeFileSync(repoJsonPath, JSON.stringify(repoJson, null, 2));
console.log('repo.json 文件已创建并保存在 repo 同级目录中。');
