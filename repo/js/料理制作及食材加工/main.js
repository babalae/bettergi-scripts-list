(async function () {

let foodName = settings.foodName ?? 0;
let foodNum = settings.foodNum ?? 0;
let flourNum = settings.flourNum ?? 0;
let creamNum = settings.creamNum ?? 0;
let smokedPoultryNum = settings.smokedPoultryNum ?? 0;
let butterNum = settings.butterNum ?? 0;
let hamNum = settings.hamNum ?? 0;
let sugarNum = settings.sugarNum ?? 0;
let spiceNum = settings.spiceNum ?? 0;
let crabRoeNum = settings.crabRoeNum ?? 0;
let jamNum = settings.jamNum ?? 0;
let cheeseNum = settings.cheeseNum ?? 0;
let baconNum = settings.baconNum ?? 0;
let sausageNum = settings.sausageNum ?? 0;

await sleep(1000);
await pathingScript.runFile("assets/前往蒙德灶台.json");
keyPress("F");
await sleep(1000);

//制作料理
if(foodName){
click(910, 51);//选择料理
await sleep(1000);
click(170, 1020);//筛选
await sleep(1000);
click(195, 1020);//重置
await sleep(1000);
click(110, 110);//输入名字
await sleep(1000);
for (const char of foodName) {
  keyPress(char);
  await sleep(500);
}
keyPress("SPACE");
await sleep(500);
click(490, 1020);//确认筛选
await sleep(1000);
click(180, 180);//选择第一个食物
await sleep(2000);
click(1690, 1015);//制作
await sleep(1000);
click(795, 1015);//自动烹饪
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of foodNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(4000);//等待烹饪
keyPress("ESCAPE");
await sleep(1500);
keyPress("ESCAPE");
await sleep(1500);
};

//食材加工

click(1010,50);//选择食材加工
await sleep(1000);
click(255,1020);//全部领取
await sleep(1000);
keyPress("ESCAPE");//点击任意处
await sleep(2000);

if(flourNum){
click(175,190);//flour
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of flourNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(creamNum){
click(770,190);//cream
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of creamNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(smokedPoultryNum){
click(920,190);//smokedPoultry
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of smokedPoultryNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(butterNum){
click(1060,190);//butter
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of butterNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(hamNum){
click(1210,190);//ham
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of hamNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(sugarNum){
click(175,375);//sugar
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of sugarNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(spiceNum){
click(325,375);//spice
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of spiceNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(crabRoeNum){
click(475,375);//crabRoe
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of crabRoeNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(jamNum){
click(620,375);//jam
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of jamNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(cheeseNum){
click(770,375);//cheese
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of cheeseNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(baconNum){
click(915,375);//bacon
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of baconNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

if(sausageNum){
click(1060,375);//sausage
await sleep(1000);
click(1690, 1015);//制作
await sleep(1000);
click(965, 455);//输入数量
await sleep(1000);
for (const char of sausageNum) {
  keyPress(char);
  await sleep(500);
}
click(1190, 755);//确认
await sleep(1000);
};

})();
