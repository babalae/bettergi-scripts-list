const fs = require('fs');
const path = require('path');

// 定义pathing目录的路径
const pathingDir = path.resolve(__dirname, '..', '..', 'repo', 'pathing');

// 递归读取目录下的所有JSON文件
function readJsonFilesRecursively(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  files.forEach(file => {
    const filePath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      readJsonFilesRecursively(filePath);
    } else if (path.extname(file.name).toLowerCase() === '.json') {
      processJsonFile(filePath);
    }
  });
}

// 处理单个JSON文件
function processJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(data);
    
    // 检查并修改第一个position的type
    if (jsonData.positions && jsonData.positions.length > 0) {
      const firstPosition = jsonData.positions[0];
      if (firstPosition.type !== 'teleport') {
        firstPosition.type = 'teleport';
        console.log(`文件 ${filePath} 中的第一个position的type已更改为teleport`);

        // 将修改后的数据写回文件
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
        console.log(`文件 ${filePath} 已成功更新`);
      } else {
        console.log(`文件 ${filePath} 中的第一个position的type已经是teleport`);
      }
    } else {
      console.log(`文件 ${filePath} 中没有positions数组或数组为空`);
    }
  } catch (err) {
    console.error(`处理文件 ${filePath} 时出错:`, err);
  }
}

// 开始递归读取文件
console.log(`开始处理 ${pathingDir} 目录下的所有JSON文件`);
readJsonFilesRecursively(pathingDir);
console.log('处理完成');
