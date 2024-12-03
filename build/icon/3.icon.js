const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 定义路径
const sourcePath = 'D:\\HuiPrograming\\Projects\\CSharp\\MiHoYo\\bettergi-scripts-list\\repo\\pathing';
const iconSourcePath = 'E:\\HuiTask\\更好的原神\\2.资料\\图标处理\\matchedIco';
const desktopIniPath = 'E:\\HuiTask\\更好的原神\\2.资料\\图标处理\\desktop.ini';

// 读取源目录
fs.readdir(sourcePath, { withFileTypes: true }, (err, entries) => {
  if (err) {
    console.error('读取源目录时出错:', err);
    return;
  }

  // 遍历每个目录
  entries.filter(entry => entry.isDirectory()).forEach(dir => {
    const dirPath = path.join(sourcePath, dir.name);
    const iconSourceFile = path.join(iconSourcePath, `${dir.name}.ico`);
    const iconDestFile = path.join(dirPath, 'icon.ico');
    const desktopIniDestFile = path.join(dirPath, 'desktop.ini');

    // 检查图标源文件是否存在
    if (!fs.existsSync(iconSourceFile)) {
      console.log(`警告：${dir.name} 的图标文件不存在，跳过所有操作`);
      return; // 跳过当前目录的所有后续操作
    }

    // 复制图标文件
    fs.copyFile(iconSourceFile, iconDestFile, (err) => {
      if (err) {
        console.error(`复制图标文件到 ${dir.name} 时出错:`, err);
        return; // 如果复制图标失败，跳过后续操作
      }
      console.log(`成功复制图标文件到 ${dir.name}`);

      // 复制desktop.ini文件
      fs.copyFile(desktopIniPath, desktopIniDestFile, (err) => {
        if (err) {
          console.error(`复制desktop.ini到 ${dir.name} 时出错:`, err);
          return; // 如果复制desktop.ini失败，跳过后续操作
        }
        console.log(`成功复制desktop.ini到 ${dir.name}`);

        // 执行cmd命令
        exec(`attrib +R "${dirPath}"`, (err, stdout, stderr) => {
          if (err) {
            console.error(`执行attrib命令时出错 ${dir.name}:`, err);
            return;
          }
          console.log(`成功为 ${dir.name} 设置只读属性`);
        });
      });
    });
  });
});
