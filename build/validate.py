import json
import os
import sys
import subprocess
import re
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
    "set_time": "0.45.0"
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
DEFAULT_BGI_VERSION = "0.42.0"
DEFAULT_VERSION = "1.0"

# ==================== 文件操作 ====================

def get_original_file(file_path):
    """从 git 仓库获取原始文件内容，如果失败则尝试从本地备份获取"""
    # 返回值增加一个来源标识: "git", "backup", "current", None

    # 首先尝试从 git 仓库获取
    try:
        result = subprocess.run(['git', 'show', f'origin/main:{file_path}'],
                                capture_output=True, text=True, encoding='utf-8')
        if result.returncode == 0:
            print("从 git 仓库成功获取原始文件")
            return json.loads(result.stdout), "git"
    except Exception as e:
        print(f"从 git 仓库获取原始文件失败: {str(e)}")

    # 如果 git 获取失败，尝试从本地备份目录获取
    try:
        # 假设有一个备份目录，存放原始文件
        backup_dir = os.path.join(os.path.dirname(os.path.dirname(file_path)), "backups")
        backup_file = os.path.join(backup_dir, os.path.basename(file_path))

        if os.path.exists(backup_file):
            print(f"从本地备份获取原始文件: {backup_file}")
            with open(backup_file, 'r', encoding='utf-8') as f:
                return json.load(f), "backup"
    except Exception as e:
        print(f"从本地备份获取原始文件失败: {str(e)}")

    # 如果都失败了，尝试使用当前文件的副本作为原始文件
    try:
        print("尝试使用当前文件作为原始文件")
        with open(file_path, 'r', encoding='utf-8') as f:
            current_data = json.load(f)
            # 创建一个副本，避免引用相同的对象
            return json.loads(json.dumps(current_data)), "current"
    except Exception as e:
        print(f"使用当前文件作为原始文件失败: {str(e)}")

    print("无法获取任何形式的原始文件")
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
                pos[axis] = round(float(pos[axis]), 2)
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

    if not info["author"]:
        info["author"] = os.getenv("GITHUB_ACTOR", "未知作者")
        corrections.append(f"author 自动设置为 {info['author']}")

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

    if "author" not in info:
        info["author"] = os.getenv("GITHUB_ACTOR", "未知作者")
        messages.append(f"⚠️ 文件缺少 author 字段，已设置为: {info['author']}")

    if "version" not in info:
        info["version"] = DEFAULT_VERSION
        messages.append(f"⚠️ 文件缺少 version 字段，已设置为默认值: {DEFAULT_VERSION}")

    if "bgi_version" not in info:
        info["bgi_version"] = DEFAULT_BGI_VERSION
        messages.append(f"⚠️ 文件缺少 bgi_version 字段，已设置为默认值: {DEFAULT_BGI_VERSION}")

    if "positions" not in data:
        data["positions"] = []
        messages.append(f"⚠️ 文件缺少 positions 字段，已添加空数组")

    for message in messages:
        print(message)

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

    # 首先检查并删除 v 前缀
    if info["bgi_version"].startswith('v'):
        info["bgi_version"] = info["bgi_version"].lstrip('v')
        corrections.append(f"bgi_version 前缀 'v' 已删除")

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
                print(f"警告: 版本号解析失败 - {e}")
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
        return []

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

    # 检查并删除 bgi_version 的 v 前缀
    if "bgi_version" in info and info["bgi_version"].startswith('v'):
        info["bgi_version"] = info["bgi_version"].lstrip('v')
        all_corrections.append("bgi_version 前缀 'v' 已删除")

    # 处理坐标
    coord_changed = process_coordinates(data["positions"])
    if coord_changed:
        all_corrections.append("坐标值自动保留两位小数")

    # 检查 BGI 版本兼容性
    bgi_version, corrections = check_bgi_version_compatibility(info["bgi_version"], auto_fix)
    if corrections:
        info["bgi_version"] = bgi_version
        all_corrections.extend(corrections)

    # 检查位置字段 - 修改为接收三个返回值
    position_issues, notices, pos_corrections = check_position_fields(data["positions"])
    if auto_fix and pos_corrections:
        all_corrections.extend(pos_corrections)

    # 检查 action 兼容性
    compatibility_issues, action_validation_issues = check_actions_compatibility(data["positions"], info["bgi_version"])
    position_issues.extend(action_validation_issues)

    # 根据兼容性问题更新 BGI 版本
    compatibility_issues, corrections = update_bgi_version_for_compatibility(info, compatibility_issues, auto_fix)
    all_corrections.extend(corrections)

    # 更新版本号 - 只有从 git 获取的文件才更新版本号
    if auto_fix:
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

        # 只有当文件来源是 git 时才更新版本号
        if source == "git":
            new_version = process_version(info["version"], original_version, is_new)
            if new_version != info["version"]:
                info["version"] = new_version
                all_corrections.append(f"version 自动更新为 {new_version}")
                print(f"版本号已更新: {info['version']}")
            else:
                print(f"版本号未变化: {info['version']}")
        else:
            print(f"本地文件，保持版本号不变: {info['version']}")

    # 合并所有通知
    for issue in compatibility_issues:
        notices.append(issue)

    for issue in position_issues:
        notices.append(issue)

    # 保存修正
    if auto_fix:
        # 无论是否有问题，都打印所有自动修正项
        if all_corrections:
            print("🔧 自动修正:")
            for correction in all_corrections:
                print(f"  - {correction}")
        else:
            print("✅ 没有需要自动修正的项目")

        # 只有在有修正或问题时才保存文件
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
    args = parser.parse_args()

    path = args.path
    auto_fix = args.fix
    all_notices = []  # 初始化 all_notices 变量

    if os.path.isfile(path) and path.endswith('.json'):
        print(f"\n🔍 校验文件: {path}")
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

    # 生成提醒信息
    if all_notices:
        with open('validation_notes.md', 'w') as f:
            f.write("## 校验注意事项\n\n" + "\n".join(f"- {n}" for n in all_notices))

if __name__ == "__main__":
    main()