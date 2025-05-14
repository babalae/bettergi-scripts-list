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
    { taskName: '薄荷E26-枫丹-佩特莉可镇', mintCount: 15 },
    { taskName: '薄荷E23-枫丹-幽林雾道2', mintCount: 9 },
    { taskName: '薄荷E08-枫丹-秋分山东侧', mintCount: 6 },
    { taskName: '薄荷C38-稻妻-清籁岛-浅濑神社', mintCount: 20 },
    { taskName: '薄荷A39-雪山-近郊2', mintCount: 21 },
    { taskName: '薄荷A38-雪山-近郊1', mintCount: 6 },
    { taskName: '薄荷A08-蒙德-风起地2', mintCount: 8 },
    { taskName: '薄荷E24-枫丹-湖中垂柳', mintCount: 15 },
    { taskName: '薄荷C31-稻妻-海祇岛-珊瑚宫', mintCount: 12 },
    { taskName: '薄荷C21-稻妻-八酝岛-藤兜砦2', mintCount: 6 },
    { taskName: '薄荷C04-稻妻-鸣神岛-绀田村', mintCount: 8 },
    { taskName: '薄荷B10-璃月-归离原1', mintCount: 10 },
    { taskName: '薄荷A01-蒙德-望风角1', mintCount: 13 },
    { taskName: '薄荷E22-枫丹-幽林雾道1', mintCount: 14 },
    { taskName: '薄荷C12-稻妻-神无冢-九条阵屋2', mintCount: 4 },
    { taskName: '薄荷C27-稻妻-八酝岛-蛇骨矿洞3', mintCount: 12 },
    { taskName: '薄荷A21-蒙德-明冠峡3', mintCount: 7 },
    { taskName: '薄荷C16-稻妻-神无冢-踏鞴砂3', mintCount: 7 },
    { taskName: '薄荷B17-璃月-渌华池2', mintCount: 10 },
    { taskName: '薄荷F06-纳塔-流泉之众5', mintCount: 2 },
    { taskName: '薄荷E20-枫丹-优兰尼娅湖', mintCount: 15 },
    { taskName: '薄荷A10-蒙德-鹰翔海滩', mintCount: 12 },
    { taskName: '薄荷D42-须弥-五绿洲的孑遗', mintCount: 9 },
    { taskName: '薄荷B11-璃月-归离原2', mintCount: 15 },
    { taskName: '薄荷E16-枫丹-新枫丹科学院5', mintCount: 11 },
    { taskName: '薄荷C42-稻妻-鹤观-茂知祭场2', mintCount: 4 },
    { taskName: '薄荷B42-璃月-南天门', mintCount: 7 },
    { taskName: '薄荷A36-雪山-眠龙谷3', mintCount: 4 },
    { taskName: '薄荷B60-沉玉谷-赤望台2', mintCount: 18 },
    { taskName: '薄荷E17-枫丹-中央实验室遗址1', mintCount: 11 },
    { taskName: '薄荷A04-蒙德-望风山地2', mintCount: 7 },
    { taskName: '薄荷D21-须弥-维摩庄5', mintCount: 7 },
    { taskName: '薄荷B08-璃月-明藴镇1', mintCount: 14 },
    { taskName: '薄荷B32-璃月-翠玦坡2', mintCount: 20 },
    { taskName: '薄荷D33-须弥-谒颂幽境1', mintCount: 21 },
    { taskName: '薄荷E14-枫丹-新枫丹科学院3', mintCount: 17 },
    { taskName: '薄荷B07-璃月-荻花洲', mintCount: 15 },
    { taskName: '薄荷B12-璃月-归离原3', mintCount: 8 },
    { taskName: '薄荷C24-稻妻-八酝岛-蛇神之首2', mintCount: 6 },
    { taskName: '薄荷A02-蒙德-望风角2', mintCount: 15 },
    { taskName: '薄荷B52-沉玉谷-赤璋城垣1', mintCount: 10 },
    { taskName: '薄荷A29-雪山-覆雪之路2', mintCount: 8 },
    { taskName: '薄荷A34-雪山-眠龙谷1', mintCount: 23 },
    { taskName: '薄荷B59-沉玉谷-赤望台1', mintCount: 11 },
    { taskName: '薄荷D15-须弥-天臂池', mintCount: 7 },
    { taskName: '薄荷C05-稻妻-鸣神岛-神樱大社', mintCount: 2 },
    { taskName: '薄荷B47-沉玉谷-翘英庄3', mintCount: 11 },
    { taskName: '薄荷D24-须弥-拜达港', mintCount: 21 },
    { taskName: '薄荷B35-璃月-绝云间1', mintCount: 20 },
    { taskName: '薄荷B34-璃月-奥藏山2', mintCount: 19 },
    { taskName: '薄荷B41-璃月-琥牢山2', mintCount: 8 },
    { taskName: '薄荷C43-稻妻-鹤观-茂知祭场3', mintCount: 7 },
    { taskName: '薄荷A09-蒙德-风起地3', mintCount: 4 },
    { taskName: '薄荷B37-璃月-绝云间3', mintCount: 10 },
    { taskName: '薄荷C35-稻妻-清籁岛-平海砦', mintCount: 2 },
    { taskName: '薄荷D32-须弥-觉王之殿3', mintCount: 12 },
    { taskName: '薄荷D25-须弥-桓那兰那1', mintCount: 10 },
    { taskName: '薄荷B43-璃月-采樵谷1', mintCount: 36 },
    { taskName: '薄荷D18-须弥-维摩庄2', mintCount: 15 },
    { taskName: '薄荷B19-璃月-遁玉陵', mintCount: 15 },
    { taskName: '薄荷C19-稻妻-八酝岛-无想刃狭间', mintCount: 6 },
    { taskName: '薄荷D04-须弥-香醉坡1', mintCount: 12 },
    { taskName: '薄荷B05-璃月-无妄坡3', mintCount: 14 },
    { taskName: '薄荷B24-璃月-青墟浦1', mintCount: 17 },
    { taskName: '薄荷B13-璃月-归离原4', mintCount: 14 },
    { taskName: '薄荷C15-稻妻-神无冢-踏鞴砂2', mintCount: 3 },
    { taskName: '薄荷C32-稻妻-海祇岛-望泷村1', mintCount: 8 },
    { taskName: '薄荷A32-雪山-星荧洞窟1', mintCount: 20 },
    { taskName: '薄荷C41-稻妻-鹤观-茂知祭场1', mintCount: 6 },
    { taskName: '薄荷D43-须弥-甘露花海', mintCount: 14 },
    { taskName: '薄荷F15-纳塔-花语会5', mintCount: 6 },
    { taskName: '薄荷D35-须弥-谒颂幽境3', mintCount: 17 },
    { taskName: '薄荷B27-璃月-灵矩关2', mintCount: 9 },
    { taskName: '薄荷E21-枫丹-茉洁站', mintCount: 11 },
    { taskName: '薄荷C44-稻妻-鹤观-茂知祭场4', mintCount: 3 },
    { taskName: '薄荷D09-须弥-化城郭3', mintCount: 24 },
    { taskName: '薄荷B61-沉玉谷-赤望台3', mintCount: 12 },
    { taskName: '薄荷A35-雪山-眠龙谷2', mintCount: 16 },
    { taskName: '薄荷B38-璃月-绝云间4', mintCount: 2 },
    { taskName: '薄荷F04-纳塔-流泉之众3', mintCount: 1 },
    { taskName: '薄荷F07-纳塔-烟密主1', mintCount: 2 },
    { taskName: '薄荷F09-纳塔-烟密主3', mintCount: 2 },
    { taskName: '薄荷B28-璃月-灵矩关3', mintCount: 10 },
    { taskName: '薄荷C11-稻妻-神无冢-九条阵屋1', mintCount: 7 },
    { taskName: '薄荷B31-璃月-翠玦坡1', mintCount: 24 },
    { taskName: '薄荷F12-纳塔-花语会2', mintCount: 6 },
    { taskName: '薄荷C14-稻妻-神无冢-踏鞴砂1', mintCount: 7 },
    { taskName: '薄荷A07-蒙德-风起地1', mintCount: 6 },
    { taskName: '薄荷C07-稻妻-鸣神岛-白狐之野', mintCount: 6 },
    { taskName: '薄荷C08-稻妻-鸣神岛-稻妻城1', mintCount: 6 },
    { taskName: '薄荷D29-须弥-往昔的桓那兰那', mintCount: 13 },
    { taskName: '薄荷D36-须弥-禅那园1', mintCount: 13 },
    { taskName: '薄荷B29-璃月-天遒谷1', mintCount: 7 },
    { taskName: '薄荷B22-璃月-天衡山2', mintCount: 8 },
    { taskName: '薄荷B44-璃月-采樵谷2', mintCount: 20 },
    { taskName: '薄荷B18-璃月-渌华池3', mintCount: 12 },
    { taskName: '薄荷C26-稻妻-八酝岛-蛇骨矿洞2', mintCount: 8 },
    { taskName: '薄荷B48-沉玉谷-灵濛山1', mintCount: 10 },
    { taskName: '薄荷E15-枫丹-新枫丹科学院4', mintCount: 8 },
    { taskName: '薄荷D38-须弥-禅那园3', mintCount: 14 },
    { taskName: '薄荷B02-璃月-石门2', mintCount: 13 },
    { taskName: '薄荷C17-稻妻-神无冢-踏鞴砂4', mintCount: 11 },
    { taskName: '薄荷D23-须弥-茸蕈窟', mintCount: 10 },
    { taskName: '薄荷C13-稻妻-神无冢-无相之火', mintCount: 2 },
    { taskName: '薄荷F03-纳塔-流泉之众2', mintCount: 2 },
    { taskName: '薄荷B23-璃月-天衡山3', mintCount: 9 },
    { taskName: '薄荷F02-纳塔-流泉之众1', mintCount: 2 },
    { taskName: '薄荷F08-纳塔-烟密主2', mintCount: 3 },
    { taskName: '薄荷B04-璃月-无妄坡2', mintCount: 6 },
    { taskName: '薄荷B46-沉玉谷-翘英庄2', mintCount: 10 },
    { taskName: '薄荷C20-稻妻-八酝岛-藤兜砦1', mintCount: 8 },
    { taskName: '薄荷C40-稻妻-鹤观-笈名海滨', mintCount: 7 },
    { taskName: '薄荷A19-蒙德-明冠峡1', mintCount: 6 },
    { taskName: '薄荷E12-枫丹-新枫丹科学院1', mintCount: 6 },
    { taskName: '薄荷B56-沉玉谷-遗珑埠', mintCount: 5 },
    { taskName: '薄荷A05-蒙德-摘星崖', mintCount: 4 },
    { taskName: '薄荷A06-蒙德-星落湖', mintCount: 8 },
    { taskName: '薄荷C22-稻妻-八酝岛-绯木村', mintCount: 6 },
    { taskName: '薄荷D14-须弥-降诸魔山5', mintCount: 16 },
    { taskName: '薄荷B06-璃月-无妄坡4', mintCount: 11 },
    { taskName: '薄荷D03-须弥-卡萨扎莱宫2', mintCount: 11 },
    { taskName: '薄荷D20-须弥-维摩庄4', mintCount: 13 },
    { taskName: '薄荷A15-蒙德-晨曦酒馆', mintCount: 9 },
    { taskName: '薄荷A17-蒙德-奔狼领2', mintCount: 5 },
    { taskName: '薄荷A28-雪山-覆雪之路1', mintCount: 17 },
    { taskName: '薄荷B09-璃月-明藴镇2', mintCount: 15 },
    { taskName: '薄荷D19-须弥-维摩庄3', mintCount: 10 },
    { taskName: '薄荷C23-稻妻-八酝岛-蛇神之首1', mintCount: 4 },
    { taskName: '薄荷C39-稻妻-鹤观-知比山', mintCount: 7 },
    { taskName: '薄荷B51-沉玉谷-古茶树坡', mintCount: 9 },
    { taskName: '薄荷D17-须弥-维摩庄1', mintCount: 17 },
    { taskName: '薄荷C02-稻妻-鸣神岛-荒海1', mintCount: 5 },
    { taskName: '薄荷C46-稻妻-鸣神岛-镇守之森', mintCount: 2 },
    { taskName: '薄荷A14-蒙德-达达乌帕谷2', mintCount: 3 },
    { taskName: '薄荷B15-璃月-孤云阁', mintCount: 6 },
    { taskName: '薄荷C45-稻妻-鹤观-惑饲滩', mintCount: 3 },
    { taskName: '薄荷E07-枫丹-秋分山西侧', mintCount: 7 },
    { taskName: '薄荷C06-稻妻-鸣神岛-神里屋敷', mintCount: 4 },
    { taskName: '薄荷A03-蒙德-望风山地1', mintCount: 5 },
    { taskName: '薄荷B62-沉玉谷-赤望台4', mintCount: 7 },
    { taskName: '薄荷C33-稻妻-海祇岛-望泷村2', mintCount: 8 },
    { taskName: '薄荷B25-璃月-青墟浦2', mintCount: 7 },
    { taskName: '薄荷D06-须弥-离渡谷', mintCount: 6 },
    { taskName: '薄荷B36-璃月-绝云间2', mintCount: 10 },
    { taskName: '薄荷C18-稻妻-神无冢-名椎滩', mintCount: 6 },
    { taskName: '薄荷A22-蒙德-风龙废墟1', mintCount: 8 },
    { taskName: '薄荷C03-稻妻-鸣神岛-荒海2', mintCount: 4 },
    { taskName: '薄荷B01-璃月-石门1', mintCount: 16 },
    { taskName: '薄荷D16-须弥-奥摩斯港', mintCount: 11 },
    { taskName: '薄荷D40-须弥-水天丛林1', mintCount: 12 },
    { taskName: '薄荷C34-稻妻-清籁岛-越石村', mintCount: 5 },
    { taskName: '薄荷B21-璃月-天衡山1', mintCount: 9 },
    { taskName: '薄荷F14-纳塔-花语会4', mintCount: 3 },
    { taskName: '薄荷D34-须弥-谒颂幽境2', mintCount: 17 },
    { taskName: '薄荷D22-须弥-须弥城', mintCount: 8 },
    { taskName: '薄荷D26-须弥-桓那兰那2', mintCount: 9 },
    { taskName: '薄荷B33-璃月-奥藏山1', mintCount: 9 },
    { taskName: '薄荷B03-璃月-无妄坡1', mintCount: 4 },
    { taskName: '薄荷D01-须弥-无郁稠林', mintCount: 2 },
    { taskName: '薄荷D10-须弥-降诸魔山1', mintCount: 16 },
    { taskName: '薄荷D07-须弥-化城郭1', mintCount: 8 },
    { taskName: '薄荷D08-须弥-化城郭2', mintCount: 7 },
    { taskName: '薄荷C37-稻妻-清籁岛-天云峠2', mintCount: 5 },
    { taskName: '薄荷B53-沉玉谷-赤璋城垣2', mintCount: 6 },
    { taskName: '薄荷C25-稻妻-八酝岛-蛇骨矿洞1', mintCount: 6 },
    { taskName: '薄荷A26-蒙德-清泉镇', mintCount: 10 },
    { taskName: '薄荷D31-须弥-觉王之殿2', mintCount: 18 },
    { taskName: '薄荷B58-沉玉谷-宝玦口', mintCount: 9 },
    { taskName: '薄荷D27-须弥-桓那兰那3', mintCount: 17 },
    { taskName: '薄荷E09-枫丹-枫丹廷1', mintCount: 7 },
    { taskName: '薄荷A11-蒙德-千风神殿', mintCount: 4 },
    { taskName: '薄荷A23-蒙德-风龙废墟2', mintCount: 9 },
    { taskName: '薄荷B55-沉玉谷-悬练山', mintCount: 7 },
    { taskName: '薄荷E03-枫丹-厄里那斯2', mintCount: 9 },
    { taskName: '薄荷B14-璃月-归离原5', mintCount: 5 },
    { taskName: '薄荷B49-沉玉谷-灵濛山2', mintCount: 5 },
    { taskName: '薄荷E25-枫丹-卡布狄斯堡遗迹', mintCount: 5 },
    { taskName: '薄荷C09-稻妻-鸣神岛-稻妻城2', mintCount: 6 },
    { taskName: '薄荷D28-须弥-桓那兰那4', mintCount: 12 },
    { taskName: '薄荷D05-须弥-香醉坡2', mintCount: 11 },
    { taskName: '薄荷B40-璃月-琥牢山1', mintCount: 9 },
    { taskName: '薄荷B39-璃月-庆云顶', mintCount: 7 },
    { taskName: '薄荷D11-须弥-降诸魔山2', mintCount: 7 },
    { taskName: '薄荷E10-枫丹-枫丹廷2', mintCount: 7 },
    { taskName: '薄荷B45-沉玉谷-翘英庄1', mintCount: 7 },
    { taskName: '薄荷D39-须弥-喀万驿', mintCount: 17 },
    { taskName: '薄荷A13-蒙德-达达乌帕谷1', mintCount: 12 },
    { taskName: '薄荷A24-蒙德-风龙废墟3', mintCount: 9 },
    { taskName: '薄荷D37-须弥-禅那园2', mintCount: 16 },
    { taskName: '薄荷B57-沉玉谷-暝垣山', mintCount: 8 },
    { taskName: '薄荷A37-雪山-寒天之钉', mintCount: 1 },
    { taskName: '薄荷E05-枫丹-厄里那斯4', mintCount: 5 },
    { taskName: '薄荷B54-沉玉谷-赤璋城垣3', mintCount: 14 },
    { taskName: '薄荷A16-蒙德-奔狼领1', mintCount: 5 },
    { taskName: '薄荷D02-须弥-卡萨扎莱宫1', mintCount: 6 },
    { taskName: '薄荷E06-枫丹-厄里那斯5', mintCount: 6 },
    { taskName: '薄荷E19-枫丹-中央实验室遗址3', mintCount: 6 },
    { taskName: '薄荷E13-枫丹-新枫丹科学院2', mintCount: 8 },
    { taskName: '薄荷F16-纳塔-花语会6', mintCount: 5 },
    { taskName: '薄荷E04-枫丹-厄里那斯3', mintCount: 8 },
    { taskName: '薄荷D12-须弥-降诸魔山3', mintCount: 13 },
    { taskName: '薄荷D41-须弥-水天丛林2', mintCount: 13 },
    { taskName: '薄荷B16-璃月-渌华池1', mintCount: 4 },
    { taskName: '薄荷C30-稻妻-海祇岛-曚云神社', mintCount: 5 },
    { taskName: '薄荷B26-璃月-灵矩关1', mintCount: 6 },
    { taskName: '薄荷B30-璃月-天遒谷2', mintCount: 7 },
    { taskName: '薄荷C10-稻妻-鸣神岛-堇色之庭', mintCount: 2 },
    { taskName: '薄荷E02-枫丹-厄里那斯1', mintCount: 4 },
    { taskName: '薄荷A31-雪山-旧宫2', mintCount: 5 },
    { taskName: '薄荷C01-稻妻-鸣神岛-离岛', mintCount: 2 },
    { taskName: '薄荷A20-蒙德-明冠峡2', mintCount: 5 },
    { taskName: '薄荷C36-稻妻-清籁岛-天云峠1', mintCount: 3 },
    { taskName: '薄荷F05-纳塔-流泉之众4', mintCount: 1 },
    { taskName: '薄荷D30-须弥-觉王之殿1', mintCount: 7 },
    { taskName: '薄荷A33-雪山-星荧洞窟2', mintCount: 4 },
    { taskName: '薄荷C29-稻妻-海祇岛-水月池2', mintCount: 2 },
    { taskName: '薄荷B50-沉玉谷-药蝶谷', mintCount: 13 },
    { taskName: '薄荷E11-枫丹-芒索斯山东麓', mintCount: 1 },
    { taskName: '薄荷A18-蒙德-奔狼领3', mintCount: 8 },
    { taskName: '薄荷A12-蒙德-誓言岬', mintCount: 14 },
    { taskName: '薄荷F11-纳塔-花语会1', mintCount: 3 },
    { taskName: '薄荷F13-纳塔-花语会3', mintCount: 3 },
    { taskName: '薄荷E01-枫丹-海露港', mintCount: 2 },
    { taskName: '薄荷A30-雪山-旧宫1', mintCount: 7 },
    { taskName: '薄荷A25-蒙德-风龙废墟4', mintCount: 6 },
    { taskName: '薄荷A27-蒙德-蒙德城', mintCount: 1 },
    { taskName: '薄荷F01-纳塔-回声之子', mintCount: 1 },
    { taskName: '薄荷E18-枫丹-中央实验室遗址2', mintCount: 3 },
    { taskName: '薄荷F10-纳塔-烟密主4', mintCount: 2 },
    { taskName: '薄荷C28-稻妻-海祇岛-水月池1', mintCount: 1 },
    { taskName: '薄荷B20-璃月-璃月港', mintCount: 1 },
    { taskName: '薄荷D13-须弥-降诸魔山4', mintCount: 1 }
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
        log.info(`未检测到脚本 ${currentTask.taskName}，跳过该任务`);
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
    let materials = captureGameRegion().find(MaterialsRo);
    let materialsSelected = captureGameRegion().find(MaterialsSelectedRo);
    if (materials.isExist()) {
        materials.click();
        await sleep(1500);
    } else if (materialsSelected.isExist()) {
        materialsSelected.click();
        await sleep(1500);
    }
    for (let i = 0; i < 10; i++) {
        let mint = captureGameRegion().find(MintRo);
        if (mint.isExist()) {
            let resList = captureGameRegion().findMulti(RecognitionObject.ocr(mint.x, mint.y + mint.width, mint.Width, mint.Height));
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
        let sliderBottom = captureGameRegion().find(SliderBottomRo);
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