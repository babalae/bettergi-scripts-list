// ============================================================
// GOOD v3 Format Constants — Chinese to English Key Mappings
// ============================================================

// --- Stat Keys ---
// Maps Chinese stat names to GOOD stat keys.
// For "生命值", "攻击力", "防御力": use "_" suffix for percent, flat otherwise.
var STAT_KEY_MAP = {
    "生命值": { flat: "hp", percent: "hp_" },
    "攻击力": { flat: "atk", percent: "atk_" },
    "防御力": { flat: "def", percent: "def_" },
    "元素精通": "eleMas",
    "元素充能效率": "enerRech_",
    "暴击率": "critRate_",
    "暴击伤害": "critDMG_",
    "治疗加成": "heal_",
    "物理伤害加成": "physical_dmg_",
    "火元素伤害加成": "pyro_dmg_",
    "雷元素伤害加成": "electro_dmg_",
    "水元素伤害加成": "hydro_dmg_",
    "草元素伤害加成": "dendro_dmg_",
    "风元素伤害加成": "anemo_dmg_",
    "岩元素伤害加成": "geo_dmg_",
    "冰元素伤害加成": "cryo_dmg_"
};

// All stat name strings for OCR matching (ordered by length descending for greedy match)
var STAT_NAMES = [
    "物理伤害加成", "火元素伤害加成", "雷元素伤害加成", "水元素伤害加成",
    "草元素伤害加成", "风元素伤害加成", "岩元素伤害加成", "冰元素伤害加成",
    "元素充能效率", "元素精通", "暴击伤害", "暴击率", "治疗加成",
    "生命值", "攻击力", "防御力"
];

// --- Artifact Slot Keys ---
var SLOT_KEY_MAP = {
    "生之花": "flower",
    "死之羽": "plume",
    "时之沙": "sands",
    "空之杯": "goblet",
    "理之冠": "circlet"
};

// --- Artifact Set Keys (Chinese → GOOD PascalCase) ---
var ARTIFACT_SET_MAP = {
    // 1-star
    "祈祷": "PrayersForDestiny",
    // 3-star sets
    "冒险家": "Adventurer",
    "幸运儿": "LuckyDog",
    "游医": "TravelingDoctor",
    // 4-star sets
    "战狂": "Berserker",
    "勇士之心": "BraveHeart",
    "守护之心": "DefendersWill",
    "教官": "Instructor",
    "武人": "MartialArtist",
    "流放者": "TheExile",
    "赌徒": "Gambler",
    "学士": "Scholar",
    "奇迹": "TinyMiracle",
    "行者之心": "ResolutionOfSojourner",
    "祭水之人": "PrayersForWisdom",
    "祭火之人": "PrayersForIllumination",
    "祭雷之人": "PrayersToSpringtime",
    "祭冰之人": "PrayersForDestiny",
    // 5-star sets
    "角斗士的终幕礼": "GladiatorsFinale",
    "流浪大地的乐团": "WanderersTroupe",
    "炽烈的炎之魔女": "CrimsonWitchOfFlames",
    "如雷的盛怒": "ThunderingFury",
    "翠绿之影": "ViridescentVenerer",
    "被怜爱的少女": "MaidenBeloved",
    "染血的骑士道": "BloodstainedChivalry",
    "悠古的磐岩": "ArchaicPetra",
    "逆飞的流星": "RetracingBolide",
    "平息鸣雷的尊者": "Thundersoother",
    "渡过烈火的贤人": "Lavawalker",
    "冰风迷途的勇士": "BlizzardStrayer",
    "沉沦之心": "HeartOfDepth",
    "千岩牢固": "TenacityOfTheMillelith",
    "苍白之火": "PaleFlame",
    "追忆之注连": "ShimenawasReminiscence",
    "绝缘之旗印": "EmblemOfSeveredFate",
    "华馆梦醒形骸记": "HuskOfOpulentDreams",
    "海染砗磲": "OceanHuedClam",
    "辰砂往生录": "VermillionHereafter",
    "来歆余响": "EchoesOfAnOffering",
    "深林的记忆": "DeepwoodMemories",
    "饰金之梦": "GildedDreams",
    "沙上楼阁史话": "DesertPavilionChronicle",
    "乐园遗落之花": "FlowerOfParadiseLost",
    "水仙之梦": "NymphsDream",
    "花海甘露之光": "VourukashasGlow",
    "昔日宗室之仪": "NoblesseOblige",
    "黄金剧团": "GoldenTroupe",
    "昔时之歌": "SongOfDaysPast",
    "回声之林夜话": "NighttimeWhispersInTheEchoingWoods",
    "未竟的遐思": "UnfinishedReverie",
    "谐律异想断章": "FragmentOfHarmonicWhimsy",
    "烬城勇者绘卷": "ScrollOfTheHeroOfCinderCity",
    "黑曜秘典": "ObsidianCodex",
    "逐影猎人": "MarechausseeHunter",
    "长夜之誓": "LongNightsOath",
    "穹境示现之夜": "NightOfTheSkysUnveiling",
    "纺月的夜歌": "SilkenMoonsSerenade",
    "深廊终曲": "FinaleOfTheDeepGalleries",
    "朝露旦暮之歌": "AubadeOfMorningstarAndMoon",
    "烈风中雕刻之日": "ADayCarvedFromRisingWinds",

    // Additional aliases for OCR fuzzy match
    "宗室": "NoblesseOblige"
};

