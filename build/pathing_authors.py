import os
import json

def process_json_authors(input_path, verbose=True):
    """
    处理 JSON 文件中的作者信息（支持 author → authors 结构化迁移、作者名重命名和链接统一）
    
    参数：
        input_path (str): 要处理的文件路径或目录路径
        config_path (str): 配置文件路径（默认在脚本同级）
        verbose (bool): 是否打印详细日志信息
        
    返回：
        dict: 包含处理总数和修改数量的统计信息
    """
    result = {
        "total_files": 0,
        "modified_files": 0,
        "errors": []
    }

    # 获取配置文件路径（和脚本在同一目录）
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "author_config.json")

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"路径不存在：{input_path}")
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"配置文件不存在：{config_path}")

    # 加载配置
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except Exception as e:
        raise RuntimeError(f"配置文件加载失败：{e}")

    author_rename = config.get("rename", {})
    author_links = config.get("links", {})

    # 构建待处理文件列表
    file_list = []
    if os.path.isfile(input_path) and input_path.endswith(".json"):
        file_list.append(input_path)
    elif os.path.isdir(input_path):
        for root, dirs, files in os.walk(input_path):
            for filename in files:
                if filename.endswith(".json"):
                    file_list.append(os.path.join(root, filename))
    else:
        raise ValueError("输入路径必须是 .json 文件或目录")

    for file_path in file_list:
        result["total_files"] += 1
        if verbose:
            print(f"\n🔍 处理文件：{file_path}")

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            msg = f"❌ 解析失败：{e}"
            if verbose:
                print(msg)
            result["errors"].append((file_path, str(e)))
            continue

        info = data.get("info")
        if not isinstance(info, dict):
            if verbose:
                print("⚠️ 缺少 info 字段")
            continue

        modified = False
        author_field = info.get("author")

        if author_field is not None:
            if isinstance(author_field, str):
                names = [name.strip() for name in author_field.split("&")]
                new_authors = []
                for name in names:
                    new_name = author_rename.get(name, name)
                    author_obj = {"name": new_name}
                    if new_name in author_links:
                        author_obj["links"] = author_links[new_name]
                    new_authors.append(author_obj)
                data["info"]["authors"] = new_authors
                modified = True
                if verbose:
                    print("✅ 替换为结构化 authors")

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
                        if verbose:
                            print(f"📝 重命名：{name} → {new_name}")

                    existing_link = author_obj.pop("link", None) or author_obj.pop("url", None) or author_obj.get("links")
                    if new_name in author_links:
                        if author_obj.get("links") != author_links[new_name]:
                            author_obj["links"] = author_links[new_name]
                            modified = True
                            if verbose:
                                print(f"🔧 更新链接：{new_name} → {author_links[new_name]}")
                    elif "links" not in author_obj and existing_link:
                        author_obj["links"] = existing_link
                        modified = True
                        if verbose:
                            print(f"🔄 标准化已有链接字段为 links → {existing_link}")

        else:
            authors_field = info.get("authors")
            if isinstance(authors_field, list):
                for author_obj in authors_field:
                    if not isinstance(author_obj, dict):
                        continue
                    name = author_obj.get("name")
                    if not name:
                        continue
                    new_name = author_rename.get(name, name)
                    if name != new_name:
                        author_obj["name"] = new_name
                        modified = True
                        if verbose:
                            print(f"📝 重命名（authors）：{name} → {new_name}")

                    existing_link = author_obj.pop("link", None) or author_obj.pop("url", None) or author_obj.get("links")
                    if new_name in author_links:
                        if author_obj.get("links") != author_links[new_name]:
                            author_obj["links"] = author_links[new_name]
                            modified = True
                            if verbose:
                                print(f"🔧 更新链接（authors）：{new_name} → {author_links[new_name]}")
                    elif "links" not in author_obj and existing_link:
                        author_obj["links"] = existing_link
                        modified = True
                        if verbose:
                            print(f"🔄 标准化已有链接字段为 links → {existing_link}")
            else:
                if verbose:
                    print("⚠️ 缺少 author 字段，且 authors 非标准格式")

        if modified:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            result["modified_files"] += 1
            if verbose:
                print("✅ 写入完成")
        else:
            if verbose:
                print("⏭️ 无需修改")

    if verbose:
        print(f"\n🎉 处理完成：共 {result['total_files']} 个 JSON 文件，修改了 {result['modified_files']} 个")

    return result


# 如果作为独立脚本运行
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("❌ 用法：python pathing_authors.py <JSON文件或目录路径>")
    else:
        process_json_authors(sys.argv[1])
