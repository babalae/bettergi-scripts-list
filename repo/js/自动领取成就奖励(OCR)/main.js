const receiveRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/receive.png"));

(async function () {

const topLeft = {x: 192, y: 281};     // 左上角坐标
const bottomRight = {x: 1738, y: 984}; // 右下角坐标
const rows = 3;                       // 行数
const cols = 7;                       // 列数
const topLeft1 = {x: 190, y: 870};     // 左上角坐标
const bottomRight1 = {x: 1735, y: 870}; // 右下角坐标
const rows1 = 1;                       // 行数
const cols1 = 7;                       // 列数
let sum = 1;
let sum1= 0;
//用于点击多个点位
async function autoClick(
  topLeft,    // 左上角点位 {x, y}
  bottomRight, // 右下角点位 {x, y}
  rows,        // 行数
  cols         // 列数
) {
  // 计算每个点之间的水平和垂直间距
  let stepX = cols  > 1 ? (bottomRight.x - topLeft.x) / (cols - 1) : 0; // 处理单列情况
  let stepY = rows > 1 ? (bottomRight.y - topLeft.y) / (rows - 1) : 0; // 处理单行情况
  // 从左到右，从上到下依次点击
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 计算当前点的坐标并四舍五入
      let x = Math.round(topLeft.x + col * stepX);
      let y = Math.round(topLeft.y + row * stepY);
      // 执行点击
      click(x, y);
      await sleep(1000);
     log.info(`第${sum}次识别`);
     sum++;
      let receive = captureGameRegion().find(receiveRo);
      await sleep(1000);
      while(receive.isExist()){
          receive.click();
          await sleep(500);
          sum1++;
           log.info(`成功识别${sum1}次`);
          
          click(400,1010);//点击空白处
          await sleep(500);
           receive = captureGameRegion().find(receiveRo);
      }

      click(400,1010);//如果是本行最后一个成就会自动翻页
      await sleep(500);
      keyPress("ESCAPE"); 
      // 等待1秒
      await sleep(1000);
    }
  }
}

//主流程
await genshin.returnMainUi();
await sleep(1000);
keyPress("ESCAPE"); 
await sleep(1000);
click(670 ,420 );//点击成就
await sleep(2000);
await autoClick(topLeft, bottomRight, rows, cols);
for (let i = 0; i < 6; i++) {
await autoClick(topLeft1, bottomRight1, rows1, cols1);
}

})();