// Rarity classification for artifact sets
var STAR_3_SETS = ["Adventurer", "LuckyDog", "TravelingDoctor"];
var STAR_4_SETS = [
    "Berserker", "BraveHeart", "DefendersWill", "Instructor", "MartialArtist",
    "TheExile", "Gambler", "Scholar", "TinyMiracle", "ResolutionOfSojourner",
    "PrayersForWisdom", "PrayersForIllumination", "PrayersToSpringtime", "PrayersForDestiny"
];

// --- Character Name Keys (Chinese → GOOD PascalCase) ---
var CHARACTER_NAME_MAP = {
    // Mondstadt
    "旅行者": "Traveler",
    "琴": "Jean",
    "安柏": "Amber",
    "丽莎": "Lisa",
    "凯亚": "Kaeya",
    "芭芭拉": "Barbara",
    "迪卢克": "Diluc",
    "雷泽": "Razor",
    "温迪": "Venti",
    "可莉": "Klee",
    "班尼特": "Bennett",
    "菲谢尔": "Fischl",
    "砂糖": "Sucrose",
    "诺艾尔": "Noelle",
    "莫娜": "Mona",
    "迪奥娜": "Diona",
    "阿贝多": "Albedo",
    "罗莎莉亚": "Rosaria",
    "优菈": "Eula",
    "米卡": "Mika",
    "杜林": "Durin",
    "雅珂达": "Jahoda",

    // Liyue
    "重云": "Chongyun",
    "行秋": "Xingqiu",
    "北斗": "Beidou",
    "凝光": "Ningguang",
    "香菱": "Xiangling",
    "刻晴": "Keqing",
    "七七": "Qiqi",
    "钟离": "Zhongli",
    "甘雨": "Ganyu",
    "魈": "Xiao",
    "胡桃": "HuTao",
    "辛焱": "Xinyan",
    "烟绯": "Yanfei",
    "云堇": "YunJin",
    "申鹤": "Shenhe",
    "夜兰": "Yelan",
    "瑶瑶": "Yaoyao",
    "白术": "Baizhu",
    "嘉明": "Gaming",
    "闲云": "Xianyun",
    "蓝砚": "LanYan",

    // Inazuma
    "神里绫华": "KamisatoAyaka",
    "神里绫人": "KamisatoAyato",
    "枫原万叶": "KaedeharaKazuha",
    "宵宫": "Yoimiya",
    "雷电将军": "RaidenShogun",
    "早柚": "Sayu",
    "九条裟罗": "KujouSara",
    "珊瑚宫心海": "SangonomiyaKokomi",
    "托马": "Thoma",
    "五郎": "Gorou",
    "荒泷一斗": "AratakiItto",
    "八重神子": "YaeMiko",
    "久岐忍": "KukiShinobu",
    "鹿野院平藏": "ShikanoinHeizou",
    "绮良良": "Kirara",
    "千织": "Chiori",
    "梦见月瑞希": "YumemizukiMizuki",

    // Sumeru
    "提纳里": "Tighnari",
    "柯莱": "Collei",
    "多莉": "Dori",
    "赛诺": "Cyno",
    "坎蒂丝": "Candace",
    "纳西妲": "Nahida",
    "莱依拉": "Layla",
    "流浪者": "Wanderer",
    "珐露珊": "Faruzan",
    "艾尔海森": "Alhaitham",
    "迪希雅": "Dehya",
    "卡维": "Kaveh",
    "赛索斯": "Sethos",

    // Fontaine
    "林尼": "Lyney",
    "琳妮特": "Lynette",
    "菲米尼": "Freminet",
    "那维莱特": "Neuvillette",
    "芙宁娜": "Furina",
    "夏洛蒂": "Charlotte",
    "莱欧斯利": "Wriothesley",
    "娜维娅": "Navia",
    "夏沃蕾": "Chevreuse",
    "希格雯": "Sigewinne",
    "克洛琳德": "Clorinde",
    "艾梅莉埃": "Emilie",
    "阿蕾奇诺": "Arlecchino",
    "爱可菲": "Escoffier",

    // Natlan
    "卡齐娜": "Kachina",
    "基尼奇": "Kinich",
    "玛拉妮": "Mualani",
    "希诺宁": "Xilonen",
    "恰斯卡": "Chasca",
    "欧洛伦": "Ororon",
    "玛薇卡": "Mavuika",
    "茜特菈莉": "Citlali",
    "伊安珊": "Iansan",
    "瓦雷莎": "Varesa",
    "伊法": "Ifa",

    // Snezhnaya
    "达达利亚": "Tartaglia",

    // Nod-Krai
    "丝柯克": "Skirk",

    // Other
    "埃洛伊": "Aloy"
};

