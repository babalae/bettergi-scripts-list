const fs = require('fs');
const path = require('path');

// ================= 使用说明 =================
// 1. 请确保你是以bettergi-script-list完整仓库的环境运行此脚本
// 2. 请确保你本地配置了node.js环境
// 3. 运行: node build/dev_deploy.js 脚本文件夹名 BGI目录。例：node build/dev_deploy.js test E:\BetterGIProject\BetterGI
// 4. 脚本自动导入，会删除原有packages后导入新的packages，其他文件覆盖式导入
// ===========================================

// 脚本名称（repo/js 下的文件夹名）
const SCRIPT_NAME = process.argv[2];

// BetterGI 软件根目录（包含 User 文件夹）
const BETTERGI_ROOT = process.argv[3];

if (!SCRIPT_NAME || !BETTERGI_ROOT) {
    console.error('❌ 参数不足。');
    console.error('用法: node dev_deploy.js <script_folder_name> <bettergi_root_path>');
    process.exit(1);
}

// 路径定义
const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_SCRIPT_DIR = path.join(REPO_ROOT, 'repo', 'js', SCRIPT_NAME);
const TARGET_SCRIPT_DIR = path.join(
  path.resolve(BETTERGI_ROOT),
  'User',
  'JsScript',
  SCRIPT_NAME
);

const PROCESSED_PACKAGES = new Set();
const PROCESSED_FILES = new Set(); // 避免循环扫描

function main() {
    console.log(`📂 源目录: ${SOURCE_SCRIPT_DIR}`);
    console.log(`📂 目标目录: ${TARGET_SCRIPT_DIR}`);

    if (!fs.existsSync(SOURCE_SCRIPT_DIR)) {
        console.error(`❌ 错误: 找不到本地脚本目录: ${SOURCE_SCRIPT_DIR}`);
        process.exit(1);
    }

    // 复制主脚本目录
    if (!fs.existsSync(TARGET_SCRIPT_DIR)) {
        fs.mkdirSync(TARGET_SCRIPT_DIR, { recursive: true });
    }

    // 清理旧的 packages 目录，防止残留
    const targetPackagesDir = path.join(TARGET_SCRIPT_DIR, 'packages');
    if (fs.existsSync(targetPackagesDir)) {
        console.log('🧹 清理旧依赖目录...');
        fs.rmSync(targetPackagesDir, { recursive: true, force: true });
    }

    copyDir(SOURCE_SCRIPT_DIR, TARGET_SCRIPT_DIR);

    // 解析依赖
    console.log('🔍 解析依赖并注入 packages...');
    resolveDependenciesRecursively(TARGET_SCRIPT_DIR);

    console.log('✅ 部署完成！可在 BetterGI 中运行测试。');
}

/**
 * 递归扫描目录中的 JS 文件并处理依赖
 * @param {string} dir
 */
function resolveDependenciesRecursively(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            resolveDependenciesRecursively(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            processJsFile(fullPath);
        }
    }
}

/**
 * 处理单个 JS 文件
 * @param {string} filePath
 */
function processJsFile(filePath) {
    if (PROCESSED_FILES.has(filePath)) return;
    PROCESSED_FILES.add(filePath);

    let content = fs.readFileSync(filePath, 'utf-8');

    // 匹配 import
    const regex = /(import\s+(?:[\w\s{},*]*?from\s+)?['"]|require\s*\(\s*['"]|import\s+['"])([^'"]+)(['"])/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
        const importPath = match[2]; // Group 2 is the path

        // 处理显式 packages/ 引用
        const packageIndex = importPath.indexOf('packages/');
        if (packageIndex >= 0) {
            let packagePath = importPath.substring(packageIndex);

            // 复制且（如果是JS）递归处理
            copyPackageResource(packagePath);
        }
        else if (importPath.startsWith('.')) {
            // 处理 packages 内部的相对引用
            const targetPackagesDir = path.join(TARGET_SCRIPT_DIR, 'packages');
            if (filePath.startsWith(targetPackagesDir)) {
                const relToScript = path.relative(TARGET_SCRIPT_DIR, filePath);
                const relDir = path.dirname(relToScript);
                let depPackagePath = path.join(relDir, importPath);
                depPackagePath = depPackagePath.split(path.sep).join('/');

                if (depPackagePath.startsWith('packages/')) {
                    copyPackageResource(depPackagePath);
                }
            }
        }
    }
}

/**
 * 从源仓库复制 package 资源到目标位置
 * @param {string} packagePath 相对路径，如 "packages/utils/test"
 */
function copyPackageResource(packagePath) {
    if (tryCopy(packagePath)) return;
    if (!packagePath.endsWith('.js') && tryCopy(packagePath + '.js')) return;
    console.warn(`⚠️ 警告: 未找到依赖资源 ${packagePath}`);
}

/**
 * 尝试复制文件或目录
 * @param {string} relPath
 * @returns {boolean}
 */
function tryCopy(relPath) {
    const src = path.join(REPO_ROOT, relPath);

    if (!fs.existsSync(src)) return false;

    if (PROCESSED_PACKAGES.has(relPath)) return true;

    const dest = path.join(TARGET_SCRIPT_DIR, relPath);
    const destDir = path.dirname(dest);

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        copyDir(src, dest);
        resolveDependenciesRecursively(dest);
    } else {
        fs.copyFileSync(src, dest);
        // 如果是 JS 文件，需要递归解析它的依赖
        if (dest.endsWith('.js')) {
            processJsFile(dest);
        }
    }

    PROCESSED_PACKAGES.add(relPath);
    return true;
}

/**
 * 递归复制目录
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

main();
