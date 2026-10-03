
/************************ logout.js ************************/

let enableLog = settings.enableLog;

// 打印日志
function logout(text, filename) {
    if (logout.text === void 0) logout.text = text;
    else logout.text = logout.text + "\n" + text;
    if (filename) {// 写文件仅支持格式 .txt, .json, .log, .csv, .xml, .html, .css
        for (let i = 0; i < 100 && !file.writeTextSync(filename, logout.text); ++i);
        if (logout.last != logout.text) {
            if (enableLog) {
                const info = logout.text.split("\n");
                for (let i = 0; i < info.length; ++i) log.info(info[i]);
            }
            logout.last = logout.text;
        }
        logout.text = void 0;
    }
}

/************************ relics.js ************************/

// 所有词条名称
const targetKeywords = [
    "生命值", "攻击力", "防御力", "元素精通",// 0-3
    "元素充能效率", "暴击率", "暴击伤害",// 4-6
    "治疗加成", "物理伤害加成", "火元素伤害加成",// 7-9
    "雷元素伤害加成", "水元素伤害加成", "草元素伤害加成",// 10-12
    "风元素伤害加成", "岩元素伤害加成", "冰元素伤害加成" // 13-15
];

// 圣遗物部件名称
const targetPartNames = ["生之花", "死之羽", "时之沙", "空之杯", "理之冠"];

class Relics {
    /* 同等级五星与四星圣遗物主属性之比 10/9, 同点数副属性之比 5/4 */
    constructor() {
        this.main = -1;// 主属性 index
        this.level = -1;// 等级
        this.quality = -1;// 星级
        this.part = -1;// 部件 index
        this.name = "";// 套装名称
        this.subAttr = [];// 副属性 index
        this.subValue = [];// 副属性值
        this.subPoints = [];// 副属性点数
        this.subCounts = [];// 副属性加强次数
    }
    set_main(str) {
        for (let i = 0; i < targetKeywords.length; ++i) {
            if (str.includes(targetKeywords[i])) {
                this.main = i;
                break;
            }
        }
    }
    set_level(lvl) {
        this.level = lvl;
    }
    set_quality(qt) {
        this.quality = qt;
    }
    set_part(str) {
        for (let i = 0; i < targetPartNames.length; ++i) {
            if (str.includes(targetPartNames[i])) {
                this.part = i;
                break;
            }
        }
    }
    set_name(str) {
        this.name = str.replace(/[^\u4E00-\u9FA5]/g, '');
    }
    set_subAttr(...attrs) {
        if (attrs.length > 4) throw new Error("副属性解析参数错误");
        for (let i = 0; i < 4; ++i) {
            if (!attrs[i]) {
                this.subAttr[i] = -1;
                this.subValue[i] = 0;
                continue;
            }
            let id = 0;
            for (; id < targetKeywords.length; ++id) {
                if (attrs[i].includes(targetKeywords[id])) break;
            }
            if (id >= targetKeywords.length) {
                this.subAttr[i] = -1;
                this.subValue[i] = 0;
                continue;
            }
            if (id < 3 && !attrs[i].includes("%")) id += targetKeywords.length;
            this.subAttr[i] = id;
            if (!attrs[i].includes("待激活")) {
                const strval = attrs[i].match(/\d*\.?\d+/);
                if (!strval) throw new Error("副属性数值解析错误");
                this.subValue[i] = parseFloat(strval[0]);
            }
            else this.subValue[i] = 0;
        }
    }
    get_mainAttr() {// 由于数值精度, 可能计算不准确
        if (this.main == -1) return null;
        let start, end;
        if (this.part == 0) {// 生之花
            start = (this.quality == 5 ? 717 : 645);
            end = (this.quality == 5 ? 4780 : 4303);
            return "生命值 " + Math.round(start + (end - start) / 20.0 * this.level);
        }
        if (this.part == 1) {// 死之羽
            start = (this.quality == 5 ? 47 : 42);
            end = (this.quality == 5 ? 311 : 280);
            return "攻击力 " + Math.round(start + (end - start) / 20.0 * this.level);
        }
        switch (this.main) {
        case 0:// 生命百分比
        case 1:// 攻击百分比
        case 9:// 火元素伤害加成
        case 10:// 雷元素伤害加成
        case 11:// 水元素伤害加成
        case 12:// 草元素伤害加成
        case 13:// 风元素伤害加成
        case 14:// 岩元素伤害加成
        case 15:// 冰元素伤害加成
            start = (this.quality == 5 ? 7.0 : 6.3);
            end = (this.quality == 5 ? 46.6 : 41.9);
            break;
        case 2:// 防御百分比
        case 8:// 物理伤害加成
            start = (this.quality == 5 ? 8.7 : 7.9);
            end = (this.quality == 5 ? 58.3 : 52.4);
            break;
        case 3:// 元素精通
            start = (this.quality == 5 ? 28 : 25.2);
            end = (this.quality == 5 ? 186.5 : 167.8);
            break;
        case 4:// 元素充能效率
            start = (this.quality == 5 ? 7.8 : 7.0);
            end = (this.quality == 5 ? 51.8 : 46.6);
            break;
        case 5:// 暴击率
            start = (this.quality == 5 ? 4.7 : 4.2);
            end = (this.quality == 5 ? 31.1 : 28.0);
            break;
        case 6:// 暴击伤害
            start = (this.quality == 5 ? 9.3 : 8.4);
            end = (this.quality == 5 ? 62.2 : 55.9);
            break;
        case 7:// 治疗加成
            start = (this.quality == 5 ? 5.4 : 4.8);
            end = (this.quality == 5 ? 35.9 : 32.3);
            break;
        default:
            throw new Error("圣遗物主属性错误");
        }
        const value = start + (end - start) / 20.0 * this.level;
        if (this.main == 3) return "元素精通 " + Math.round(value);
        return targetKeywords[this.main] + " " + value.toFixed(1) + "%";
    }

