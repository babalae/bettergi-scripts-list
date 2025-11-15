const MaterialsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/Materials.png"), 900, 0, 100, 100);
const MaterialsSelectedRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/MaterialsSelected.png"), 900, 0, 100, 100);
const SliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/SliderBottom.png"), 1280, 110, 25, 845);
const MintRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/Mint.png"), 110, 90, 1170, 875);

(async function main() {
// 从设置文件中读取用户配置
    let targetMintCount = parseInt(settings.targetMintCount);
    if (isNaN(targetMintCount) || targetMintCount <= 0) {
        if (settings.targetMintCount === undefined || settings.targetMintCount === "") {
            targetMintCount = 9999;
            log.info("目标薄荷数量未设置，使用默认值：9999");
        } else {
            notification.error("请输入有效的目标薄荷数量（正整数）");
            return;
        }
    }
    
    const isRefresh = settings.isRefresh;
    
    let executionTime = parseInt(settings.executionTime);
    if (isNaN(executionTime) || executionTime <= 0) {
        if (settings.executionTime === undefined || settings.executionTime === "") {
            executionTime = 9999;
            log.info("执行时间未设置，使用默认值：9999分钟");
        } else {
            notification.error("请输入有效的执行时间（正整数，单位：分钟）");
            return;
        }
    }

// 定义地图路线顺序的任务数据，从薄荷表格的sheet5获取整理
const mapOrderTasks = [
    { taskName: 'E26-薄荷-枫丹-佩特莉可镇', mintCount: 15 },
    { taskName: 'E23-薄荷-枫丹-幽林雾道2', mintCount: 9 },
    { taskName: 'E08-薄荷-枫丹-秋分山东侧', mintCount: 6 },
    { taskName: 'C38-薄荷-稻妻-清籁岛-浅濑神社', mintCount: 20 },
    { taskName: 'A39-薄荷-雪山-近郊2', mintCount: 21 },
    { taskName: 'A38-薄荷-雪山-近郊1', mintCount: 6 },
    { taskName: 'A08-薄荷-蒙德-风起地2', mintCount: 8 },
    { taskName: 'E24-薄荷-枫丹-湖中垂柳', mintCount: 15 },
    { taskName: 'C31-薄荷-稻妻-海祇岛-珊瑚宫', mintCount: 12 },
    { taskName: 'C21-薄荷-稻妻-八酝岛-藤兜砦2', mintCount: 6 },
    { taskName: 'C04-薄荷-稻妻-鸣神岛-绀田村', mintCount: 8 },
    { taskName: 'B10-薄荷-璃月-归离原1', mintCount: 10 },
    { taskName: 'A01-薄荷-蒙德-望风角1', mintCount: 13 },
    { taskName: 'E22-薄荷-枫丹-幽林雾道1', mintCount: 14 },
    { taskName: 'C12-薄荷-稻妻-神无冢-九条阵屋2', mintCount: 4 },
    { taskName: 'C27-薄荷-稻妻-八酝岛-蛇骨矿洞3', mintCount: 12 },
    { taskName: 'A21-薄荷-蒙德-明冠峡3', mintCount: 7 },
    { taskName: 'C16-薄荷-稻妻-神无冢-踏鞴砂3', mintCount: 7 },
    { taskName: 'B17-薄荷-璃月-渌华池2', mintCount: 10 },
    { taskName: 'F06-薄荷-纳塔-流泉之众5', mintCount: 2 },
    { taskName: 'E20-薄荷-枫丹-优兰尼娅湖', mintCount: 15 },
    { taskName: 'A10-薄荷-蒙德-鹰翔海滩', mintCount: 12 },
    { taskName: 'D42-薄荷-须弥-五绿洲的孑遗', mintCount: 9 },
    { taskName: 'B11-薄荷-璃月-归离原2', mintCount: 15 },
    { taskName: 'E16-薄荷-枫丹-新枫丹科学院5', mintCount: 11 },
    { taskName: 'C42-薄荷-稻妻-鹤观-茂知祭场2', mintCount: 4 },
    { taskName: 'B42-薄荷-璃月-南天门', mintCount: 7 },
    { taskName: 'A36-薄荷-雪山-眠龙谷3', mintCount: 4 },
    { taskName: 'B60-薄荷-沉玉谷-赤望台2', mintCount: 18 },
    { taskName: 'E17-薄荷-枫丹-中央实验室遗址1', mintCount: 11 },
    { taskName: 'A04-薄荷-蒙德-望风山地2', mintCount: 7 },
    { taskName: 'D21-薄荷-须弥-维摩庄5', mintCount: 7 },
    { taskName: 'B08-薄荷-璃月-明藴镇1', mintCount: 14 },
    { taskName: 'B32-薄荷-璃月-翠玦坡2', mintCount: 20 },
    { taskName: 'D33-薄荷-须弥-谒颂幽境1', mintCount: 21 },
    { taskName: 'E14-薄荷-枫丹-新枫丹科学院3', mintCount: 17 },
    { taskName: 'B07-薄荷-璃月-荻花洲', mintCount: 15 },
    { taskName: 'B12-薄荷-璃月-归离原3', mintCount: 8 },
    { taskName: 'C24-薄荷-稻妻-八酝岛-蛇神之首2', mintCount: 6 },
    { taskName: 'A02-薄荷-蒙德-望风角2', mintCount: 15 },
    { taskName: 'B52-薄荷-沉玉谷-赤璋城垣1', mintCount: 10 },
    { taskName: 'A29-薄荷-雪山-覆雪之路2', mintCount: 8 },
    { taskName: 'A34-薄荷-雪山-眠龙谷1', mintCount: 23 },
    { taskName: 'B59-薄荷-沉玉谷-赤望台1', mintCount: 11 },
    { taskName: 'D15-薄荷-须弥-天臂池', mintCount: 7 },
    { taskName: 'C05-薄荷-稻妻-鸣神岛-神樱大社', mintCount: 2 },
    { taskName: 'B47-薄荷-沉玉谷-翘英庄3', mintCount: 11 },
    { taskName: 'D24-薄荷-须弥-拜达港', mintCount: 21 },
    { taskName: 'B35-薄荷-璃月-绝云间1', mintCount: 20 },
    { taskName: 'B34-薄荷-璃月-奥藏山2', mintCount: 19 },
    { taskName: 'B41-薄荷-璃月-琥牢山2', mintCount: 8 },
    { taskName: 'C43-薄荷-稻妻-鹤观-茂知祭场3', mintCount: 7 },
    { taskName: 'A09-薄荷-蒙德-风起地3', mintCount: 4 },
    { taskName: 'B37-薄荷-璃月-绝云间3', mintCount: 10 },
    { taskName: 'C35-薄荷-稻妻-清籁岛-平海砦', mintCount: 2 },
    { taskName: 'D32-薄荷-须弥-觉王之殿3', mintCount: 12 },
    { taskName: 'D25-薄荷-须弥-桓那兰那1', mintCount: 10 },
    { taskName: 'B43-薄荷-璃月-采樵谷1', mintCount: 36 },
    { taskName: 'D18-薄荷-须弥-维摩庄2', mintCount: 15 },
    { taskName: 'B19-薄荷-璃月-遁玉陵', mintCount: 15 },
    { taskName: 'C19-薄荷-稻妻-八酝岛-无想刃狭间', mintCount: 6 },
    { taskName: 'D04-薄荷-须弥-香醉坡1', mintCount: 12 },
    { taskName: 'B05-薄荷-璃月-无妄坡3', mintCount: 14 },
    { taskName: 'B24-薄荷-璃月-青墟浦1', mintCount: 17 },
    { taskName: 'B13-薄荷-璃月-归离原4', mintCount: 14 },
    { taskName: 'C15-薄荷-稻妻-神无冢-踏鞴砂2', mintCount: 3 },
    { taskName: 'C32-薄荷-稻妻-海祇岛-望泷村1', mintCount: 8 },
    { taskName: 'A32-薄荷-雪山-星荧洞窟1', mintCount: 20 },
    { taskName: 'C41-薄荷-稻妻-鹤观-茂知祭场1', mintCount: 6 },
    { taskName: 'D43-薄荷-须弥-甘露花海', mintCount: 14 },
    { taskName: 'F15-薄荷-纳塔-花语会5', mintCount: 6 },
    { taskName: 'D35-薄荷-须弥-谒颂幽境3', mintCount: 17 },
    { taskName: 'B27-薄荷-璃月-灵矩关2', mintCount: 9 },
    { taskName: 'E21-薄荷-枫丹-茉洁站', mintCount: 11 },
    { taskName: 'C44-薄荷-稻妻-鹤观-茂知祭场4', mintCount: 3 },
    { taskName: 'D09-薄荷-须弥-化城郭3', mintCount: 24 },
    { taskName: 'B61-薄荷-沉玉谷-赤望台3', mintCount: 12 },
    { taskName: 'A35-薄荷-雪山-眠龙谷2', mintCount: 16 },
    { taskName: 'B38-薄荷-璃月-绝云间4', mintCount: 2 },
    { taskName: 'F04-薄荷-纳塔-流泉之众3', mintCount: 1 },
    { taskName: 'F07-薄荷-纳塔-烟密主1', mintCount: 2 },
    { taskName: 'F09-薄荷-纳塔-烟密主3', mintCount: 2 },
    { taskName: 'B28-薄荷-璃月-灵矩关3', mintCount: 10 },
    { taskName: 'C11-薄荷-稻妻-神无冢-九条阵屋1', mintCount: 7 },
    { taskName: 'B31-薄荷-璃月-翠玦坡1', mintCount: 24 },
    { taskName: 'F12-薄荷-纳塔-花语会2', mintCount: 6 },
    { taskName: 'C14-薄荷-稻妻-神无冢-踏鞴砂1', mintCount: 7 },
    { taskName: 'A07-薄荷-蒙德-风起地1', mintCount: 6 },
    { taskName: 'C07-薄荷-稻妻-鸣神岛-白狐之野', mintCount: 6 },
    { taskName: 'C08-薄荷-稻妻-鸣神岛-稻妻城1', mintCount: 6 },
    { taskName: 'D29-薄荷-须弥-往昔的桓那兰那', mintCount: 13 },
    { taskName: 'D36-薄荷-须弥-禅那园1', mintCount: 13 },
    { taskName: 'B29-薄荷-璃月-天遒谷1', mintCount: 7 },
    { taskName: 'B22-薄荷-璃月-天衡山2', mintCount: 8 },
    { taskName: 'B44-薄荷-璃月-采樵谷2', mintCount: 20 },
    { taskName: 'B18-薄荷-璃月-渌华池3', mintCount: 12 },
    { taskName: 'C26-薄荷-稻妻-八酝岛-蛇骨矿洞2', mintCount: 8 },
    { taskName: 'B48-薄荷-沉玉谷-灵濛山1', mintCount: 10 },
    { taskName: 'E15-薄荷-枫丹-新枫丹科学院4', mintCount: 8 },
    { taskName: 'G05-薄荷-挪德卡莱-伦波岛-苔骨荒原', mintCount: 16 },
    { taskName: 'F22-薄荷-纳塔-悠悠度假村4', mintCount: 11 },
    { taskName: 'D38-薄荷-须弥-禅那园3', mintCount: 14 },
    { taskName: 'B02-薄荷-璃月-石门2', mintCount: 13 },
    { taskName: 'C17-薄荷-稻妻-神无冢-踏鞴砂4', mintCount: 11 },
    { taskName: 'D23-薄荷-须弥-茸蕈窟', mintCount: 10 },
    { taskName: 'C13-薄荷-稻妻-神无冢-无相之火', mintCount: 2 },
    { taskName: 'F03-薄荷-纳塔-流泉之众2', mintCount: 2 },
    { taskName: 'B23-薄荷-璃月-天衡山3', mintCount: 9 },
    { taskName: 'F02-薄荷-纳塔-流泉之众1', mintCount: 2 },
    { taskName: 'F08-薄荷-纳塔-烟密主2', mintCount: 3 },
    { taskName: 'B04-薄荷-璃月-无妄坡2', mintCount: 6 },
    { taskName: 'B46-薄荷-沉玉谷-翘英庄2', mintCount: 10 },
    { taskName: 'C20-薄荷-稻妻-八酝岛-藤兜砦1', mintCount: 8 },
    { taskName: 'C40-薄荷-稻妻-鹤观-笈名海滨', mintCount: 7 },
    { taskName: 'A19-薄荷-蒙德-明冠峡1', mintCount: 6 },
    { taskName: 'E12-薄荷-枫丹-新枫丹科学院1', mintCount: 6 },
    { taskName: 'B56-薄荷-沉玉谷-遗珑埠', mintCount: 5 },
    { taskName: 'A05-薄荷-蒙德-摘星崖', mintCount: 4 },
    { taskName: 'A06-薄荷-蒙德-星落湖', mintCount: 8 },
    { taskName: 'C22-薄荷-稻妻-八酝岛-绯木村', mintCount: 6 },
    { taskName: 'D14-薄荷-须弥-降诸魔山5', mintCount: 16 },
    { taskName: 'B06-薄荷-璃月-无妄坡4', mintCount: 11 },
    { taskName: 'D03-薄荷-须弥-卡萨扎莱宫2', mintCount: 11 },
    { taskName: 'D20-薄荷-须弥-维摩庄4', mintCount: 13 },
    { taskName: 'A15-薄荷-蒙德-晨曦酒馆', mintCount: 9 },
    { taskName: 'A17-薄荷-蒙德-奔狼领2', mintCount: 5 },
    { taskName: 'A28-薄荷-雪山-覆雪之路1', mintCount: 17 },
    { taskName: 'B09-薄荷-璃月-明藴镇2', mintCount: 15 },
    { taskName: 'D19-薄荷-须弥-维摩庄3', mintCount: 10 },
    { taskName: 'C23-薄荷-稻妻-八酝岛-蛇神之首1', mintCount: 4 },
    { taskName: 'C39-薄荷-稻妻-鹤观-知比山', mintCount: 7 },
    { taskName: 'B51-薄荷-沉玉谷-古茶树坡', mintCount: 9 },
    { taskName: 'D17-薄荷-须弥-维摩庄1', mintCount: 17 },
    { taskName: 'C02-薄荷-稻妻-鸣神岛-荒海1', mintCount: 5 },
    { taskName: 'C46-薄荷-稻妻-鸣神岛-镇守之森', mintCount: 2 },
    { taskName: 'A14-薄荷-蒙德-达达乌帕谷2', mintCount: 3 },
    { taskName: 'B15-薄荷-璃月-孤云阁', mintCount: 6 },
    { taskName: 'C45-薄荷-稻妻-鹤观-惑饲滩', mintCount: 3 },
    { taskName: 'E07-薄荷-枫丹-秋分山西侧', mintCount: 7 },
    { taskName: 'C06-薄荷-稻妻-鸣神岛-神里屋敷', mintCount: 4 },
    { taskName: 'A03-薄荷-蒙德-望风山地1', mintCount: 5 },
    { taskName: 'B62-薄荷-沉玉谷-赤望台4', mintCount: 7 },
    { taskName: 'C33-薄荷-稻妻-海祇岛-望泷村2', mintCount: 8 },
    { taskName: 'B25-薄荷-璃月-青墟浦2', mintCount: 7 },
    { taskName: 'D06-薄荷-须弥-离渡谷', mintCount: 6 },
    { taskName: 'B36-薄荷-璃月-绝云间2', mintCount: 10 },
    { taskName: 'C18-薄荷-稻妻-神无冢-名椎滩', mintCount: 6 },
    { taskName: 'A22-薄荷-蒙德-风龙废墟1', mintCount: 8 },
    { taskName: 'F20-薄荷-纳塔-悠悠度假村2', mintCount: 7 },
    { taskName: 'C03-薄荷-稻妻-鸣神岛-荒海2', mintCount: 4 },
    { taskName: 'B01-薄荷-璃月-石门1', mintCount: 16 },
    { taskName: 'D16-薄荷-须弥-奥摩斯港', mintCount: 11 },
    { taskName: 'D40-薄荷-须弥-水天丛林1', mintCount: 12 },
    { taskName: 'C34-薄荷-稻妻-清籁岛-越石村', mintCount: 5 },
    { taskName: 'B21-薄荷-璃月-天衡山1', mintCount: 9 },
    { taskName: 'F14-薄荷-纳塔-花语会4', mintCount: 3 },
    { taskName: 'D34-薄荷-须弥-谒颂幽境2', mintCount: 17 },
    { taskName: 'D22-薄荷-须弥-须弥城', mintCount: 8 },
    { taskName: 'D26-薄荷-须弥-桓那兰那2', mintCount: 9 },
    { taskName: 'B33-薄荷-璃月-奥藏山1', mintCount: 9 },
    { taskName: 'B03-薄荷-璃月-无妄坡1', mintCount: 4 },
    { taskName: 'D01-薄荷-须弥-无郁稠林', mintCount: 2 },
    { taskName: 'D10-薄荷-须弥-降诸魔山1', mintCount: 16 },
    { taskName: 'G06-薄荷-挪德卡莱-伦波岛-蓝珀湖', mintCount: 11 },
    { taskName: 'D07-薄荷-须弥-化城郭1', mintCount: 8 },
    { taskName: 'D08-薄荷-须弥-化城郭2', mintCount: 7 },
    { taskName: 'F21-薄荷-纳塔-悠悠度假村3', mintCount: 11 },
    { taskName: 'G03-薄荷-挪德卡莱-伦波岛-蛋卷工坊02', mintCount: 6 },
    { taskName: 'C37-薄荷-稻妻-清籁岛-天云峠2', mintCount: 5 },
    { taskName: 'B53-薄荷-沉玉谷-赤璋城垣2', mintCount: 6 },
    { taskName: 'C25-薄荷-稻妻-八酝岛-蛇骨矿洞1', mintCount: 6 },
    { taskName: 'A26-薄荷-蒙德-清泉镇', mintCount: 10 },
    { taskName: 'D31-薄荷-须弥-觉王之殿2', mintCount: 18 },
    { taskName: 'B58-薄荷-沉玉谷-宝玦口', mintCount: 9 },
    { taskName: 'D27-薄荷-须弥-桓那兰那3', mintCount: 17 },
    { taskName: 'E09-薄荷-枫丹-枫丹廷1', mintCount: 7 },
    { taskName: 'A11-薄荷-蒙德-千风神殿', mintCount: 4 },
    { taskName: 'A23-薄荷-蒙德-风龙废墟2', mintCount: 9 },
    { taskName: 'B55-薄荷-沉玉谷-悬练山', mintCount: 7 },
    { taskName: 'E03-薄荷-枫丹-厄里那斯2', mintCount: 9 },
    { taskName: 'B14-薄荷-璃月-归离原5', mintCount: 5 },
    { taskName: 'B49-薄荷-沉玉谷-灵濛山2', mintCount: 5 },
    { taskName: 'E25-薄荷-枫丹-卡布狄斯堡遗迹', mintCount: 5 },
    { taskName: 'C09-薄荷-稻妻-鸣神岛-稻妻城2', mintCount: 6 },
    { taskName: 'D28-薄荷-须弥-桓那兰那4', mintCount: 12 },
    { taskName: 'D05-薄荷-须弥-香醉坡2', mintCount: 11 },
    { taskName: 'B40-薄荷-璃月-琥牢山1', mintCount: 9 },
    { taskName: 'B39-薄荷-璃月-庆云顶', mintCount: 7 },
    { taskName: 'D11-薄荷-须弥-降诸魔山2', mintCount: 7 },
    { taskName: 'E10-薄荷-枫丹-枫丹廷2', mintCount: 7 },
    { taskName: 'G02-薄荷-挪德卡莱-伦波岛-蛋卷工坊01', mintCount: 11 },
    { taskName: 'B45-薄荷-沉玉谷-翘英庄1', mintCount: 7 },
    { taskName: 'D39-薄荷-须弥-喀万驿', mintCount: 17 },
    { taskName: 'A13-薄荷-蒙德-达达乌帕谷1', mintCount: 12 },
    { taskName: 'A24-薄荷-蒙德-风龙废墟3', mintCount: 9 },
    { taskName: 'F17-薄荷-纳塔-流泉之众地下1', mintCount: 3 },
    { taskName: 'G01-薄荷-挪德卡莱-希汐岛', mintCount: 2 },
    { taskName: 'D37-薄荷-须弥-禅那园2', mintCount: 16 },
    { taskName: 'B57-薄荷-沉玉谷-暝垣山', mintCount: 8 },
    { taskName: 'A37-薄荷-雪山-寒天之钉', mintCount: 1 },
    { taskName: 'E05-薄荷-枫丹-厄里那斯4', mintCount: 5 },
    { taskName: 'F19-薄荷-纳塔-悠悠度假村1', mintCount: 7 },
    { taskName: 'B54-薄荷-沉玉谷-赤璋城垣3', mintCount: 14 },
    { taskName: 'A16-薄荷-蒙德-奔狼领1', mintCount: 5 },
    { taskName: 'D02-薄荷-须弥-卡萨扎莱宫1', mintCount: 6 },
    { taskName: 'G09-薄荷-挪德卡莱-帕哈岛-月矩力试验设计局', mintCount: 12 },
    { taskName: 'E06-薄荷-枫丹-厄里那斯5', mintCount: 6 },
    { taskName: 'E19-薄荷-枫丹-中央实验室遗址3', mintCount: 6 },
    { taskName: 'E13-薄荷-枫丹-新枫丹科学院2', mintCount: 8 },
    { taskName: 'F16-薄荷-纳塔-花语会6', mintCount: 5 },
    { taskName: 'F17-薄荷-纳塔-流泉之众地下1', mintCount: 5 },
    { taskName: 'E04-薄荷-枫丹-厄里那斯3', mintCount: 8 },
    { taskName: 'D12-薄荷-须弥-降诸魔山3', mintCount: 13 },
    { taskName: 'D41-薄荷-须弥-水天丛林2', mintCount: 13 },
    { taskName: 'B16-薄荷-璃月-渌华池1', mintCount: 4 },
    { taskName: 'C30-薄荷-稻妻-海祇岛-曚云神社', mintCount: 5 },
    { taskName: 'B26-薄荷-璃月-灵矩关1', mintCount: 6 },
    { taskName: 'B30-薄荷-璃月-天遒谷2', mintCount: 7 },
    { taskName: 'C10-薄荷-稻妻-鸣神岛-堇色之庭', mintCount: 2 },
    { taskName: 'E02-薄荷-枫丹-厄里那斯1', mintCount: 4 },
    { taskName: 'A31-薄荷-雪山-旧宫2', mintCount: 5 },
    { taskName: 'C01-薄荷-稻妻-鸣神岛-离岛', mintCount: 2 },
    { taskName: 'A20-薄荷-蒙德-明冠峡2', mintCount: 5 },
    { taskName: 'C36-薄荷-稻妻-清籁岛-天云峠1', mintCount: 3 },
    { taskName: 'F05-薄荷-纳塔-流泉之众4', mintCount: 1 },
    { taskName: 'D30-薄荷-须弥-觉王之殿1', mintCount: 7 },
    { taskName: 'A33-薄荷-雪山-星荧洞窟2', mintCount: 4 },
    { taskName: 'C29-薄荷-稻妻-海祇岛-水月池2', mintCount: 2 },
    { taskName: 'G08-薄荷-挪德卡莱-伦波岛-空寂走廊', mintCount: 16 },
    { taskName: 'B50-薄荷-沉玉谷-药蝶谷', mintCount: 13 },
    { taskName: 'E11-薄荷-枫丹-芒索斯山东麓', mintCount: 1 },
    { taskName: 'G04-薄荷-挪德卡莱-伦波岛-那夏镇', mintCount: 5 },
    { taskName: 'A18-薄荷-蒙德-奔狼领3', mintCount: 8 },
    { taskName: 'F20-薄荷-纳塔-悠悠度假村2', mintCount: 5 },
    { taskName: 'G07-薄荷-挪德卡莱-伦波岛-刻拉蒂之眼', mintCount: 3 },
    { taskName: 'A12-薄荷-蒙德-誓言岬', mintCount: 14 },
    { taskName: 'F11-薄荷-纳塔-花语会1', mintCount: 3 },
    { taskName: 'F13-薄荷-纳塔-花语会3', mintCount: 3 },
    { taskName: 'E01-薄荷-枫丹-海露港', mintCount: 2 },
    { taskName: 'A30-薄荷-雪山-旧宫1', mintCount: 7 },
    { taskName: 'A25-薄荷-蒙德-风龙废墟4', mintCount: 6 },
    { taskName: 'A27-薄荷-蒙德-蒙德城', mintCount: 1 },
    { taskName: 'F18-薄荷-纳塔-浮羽之湾', mintCount: 2 },
    { taskName: 'F01-薄荷-纳塔-回声之子', mintCount: 1 },
    { taskName: 'E18-薄荷-枫丹-中央实验室遗址2', mintCount: 3 },
    { taskName: 'F10-薄荷-纳塔-烟密主4', mintCount: 2 },
    { taskName: 'C28-薄荷-稻妻-海祇岛-水月池1', mintCount: 1 },
    { taskName: 'B20-薄荷-璃月-璃月港', mintCount: 1 },
    { taskName: 'D13-薄荷-须弥-降诸魔山4', mintCount: 1 }
]

// 读取/初始化进度文件（存储上次执行到的任务索引）
let currentIndex = 0;
if (!isRefresh) {
    try {
        const progress = await file.readText("mint_progress.txt");
        currentIndex = parseInt(progress);
        if (isNaN(currentIndex) || currentIndex < 0 || currentIndex >= mapOrderTasks.length) {
            currentIndex = 0;
        }
    } catch (error) {
        currentIndex = 0;
    }
}

// 读取上次执行日期
let lastExecutionDate = "";
try {
    lastExecutionDate = await file.readText("last_execution_date.txt");
} catch (error) {}

// 获取当前日期
const currentDate = new Date().toDateString();
if (lastExecutionDate!== currentDate || isRefresh) {
    // 清空所有路线标记
    await file.writeText("mint_progress.txt", "0");
    await file.writeText("last_execution_date.txt", currentDate);
    currentIndex = 0;
    log.info("自动检测到薄荷刷新或选择强制刷新，将从头开始执行路线");
} else {
    // 更新执行日期
    await file.writeText("last_execution_date.txt", currentDate);
}

// 返回主界面
await genshin.returnMainUi();

// 记录初始薄荷数量
const initialMintCount = await getMintCount();
let collected = 0;
let taskIndex = currentIndex;
let totalExecutionTime = 0; // 总执行时间，单位分钟
let startTime = new Date(); // 记录开始时间

while (collected < targetMintCount && totalExecutionTime <= executionTime) {
    try {
        const progress = await file.readText("mint_progress.txt");
        const savedIndex = parseInt(progress);
        if (savedIndex >= mapOrderTasks.length) {
            log.info("所有薄荷均未刷新，任务结束");
            break;
        }
    } catch (error) {
        log.error("读取进度文件时出错: ", error);
        break;
    }

    const currentTask = mapOrderTasks[taskIndex];
    const scriptPath = `assets/AutoPath/${currentTask.taskName}.json`;
    try {
        // 检查脚本是否存在
        await file.readText(scriptPath);
    } catch (error) {
        log.info(`未检测到脚本 ${currentTask.taskName}，跳过该任务，请检查是否订阅【薄荷全收集版】`);
        taskIndex++;
        if (taskIndex >= mapOrderTasks.length) {
            taskIndex = 0;
        }
        continue;
    }

    const routeStartTime = new Date(); // 记录路线开始时间
    log.info(`执行任务：${currentTask.taskName}，预计采集${currentTask.mintCount}个薄荷`);
    // 执行地图追踪任务
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    await pathingScript.runFile(scriptPath);
    await sleep(1000);

    const routeEndTime = new Date(); // 记录路线结束时间
    const routeExecutionTime = routeEndTime - routeStartTime; // 路线执行时间，单位毫秒
    const minutes = Math.floor(routeExecutionTime / 60000);
    const seconds = Math.floor((routeExecutionTime % 60000) / 1000);
    const formattedRouteTime = `${minutes}分${seconds}秒`;

    // 识别当前薄荷数量
    const currentMintCount = await getMintCount();
    const mintCollectedThisRoute = currentMintCount - initialMintCount - collected;
    collected += mintCollectedThisRoute;

    totalExecutionTime = (routeEndTime - startTime) / 60000; // 更新总执行时间，单位分钟
    totalExecutionTime = parseFloat(totalExecutionTime.toFixed(1));

    log.info(`已完成${currentTask.taskName}路线，该路线已采集${mintCollectedThisRoute}个薄荷，运行时间${formattedRouteTime}。总计采集${collected}个薄荷，运行时间${totalExecutionTime}分钟`);

    taskIndex++;
    // 记录进度
    await file.writeText("mint_progress.txt", taskIndex.toString());

    if (collected >= targetMintCount) {
        log.info(`已采集${collected}个薄荷，目标数量达成`);
        break;
    }
    if (totalExecutionTime > executionTime) {
        log.info(`已运行${totalExecutionTime}分钟，目标执行时间达成`);
        break;
    }
}
})();

