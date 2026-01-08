//设计目标
//1、主要用于地图追踪记录坐标然后转译为录制编辑器可识别的文件
//2、运行脚本后，按F7会记录当前坐标到Records/PointsInf.txt
//3、记录信息样式如下：-862.01171875,2284.10205078125,1
//4、地图追踪结束后，按F8，转译为录制编辑器文件PointsInf.json

//注意
//1、不要手动修改PointsInf.txt的内容
//2、F9会清空PointsInf.txt和PointsInf.json的内容，别手滑
//3、战斗飞行等具体的细节需要到录制编辑器里面逐个修改，默认是行走模式不会战斗
//4、PointsInf.json里面诸如???的地方，结合自己情况修改，比如作者信息什么的
//5、默认第一个位置是传送点

const recordFilePath = `Records/PointsInf.txt`;
const jsonFilePath = `Records/PointsInf.json`;
let PositionCounter = 0
//类似于C++的格式化字符串(AI写的)
function sprintf(format, ...args) {
  return format.replace(/%(\d+\$)?([a-z%])/g, (match, index, specifier) => {
    const argIndex = index ? parseInt(index) - 1 : args.indexOf(match);
    if (argIndex < 0 || argIndex >= args.length) throw new Error("参数索引越界");
    const arg = args[argIndex];
    switch (specifier) {
      case 's': return String(arg);
      case 'd': return Number(arg).toFixed(0);
      case 'f': return Number(arg).toFixed(2);
      case '%': return '%'; // 转义%%
      default: throw new Error(`不支持的格式符：${specifier}`);
    }
  });
}
//将位置信息保存到文件
function GetPositionThenSaveToFile() {
    center = genshin.getPositionFromMap();
    leyLineX = center.x;
    leyLineY = center.y;
    PositionCounter++;
    log.info(`找到坐标:(${leyLineX},${leyLineY},${PositionCounter})`);
    file.writeText(recordFilePath, `${leyLineX},${leyLineY},${PositionCounter}\n`, true);
}
//json文件结构
const Header = "{\n\
    \"info\": {\n\
        \"authors\": [{\n\
          \"links\": \"https:???\",\n\
          \"name\": \"???\"\n\
        }],\n\
    \"bgi_version\": \"0.50.0\",\n\
    \"description\": \"\",\n\
    \"enable_monster_loot_split\": false,\n\
    \"last_modified_time\": 1757909722208,\n\
    \"map_match_method\": \"\",\n\
    \"map_name\": \"Teyvat\",\n\
    \"name\": \"????\",\n\
    \"tags\": [],\n\
    \"type\": \"collect\",\n\
    \"version\": \"1.0\"\n\
  },\n\
  \"positions\": ["
const Ender = "]\n}"
const Sentence = "\
    \n    {\n\
      \"id\": %3$s,\n\
      \"action\": \"\",\n\
      \"action_params\": \"\",\n\
      \"move_mode\": \"walk\",\n\
      \"type\": \"path\",\n\
      \"x\": %1$s,\n\
      \"y\": %2$s\n\
    }"
//转换位置信息到json格式
async function ConvertPositionToJsonFile(){
    const content = file.readTextSync(recordFilePath);
    const Line = content.split("\n");
    const emptyArray = []
    for (let i = 0; i < Line.length; i++) {
        line = Line[i].trim();
        if (!line) continue;
        Sub = line.split(",")
        if(Sub.length != 3){
            log.error(`第{0}行数据有问题,请手动检查`,i);
            return;
        }
        emptyArray.push(sprintf(Sentence,Sub[0],Sub[1],Sub[2]))
    }
    if(emptyArray.length == 0)return;
    await file.writeText(jsonFilePath, Header + `\n`, true);
    for(let i = 0;i < emptyArray.length;i++){
        if(i == 0){//默认第一点位是传送点
            await file.writeText(jsonFilePath,emptyArray[i].replace("path","teleport"),true);
        }else if(i == emptyArray.length - 1){//默认最后一个点位需要精确到达
            await file.writeText(jsonFilePath,"," + emptyArray[i].replace("path","target"),true);
        }else{
            await file.writeText(jsonFilePath,"," + emptyArray[i],true);
        }
    }
    await file.writeText(jsonFilePath, Ender + `\n`, true);
    log.info(`已转换到:(${jsonFilePath})`);
}
//清空文件PointsInf.txt和PointsInf.json
async function ClearAllFileContent(){
    await file.writeText(recordFilePath,"",false);
    await file.writeText(jsonFilePath,"",false);
    PositionCounter = 0;
    log.info(`已清空:(${recordFilePath},${jsonFilePath})`);
}

(async function () {
    //log.info("本脚本通过小地图获取角色位置")
    log.info("F7记录,F8转换并退出,F9清空")
    genshin.returnMainUi();
    await sleep(1000);
    const keyMouseHook = new KeyMouseHook()
    let keyData = ""
    keyMouseHook.OnKeyDown(function(keyCode) {
        //log.info("Key:{0}",keyCode)
        keyData = keyCode;
    });
    while(true){
        if(keyData === "F7"){
            GetPositionThenSaveToFile();
        }
        if(keyData === "F8"){
            await ConvertPositionToJsonFile();
            break;
        }
        if(keyData === "F9"){
            await ClearAllFileContent();
        }
        keyData = "";
        await sleep(200);
    }
    keyMouseHook.Dispose();
    await sleep(1000);
})();