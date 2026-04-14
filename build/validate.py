#!/usr/bin/python
# -*- coding: utf-8 -*-
import json
import os
import subprocess
import re
import chardet
from packaging.version import parse
from semver import VersionInfo

# ==================== 配置和常量 ====================

# 定义有效的 type 和 move_mode 值
VALID_TYPES = ["teleport", "path", "target", "orientation"]
VALID_MOVE_MODES = ["swim", "walk", "fly", "climb", "run", "dash", "jump"]

# 定义 action 和 action_params 的最低兼容版本
ACTION_VERSION_MAP = {
    "fight": "0.42.0",
    "mining": "0.43.0",
    "fishing": "0.43.0",
    "force_tp": "0.42.0",
    "log_output": "0.42.0",
    "anemo_collect": "0.42.0",
    "combat_script": "0.42.0",
    "hydro_collect": "0.42.0",
    "pick_around": "0.42.0",
    "pyro_collect": "0.43.0",
    "stop_flying": "0.42.0",
    "normal_attack": "0.42.0",
    "electro_collect": "0.42.0",
    "nahida_collect": "0.42.0",
    "up_down_grab_leaf": "0.42.0",
    "set_time": "0.45.0",
    "exit_and_relogin": "0.46.0",
    "use_gadget": "0.48.1"
}

# 定义 action_params 的最低兼容版本和正则表达式验证
ACTION_PARAMS_VERSION_MAP = {
    "stop_flying": {
        "params": {"version": "0.44.0", "regex": r"^\d+(\.\d+)?$"}
    },
    "pick_around": {
        "params": {"version": "0.42.0", "regex": r"^\d+$"}
    },
    "combat_script": {
        "params": {"version": "0.42.0", "regex": r"^.+$"}  # 任意非空字符串
    },
    "log_output": {
        "params": {"version": "0.42.0", "regex": r"^.+$"}  # 任意非空字符串
    }
    # 其他 action 类型没有明确的 action_params 格式要求
}

# 默认版本号
DEFAULT_BGI_VERSION = "0.60.1"
DEFAULT_VERSION = "1.0"

# ==================== 文件操作 ====================