    make_point() {
        // 计算所有副属性的点数
        for (let i = 0; i < 4; ++i) {
            let point, id = this.subAttr[i];
            if (id == -1) {
                this.subPoints[i] = 0;
                continue;
            }
            switch (id) {
            case (targetKeywords.length):// 生命值
                point = 29.8444;// * 2.2533;
                break;
            case (targetKeywords.length + 1):// 攻击力
                point = 1.9430;// * 2.4300;
                break;
            case (targetKeywords.length + 2):// 防御力
                point = 2.3316;// * 2.2468;
                break;
            case 3:// 元素精通
                point = 2.3316;
                break;
            case 0:// 生命百分比
            case 1:// 攻击百分比
                point = 0.5829;
                break;
            case 2:// 防御百分比
                point = 0.7286;
                break;
            case 4:// 元素充能效率
                point = 0.6477;
                break;
            case 5:// 暴击率
                point = 0.3886;
                break;
            case 6:// 暴击伤害
                point = 0.7772;
                break;
            default:
                throw new Error("圣遗物副属性错误");
            }
            if (this.quality != 5) point *= 0.8;// 若四星圣遗物则都乘以 0.8
            this.subPoints[i] = this.subValue[i] / point;
        }
        // 计算所有副属性的词条数(计算不可能完全准确因而总词条数可能比实际多一个)
        let sum = 0, allcounts = Math.trunc(this.level / 4) + (this.quality - 1);
        for (let i = 0; i < 4; ++i) {
            let points = this.subPoints[i];
            if (points == 0) {
                this.subCounts[i] = 0;
                continue;
            }
            this.subCounts[i] = -1;// 缺省未知词条数
            if (points < 20.5) this.subCounts[i] = (points < 12 ? 1 : 2);
            else if (points < 27.9) this.subCounts[i] = 3;
            else if (this.quality == 5) {
                if (points > 30.1 && points < 34.9) this.subCounts[i] = 4;
                else if (points > 40.1 && points < 41.9) this.subCounts[i] = 5;
                else if (points > 50.1) this.subCounts[i] = 6;
            }
            else if (points > 30.1) this.subCounts[i] = 4;
            if (this.subCounts[i] != -1) sum += this.subCounts[i];
            else sum |= 128;
        }
        if (sum > 128) {
            sum = allcounts - (sum - 128);// 未确定的词条数
            const id = this.subCounts.indexOf(-1);
            if (this.quality == 5) {// 五星圣遗物需猜测词条数
                const nid = this.subCounts.indexOf(-1, id + 1);
                if (nid == -1) {// 仅需处理一个未确定词条
                    this.subCounts[id] = Math.min(sum, Math.trunc(this.subPoints[id] * 0.1434));
                }
                else {// 需处理两个未确定词条
                    this.subCounts[nid] = this.subCounts[id] = 3;
                    if (sum == 7) {
                        if (this.subPoints[id] >= this.subPoints[nid]) this.subCounts[id] = 4;
                        else this.subCounts[nid] = 4;
                    }
                }
            }
            else {// 四星圣遗物基本可确定
                this.subCounts[id] = sum;//(sum < 4 || this.subPoints[id] < 29 ? 3 : 4);
            }
        }
    }

