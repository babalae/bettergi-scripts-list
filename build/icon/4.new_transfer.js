const fs = require('fs');
const path = require('path');

// 定义路径
const pngDir = 'E:\\HuiTask\\更好的原神\\2.资料\\图标处理\\matchedPng';
const iconDir = 'E:\\HuiTask\\更好的原神\\2.资料\\图标处理\\matchedIco';

// 定义输出目录
const outputDir = 'E:\\HuiTask\\更好的原神\\2.资料\\图标处理\\diffPng';

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 获取两个目录中的文件列表并去除扩展名
const getPureFilenames = (dir) => {
    return fs.readdirSync(dir).map(file => path.parse(file).name);
};

const pngFiles = getPureFilenames(pngDir);
const icoFiles = getPureFilenames(iconDir);

// 找出在PNG目录存在但在ICO目录不存在的文件
const unmatchedPng = pngFiles.filter(name => !icoFiles.includes(name));

// 复制不匹配的PNG文件到输出目录
unmatchedPng.forEach(filename => {
    const sourcePath = path.join(pngDir, `${filename}.png`);
    const destPath = path.join(outputDir, `${filename}.png`);
    fs.copyFileSync(sourcePath, destPath);
});

console.log(`找到并复制了 ${unmatchedPng.length} 个不匹配的 PNG 文件到: ${outputDir}`);

