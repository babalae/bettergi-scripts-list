// 这个脚本，有新的脚本目录就要使用

const fs = require('fs');
const path = require('path');

// 定义路径
const pathingDir = 'D:\\HuiPrograming\\Projects\\CSharp\\MiHoYo\\bettergi-scripts-list\\repo\\pathing';
const pngDir = 'E:\\HuiTask\\更好的原神\\2.资料\\图标处理\\newPng';
const outputDir = 'E:\\HuiTask\\更好的原神\\2.资料\\图标处理\\matchedPng';

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// 读取 pathing 目录下的所有文件夹名称
fs.readdir(pathingDir, { withFileTypes: true }, (err, entries) => {
  if (err) {
    console.error('读取 pathing 目录时出错:', err);
    return;
  }

  // 过滤出目录
  const directories = entries.filter(entry => entry.isDirectory()).map(dir => dir.name);

  // 遍历目录名称
  directories.forEach(dirName => {
    const pngPath = path.join(pngDir, `${dirName}.png`);
    const outputPath = path.join(outputDir, `${dirName}.png`);

    // 检查对应的 PNG 文件是否存在
    if (fs.existsSync(pngPath)) {
      // 复制文件
      fs.copyFile(pngPath, outputPath, err => {
        if (err) {
          console.error(`复制 ${dirName}.png 时出错:`, err);
        } else {
          console.log(`成功复制 ${dirName}.png 到 matchedPng 文件夹`);
        }
      });
    } else {
      console.log(`未找到对应的 PNG 文件: ${dirName}.png`);
    }
  });
});