    /* 获取副属性总点数 */
    getAttrPoints() {
        //if (this.subPoints.length == 0) this.make_point();
        return this.subPoints[0] + this.subPoints[1] + this.subPoints[2] + this.subPoints[3];
    }

    /* 获取副属性总词条数(对于已强化的圣遗物可能不准确) */
    getAttrCounts() {
        //if (this.subCounts.length == 0) this.make_point();
        return this.subCounts[0] + this.subCounts[1] + this.subCounts[2] + this.subCounts[3];
    }

    /* 判断是否为初始完全词条圣遗物(对于已强化的圣遗物可能不准确) */
    isDominant() {
        //if (this.subPoints.length == 0) this.make_point();
        return this.getAttrCounts() >= Math.trunc(this.level / 4) + (this.quality - 1);
    }

    /* 打印圣遗物信息 */
    print() {
        if (!this.isDominant()) logout("==== 圣遗物 ====");
        else logout("==== 完全圣遗物 ====");
        logout(this.name + "：" + targetPartNames[this.part] + "，" +
            (this.quality == 5 ? "金" : "紫") + "，等级+" + this.level);
        logout("总点数：" + this.getAttrPoints().toFixed(1) + "，" + "主属性：" + this.get_mainAttr());
        for (let i = 0; i < 4; ++i) {
            if (this.subAttr[i] == -1) continue;
            const val = this.subValue[i];
            if (val == 0) continue;
            let str, id = this.subAttr[i];
            if (id < targetKeywords.length) str = targetKeywords[id];
            else str = targetKeywords[id - targetKeywords.length];
            if (id == 3 || id >= targetKeywords.length) str = str + "+" + Math.round(val);
            else str = str + "+" + val.toFixed(1) + "%";
            logout("副属性" + (i + 1) + "：+" + (this.subCounts[i] - 1) + "次，" + str);
        }
    }
};

/************************ characters.js ************************/

// 词条名称简写
const abbrevKeywords = [
    "生命", "攻击", "防御", "精通",// 0-3
    "充能", "暴击", "暴伤",// 4-6
    "治疗", "物伤", "火伤",// 7-9
    "雷伤", "水伤", "草伤",// 10-12
    "风伤", "岩伤", "冰伤" // 13-15
];