// --- Weapon Name Keys (Chinese → GOOD PascalCase) ---
var WEAPON_NAME_MAP = {
    // === Swords ===
    "无锋剑": "DullBlade",
    "银剑": "SilverSword",
    "冷刃": "CoolSteel",
    "暗铁剑": "DarkIronSword",
    "飞天御剑": "SkyriderSword",
    "旅行剑": "TravelersHandySword",
    "黎明神剑": "HarbingerOfDawn",
    "吃虎鱼刀": "FilletBlade",
    "铁蜂刺": "IronSting",
    "笛剑": "TheFlute",
    "西风剑": "FavoniusSword",
    "祭礼剑": "SacrificialSword",
    "匣里龙吟": "LionsRoar",
    "试作斩岩": "PrototypeRancour",
    "黑岩长剑": "BlackcliffLongsword",
    "宗室长剑": "RoyalLongsword",
    "暗巷闪光": "TheAlleyFlash",
    "黑剑": "TheBlackSword",
    "降临之剑": "SwordOfDescension",
    "腐殖之剑": "FesteringDesire",
    "天目影打刀": "AmenomaKageuchi",
    "辰砂之纺锤": "CinnabarSpindle",
    "笼钓瓶一心": "KagotsurubeIsshin",
    "原木刀": "SapwoodBlade",
    "西福斯的月光": "XiphosMoonlight",
    "东花坊时雨": "ToukabouShigure",
    "狼牙": "WolfFang",
    "海渊终曲": "FinaleOfTheDeep",
    "芙洛洛伦之剑": "FluteOfEzpitzal",
    "船坞长剑": "TheDockhandsAssistant",
    "灰河渡手": "FleuveCendreFerryman",
    "静谧之曲": "SerenitysCall",
    "硬骨": "SturdyBone",
    "裁断": "Absolution",
    "有乐御簾切": "UrakuMisugiri",
    "天空之刃": "SkywardBlade",
    "风鹰剑": "AquilaFavonia",
    "磐岩结绿": "PrimordialJadeCutter",
    "斫峰之刃": "SummitShaper",
    "苍古自由之誓": "FreedomSworn",
    "雾切之回光": "MistsplitterReforged",
    "波乱月白经津": "HaranGeppakuFutsu",
    "圣显之钥": "KeyOfKhajNisut",
    "萃光的裁叶刀": "LightOfFoliarIncision",
    "静水流涌之辉": "SplendorOfTranquilWaters",
    "岩峰巡歌": "PeakPatrolSong",
    "赦罪": "Absolution",
    "碧落之珑": "Azurelight",
    "映月珠光": "LightbearingMoonshard",
    "织月缀花之曦": "MoonweaversDawn",

    // Edge-case: 以理书之诡辩 was renamed
    "以理书之诡辩": "SwordOfNarzissenkreuz",
    "噬人哀歌": "CalamityOfEshu",

    // === Claymores ===
    "训练大剑": "WasterGreatsword",
    "佣兵重剑": "OldMercsPal",
    "铁影阔剑": "FerrousShadow",
    "飞天大御剑": "SkyriderGreatsword",
    "沐浴龙血的剑": "BloodtaintedGreatsword",
    "白铁大剑": "WhiteIronGreatsword",
    "以攻代守": "TheBell",
    "钟剑": "TheBell",
    "雨裁": "Rainslasher",
    "祭礼大剑": "SacrificialGreatsword",
    "西风大剑": "FavoniusGreatsword",
    "试作古华": "PrototypeArchaic",
    "黑岩斩刀": "BlackcliffSlasher",
    "宗室大剑": "RoyalGreatsword",
    "白影剑": "Whiteblind",
    "螭骨剑": "SerpentSpine",
    "雪葬的星银": "SnowTombedStarsilver",
    "千岩古剑": "LithicBlade",
    "桂木斩长正": "KatsuragikiriNagamasa",
    "衔珠海皇": "LuxuriousSeaLord",
    "玛海菈的水色": "MakhairaAquamarine",
    "森林王器": "ForestRegalia",
    "聊聊棒": "TalkingStick",
    "浪影阔剑": "TidalShadow",
    "便携动力锯": "PortablePowerSaw",
    "「究极霸王超级魔剑」": "UltimateOverlordsMegaMagicSword",
    "究极霸王超级魔剑": "UltimateOverlordsMegaMagicSword",
    "花蕊绽放之时": "MailedFlower",
    "石英大剑": "EarthShaker",
    "硕果钩": "FruitfulHook",
    "万能钥匙": "MasterKey",
    "天空之傲": "SkywardPride",
    "狼的末路": "WolfsGravestone",
    "松籁响起之时": "SongOfBrokenPines",
    "无工之剑": "TheUnforged",
    "赤角石溃杵": "RedhornStonethresher",
    "苇海信标": "BeaconOfTheReedSea",
    "裁决": "Verdict",
    "一千零一个大丰收": "AThousandBlazingSuns",
    "烈阳巨剑": "FlameForgedInsight",
    "山巅之风": "GestOfTheMightyWolf",
    "悬锋山脊": "FangOfTheMountainKing",

    // === Polearms ===
    "新手长枪": "BeginnersProtector",
    "铁尖枪": "IronPoint",
    "白缨枪": "WhiteTassel",
    "黑缨枪": "BlackTassel",
    "钺矛": "Halberd",
    "匣里灭辰": "DragonsBane",
    "流月针": "CrescentPike",
    "试作星镰": "PrototypeStarglitter",
    "西风长枪": "FavoniusLance",
    "宗室猎枪": "RoyalSpear",
    "黑岩刺枪": "BlackcliffPole",
    "决斗之枪": "Deathmatch",
    "千岩长枪": "LithicSpear",
    "龙脊长枪": "DragonspineSpear",
    "喜多院十文字": "KitainCrossSpear",
    "「渔获」": "TheCatch",
    "渔获": "TheCatch",
    "断浪长鳍": "WavebreakersFin",
    "贯月矛": "Moonpiercer",
    "风信之锋": "MissiveWindspear",
    "沙中伟贤的对答": "DialoguesOfTheDesertSages",
    "公义的酬报": "RightfulReward",
    "勘探钻机": "ProspectorsDrill",
    "峡湾长歌": "BalladOfTheFjords",
    "虹的行迹": "FootprintOfTheRainbow",
    "山牢余龙": "MountainBracingBolt",
    "勘探铲": "ProspectorsShovel",
    "裂相缠缚之环": "FracturedHalo",
    "和璞鸢": "PrimordialJadeWingedSpear",
    "天空之脊": "SkywardSpine",
    "贯虹之槊": "VortexVanquisher",
    "护摩之杖": "StaffOfHoma",
    "薙草之稻光": "EngulfingLightning",
    "息灾": "CalamityQueller",
    "赤沙之杖": "StaffOfTheScarletSands",
    "菫色之忆": "CrimsonMoonsSemblance",
    "柔灯挽歌": "LumidouceElegy",
    "苇风拂行之纪": "TamayurateiNoOhanashi",
    "馨香调酿": "SymphonistOfScents",
    "血染遗迹": "BloodsoakedRuins",
    "奉祀之人": "SacrificersStaff",

    // === Bows ===
    "猎弓": "HuntersBow",
    "历练的猎弓": "SeasonedHuntersBow",
    "鸦羽弓": "RavenBow",
    "弹弓": "Slingshot",
    "信使": "Messenger",
    "反曲弓": "RecurveBow",
    "神射手之誓": "SharpshootersOath",
    "绝弦": "TheStringless",
    "西风猎弓": "FavoniusWarbow",
    "祭礼弓": "SacrificialBow",
    "弓藏": "Rust",
    "试作澹月": "PrototypeCrescent",
    "钢轮弓": "CompoundBow",
    "黑岩战弓": "BlackcliffWarbow",
    "宗室长弓": "RoyalBow",
    "苍翠猎弓": "TheViridescentHunt",
    "暗巷猎手": "AlleyHunter",
    "幽夜华尔兹": "MitternachtsWaltz",
    "落霞": "FadingTwilight",
    "破魔之弓": "Hamayumi",
    "掠食者": "Predator",
    "曚云之月": "MouunsMoon",
    "王下近侍": "KingsSquire",
    "竭泽": "EndOfTheLine",
    "鹮穿之喙": "IbisPiercer",
    "烈阳之嗣": "ScionOfTheBlazingSun",
    "静谧之歌": "SongOfStillness",
    "测距规": "RangeGauge",
    "铁骨锁链": "ChainBreaker",
    "缀花钩绳": "SnareHook",
    "云锻": "Cloudforged",
    "花翎鸢": "FlowerWreathedFeathers",
    "风花之颂": "WindblumeOde",
    "终末嗟叹之诗": "ElegyForTheEnd",
    "天空之翼": "SkywardHarp",
    "阿莫斯之弓": "AmosBow",
    "冬极白星": "PolarStar",
    "飞雷之弦振": "ThunderingPulse",
    "猎人之径": "HuntersPath",
    "若水": "AquaSimulacra",
    "最初的大魔术": "TheFirstGreatMagic",
    "白雨心弦": "SilvershowerHeartstrings",
    "破晓编年诗": "TheDaybreakChronicles",
    "寂静离别之序": "SequenceOfSolitude",
    "星鹫赤羽": "AstralVulturesCrimsonPlumage",
    "虹蛇弓": "RainbowSerpentsRainBow",

    // === Catalysts ===
    "学徒笔记": "ApprenticesNotes",
    "口袋魔导书": "PocketGrimoire",
    "魔导绪论": "MagicGuide",
    "讨龙英杰谭": "ThrillingTalesOfDragonSlayers",
    "异世界行记": "OtherworldlyStory",
    "翡玉法球": "EmeraldOrb",
    "甲级宝珏": "TwinNephrite",
    "万国诸海图谱": "MappaMare",
    "流浪乐章": "TheWidsith",
    "祭礼残章": "SacrificialFragments",
    "西风秘典": "FavoniusCodex",
    "试作金珀": "PrototypeAmber",
    "黑岩绯玉": "BlackcliffAgate",
    "宗室秘法录": "RoyalGrimoire",
    "匣里日月": "SolarPearl",
    "暗巷的酒与诗": "WineAndSong",
    "嘟嘟可故事集": "DodocoTales",
    "白辰之环": "HakushinRing",
    "证誓之明瞳": "OathswornEye",
    "流浪的晚星": "WanderingEvenstar",
    "盈满之实": "FruitOfFulfillment",
    "纯水流华": "FlowingPurity",
    "遗祀玉珑": "SacrificialJade",
    "万世流涌大典": "TomeOfTheEternalFlow",
    "驭浪的祈望": "WaveridingWhirl",
    "乘浪的回忆": "SurfsUp",
    "暖阳赖床记": "SunnyMorningSleepIn",
    "真理的量子计算器": "QuantumCatalyst",
    "黑墨灯笼": "BlackmarrowLantern",
    "环彩的琴弦": "EtherlightSpindlelute",
    "寒露霜锋": "DawningFrost",
    "灰烬饮杯": "AshGravenDrinkingHorn",
    "映虹之环": "RingOfYaxche",
    "冰风迷途": "Frostbearer",
    "忍冬之果": "Frostbearer",
    "天空之卷": "SkywardAtlas",
    "四风原典": "LostPrayerToTheSacredWinds",
    "尘世之锁": "MemoryOfDust",
    "不灭月华": "EverlastingMoonglow",
    "神乐之真意": "KagurasVerity",
    "千夜浮梦": "AThousandFloatingDreams",
    "碧落之珑": "JadefallsSplendor",
    "图莱杜拉的回忆": "TulaytullahsRemembrance",
    "金流监督": "CashflowSupervision",
    "鹤鸣余音": "CranesEchoingCall",
    "万象之锭": "VividNotions",
    "赤月之形": "NightweaversLookingGlass",
    "夜幕降临之曲": "NocturnesCurtainCall",
    "真理之典": "ReliquaryOfTruth",
    "星观的长吟": "StarcallersWatch"
};

