eval(file.readTextSync("utils.js"));
(async function () {

function validateChallengeTime(challengeTime) {


    // 检查是否为正数
    if (challengeTime <= 0) {
throw new Error('challengeTime 必须是一个正数');
    }

    // 检查是否小于60
    if (challengeTime >= 60) {
throw new Error('challengeTime 必须小于60');
    }

    // 检查小数点位数是否不多于两位
    const decimalPart = challengeTime.toString().split('.')[1];
    if (decimalPart && decimalPart.length > 2) {
throw new Error('challengeTime 的小数点位数不能多于两位');
    }
}


validateChallengeTime(settings.challengeTime);

if(!settings.unfairContractTerms) throw new Error('未签署霸王条款，无法使用');

//执行不同的周本
switch (settings.monsterName) {
  case "北风狼":
         await utils.weeklyBoss1();
    break;
  case "风魔龙":
         await utils.weeklyBoss2();
    break;
  case "公子":
         await utils.weeklyBoss3();
    break;
  case "若陀龙王":
         await utils.weeklyBoss4();
    break;
  case "女士":
         await utils.weeklyBoss5();
    break;
  case "雷神":
         await utils.weeklyBoss6();
    break;
  case "散兵":
         await utils.weeklyBoss7();
    break;
  case "阿佩普":
         await utils.weeklyBoss8();
    break;
  case "吞星之鲸":
         await utils.weeklyBoss9();
    break;
  case "仆人":
         await utils.weeklyBoss10();
    break;
  case "源焰之主":
         await utils.weeklyBoss11();
    break;
  case "门扉前的弈局":
         await utils.weeklyBoss12();
    break;
  default:
    break;
}


})();