// 单个角色的套装
class Actor {
    constructor(str) {
        if (!str) return;// 支持无参构造
        const actorName = str.match(/^\d+\. *(.*)$/m);// 匹配角色名字
        const weaponRe = /^-   武器：(.*)$/m;
        const relicsRe = /^-   圣遗物：(.*)$/m;
        const mainAttrRe = /^-   圣遗物主词条：(.*)$/m;
        const subAttrRe = /^-   圣遗物副词条：(.*)$/m;
        let result, weapon, relics, mainAttr, subAttr, lvl = 0;
        if ((/^.*；.*；.*$/m).test(str)) lvl = 2;
        else if((/^.*；.*$/m).test(str)) lvl = 1;
        /* 武器 */
        result = str.match(weaponRe);
        if (!result || !result[1]) weapon = ["", "", ""];
        else {
            weapon = result[1].split("；");
            for (let i = weapon.length; i <= lvl; ++i) weapon[i] = weapon[0];
        }
        /* 圣遗物 */
        result = str.match(relicsRe);
        if (!result || !result[1]) relics = ["", "", ""];
        else {
            relics = result[1].split("；");
            for (let i = relics.length; i <= lvl; ++i) relics[i] = relics[0];
        }
        /* 圣遗物主词条 */
        result = str.match(mainAttrRe);
        if (!result || !result[1]) mainAttr = ["", "", ""];
        else {
            mainAttr = result[1].split("；");
            for (let i = mainAttr.length; i <= lvl; ++i) mainAttr[i] = mainAttr[0];
        }
        /* 圣遗物副词条 */
        result = str.match(subAttrRe);
        if (!result || !result[1]) subAttr = ["", "", ""];
        else {
            subAttr = result[1].split("；");
            for (let i = subAttr.length; i <= lvl; ++i) subAttr[i] = subAttr[0];
        }
        // 子配置
        let pos = this, objects = [this];
        for (let i = 0; i < lvl; ++i) {
            pos = pos.next = new Actor();
            objects[i + 1] = pos;
        }
        pos.next = null;
        // 解析配置
        for (let id = 0; id <= lvl; ++id) {
            objects[id].name = actorName[1];// 角色名字
            objects[id].weaponName = weapon[id].split("、");// 武器名称
            objects[id].relicsName = relics[id].split("、");// 圣遗物名称
            objects[id].mainAttr = [(1 << 0), (1 << 1)];// 主属性采取位标志存储
            objects[id].subAttr = [];// 副属性 index
            const mainAttrName = mainAttr[id].split("、");
            for (let i = mainAttrName.length; i < 3; ++i) mainAttrName[i] = mainAttrName[0];
            for (let i = 2; i < 5; ++i) {
                let val = 0, keywords = mainAttrName[i - 2].split("/");
                for (let j = 0; j < keywords.length; ++j) {
                    val |= (1 << abbrevKeywords.indexOf(keywords[j]));
                }
                objects[id].mainAttr[i] = val;
            }
            const keywords = subAttr[id].split("、");
            for (let i = 0; i < keywords.length; ++i) {
                objects[id].subAttr[i] = abbrevKeywords.indexOf(keywords[i]);
            }
        }
    }

    print(index) {
        logout((index + ".").padEnd(3) + " " + this.name);
        logout("");
        logout("-   武器：" + this.weaponName.join("、"));
        logout("-   圣遗物：" + this.relicsName.join("、"));
        const mainAttrName = [];
        for (let i = 2; i < 5; ++i) {
            const attrName = [];
            for (let j = 0; j < abbrevKeywords.length; ++j) {
                if ((1 << j) & this.mainAttr[i]) attrName.push(abbrevKeywords[j]);
            }
            mainAttrName.push(attrName.join("/"));
        }
        logout("-   圣遗物主词条：" + mainAttrName.join("、"));
        const subAttrName = [];
        for (let i = 0; i < this.subAttr.length; ++i) {
            subAttrName.push(abbrevKeywords[this.subAttr[i]]);
        }
        logout("-   圣遗物副词条：" + subAttrName.join("、"));
        logout("");
        if (this.next) this.next.print(index);
    }

