import os
import sys
import json

# 指定要处理的文件夹路径
# folder_path = r"C:\Users\ThinkPadE16\Documents\GitHub\bettergi-scripts-list\repo\pathing"  # 修改为你的路径，如 r"C:\Users\..." 或 "./jsons"

# 作者重命名映射：旧名 -> 新名
author_rename = {
    "起个名字好难": "起个名字好难的喵",
}

# 作者映射表：用于自动填入 links
author_links = {
    "秋云": "https://github.com/physligl",
    "起个名字好难的喵": "https://github.com/MisakaAldrich",
    "火山": "https://github.com/RRRR623",
    "mno": "https://github.com/Bedrockx",
    "汐": "https://github.com/jiegedabaobei",
    "Tool_tingsu": "https://github.com/Tooltingsu",
    "吉吉喵": "https://github.com/JJMdzh",
    "曦": "https://github.com/cx05121",
    "ddaodan": "https://github.com/ddaodan",
    "LCB-茶包": "https://github.com/kaedelcb",
    "蜜柑魚": "https://github.com/this-Fish",
    "彩虹QQ人":"https://github.com/KRdingsan",
    "mfkvfhpdx": "https://github.com/mfkvfhpdx",
    "提瓦特钓鱼玳师": "https://github.com/Hijiwos",
    "柒叶子": "https://github.com/5117600049",
    "不瘦五十斤不改名": "https://github.com/PanZic",
    "½": "https://github.com/Traveler07",
    "Patrick-Ze (AyakaMain)": "https://github.com/Patrick-Ze",
    "风埠": "https://github.com/jhkif",
    "jbcaaa":"https://github.com/jbcaaa",
    "johsang":"https://github.com/johsang",
    "寒烟": "https://github.com/214-hanyan",
    "灰林鸮": "https://github.com/Strix-nivicolum",
    "Tim": "https://github.com/Limint",
    "花见木易": "https://github.com/Flower-MUYi",
    "无限不循环": "https://github.com/non-repeating001",
    "wjdsg": "https://gitee.com/wangjian0327/auto-bgi",
    "HZYgrandma": "https://github.com/HZYgrandma",
    "huiyadanli": "https://github.com/huiyadanli",
    "呱呱z": "https://github.com/jidingcai"
}

# 获取命令行参数
if len(sys.argv) < 2:
    print("❌ 请提供要处理的目录路径，例如：")
    print("   python authors.py D:\GitHub\bettergi-scripts-list\repo\pathing")
    sys.exit(1)

folder_path = sys.argv[1]

if not os.path.exists(folder_path):
    print(f"❌ 路径不存在：{folder_path}")
    sys.exit(1)

print(f"🚀 启动，递归处理文件夹：{folder_path}")

count_total = 0
count_modified = 0

for root, dirs, files in os.walk(folder_path):
    for filename in files:
        if filename.endswith("manifest.json"):
            count_total += 1
            file_path = os.path.join(root, filename)
            print(f"\n🔍 正在处理：{file_path}")

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                print(f"❌ JSON 解析失败：{e}")
                continue

            # info = data.get("info")
            # if not isinstance(info, dict):
            #     print("⚠️ 缺少 info 字段或格式错误")
            #     continue

            author_field = data.get("authors")
            if author_field is None:
                print("⚠️ 缺少 author 字段")
                continue

            modified = False

            # 字符串情况（含单人或 & 多人）
            # 情况 1：字符串类型
            if isinstance(author_field, str):
                names = [name.strip() for name in author_field.split("&")]
                new_authors = []
                for name in names:
                    new_name = author_rename.get(name, name)
                    author_obj = {"name": new_name}
                    if new_name in author_links:
                        author_obj["links"] = author_links[new_name]
                    new_authors.append(author_obj)
                data["authors"] = new_authors
                modified = True
                print("✅ 替换为结构化 author")

            # 情况 2：列表类型，检查每个作者对象
            elif isinstance(author_field, list):
                for author_obj in author_field:
                    if not isinstance(author_obj, dict):
                        continue

                    name = author_obj.get("name")
                    if not name:
                        continue

                    # 名字替换
                    new_name = author_rename.get(name, name)
                    if name != new_name:
                        author_obj["name"] = new_name
                        modified = True
                        print(f"📝 重命名：{name} → {new_name}")

                    # 找所有可能字段（link, url, links）
                    existing_link = author_obj.pop("link", None) or author_obj.pop("url", None) or author_obj.get("links")

                    # 如果映射表有 → 使用
                    if new_name in author_links:
                        if author_obj.get("links") != author_links[new_name]:
                            author_obj["links"] = author_links[new_name]
                            modified = True
                            print(f"🔧 更新链接：{new_name} → {author_links[new_name]}")
                    # 否则使用已有字段（如果没有 links）
                    elif "links" not in author_obj and existing_link:
                        author_obj["links"] = existing_link
                        modified = True
                        print(f"🔄 标准化已有链接字段为 links → {existing_link}")

            if modified:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                count_modified += 1
                print("✅ 文件已保存")
            else:
                print("⏭️ 无需修改")

print(f"\n🎉 全部完成：共检查 {count_total} 个文件，修改了 {count_modified} 个文件")