// Weapon rarity data (minimum rarity by weapon key category)
// We detect rarity by star icon count in the detail panel
// 1-2 star weapons (not usually needed, but included for completeness)
var WEAPON_1_2_STAR = [
    "DullBlade", "SilverSword", "WasterGreatsword", "OldMercsPal",
    "BeginnersProtector", "IronPoint", "HuntersBow", "SeasonedHuntersBow",
    "ApprenticesNotes", "PocketGrimoire"
];

// --- Level to Ascension Lookup ---
// Given a character/weapon level, determine the maximum possible ascension
// Ascension boundaries: 20→0, 40→1, 50→2, 60→3, 70→4, 80→5, 90→6
function levelToAscension(level) {
    if (level <= 20) return 0;
    if (level <= 40) return 1;
    if (level <= 50) return 2;
    if (level <= 60) return 3;
    if (level <= 70) return 4;
    if (level <= 80) return 5;
    return 6;
}

// --- Helper: Parse a stat from OCR text ---
// Returns { key: "statKey", value: number } or null
function parseStatFromText(text) {
    if (!text || typeof text !== "string") return null;
    text = text.replace(/,/g, "").trim();

    for (var i = 0; i < STAT_NAMES.length; i++) {
        var name = STAT_NAMES[i];
        if (text.indexOf(name) === -1) continue;

        var isInactive = text.indexOf("待激活") !== -1;
        var hasPercent = text.indexOf("%") !== -1;

        // Extract numeric value
        var numMatch = text.match(/[\+\s]([\d]+\.?\d*)/);
        var value = numMatch ? parseFloat(numMatch[1]) : 0;

        var statEntry = STAT_KEY_MAP[name];
        var key;
        if (typeof statEntry === "object") {
            // hp, atk, def — distinguish flat vs percent
            key = hasPercent ? statEntry.percent : statEntry.flat;
        } else {
            key = statEntry;
        }

        return {
            key: key,
            value: isInactive ? 0 : value,
            inactive: isInactive
        };
    }
    return null;
}