    /* 圣遗物是否适合当前角色, 返回适合的配置(Actor类型) */
    getSuitable(relics) {
        do {
            // 套装名称必须匹配
            if (this.relicsName[0] && !this.relicsName.includes(relics.name)) break;
            // 主属性必须匹配
            if (!((1 << relics.main) & this.mainAttr[relics.part])) break;
            // 计算是否包含有效词条
            const hasAttr = [];
            for (let i = 0; i < this.subAttr.length; ++i) {
                if (relics.part >= 2 && this.subAttr[i] == relics.main) continue;
                hasAttr.push(relics.subAttr.indexOf(this.subAttr[i]) != -1);
            }
            // 若初始完全词条且含前两类
            const dominant = relics.isDominant();
            const hasFirst = (hasAttr[0] === void 0 || hasAttr[0]);
            const hasSecond = (hasAttr[1] === void 0 || hasAttr[1]);
            if (dominant && hasFirst && hasSecond) return this;
            // 若有效词条类型多于三种(不占用主词条)或四种(占用主词条)
            if (hasAttr.length > 3) {
                const hasThird = (hasAttr[2] === void 0 || hasAttr[2]);
                const hasFourth = (hasAttr[3] === void 0 || hasAttr[3]);
                if (!dominant) {// 非初始完全词条
                    if (!hasFirst || !hasSecond) break;// 前两类必须都有
                    if (hasThird && hasFourth) return this;// 前四类都有
                    if (!hasThird && !hasFourth) break;// 前四类缺少两类
                    for (let i = 4; i < hasAttr.length; ++i) {
                        if (hasAttr[i]) return this;// 四有效
                    }
                }
                else {// 初始完全词条
                    if (!hasFirst && !hasSecond) break;// 前两类必须有一类
                    if (hasThird && hasFourth) return this;// 前四类有三类
                    if (!hasThird && !hasFourth) break;// 前四类缺少三类
                    for (let i = 4; i < hasAttr.length; ++i) {
                        if (hasAttr[i]) return this;// 三有效
                    }
                }
            }
        } while(false);
        if (!this.next) return null;
        else return this.next.getSuitable(relics);
    }

    /* 圣遗物是否可用于当前角色, 返回适合的配置(Actor类型) */
    getAffable(relics) {
        do {
            // 套装名称必须匹配
            if (this.relicsName[0] && !this.relicsName.includes(relics.name)) break;
            // 主属性必须匹配
            if (!((1 << relics.main) & this.mainAttr[relics.part])) break;
            // 计算是否包含有效词条
            const hasAttr = [];
            for (let i = 0; i < this.subAttr.length; ++i) {
                if (relics.part >= 2 && this.subAttr[i] == relics.main) continue;
                hasAttr.push(relics.subAttr.indexOf(this.subAttr[i]) != -1);
            }
            // 若含前两类词条
            const hasFirst = (hasAttr[0] === void 0 || hasAttr[0]);
            const hasSecond = (hasAttr[1] === void 0 || hasAttr[1]);
            if (hasFirst && hasSecond) return this;
            // 若有效词条类型多于三种(不占用主词条)或四种(占用主词条)
            if (hasAttr.length > 3) {
                const hasThird = (hasAttr[2] === void 0 || hasAttr[2]);
                const hasFourth = (hasAttr[3] === void 0 || hasAttr[3]);
                if (!hasFirst && !hasSecond) break;// 前两类必须有一类
                if (hasThird && hasFourth) return this;// 前四类有三类
                if (!hasThird && !hasFourth) break;// 前四类缺少三类
                for (let i = 4; i < hasAttr.length; ++i) {
                    if (hasAttr[i]) return this;// 三有效
                }
            }
        } while(false);
        if (!this.next) return null;
        else return this.next.getAffable(relics);
    }

    /* 获取圣遗物于当前角色的适用分数 */
    getScore(relics) {
        let ret = this.relicsName.indexOf(relics.name);
        if (ret != -1) {
            if (ret == 0) ret = 2;// 专属套装加两分
            else if (ret > 1) ret = 0;// 非专属套装不加分
        }
        const indexAttr = [];
        for (let i = 0; i < this.subAttr.length; ++i) {// 要排除与主属性相同的副词条
            if (relics.part >= 2 && this.subAttr[i] == relics.main) continue;
            indexAttr.push(relics.subAttr.indexOf(this.subAttr[i]));
        }
        for (let i = 0; i < indexAttr.length; ++i) {
            const id = indexAttr[i];
            if (id == -1) continue;
            if (i < 2) ret += relics.subPoints[id];
            else if (i < 4) ret += relics.subPoints[id] * 0.8;
            else ret += relics.subPoints[id] * 0.56;
            if (relics.subAttr[id] < 3) {// 计算数值生命值、攻击力、防御力
                const nid = relics.subAttr.indexOf(this.subAttr[i] + targetKeywords.length);
                if (nid == -1) continue;
                // 统一将点数除以 2.37 以转为百分比属性点
                if (i < 2) ret += relics.subPoints[nid] * (1.0 * 27 / 64);
                else if (i < 4) ret += relics.subPoints[nid] * (0.8 * 27 / 64);
                else ret += relics.subPoints[nid] * (0.56 * 27 / 64);
            }
        }
        this.score = ret;
        return ret;
    }
};

