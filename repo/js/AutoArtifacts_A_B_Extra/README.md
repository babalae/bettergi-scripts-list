# 狗粮ABE路线，自动拾取分解

## 脚本用途

圣遗物狗粮AB及额外路线，自动轮换，自动分解，就近恢复。

## 资源用途

本目录包含脚本运行所需的资源文件，以下用途根据资源文件名、目录名和 `main.js` 中的资源引用进行保守推断：

- 地图追踪或自动路径 JSON，供脚本加载对应路线。
  - `assets/狗粮A线@Yang-z/【收尾】狗粮-稻妻-神无冢-踏鞴砂①-6个／21个-f.json`
  - `assets/狗粮A线@Yang-z/【收尾】狗粮-稻妻-神无冢-踏鞴砂②-7个／21个-f.json`
  - `assets/狗粮A线@Yang-z/【收尾】狗粮-稻妻-神无冢-踏鞴砂③-8个／21个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-璃月-珉林-东北-9个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-璃月-珉林-北-5个.json`
  - `assets/狗粮A线@Yang-z/狗粮-璃月-珉林-奥藏山南-2个／3个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-璃月-珉林-绝云间-3个-m.json`
  - `assets/狗粮A线@Yang-z/狗粮-璃月-琼玑野-绿华池-3个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-璃月-碧水源-盐中之地-3个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-纳塔-万火之瓯-竞技场东-2个／4个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-纳塔-奥奇卡纳塔-七天神像-14个.json`
  - `assets/狗粮A线@Yang-z/狗粮-纳塔-奥奇卡纳塔-托佐兹之岛-6个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-纳塔-奥奇卡纳塔-流灰之街-4个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-纳塔-涌流地-流泉之众-4个.json`
  - `assets/狗粮A线@Yang-z/狗粮-纳塔-翘枝崖-北-6个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-纳塔-镜璧山-七天神像下-3个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-纳塔-镜璧山-南-9个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-蒙德-龙脊雪山-西-3个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-须弥-二净甸-七天神像-4个／8个.json`
  - `assets/狗粮A线@Yang-z/狗粮-须弥-二净甸-觉王之殿南-6个／7个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-须弥-失落的苗圃-南-8个-f.json`
  - `assets/狗粮A线@Yang-z/狗粮-须弥-须弥城-4个.json`
  - `assets/狗粮A线@Yang-z/（恢复）狗粮-璃月-琼玑野.json`
  - `assets/狗粮A线@Yang-z/（恢复）狗粮-稻妻-神无冢.json`
  - `assets/狗粮A线@Yang-z/（恢复）狗粮-纳塔-涌流地.json`
  - `assets/狗粮A线@Yang-z/（恢复）狗粮-须弥-失落的苗圃.json`
  - `assets/狗粮B线@Yang-z/【收尾】狗粮-稻妻-清籁岛-清籁丸-20个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-伊黎耶林区-欧庇克莱歌剧院东南-2个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-枫丹庭区-3个.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-白露区-秋分山东侧-2个-f~m.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-研究院区-中央实验室遗址-北侧屋内-4个.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-研究院区-中部塔内-9个.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-研究院区-学术会堂-1个／2个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-研究院区-新枫丹科学院-东南侧-8个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-研究院区-西北-6个／7个.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-研究院区-西南偏南-6个-m-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-研究院区-西南偏西-4个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-黎翡区-七天神像-3个／5个.json`
  - `assets/狗粮B线@Yang-z/狗粮-枫丹-黎翡区-芒索斯山东-3个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-海祇岛-东方小岛-2个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-海祇岛-望泷村西南-4个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-海祇岛-珊瑚宫东北-6个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-清籁岛-平海砦西-8个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-清籁岛-浅濑神社-3个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-清籁岛-越石村-8个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-神无冢-东-5个／6个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-神无冢-九条阵屋-2个／3个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-神无冢-堇色之庭-4个.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-鹤观-东偏中-2个-f.json`
  - `assets/狗粮B线@Yang-z/狗粮-稻妻-鹤观-南-2个-f.json`
  - `assets/狗粮B线@Yang-z/（恢复）狗粮-枫丹-研究院区.json`
  - `assets/狗粮B线@Yang-z/（恢复）狗粮-枫丹-黎翡区.json`
  - `assets/狗粮B线@Yang-z/（恢复）狗粮-稻妻-清籁岛.json`
  - `assets/狗粮B线@Yang-z/（恢复）狗粮-稻妻-神无冢.json`
  - `assets/狗粮额外@Yang-z/【额外】狗粮-枫丹-研究院区-新枫丹科学院周边+3个-f.json`
  - `assets/狗粮额外@Yang-z/【额外】狗粮-纳塔-灵谜纹+13个.json`
  - `assets/狗粮额外@Yang-z/【额外】狗粮-纳塔-鸡屁股+8个／9个-f.json`
  - `assets/狗粮额外@Yang-z/【额外】狗粮-须弥-水天丛林+7个-f.json`

## 注意事项

- 请保持资源文件的相对路径不变，避免脚本无法加载。
- 若替换识别图片或路径 JSON，请同步检查 `main.js` 中的引用。
- 未能从文件名或引用明确判断的资源，按“用于脚本运行所需的识别或配置资源”处理。
