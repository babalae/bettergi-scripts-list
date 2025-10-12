import json
import os
import subprocess
import re
from packaging.version import parse
from semver import VersionInfo

# ==================== 配置和常量 ====================

DEFAULT_VERSION = "1.0.0"

# ==================== 文件操作 ====================

def load_json_file(file_path):
    """加载 JSON 文件"""
    try:
        with open(file_path, encoding='utf-8') as f:
            return json.load(f), None
    except Exception as e:
        return None, f"❌ JSON 格式错误: {str(e)}"

def save_json_file(file_path, old_version, new_version):
    """保存 JSON 文件，只修改版本号，保持原有格式"""
    try:
        # 读取原文件内容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 使用简单的字符串替换
        old_version_str = f'"{old_version}"'
        new_version_str = f'"{new_version}"'
        
        if old_version_str in content:
            new_content = content.replace(old_version_str, new_version_str, 1)
            
            # 写回文件
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return True
        else:
            print(f"未找到版本号: {old_version}")
            return False
    except Exception as e:
        print(f"保存文件失败: {str(e)}")
        return False

# ==================== 版本处理 ====================

def get_original_manifest_version(file_path):
    """从上游仓库获取原始manifest.json的版本号"""
    try:
        # 直接从upstream/main获取原始版本
        result = subprocess.run(['git', 'show', f'upstream/main:{file_path}'],
                                capture_output=True, text=True, encoding='utf-8')
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout)
            version = data.get('version', DEFAULT_VERSION)
            print(f"🔍 获取到原始版本号: {version} (来自 upstream/main:{file_path})")
            return version
        else:
            print(f"⚠️ 无法从upstream/main获取原始版本: {file_path}")
            print(f"错误信息: {result.stderr}")
    except Exception as e:
        print(f"⚠️ 获取原始版本时出错: {str(e)}")
    
    # 如果无法获取，返回None表示无法比较
    print(f"⚠️ 无法获取原始版本号，跳过版本号检查")
    return None

def increment_version(version_str):
    """增加版本号，在最后一个数字上+1"""
    try:
        # 解析版本号
        version_parts = version_str.split('.')
        if len(version_parts) >= 2:
            # 将最后一个部分转换为数字并+1
            last_part = int(version_parts[-1])
            version_parts[-1] = str(last_part + 1)
            return '.'.join(version_parts)
        else:
            # 如果版本号格式不正确，返回默认版本
            return DEFAULT_VERSION
    except (ValueError, IndexError):
        return DEFAULT_VERSION

def process_manifest_version(manifest_path, auto_fix=False):
    """处理manifest.json的版本号"""
    corrections = []
    
    try:
        print(f"🔍 处理manifest.json版本号: {manifest_path}")
        
        # 加载当前manifest.json
        data, error = load_json_file(manifest_path)
        if error:
            return error, corrections
        
        current_version = data.get('version', DEFAULT_VERSION)
        print(f"📋 当前版本号: {current_version}")
        
        # 获取原始版本号
        original_version = get_original_manifest_version(manifest_path)
        
        # 如果无法获取原始版本号，跳过版本号检查
        if original_version is None:
            print(f"⚠️ 无法获取原始版本号，跳过版本号检查")
            return None, corrections
        
        print(f"📋 原始版本号: {original_version}")
        
        # 检查版本号是否增加
        if current_version == original_version:
            print(f"⚠️ 版本号未增加: {current_version} == {original_version}")
            if auto_fix:
                # 自动增加版本号
                new_version = increment_version(current_version)
                print(f"🔄 自动增加版本号: {current_version} → {new_version}")
                corrections.append(f"版本号已自动更新: {current_version} → {new_version}")
                
                # 保存文件
                if save_json_file(manifest_path, current_version, new_version):
                    print(f"✅ {manifest_path}: 版本号已自动更新: {current_version} → {new_version}")
                else:
                    corrections.append(f"保存文件失败: {manifest_path}")
            else:
                corrections.append(f"版本号未增加: {current_version} (与原始版本相同)")
        else:
            print(f"✅ {manifest_path}: 版本号已更新: {original_version} → {current_version}")
    
    except Exception as e:
        error_msg = f"处理manifest.json版本号时出错: {str(e)}"
        print(f"❌ {error_msg}")
        return error_msg, corrections
    
    return None, corrections

# ==================== JS语法校验 ====================

def validate_js_syntax(js_file_path):
    """校验JS文件语法"""
    errors = []
    try:
        # 使用Node.js -c 参数进行语法检查
        result = subprocess.run(['node', '-c', js_file_path], capture_output=True, text=True, check=True)
        if result.returncode == 0:
            print(f"✅ {js_file_path}: JS语法正确")
        else:
            errors.append(f"❌ {js_file_path}: JS语法错误: {result.stderr.strip()}")
            print(f"❌ {js_file_path}: JS语法错误: {result.stderr.strip()}")
    except subprocess.CalledProcessError as e:
        errors.append(f"❌ {js_file_path}: JS语法错误: {e.stderr.strip()}")
        print(f"❌ {js_file_path}: JS语法错误: {e.stderr.strip()}")
    except FileNotFoundError:
        errors.append(f"❌ Node.js 未安装或不在PATH中，无法校验JS语法。")
        print(f"❌ Node.js 未安装或不在PATH中，无法校验JS语法。")
    return errors