// 所有角色的套装
class Characters {
    constructor(str) {
        this.actors = [];
        const general = str.match(/1\.  .*\n\n(?:-   .*\n)+\n/g);// 默认模板
        let pos = this.actors[0] = new Actor(general[0]);
        for (let i = 1; i < general.length; ++i) {
            pos = pos.next = new Actor(general[i]);
        }
        const specials = str.match(/\d+\..*\n\n(?:-   .*\n)+\n/g);// 特定角色
        for (let i = general.length; i < specials.length; ++i) {
            this.actors.push(new Actor(specials[i]));
        }
        //enableLog = false;
        //this.print();// 调试信息
        //logout("", "characters.txt");
        //enableLog = settings.enableLog;
    }

    print() {
        for (let i = 0; i < this.actors.length; ++i) this.actors[i].print(i + 1);
    }

    /* 评价圣遗物 */
    evaluate(relics) {
        let text, objects = [];// 首先查找毕业配置
        for (let i = 1; i < this.actors.length; ++i) {// 先跳过默认模板
            const obj = this.actors[i].getSuitable(relics);
            if (obj != null) {
                obj.getScore(relics);
                objects.push(obj);
            }
        }
        objects.sort((x, y) => y.score - x.score);// 评分降序排列
        let obj = this.actors[0].getSuitable(relics);
        if (obj != null) {
            obj.getScore(relics);
            objects.push(obj);// 确保默认模板排在最後
        }
        if (objects.length == 0) {// 尝试查找可用配置
            for (let i = 1; i < this.actors.length; ++i) {// 先跳过默认模板
                const obj = this.actors[i].getAffable(relics);
                if (obj != null) {
                    obj.getScore(relics);
                    objects.push(obj);
                }
            }
            objects.sort((x, y) => y.score - x.score);// 评分降序排列
            let obj = this.actors[0].getAffable(relics);
            if (obj != null) {
                obj.getScore(relics);
                objects.push(obj);// 确保默认模板排在最後
            }
            if (objects.length == 0) {// 没有角色需要此圣遗物
                logout("**这个圣遗物不堪大用啊**");
                return;
            }
            else text = "可用：";
        }
        else text = "适配：";
        /* 打印前六名适配角色 */
        text = text + objects[0].name;
        for (let i = 1; i < 6 && i < objects.length; ++i) {
            text = text + "、" + objects[i].name;
        }
        logout(text);
        /* 打印首个适配角色所需副词条和评分 */
        obj = objects[0];
        text = "词条点(" + obj.score.toFixed(1) + ")：";
        for (let i = 0; i < obj.subAttr.length; ++i) {
            let midstr = "";
            if (relics.subAttr.indexOf(obj.subAttr[i]) != -1) midstr = "*";
            text = text + midstr + abbrevKeywords[obj.subAttr[i]] + midstr + "、";
        }
        logout(text.slice(0, -1));
    }
};

/************************ genshin.js ************************/

// 辅助函数：检查圣遗物品质（使用模板匹配）
function checkQuality(image, templateObj, x, y, w, h) {
    const crop = image.DeriveCrop(x, y, w, h);
    const matchResult = crop.Find(templateObj);
    const ret = !matchResult.IsEmpty();
    matchResult.Dispose();
    crop.Dispose();
    return ret;
}

