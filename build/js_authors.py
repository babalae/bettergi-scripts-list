import os
import sys
import json

# 获取配置文件路径（和脚本在同一目录）
script_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(script_dir, "author_config.json")

# 获取要处理的文件夹路径
if len(sys.argv) < 2:
    print("❌ 用法：python js_authors.py <JSON目录路径>")
    sys.exit(1)

folder_path = sys.argv[1]

if not os.path.exists(folder_path):
    print(f"❌ JSON目录不存在：{folder_path}")
    sys.exit(1)
if not os.path.exists(config_path):
    print(f"❌ 配置文件不存在：{config_path}")
    sys.exit(1)

# 加载配置
try:
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
except Exception as e:
    print(f"❌ 配置文件加载失败：{e}")
    sys.exit(1)

author_rename = config.get("rename", {})
author_links = config.get("links", {})

print(f"🚀 启动，处理目录：{folder_path}")
count_total = 0
count_modified = 0

for root, dirs, files in os.walk(folder_path):
    for filename in files:
        if filename.endswith("manifest.json"):
            count_total += 1
            file_path = os.path.join(root, filename)
            print(f"\n🔍 处理文件：{file_path}")

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                print(f"❌ 解析失败：{e}")
                continue

            # info = data.get("info")
            # if not isinstance(info, dict):
            #     print("⚠️ 缺少 info 字段")
            #     continue

            author_field = data.get("authors")
            if author_field is None:
                print("⚠️ 缺少 authors 字段")
                continue

            modified = False

            # 字符串格式处理
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

            # 列表格式处理
            elif isinstance(author_field, list):
                for author_obj in author_field:
                    if not isinstance(author_obj, dict):
                        continue
                    name = author_obj.get("name")
                    if not name:
                        continue
                    new_name = author_rename.get(name, name)
                    if name != new_name:
                        author_obj["name"] = new_name
                        modified = True
                        print(f"📝 重命名：{name} → {new_name}")

                    # 统一链接字段名
                    existing_link = author_obj.pop("link", None) or author_obj.pop("url", None) or author_obj.get("links")
                    if new_name in author_links:
                        if author_obj.get("links") != author_links[new_name]:
                            author_obj["links"] = author_links[new_name]
                            modified = True
                            print(f"🔧 更新链接：{new_name} → {author_links[new_name]}")
                    elif "links" not in author_obj and existing_link:
                        author_obj["links"] = existing_link
                        modified = True
                        print(f"🔄 标准化已有链接字段为 links → {existing_link}")

            if modified:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                count_modified += 1
                print("✅ 写入完成")
            else:
                print("⏭️ 无需修改")

print(f"\n🎉 处理完成：共 {count_total} 个 JSON 文件，修改了 {count_modified} 个")
