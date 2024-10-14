const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function calculateSHA1(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha1');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function convertNewlines(text) {
    return text.replace(/\\n/g, '\n');
}

function extractInfoFromCombatFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const authorMatch = content.match(/\/\/\s*作者\s*:(.*)/);
    const descriptionMatch = content.match(/\/\/\s*描述\s*:(.*)/);
    const characterMatches = content.match(/^(?!\/\/).*?(\S+)(?=\s|$)/gm);

    const tags = [...new Set(characterMatches || [])]
        .map(char => char.trim())
        .filter(char => char.length > 0 && !char.match(/^[,.]$/)); // 过滤掉单个逗号或句号

    return {
        author: authorMatch ? authorMatch[1].trim() : '',
        description: descriptionMatch ? convertNewlines(descriptionMatch[1].trim()) : '',
        tags: tags
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
                tags: []
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
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
        author: content.info && content.info.author ? content.info.author : '',
        description: convertNewlines(content.info && content.info.description ? content.info.description : ''),
        tags: parentFolders.slice(2)  // 从第三个元素开始，跳过 'pathing' 和下一级目录
    };
}

function extractInfoFromTCGFile(filePath, parentFolder) {
    const content = fs.readFileSync(filePath, 'utf8');
    const authorMatch = content.match(/\/\/\s*作者:(.*)/);
    const descriptionMatch = content.match(/\/\/\s*描述:(.*)/);
    const characterMatches = content.match(/角色\d+=([^|\r\n{]+)/g);

    let tags = characterMatches
        ? characterMatches.map(match => match.split('=')[1].trim())
            .filter(tag => tag && !tag.startsWith('角色'))
        : [];

    if (filePath.includes('惊喜牌组')) {
        tags = ['惊喜牌组', ...tags];
    }

    return {
        author: authorMatch ? authorMatch[1].trim() : '',
        description: descriptionMatch ? convertNewlines(descriptionMatch[1].trim()) : '',
        tags: [...new Set(tags)]  // 去重
    };
}

function generateDirectoryTree(dir, currentDepth = 0, parentFolders = []) {
    const stats = fs.statSync(dir);
    const info = {
        name: path.basename(dir),
        type: stats.isDirectory() ? 'directory' : 'file'
    };

    if (stats.isDirectory()) {
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
            info.children = fs.readdirSync(dir).map(child => {
                const childPath = path.join(dir, child);
                return generateDirectoryTree(childPath, currentDepth + 1, [...parentFolders, info.name]);
            });
        }
    } else {
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
        return generateDirectoryTree(folderPath, 0, [folder]);
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