# ==================== 核心校验逻辑 ====================

def validate_js_file(file_path, auto_fix=False):
    """校验单个JS或JSON文件"""
    errors = []
    corrections = []
    
    if file_path.lower().endswith('.json'):
        if os.path.basename(file_path).lower() == 'manifest.json':
            # 处理manifest.json的版本号
            version_error, version_corrections = process_manifest_version(file_path, auto_fix)
            if version_error:
                errors.append(version_error)
            corrections.extend(version_corrections)
        
        # 校验JSON格式
        data, json_error = load_json_file(file_path)
        if json_error:
            errors.append(f"❌ {file_path}: {json_error}")
            print(f"❌ {file_path}: {json_error}")
        else:
            print(f"✅ {file_path}: JSON格式正确")
    
    elif file_path.lower().endswith('.js'):
        # 校验JS语法
        js_errors = validate_js_syntax(file_path)
        errors.extend(js_errors)
    
    return errors, corrections

def validate_js_directory(dir_path, auto_fix=False):
    """校验JS目录下的所有文件"""
    all_errors = []
    all_corrections = []
    
    try:
        for root, dirs, files in os.walk(dir_path):
            for file in files:
                file_path = os.path.join(root, file)
                file_ext = os.path.splitext(file)[1].lower()
                
                # 处理所有JS和JSON文件
                if file_ext in ['.js', '.json']:
                    errors, corrections = validate_js_file(file_path, auto_fix)
                    all_errors.extend(errors)
                    all_corrections.extend(corrections)
    
    except Exception as e:
        error_msg = f"❌ 遍历目录时出错: {str(e)}"
        all_errors.append(error_msg)
        print(error_msg)
    
    return all_errors, all_corrections

def validate_js_files_from_list(file_list_path, auto_fix=False):
    """从文件列表校验JS文件，并处理对应目录的manifest.json"""
    all_errors = []
    all_corrections = []
    processed_manifests = set()  # 避免重复处理同一个manifest.json
    
    try:
        print(f"📋 读取文件列表: {file_list_path}")
        with open(file_list_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            print(f"📋 文件列表内容 ({len(lines)} 行):")
            for i, line in enumerate(lines):
                file_path = line.strip()
                print(f"  {i+1}: {file_path}")
                if file_path and os.path.exists(file_path):
                    print(f"    ✅ 文件存在，开始校验")
                    errors, corrections = validate_js_file(file_path, auto_fix)
                    all_errors.extend(errors)
                    all_corrections.extend(corrections)
                    
                    # 如果是JS文件，检查对应目录的manifest.json
                    if file_path.lower().endswith('.js'):
                        # 获取文件所在目录
                        file_dir = os.path.dirname(file_path)
                        manifest_path = os.path.join(file_dir, 'manifest.json')
                        
                        # 检查manifest.json是否存在且未被处理过
                        if os.path.exists(manifest_path) and manifest_path not in processed_manifests:
                            print(f"    🔍 检查对应目录的manifest.json: {manifest_path}")
                            processed_manifests.add(manifest_path)
                            errors, corrections = validate_js_file(manifest_path, auto_fix)
                            all_errors.extend(errors)
                            all_corrections.extend(corrections)
                        elif not os.path.exists(manifest_path):
                            print(f"    ⚠️ 未找到对应的manifest.json: {manifest_path}")
                else:
                    print(f"    ❌ 文件不存在或为空")
    
    except Exception as e:
        error_msg = f"❌ 读取文件列表时出错: {str(e)}"
        all_errors.append(error_msg)
        print(error_msg)
    
    return all_errors, all_corrections

# ==================== 主函数 ====================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='校验 JS 脚本文件')
    parser.add_argument('path', help='要校验的文件或目录路径')
    parser.add_argument('--fix', action='store_true', help='自动修复问题')
    args = parser.parse_args()

    path = args.path
    auto_fix = args.fix
    
    print(f"🔍 开始JS脚本校验: {path}")
    
    all_errors = []
    all_corrections = []
    
    if os.path.isfile(path):
        # 单个文件
        if path.endswith('.txt'):
            # 文件列表
            print(f"📋 检测到文件列表: {path}")
            errors, corrections = validate_js_files_from_list(path, auto_fix)
        else:
            # 单个JS或JSON文件
            print(f"📄 检测到单个文件: {path}")
            errors, corrections = validate_js_file(path, auto_fix)
        all_errors.extend(errors)
        all_corrections.extend(corrections)
    
    elif os.path.isdir(path):
        # 目录
        print(f"📁 检测到目录: {path}")
        errors, corrections = validate_js_directory(path, auto_fix)
        all_errors.extend(errors)
        all_corrections.extend(corrections)
    
    else:
        print(f"❌ 无效的路径: {path}")
        exit(1)
    
    # 输出结果
    if all_errors:
        print("\n❌ 发现以下错误:")
        for error in all_errors:
            print(f"- {error}")
        exit(1)
    elif all_corrections:
        print("\n✅ JS脚本校验完成，并自动修复了以下问题:")
        for correction in all_corrections:
            print(f"- {correction}")
    else:
        print("\n✅ JS脚本校验完成，没有发现问题")

if __name__ == "__main__":
    main()