// 辅助函数：检查圣遗物等级（使用模板匹配，因为OCR识别不准确）
function checkLevel(image, templateObjs, x, y, w, h) {
    const crop = image.DeriveCrop(x, y, w, h);
    let ret = 0;
    let res = crop.Find(templateObjs[ret]);
    if (res.IsEmpty()) {// 尝试两遍
        ret = 20;
        let i = 0;
        while (true) {
            res.Dispose();
            res = crop.Find(templateObjs[ret]);
            if (!res.IsEmpty()) break;
            if (--ret < 0) {
                if (++i >= 2) break;
                ret = 20;
            }
        }
    }
    res.Dispose();
    crop.Dispose();
    return ret;
}

// 辅助函数：读取指定区域的文本内容（使用OCR识别）
function readTextRegion(image, KeywordObj) {
    const textResult = image.Find(KeywordObj);
    const ret = textResult.Text;
    textResult.Dispose();
    return ret;
}

function autoZoom(x, y, w, h) {
    /* 注意, BetterGI 截图强制转为 1080P, 这里不用缩放 */
    const ratio = 1;//genshin.scaleTo1080PRatio;
    return [x * ratio, y * ratio, w * ratio, h * ratio];
}

function readImageAutoZoom(path, width, height) {
    const ratio = 1;//genshin.scaleTo1080PRatio;
    return file.ReadImageMatWithResizeSync(path, width * ratio, height * ratio);
}

function readTemplate() {
    const template = [];
    for (let i = 0; i <= 20; ++i) {
        template[i] = readImageAutoZoom("assets/" + i.toFixed(0) + ".png", 47, 21);
    }
    template[21] = readImageAutoZoom("assets/star.png", 28, 26);
    return template;
}

function freeTemplate(template) {
    for (let i = 0; i <= 21; ++i) template[i].Dispose();
}