def get_original_file(file_path):
    """从上游仓库获取原始文件内容，如果失败则尝试从本地获取"""
    # 返回值增加一个来源标识: "upstream", "pr_submitted", None

    try:
        result = subprocess.run(['git', 'show', f'upstream/main:{file_path}'],
                                capture_output=True, text=True, encoding='utf-8')
        if result.returncode == 0:
            return json.loads(result.stdout), "upstream"
    except Exception as e:
        print(f"从上游仓库获取原始文件失败: {str(e)}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            current_data = json.load(f)
            # 创建一个副本，避免引用相同的对象
            return json.loads(json.dumps(current_data)), "pr_submitted"
    except Exception as e:
        print(f"读取当前文件失败: {str(e)}")

    return None, None

def load_json_file(file_path):
    """加载 JSON 文件"""
    try:
        with open(file_path, encoding='utf-8') as f:
            return json.load(f), None
    except Exception as e:
        return None, f"❌ JSON 格式错误: {str(e)}"

def save_json_file(file_path, data):
    """保存 JSON 文件"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"保存文件失败: {str(e)}")
        return False

# ==================== 版本处理 ====================

def process_version(current, original, is_new):
    """处理版本号更新逻辑"""
    if is_new:
        return DEFAULT_VERSION

    if not original:
        return DEFAULT_VERSION

    try:
        cv = parse(current)
        ov = parse(original)
        # 强制更新版本号，无论当前版本是否大于原始版本
        return f"{ov.major}.{ov.minor + 1}"
    except Exception:
        # 如果解析失败，尝试简单的数字处理
        parts = original.split('.')
        if len(parts) >= 2:
            try:
                major = int(parts[0])
                minor = int(parts[1])
                return f"{major}.{minor + 1}"
            except ValueError:
                pass
        return f"{original}.1"

def extract_required_version(compatibility_issues):
    """从兼容性问题中提取所需的最高版本号"""
    required_versions = []
    for issue in compatibility_issues:
        parts = issue.split(">=")
        if len(parts) > 1:
            version_part = parts[1].split(",")[0].strip()
            version_match = re.search(r'(\d+\.\d+\.\d+)', version_part)
            if version_match:
                required_versions.append(version_match.group(1))

    if not required_versions:
        return None

    try:
        return max(required_versions, key=lambda v: VersionInfo.parse(v))
    except ValueError:
        return None

def parse_bgi_version(version_str):
    """解析 BGI 版本号"""
    try:
        # 确保删除 v 前缀
        return VersionInfo.parse(version_str.lstrip('v'))
    except ValueError:
        return None

# ==================== 字段验证 ====================

def check_action_compatibility(action_type, action_params, bgi_version):
    """检查 action 和 action_params 与 BGI 版本的兼容性"""
    issues = []
    validation_issues = []

    # 如果 action_type 为空，则跳过检查
    if not action_type:
        return issues, validation_issues

    # 确保 bgi_version 是有效的格式
    bgi_ver = parse_bgi_version(bgi_version)
    if not bgi_ver:
        validation_issues.append(f"无效的 bgi_version 格式: {bgi_version}")
        return issues, validation_issues

    # 检查 action 兼容性
    if action_type in ACTION_VERSION_MAP:
        min_version = ACTION_VERSION_MAP[action_type]
        try:
            if bgi_ver < VersionInfo.parse(min_version):
                issues.append(f"action '{action_type}' 需要 BGI 版本 >= {min_version}，当前为 {bgi_version}")
        except ValueError:
            validation_issues.append(f"无法比较版本: {min_version} 与 {bgi_version}")
    else:
        validation_issues.append(f"未知的 action 类型: '{action_type}'，已知类型: {', '.join(sorted(ACTION_VERSION_MAP.keys()))}")

    # 检查 action_params 兼容性和格式
    if action_type in ACTION_PARAMS_VERSION_MAP and action_params:
        param_info = ACTION_PARAMS_VERSION_MAP[action_type]["params"]
        min_version = param_info["version"]
        regex_pattern = param_info["regex"]

        # 版本兼容性检查
        try:
            if bgi_ver < VersionInfo.parse(min_version):
                issues.append(f"action '{action_type}' 的参数需要 BGI 版本 >= {min_version}，当前为 {bgi_version}")
        except ValueError:
            validation_issues.append(f"无法比较版本: {min_version} 与 {bgi_version}")

        # 参数格式验证
        if not re.match(regex_pattern, str(action_params)):
            validation_issues.append(f"action '{action_type}' 的参数格式不正确: '{action_params}'，应匹配模式: {regex_pattern}")

    return issues, validation_issues

def process_coordinates(positions):
    """统一处理坐标保留两位小数逻辑"""
    coord_changed = False
    for pos in positions:
        for axis in ['x', 'y']:
            if axis in pos and isinstance(pos[axis], (int, float)):
                original = pos[axis]
                pos[axis] = round(float(pos[axis]), 4)
                if original != pos[axis]:
                    coord_changed = True
    return coord_changed

def ensure_required_fields(info, filename):
    """统一处理必要字段检查逻辑"""
    corrections = []

    if info["name"] != filename:
        info["name"] = filename
        corrections.append(f"name 自动修正为 {filename}")

    if info["type"] not in ["collect", "fight"]:
        info["type"] = "collect"
        corrections.append("type 自动修正为 collect")

    if not info["authors"]:
        author_name = os.getenv("GITHUB_ACTOR", "未知作者")
        author_link = "https://github.com/" + os.getenv("GITHUB_ACTOR", "babalae/bettergi-scripts-list")
        info["authors"] = [{"name": author_name, "links": author_link}]
        corrections.append(f"authors 自动设置为 {info['authors']}")

    return corrections

def check_position_fields(positions):
    """检查位置字段的有效性

    自动修复功能:
    1. 缺少 type 字段时，自动设置为 'path'
    2. type 字段无效时，自动修正为 'path'
    3. 当 type 为 'path' 或 'target' 且缺少 move_mode 时，自动设置为 'walk'
    4. move_mode 字段无效时，自动修正为 'walk'
    """
    validation_issues = []
    notices = []
    corrections = []  # 添加修正列表

    for idx, pos in enumerate(positions):
        # 检查必需字段
        required_fields = ["x", "y", "type"]
        missing_fields = [field for field in required_fields if field not in pos]

        if missing_fields:
            validation_issues.append(f"位置 {idx+1} 缺少必需字段: {', '.join(missing_fields)}")
            # 自动添加缺失的 type 字段
            if "type" in missing_fields:
                pos["type"] = "path"  # 自动修复：缺少 type 字段时设置为 path
                corrections.append(f"位置 {idx+1} 缺少 type 字段，已设置为默认值 'path'")
                # 如果添加了 path 类型，也需要添加 move_mode
                if "move_mode" not in pos:
                    pos["move_mode"] = "walk"  # 自动修复：为 path 类型添加默认 move_mode
                    corrections.append(f"位置 {idx+1} 缺少 move_mode 字段，已设置为默认值 'walk'")
            # 移除 continue，确保后续检查能够执行
            # continue

        # 验证 type 字段
        if "type" in pos:
            pos_type = pos["type"]
            if pos_type not in VALID_TYPES:
                validation_issues.append(f"位置 {idx+1}: type '{pos_type}' 无效，有效值为: {', '.join(VALID_TYPES)}")
                # 自动修正无效的 type 字段
                pos["type"] = "path"  # 自动修复：无效 type 修正为 path
                corrections.append(f"位置 {idx+1} 的 type '{pos_type}' 无效，已修正为 'path'")
                pos_type = "path"  # 更新 pos_type 以便后续检查

            # 当 type 为 path 或 target 时，验证 move_mode
            if pos_type in ["path", "target"]:
                if "move_mode" not in pos:
                    validation_issues.append(f"位置 {idx+1}: type 为 '{pos_type}' 时必须指定 move_mode")
                    # 自动添加缺失的 move_mode
                    pos["move_mode"] = "walk"  # 自动修复：缺少 move_mode 时设置为 walk
                    corrections.append(f"位置 {idx+1} 缺少 move_mode 字段，已设置为默认值 'walk'")
                elif pos["move_mode"] not in VALID_MOVE_MODES:
                    validation_issues.append(f"位置 {idx+1}: move_mode '{pos['move_mode']}' 无效，有效值为: {', '.join(VALID_MOVE_MODES)}")
                    # 自动修正无效的 move_mode
                    pos["move_mode"] = "walk"  # 自动修复：无效 move_mode 修正为 walk
                    corrections.append(f"位置 {idx+1} 的 move_mode '{pos['move_mode']}' 无效，已修正为 'walk'")

        # 检查第一个位置是否为 teleport
        if idx == 0 and pos.get("type") != "teleport":
            notices.append("⚠️ 第一个 position 的 type 不是 teleport")

    return validation_issues, notices, corrections

def check_bgi_version_compatibility(bgi_version, auto_fix=False):
    """检查 BGI 版本兼容性"""
    corrections = []

    # 删除可能存在的 v 前缀
    if bgi_version.startswith('v'):
        bgi_version = bgi_version.lstrip('v')
        corrections.append(f"bgi_version 前缀 'v' 已删除")

    bgi_ver = parse_bgi_version(bgi_version)

    if not bgi_ver:
        if auto_fix:
            corrections.append(f"bgi_version {bgi_version} 格式无效，自动更新为 {DEFAULT_BGI_VERSION}")
            return DEFAULT_BGI_VERSION, corrections
        return bgi_version, []

    if bgi_ver < VersionInfo.parse(DEFAULT_BGI_VERSION):
        if auto_fix:
            corrections.append(f"bgi_version {bgi_version} 自动更新为 {DEFAULT_BGI_VERSION} (原版本低于要求)")
            return DEFAULT_BGI_VERSION, corrections

    return bgi_version, corrections

def check_position_ids(positions):
    """检查并修复位置 ID 编编号的连续性
    
    自动修复功能:
    1. 缺少 id 字段时，自动按顺序添加
    2. id 编号不连续时，自动重新排序
    3. id 不是从 1 开始时，自动调整
    4. id 值无效（非数字）时，自动修正
    """
    corrections = []
    validation_issues = []
    
    if not positions:
        return validation_issues, corrections
    
    # 检查是否所有位置都有 id 字段，并收集现有 id 值
    current_ids = []
    missing_ids = []
    invalid_ids = []
    
    for idx, pos in enumerate(positions):
        if "id" not in pos:
            missing_ids.append(idx)
            current_ids.append(None)
        else:
            try:
                id_val = int(pos["id"])
                current_ids.append(id_val)
            except (ValueError, TypeError):
                # 如果 id 不是数字，记录为无效
                invalid_ids.append(idx)
                current_ids.append(None)
    
    # 如果有缺少 id 的位置，记录
    if missing_ids:
        corrections.append(f"为 {len(missing_ids)} 个位置自动添加了 id 字段")
    
    # 如果有无效 id，记录
    if invalid_ids:
        corrections.append(f"修正了 {len(invalid_ids)} 个无效的 id 值")
    
    # 生成期望的 id 序列（从 1 开始）
    expected_ids = list(range(1, len(positions) + 1))
    
    # 检查当前 id 是否符合期望
    needs_reorder = False
    
    # 过滤掉 None 值来检查现有的有效 id
    valid_current_ids = [id_val for id_val in current_ids if id_val is not None]
    
    if len(valid_current_ids) != len(positions):
        needs_reorder = True
    elif valid_current_ids != expected_ids:
        needs_reorder = True
    else:
        # 检查是否有重复的 id
        if len(set(valid_current_ids)) != len(valid_current_ids):
            needs_reorder = True
            duplicates = [id_val for id_val in set(valid_current_ids) if valid_current_ids.count(id_val) > 1]
            corrections.append(f"检测到重复的 id: {duplicates}")
      # 如果需要重新排序，自动修复
    if needs_reorder:
        id_issues = []
        
        # 分析具体问题
        if missing_ids or invalid_ids:
            if missing_ids:
                id_issues.append("存在缺少id的位置")
            if invalid_ids:
                id_issues.append("存在无效id值")
        
        if valid_current_ids:
            if min(valid_current_ids) != 1:
                id_issues.append("id不是从1开始")
            
            # 检查连续性
            sorted_valid_ids = sorted(valid_current_ids)
            expected_sorted = list(range(1, len(valid_current_ids) + 1))
            if sorted_valid_ids != expected_sorted:
                id_issues.append("id编号不连续")
        
        # 重新按顺序分配 id，并将 id 字段放在第一个位置
        for idx, pos in enumerate(positions):
            new_id = idx + 1
            # 创建新的有序字典，id 放在第一个
            new_pos = {"id": new_id}
            # 添加其他字段
            for key, value in pos.items():
                if key != "id":
                    new_pos[key] = value
            # 更新原位置
            pos.clear()
            pos.update(new_pos)
        
        if id_issues:
            corrections.append(f"id编号已重新排序并置于首位 (问题: {', '.join(id_issues)})")
        else:
            corrections.append("id编号已按顺序重新分配并置于首位")
    
    return validation_issues, corrections

# ==================== 验证修复文件编码 ====================

def detect_encoding(file_path, read_size=2048):
    try:
        with open(file_path, 'rb') as f:
            raw = f.read(read_size)
            result = chardet.detect(raw)
            return result['encoding'], result['confidence']
    except:
        return None, 0

def fix_encoding_name(enc, file_path=None):
    if not enc:
        return None
    enc = enc.lower()
    if enc in ['ascii']:
        try:
            with open(file_path, 'rb') as f:
                raw = f.read()
                raw.decode('utf-8')
            return 'utf-8'
        except:
            return 'gb18030'
    if enc in ['gb2312', 'gbk', 'windows-1252', 'iso-8859-1', 'gb18030']:
        return 'gb18030'
    return enc

def convert_to_utf8(file_path, original_encoding):
    try:
        encoding = fix_encoding_name(original_encoding, file_path)

        with open(file_path, 'r', encoding=encoding, errors='replace') as f:
            content = f.read()
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"[✔] Converted to UTF-8: {file_path} (from {original_encoding} → {encoding})")
    except Exception as e:
        print(f"[✖] Failed to convert: {file_path} | Error: {e}")

def process_file(file_path, target_extensions=None):
    if target_extensions and not any(file_path.lower().endswith(ext) for ext in target_extensions):
        return
    encoding, confidence = detect_encoding(file_path)
    if encoding is None or confidence < 0.7:
        print(f"[⚠️] Unknown encoding: {file_path} | Detected: {encoding}, Conf: {confidence:.2f}")
        return
    if encoding.lower() == 'utf-8':
        return  # Skip already UTF-8
    convert_to_utf8(file_path, encoding)

def scan_and_convert(path, target_extensions=None):
    if os.path.isfile(path):
        process_file(path, target_extensions)
    elif os.path.isdir(path):
        for dirpath, _, filenames in os.walk(path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                process_file(filepath, target_extensions)
    else:
        print(f"❌ Path not found: {path}")

# ==================== 验证修复作者信息 ====================

def process_json_authors(input_path, verbose=False):
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
                # if verbose:
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

# ==================== 目录结构校验 ====================

def validate_directory_structure(dir_path, parent_folders=None):
    """校验目录结构，检测JSON文件和目录同级的情况"""
    if parent_folders is None:
        parent_folders = []
    
    errors = []
    
    try:
        items = os.listdir(dir_path)
        files = []
        directories = []
        
        # 分类文件和目录
        for item in items:
            item_path = os.path.join(dir_path, item)
            if os.path.isfile(item_path):
                files.append(item)
            elif os.path.isdir(item_path):
                directories.append(item)
        
        # 检查是否有JSON文件和目录同级
        json_files = [f for f in files if f.lower().endswith('.json')]
        
        if json_files and directories:
            relative_path = '/'.join(parent_folders + [os.path.basename(dir_path)]) if parent_folders else os.path.basename(dir_path)
            error_msg = f"❌ 目录结构错误: 在目录 \"{relative_path}\" 中发现JSON文件和子目录同级存在。JSON文件: {json_files}, 子目录: {directories}"
            errors.append(error_msg)
            print(error_msg)
        
        # 递归检查子目录
        for dir_name in directories:
            sub_dir_path = os.path.join(dir_path, dir_name)
            sub_errors = validate_directory_structure(sub_dir_path, parent_folders + [os.path.basename(dir_path)])
            errors.extend(sub_errors)
        
    except Exception as error:
        relative_path = '/'.join(parent_folders + [os.path.basename(dir_path)]) if parent_folders else os.path.basename(dir_path)
        error_msg = f"❌ 无法访问目录 \"{relative_path}\": {str(error)}"
        errors.append(error_msg)
        print(error_msg)
    
    return errors

# ==================== 主验证逻辑 ====================

def initialize_data(data, file_path):
    """初始化数据结构，确保必要字段存在"""
    messages = []

    if "info" not in data:
        data["info"] = {}
        messages.append(f"⚠️ 文件缺少 info 字段，已添加默认值")

    info = data["info"]
    filename = os.path.splitext(os.path.basename(file_path))[0]

    # 检查并添加必要的字段
    if "name" not in info:
        info["name"] = filename
        messages.append(f"⚠️ 文件缺少 name 字段，已设置为文件名: {info['name']}")

    if "type" not in info:
        info["type"] = "collect"
        messages.append(f"⚠️ 文件缺少 type 字段，已设置为默认值: collect")

    if "authors" not in info:
        author_name = os.getenv("GITHUB_ACTOR", "未知作者")
        author_link = "https://github.com/" + os.getenv("GITHUB_ACTOR", "babalae/bettergi-scripts-list")
        info["authors"] = [{"name": author_name, "links": author_link}]
        messages.append(f"⚠️ 文件缺少 authors 字段，已设置为: {info['authors']}")

    if "version" not in info:
        info["version"] = DEFAULT_VERSION
        messages.append(f"⚠️ 文件缺少 version 字段，已设置为默认值: {DEFAULT_VERSION}")

    if "bgi_version" not in info:
        info["bgi_version"] = DEFAULT_BGI_VERSION
        messages.append(f"⚠️ 文件缺少 bgi_version 字段，已设置为默认值: {DEFAULT_BGI_VERSION}")

    if "positions" not in data:
        data["positions"] = []
        messages.append(f"⚠️ 文件缺少 positions 字段，已添加空数组")

    return data

def check_actions_compatibility(positions, bgi_version):
    """检查所有位置的 action 兼容性"""
    compatibility_issues = []
    validation_issues = []

    for idx, pos in enumerate(positions):
        action_type = pos.get("action", "")
        action_params = pos.get("params", "")

        if action_type:
            compat_issues, valid_issues = check_action_compatibility(action_type, action_params, bgi_version)

            for issue in compat_issues:
                compatibility_issues.append(f"位置 {idx+1}: {issue}")

            for issue in valid_issues:
                validation_issues.append(f"位置 {idx+1}: {issue}")

    return compatibility_issues, validation_issues

def update_bgi_version_for_compatibility(info, compatibility_issues, auto_fix):
    """根据兼容性问题更新 BGI 版本"""
    corrections = []

    if auto_fix and compatibility_issues:
        max_required = extract_required_version(compatibility_issues)

        if max_required:
            # 确保 max_required 没有 v 前缀
            max_required = max_required.lstrip('v')

            try:
                current_bgi = parse_bgi_version(info["bgi_version"])
                if current_bgi and current_bgi < VersionInfo.parse(max_required):
                    info["bgi_version"] = max_required
                    corrections.append(f"bgi_version {info['bgi_version']} 自动更新为 {max_required} 以兼容所有功能")
                    return [], corrections
            except ValueError as e:
                # print(f"警告: 版本号解析失败 - {e}")
                info["bgi_version"] = DEFAULT_BGI_VERSION
                corrections.append(f"bgi_version 自动更新为 {DEFAULT_BGI_VERSION} (版本解析失败)")
                return [], corrections

    return compatibility_issues, corrections

def validate_file(file_path, auto_fix=False):
    """验证并修复 JSON 文件"""
    # 加载文件
    data, error = load_json_file(file_path)
    if error:
        print(error)
        return [error]

    # 获取原始文件
    original_data, source = get_original_file(file_path) if auto_fix else (None, None)
    is_new = not original_data if auto_fix else True

    # 初始化数据结构
    data = initialize_data(data, file_path)
    info = data["info"]
    filename = os.path.splitext(os.path.basename(file_path))[0]

    # 收集所有修正 - 修复：添加了这一行来定义 all_corrections 变量
    all_corrections = []

    # 检查必要字段
    corrections = ensure_required_fields(info, filename)
    all_corrections.extend(corrections)

    # 处理坐标
    coord_changed = process_coordinates(data["positions"])
    if coord_changed:
        all_corrections.append("坐标值自动保留四位小数")

    # 检查 BGI 版本兼容性
    bgi_version, corrections = check_bgi_version_compatibility(info["bgi_version"], auto_fix)
    if corrections:
        info["bgi_version"] = bgi_version
        all_corrections.extend(corrections)    # 检查位置字段 - 修改为接收三个返回值
    position_issues, notices, pos_corrections = check_position_fields(data["positions"])
    if auto_fix and pos_corrections:
        all_corrections.extend(pos_corrections)

    # 检查位置 ID 编号
    if auto_fix:
        id_validation_issues, id_corrections = check_position_ids(data["positions"])
        if id_corrections:
            all_corrections.extend(id_corrections)
        position_issues.extend(id_validation_issues)

    # 检查 action 兼容性
    compatibility_issues, action_validation_issues = check_actions_compatibility(data["positions"], info["bgi_version"])
    position_issues.extend(action_validation_issues)

    # 根据兼容性问题更新 BGI 版本
    compatibility_issues, corrections = update_bgi_version_for_compatibility(info, compatibility_issues, auto_fix)
    all_corrections.extend(corrections)

    # 更新版本号 - 只有从上游仓库获取的文件才更新版本号
    # if auto_fix:
    if False:
        has_original_version = False
        original_version = None

        if original_data and "info" in original_data and "version" in original_data["info"]:
            original_version = original_data["info"]["version"]
            has_original_version = True
            print(f"成功获取原始版本号: {original_version}")
        else:
            print("未找到原始版本号，将视为新文件处理")

        # 只有在没有原始版本号时才视为新文件
        is_new = not has_original_version

        print(f"原始版本号: {original_version}, 当前版本号: {info['version']}, 是否新文件: {is_new}, 来源: {source}")

        # 只有当文件来源是上游仓库时才更新版本号
        if source == "upstream":
            new_version = process_version(info["version"], original_version, is_new)
            if new_version != info["version"]:
                info["version"] = new_version
                all_corrections.append(f"version 自动更新为 {new_version}")
                print(f"版本号已更新: {info['version']}")
            else:
                print(f"版本号未变化: {info['version']}")
        else:
            print(f"这是PR提交的文件，保持版本号不变: {info['version']}（合并后再更新版本）")

    # 合并所有通知
    for issue in compatibility_issues:
        notices.append(issue)

    for issue in position_issues:
        notices.append(issue)

    # 保存修正
    if auto_fix:
        if all_corrections or position_issues:
            if save_json_file(file_path, data):
                print("✅ 文件已保存")
            else:
                notices.append("❌ 保存文件失败")

    return notices

def main():
    import argparse

    parser = argparse.ArgumentParser(description='校验 BetterGI 脚本文件')
    parser.add_argument('path', help='要校验的文件或目录路径')
    parser.add_argument('--fix', action='store_true', help='自动修复问题')
    parser.add_argument('--structure', action='store_true', help='浅草的氨气搞得什么结构校验')
    args = parser.parse_args()

    path = args.path
    auto_fix = args.fix
    structure = args.structure
    all_notices = []  # 初始化 all_notices 变量

    # 首先执行目录结构校验
    if structure:
        if os.path.isdir(path):
            print("🔍 开始目录结构校验...")
            structure_errors = validate_directory_structure(path)
            if structure_errors:
                print("\n❌ 目录结构校验失败，发现以下错误:")
                for error in structure_errors:
                    print(f"- {error}")
                print("\n请修复上述目录结构问题后重新提交。")
                print("\n目录结构规范说明:")
                print("- 不允许JSON文件和子目录在同一个目录下共存")
                print("- 建议将JSON文件移动到专门的子目录中")
                exit(1)
            print("✅ 目录结构校验通过")

    if os.path.isfile(path) and path.endswith('.json'):
        scan_and_convert(path)
        process_json_authors(path)
        # print(f"\n🔍 校验文件: {path}")
        notices = validate_file(path, auto_fix)
        if notices:
            all_notices.extend([f"{path}: {n}" for n in notices])  # 添加到 all_notices
            print("\n校验注意事项:")
            for notice in notices:
                print(f"- {notice}")
        else:
            print("✅ 校验完成，没有发现问题")
    elif os.path.isdir(path):
        for root, _, files in os.walk(path):
            for file in files:
                if file.endswith('.json'):
                    file_path = os.path.join(root, file)
                    print(f"\n🔍 校验文件: {file_path}")
                    scan_and_convert(file_path)
                    process_json_authors(file_path)
                    notices = validate_file(file_path, auto_fix)
                    if notices:
                        all_notices.extend([f"{file_path}: {n}" for n in notices])

        if all_notices:
            print("\n所有校验注意事项:")
            for notice in all_notices:
                print(f"- {notice}")
        else:
            print("\n✅ 所有文件校验完成，没有发现问题")
    else:
        print(f"❌ 无效的路径: {path}")

if __name__ == "__main__":
    main()
