(async function () {


dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));

await genshin.tp(5035.94,3672.92);//安眠处1
await sleep(1000);
await keyMouseScript.runFile(`assets/安眠处地面1-3.json`);


await genshin.tp(4939.90,3564.62);//安眠处2
await sleep(1000);
await keyMouseScript.runFile(`assets/安眠处地面3-6.json`);

await genshin.tp(4939.90,3564.62);//安眠处2
await sleep(1000);
await keyMouseScript.runFile(`assets/安眠处地面4-8.json`);

await genshin.tp(4939.90,3564.62);//安眠处2
await sleep(1000);
await keyMouseScript.runFile(`assets/安眠处地面5-6.json`);
//3
await genshin.tp(4259.14,2704.10,ture);//白松镇1
await sleep(1000);
await keyMouseScript.runFile(`assets/白松镇1-3.json`);
//9
await genshin.tp(4234.85,3121.65);//自然哲学学院1，有概率失败
await sleep(1000);
await keyMouseScript.runFile(`assets/自然哲学学院1.json`);
//4
await genshin.tp(4175.23,3280.54);//自然哲学学院2
await sleep(1000);
await keyMouseScript.runFile(`assets/自然哲学学院2.json`);
//4
await genshin.tp(4191.45,3802.76);//塔拉塔海沟
await sleep(1000);
await keyMouseScript.runFile(`assets/塔拉塔海谷1.json`);
//4
await genshin.tp(4012.88,3434.90);//塞洛海原1
await sleep(1000);
await keyMouseScript.runFile(`assets/塞洛海原1.json`);

//5
await genshin.tp(3965.72,3235.31);//塞洛海原2
await sleep(1000);
await keyMouseScript.runFile(`assets/塞洛海原2.json`);

//3
await genshin.tp(4396.86,3092.05);//塞洛海原3
await sleep(1000);
await keyMouseScript.runFile(`assets/塞洛海原3.json`);
//5
await genshin.tp(4396.86,3092.05);//塞洛海原3
await sleep(1000);
await keyMouseScript.runFile(`assets/塞洛海原4.json`);

//5
await genshin.tp(4487.10,2801.05);//苍晶区1
await sleep(1000);
await keyMouseScript.runFile(`assets/苍晶区1.json`);

//8
await genshin.tp(4775.41,3145.85);//枫丹廷区1
await sleep(1000);
await keyMouseScript.runFile(`assets/枫丹廷区1.json`);
//2
await genshin.tp(4775.41,3145.85);//枫丹廷区1
await sleep(1000);
await keyMouseScript.runFile(`assets/枫丹廷区2.json`);

//3
await genshin.tp(4775.41,3145.85);//枫丹廷区1
await sleep(1000);
await keyMouseScript.runFile(`assets/枫丹廷区3.json`);

dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));



})();