// 识别薄荷数量的函数，参考识别.js
async function getMintCount() {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    await sleep(1000);
    keyPress("B");
    await sleep(1500);
    let mintCount = 0;
    let ro1 = captureGameRegion();
    let materials = ro1.find(MaterialsRo);
    ro1.dispose();
    let ro2 = captureGameRegion();
    let materialsSelected = ro2.find(MaterialsSelectedRo);
    ro2.dispose();
    if (materials.isExist()) {
        materials.click();
        await sleep(1500);
    } else if (materialsSelected.isExist()) {
        materialsSelected.click();
        await sleep(1500);
    }
    for (let i = 0; i < 10; i++) {
        let ro3 = captureGameRegion();
        let mint = ro3.find(MintRo);
        ro3.dispose();
        if (mint.isExist()) {
            let ro4 = captureGameRegion();
            let resList = ro4.findMulti(RecognitionObject.ocr(mint.x, mint.y + mint.width, mint.Width, mint.Height));
            ro4.dispose();
            for (let j = 0; j < resList.count; j++) {
                let mintResult = resList[j];
                mintCount = parseInt(mintResult.text);
                // 输出日志
                log.info(`检测到薄荷数量：${mintCount}`);
                break;
            }
            if (mintCount > 0) {
                break;
            }
        }
        let ro5 = captureGameRegion();
        let sliderBottom = ro5.find(SliderBottomRo);
        ro5.dispose();
        if (sliderBottom.isExist()) {
            click(Math.ceil(sliderBottom.x + sliderBottom.Width / 2), Math.ceil(sliderBottom.y + sliderBottom.Height + sliderBottom.Height / 2));
            await moveMouseTo(0, 0);
            await sleep(250);
        }
    }
    await genshin.returnMainUi();
    return mintCount;
}

// 检查所有路线是否都已执行过（都有标记）
async function checkAllRoutesCompleted() {
    const progress = await file.readText("mint_progress.txt");
    const index = parseInt(progress);
    return index === 0;
}