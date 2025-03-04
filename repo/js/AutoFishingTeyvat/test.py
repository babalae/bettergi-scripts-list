# import os
#
# file_path = r"D:\Workplace\BetterGI脚本-追踪-战斗\JS脚本\AutoFishingTeyvat\assets\Pathing"
# file_names = [i.rstrip(".json") for i in os.listdir(file_path)]
# fishes = []
# baits = []
# for each in file_names:
#         msgs = each.split("-")
#
#         p_area = msgs[0]
#         p_type = msgs[1]
#         p_detail = msgs[2]
#         p_fish = msgs[3].split('_')
#         p_bait = msgs[4].split('_')
#         p_spl = msgs[5]
#
#         for i in p_fish:
#                 if i not in fishes:
#                         fishes.append(i)
#         for i in p_bait:
#                 if i not in baits:
#                         baits.append(i)
# print(fishes)
# print(baits)
#

# fish_msg = {
#         '花鳉': {'bait': '果酿饵', 'time': '全天'},
#         '波波心羽鲈': {'bait': '酸桔饵', 'time': '夜晚'},
#         '烘烘心羽鲈': {'bait': '酸桔饵', 'time': '白天'},
#         '维护机关·水域清理者': {'bait': '维护机关频闪诱饵', 'time': '白天'},
#         '维护机关·态势控制者': {'bait': '维护机关频闪诱饵', 'time': '夜晚'},
#         '维护机关·澄金领队型': {'bait': '维护机关频闪诱饵', 'time': '全天'},
#         '海涛斧枪鱼': {'bait': '甘露饵', 'time': '全天'},
#         '维护机关·初始能力型': {'bait': '维护机关频闪诱饵', 'time': '全天'},
#         '维护机关·白金典藏型': {'bait': '维护机关频闪诱饵', 'time': '夜晚'},
#         '吹沙角鲀': {'bait': '甘露饵', 'time': '白天'},
#         '甜甜花鳉': {'bait': '果酿饵', 'time': '全天'},
#         '擒霞客': {'bait': '果酿饵', 'time': '夜晚'},
#         '水晶宴': {'bait': '果酿饵', 'time': '白天'},
#         '斗棘鱼': {'bait': '赤糜饵', 'time': '夜晚'},
#         '炮鲀': {'bait': '飞蝇假饵', 'time': '全天'},
#         '流纹褐蝶鱼': {'bait': '蠕虫假饵', 'time': '白天'},
#         '锖假龙': {'bait': '飞蝇假饵', 'time': '全天'},
#         '金赤假龙': {'bait': '飞蝇假饵', 'time': '全天'},
#         '玉玉心羽鲈': {'bait': '酸桔饵', 'time': '全天'},
#         '赤魔王': {'bait': '赤糜饵', 'time': '白天'},
#         '长生仙': {'bait': '蠕虫假饵', 'time': '白天'},
#         '苦炮鲀': {'bait': '飞蝇假饵', 'time': '全天'},
#         '肺棘鱼': {'bait': '赤糜饵', 'time': '夜晚'},
#         '流纹京紫蝶鱼': {'bait': '蠕虫假饵', 'time': '白天'},
#         '琉璃花鳉': {'bait': '果酿饵', 'time': '全天'},
#         '伪装鲨鲨独角鱼': {'bait': '澄晶果粒饵', 'time': '全天'},
#         '繁花斗士急流鱼': {'bait': '澄晶果粒饵', 'time': '夜晚'},
#         '深潜斗士急流鱼': {'bait': '澄晶果粒饵', 'time': '白天'},
#         '晚霞翻车鲀': {'bait': '澄晶果粒饵', 'time': '夜晚'},
#         '青浪翻车鲀': {'bait': '澄晶果粒饵', 'time': '白天'},
#         '拟似燃素独角鱼': {'bait': '温火饵', 'time': '全天'},
#         '炽岩斗士急流鱼': {'bait': '温火饵', 'time': '全天'},
#         '蓝染花鳉': {'bait': '果酿饵', 'time': '全天'},
#         '鸩棘鱼': {'bait': '赤糜饵', 'time': '夜晚'},
#         '流纹茶蝶鱼': {'bait': '蠕虫假饵', 'time': '白天'},
#         '雪中君': {'bait': '赤糜饵', 'time': '夜晚'},
#         '真果角鲀': {'bait': '甘露饵', 'time': '白天'},
#         '青金斧枪鱼': {'bait': '甘露饵', 'time': '全天'},
#         '暮云角鲀': {'bait': '甘露饵', 'time': '夜晚'},
#         '翡玉斧枪鱼': {'bait': '甘露饵', 'time': '全天'},
#         '沉波蜜桃': {'bait': '甘露饵', 'time': '白天'},
#         '雷鸣仙': {'bait': '蠕虫假饵', 'time': '夜晚'}
#     }
# temp_day = {}
# temp_night = {}
# for each, detail in fish_msg.items():
#     if detail["time"] == "白天":
#         temp_day[each] = detail
#     elif detail["time"] == "夜晚":
#         temp_night[each] = detail
# print(temp_day)
# print(temp_night)

import os


class Tools:
    def __init__(self):
        pass

    @staticmethod
    def output_paths_in_js_code():
        path_gcm = r"D:\Workplace\BetterGI脚本-追踪-战斗\JS脚本\AutoFishingTeyvat\assets\KeyMouseScript"
        path_pathing = r"D:\Workplace\BetterGI脚本-追踪-战斗\JS脚本\AutoFishingTeyvat\assets\Pathing"
        list_pathing = [i.rstrip(".json") for i in os.listdir(path_pathing)]
        list_gcm = [i.rstrip(".json") for i in os.listdir(path_gcm)]
        text_pathing = ""
        text_gcm = ""

        text = """    const path_pathing = [
        {pathing}
    ]
    const path_gcm = [
        {gcm}
    ]"""
        for each in list_pathing:
            if list_pathing.index(each) != len(list_pathing) - 1:
                text_pathing += f"'{each}',\n        "
            else:
                text_pathing += f"'{each}'"
        for each in list_gcm:
            if list_gcm.index(each) != len(list_gcm) - 1:
                text_gcm += f"'{each}',\n        "
            else:
                text_gcm += f"'{each}'"

        print(text.format(pathing=text_pathing, gcm=text_gcm))

    @staticmethod
    def get_fish_and_bait():
        file_path = r"D:\Workplace\BetterGI脚本-追踪-战斗\JS脚本\AutoFishingTeyvat\assets\Pathing"
        file_names = [i.rstrip(".json") for i in os.listdir(file_path)]
        fishes = []
        baits = []
        for each in file_names:
            msgs = each.split("-")

            p_area = msgs[0]
            p_type = msgs[1]
            p_detail = msgs[2]
            p_fish = msgs[3].split('_')
            p_bait = msgs[4].split('_')
            p_spl = msgs[5]

            for i in p_fish:
                if i not in fishes:
                    fishes.append(i)
            for i in p_bait:
                if i not in baits:
                    baits.append(i)
        print(fishes)
        print(baits)


if __name__ == "__main__":
    op = Tools()
    op.get_fish_and_bait()