// 入口函数
(async function () {
    const characters = new Characters(file.readTextSync("角色一览.md"));
    const template = readTemplate();
    const templateQualityObj = RecognitionObject.TemplateMatch(template[21]);
    const templateLevelObj = [];
    for (let i = 0; i <= 20; ++i) {
        let tempObj = RecognitionObject.TemplateMatch(template[i]);
        tempObj.Threshold = 0.91;// 至少 0.91
        //tempObj.InitTemplate();// 这个不需要
        templateLevelObj[i] = tempObj;
    }

    const backpackPartNameObj = RecognitionObject.Ocr(...autoZoom(1320, 180, 90, 40));
    const backpackMainAttrObj = RecognitionObject.Ocr(...autoZoom(1320, 268, 180, 32));
    const backpackSuitNameObj = RecognitionObject.Ocr(...autoZoom(1320, 630, 240, 35));
    const backpackSubAttrObj1 = RecognitionObject.Ocr(...autoZoom(1352, 470, 368, 40));
    const backpackSubAttrObj2 = RecognitionObject.Ocr(...autoZoom(1352, 510, 368, 40));
    const backpackSubAttrObj3 = RecognitionObject.Ocr(...autoZoom(1352, 550, 368, 40));
    const backpackSubAttrObj4 = RecognitionObject.Ocr(...autoZoom(1352, 590, 368, 40));
    // 祝圣之霜定义的圣遗物, 坐标轴需下移 38px
    const ebackpackSuitNameObj = RecognitionObject.Ocr(...autoZoom(1320, 630 + 38, 240, 35));
    const ebackpackSubAttrObj1 = RecognitionObject.Ocr(...autoZoom(1352, 470 + 38, 368, 40));
    const ebackpackSubAttrObj2 = RecognitionObject.Ocr(...autoZoom(1352, 510 + 38, 368, 40));
    const ebackpackSubAttrObj3 = RecognitionObject.Ocr(...autoZoom(1352, 550 + 38, 368, 40));
    const ebackpackSubAttrObj4 = RecognitionObject.Ocr(...autoZoom(1352, 590 + 38, 368, 40));

    const characterSuitNameObj = RecognitionObject.Ocr(...autoZoom(1458, 486, 242, 32));
    const characterPartNameObj = RecognitionObject.Ocr(...autoZoom(1458, 172, 90, 30));
    const characterMainAttrObj = RecognitionObject.Ocr(...autoZoom(1466, 214, 214, 38));
    const characterSubAttrObj1 = RecognitionObject.Ocr(...autoZoom(1480, 352, 368, 27));
    const characterSubAttrObj2 = RecognitionObject.Ocr(...autoZoom(1480, 385, 368, 27));
    const characterSubAttrObj3 = RecognitionObject.Ocr(...autoZoom(1480, 419, 368, 27));
    const characterSubAttrObj4 = RecognitionObject.Ocr(...autoZoom(1480, 453, 368, 27));

    while (true) {
        // 每次分析耗时约 100ms, 等待约 200ms
        await sleep(200);
        // 捕获游戏区域图像
        const gameImage = captureGameRegion();
        if (gameImage.IsEmpty()) {
            log.error("无法捕获游戏画面");
            break;
        }
        try {
            // 尝试背包界面匹配主词条
            let mainResult = gameImage.Find(backpackMainAttrObj);
            const relics = new Relics();
            if (!mainResult.IsEmpty()) {
                relics.set_main(mainResult.Text);
                if (relics.main != -1) {
                    // 背包界面属性识别
                    let name, part, quality, level, attr1, attr2, attr3, attr4;
                    part = readTextRegion(gameImage, backpackPartNameObj);
                    if (checkQuality(gameImage, templateQualityObj, ...autoZoom(1468, 356, 32, 32)))
                        quality = 5;
                    else quality = 4;
                    level = checkLevel(gameImage, templateLevelObj, ...autoZoom(1338, 429, 55, 27));
                    if (level != -1) {
                        name = readTextRegion(gameImage, backpackSuitNameObj);
                        attr1 = readTextRegion(gameImage, backpackSubAttrObj1);
                        attr2 = readTextRegion(gameImage, backpackSubAttrObj2);
                        attr3 = readTextRegion(gameImage, backpackSubAttrObj3);
                        attr4 = readTextRegion(gameImage, backpackSubAttrObj4);
                    }
                    else {
                        level = checkLevel(gameImage, templateLevelObj, ...autoZoom(1338, 429 + 38, 55, 27));
                        name = readTextRegion(gameImage, ebackpackSuitNameObj);
                        attr1 = readTextRegion(gameImage, ebackpackSubAttrObj1);
                        attr2 = readTextRegion(gameImage, ebackpackSubAttrObj2);
                        attr3 = readTextRegion(gameImage, ebackpackSubAttrObj3);
                        attr4 = readTextRegion(gameImage, ebackpackSubAttrObj4);
                    }
                    relics.set_name(name);
                    relics.set_part(part);
                    relics.set_quality(quality);
                    relics.set_level(level);
                    relics.set_subAttr(attr1, attr2, attr3, attr4);
                }
            } else {
                mainResult.Dispose();
                // 尝试角色界面匹配主词条
                mainResult = gameImage.Find(characterMainAttrObj);
                if (!mainResult.IsEmpty()) {
                    relics.set_main(mainResult.Text);
                    if (relics.main != -1) {
                        // 角色界面属性识别
                        relics.set_level(checkLevel(gameImage, templateLevelObj, ...autoZoom(1465, 310, 56, 28)));
                        relics.set_quality(checkQuality(gameImage, templateQualityObj, ...autoZoom(1596, 265, 32, 32)) ? 5 : 4);
                        relics.set_part(readTextRegion(gameImage, characterPartNameObj));
                        relics.set_name(readTextRegion(gameImage, characterSuitNameObj));
                        relics.set_subAttr(
                            readTextRegion(gameImage, characterSubAttrObj1),
                            readTextRegion(gameImage, characterSubAttrObj2),
                            readTextRegion(gameImage, characterSubAttrObj3),
                            readTextRegion(gameImage, characterSubAttrObj4)
                        );
                    }
                }
            }
            mainResult.Dispose();
            /* 分析结果 */
            if (relics.main != -1) {
                relics.make_point();// 计算副属性点数
                relics.print();// 打印圣遗物信息
                characters.evaluate(relics);// 评价圣遗物
                logout("----------------", "overlay.txt");
            }
        } catch (error) {
            log.error(`处理失败: ${error.message}`);
        }
        finally {
            gameImage.Dispose();
        }
    }
    freeTemplate(template);
})();
