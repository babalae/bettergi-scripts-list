// 校验 assets 目录，并为仓库构建生成乐谱统计。
const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');

const ASSETS_DIR = path.resolve(__dirname, '..', 'assets');

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.json', '.png', '.jpg', '.jpeg', '.webp']);

function listAssetFiles(dir, relative = '') {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const relPath = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            files.push(...listAssetFiles(path.join(dir, entry.name), relPath));
        } else if (entry.isFile()) {
            files.push(relPath);
        } else {
            throw new Error(`assets 仅接受普通文件：${relPath}`);
        }
    }
    return files;
}

function collectAssets() {
    const errors = [];
    const files = [];
    let totalSize = 0;
    let scoreCount = 0;
    let scoreBytes = 0;
    const byType = new Map();
    const byInstrument = new Map();
    const scoreNames = new Map();
    const assetPaths = new Map();

    const assetRoot = fs.lstatSync(ASSETS_DIR, { throwIfNoEntry: false });
    if (assetRoot && !assetRoot.isDirectory()) {
        throw new Error('assets 必须是普通目录');
    }

    for (const relPath of assetRoot ? listAssetFiles(ASSETS_DIR).sort() : []) {
        const key = relPath.toUpperCase();
        if (assetPaths.has(key)) {
            errors.push(`资源路径同名: ${assetPaths.get(key)} 和 ${relPath}`);
            continue;
        }
        assetPaths.set(key, relPath);

        const ext = path.extname(relPath).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            errors.push(`不允许的文件类型: ${relPath}（白名单: ${[...ALLOWED_EXTENSIONS].join(' ')}）`);
            continue;
        }

        const filePath = path.join(ASSETS_DIR, relPath);
        if (fs.statSync(filePath).size > MAX_FILE_SIZE) {
            errors.push(`文件超过 3 MiB 上限: ${relPath}`);
            continue;
        }

        const content = fs.readFileSync(filePath);
        if (content.length > MAX_FILE_SIZE) {
            errors.push(`文件超过 3 MiB 上限: ${relPath}`);
            continue;
        }
        totalSize += content.length;
        files.push({
            path: relPath,
            size: content.length,
            sha256: createHash('sha256').update(content).digest('hex')
        });

        if (ext !== '.json') {
            continue;
        }
        if (content.length > 0 && content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
            errors.push(`JSON 文件含 BOM: ${relPath}`);
            continue;
        }

        let json;
        try {
            json = JSON.parse(content.toString('utf8'));
        } catch (e) {
            errors.push(`JSON 解析失败: ${relPath}（${e.message}）`);
            continue;
        }

        if (relPath.startsWith('music/scores/')) {
            const name = path.posix.basename(relPath).toUpperCase();
            const previous = scoreNames.get(name);
            if (previous) {
                errors.push(`仓库曲谱同名: ${previous} 和 ${relPath}`);
                continue;
            }
            scoreNames.set(name, relPath);

            const type = typeof json?.type === 'string' ? json.type.trim().toLowerCase() : 'yuanqin';
            const instrument = typeof json?.instrument === 'string' ? json.instrument : '风物之诗琴';
            scoreCount++;
            scoreBytes += content.length;
            byType.set(type, (byType.get(type) ?? 0) + 1);
            for (const name of new Set(instrument.split(',').map(value => value.trim()).filter(Boolean))) {
                byInstrument.set(name, (byInstrument.get(name) ?? 0) + 1);
            }
        }
    }

    if (totalSize > MAX_TOTAL_SIZE) {
        errors.push(`assets 目录总量 ${(totalSize / 1024 / 1024).toFixed(1)}MB 超过 30MB 上限`);
    }

    if (errors.length > 0) {
        throw new Error(`assets 目录校验失败：\n${errors.map(error => `  - ${error}`).join('\n')}`);
    }

    const orderedCounts = counts => Object.fromEntries([...counts.keys()].sort().map(name => [name, counts.get(name)]));
    return {
        count: files.length,
        totalBytes: totalSize,
        files,
        musicScoreStats: {
            count: scoreCount,
            totalBytes: scoreBytes,
            byType: orderedCounts(byType),
            byInstrument: orderedCounts(byInstrument)
        }
    };
}

if (require.main === module) {
    try {
        const { count, totalBytes } = collectAssets();
        console.log(`assets 目录校验通过（${count} 个文件，${(totalBytes / 1024).toFixed(1)}KB）`);
    } catch (e) {
        console.error(e.message);
        process.exitCode = 1;
    }
}

module.exports = { collectAssets };