// --- Helper: Fuzzy match a string against a map ---
// Returns the best matching key from the map, or null
function fuzzyMatchMap(text, map) {
    if (!text) return null;
    // Clean OCR text: remove non-CJK/non-alphanumeric noise
    var cleaned = text.replace(/[^\u4E00-\u9FFF\u300C\u300Da-zA-Z0-9]/g, "").trim();
    if (!cleaned) return null;

    // Exact match first
    if (map[cleaned] !== undefined) return map[cleaned];

    // Try substring match (OCR may include extra characters)
    var bestMatch = null;
    var bestLen = 0;
    for (var cn in map) {
        if (cleaned.indexOf(cn) !== -1 && cn.length > bestLen) {
            bestMatch = map[cn];
            bestLen = cn.length;
        }
        if (cn.indexOf(cleaned) !== -1 && cleaned.length > bestLen) {
            bestMatch = map[cn];
            bestLen = cleaned.length;
        }
    }
    if (bestMatch) return bestMatch;

    // Levenshtein distance fallback for short strings
    var minDist = Infinity;
    for (var cn2 in map) {
        var dist = levenshtein(cleaned, cn2);
        if (dist < minDist && dist <= Math.max(1, Math.floor(cn2.length * 0.3))) {
            minDist = dist;
            bestMatch = map[cn2];
        }
    }
    return bestMatch;
}

// Simple Levenshtein distance
function levenshtein(a, b) {
    var m = a.length, n = b.length;
    var dp = [];
    for (var i = 0; i <= m; i++) {
        dp[i] = [i];
        for (var j = 1; j <= n; j++) {
            if (i === 0) { dp[i][j] = j; continue; }
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return dp[m][n];
}
