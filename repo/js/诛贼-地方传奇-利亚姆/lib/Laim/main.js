

eval(file.readTextSync("lib/core.js"));
eval(file.readTextSync("lib/CharacterRotator.js"));


// 主函数里先初始化模板
const xietiao = RecognitionObject.TemplateMatch(    file.ReadImageMatSync('assets/Recognition/血条.png'), 600,0,600,120);
const Shui = RecognitionObject.TemplateMatch(    file.ReadImageMatSync('assets/Recognition/Shui.png'), 740,90,100,50);

// 一键执行

(async function main() {

    const done = await Core.executeMainProcess();
    log.info('Core 最终执行结果:', done);
    if (done) {
        await genshin.tpToStatueOfTheSeven();
        
    let msg = `Liam 执行: ${done ? '✅成功' : '❌失败'}`;
    //  发送
    notification.send(msg);
        await genshin.tpToStatueOfTheSeven();
    }else{
        await genshin.tpToStatueOfTheSeven();
    const done1 = await Core.executeMainProcess();
    let msg1 = `Liam 执行: ${done1 ? '✅成功' : '❌失败'}`;
    //  发送
    notification.send(msg1);
        await genshin.tpToStatueOfTheSeven();
    }

// 对于有绿色水没有解密的，可以在水尖端这个位置放一个座椅（周年庆给的），放的位置大概？"x":2912.4453125,"y":3800.40478515625,卡住怪，让怪往水池边走
// 沾染上水之后先往右拐一下，拉近与怪的距离，再拐回去，确保怪第二个技能可以成功将怪炸到水里，
// 难点一在于将座椅放到合适的位置，这个可以细微调整，
// 难点二在于，执行看点水坐标后的一段键鼠录制需要比较精细，差一点就绕过了！
// 无论是不是绿色水，可以先测验一波，如果一次成功，则不继续进行，如果直到血条消失，也没有出现水，则放障碍物


// 千万不要两个人同时到同一片加载区域，即锚点附近不要有两名玩家或以上，这样怪的抗打断系数提高，则抵抗它掉到河里，切记，切记！













})();

