import json
import re
import os
from typing import Dict, Any


def merge_codes(s: str) -> str:
    """
    合并满足条件的相邻代码项：
    1. 首字母同为 'D' 或 'U'
    2. 数字部分为 0 或 1
    合并规则：保留首字母，拼接中间字母，数字取右侧项的数字
    例如 "UA0|UN1" -> "UAN1"
    """
    pattern = re.compile(r'^([DU])([A-Z]+)(\d+)$')
    codes = s.split('|')
    merged = []

    for code in codes:
        m = pattern.match(code)
        if not m:
            merged.append((code, '', ''))
            continue

        prefix, middle, num_str = m.groups()
        num = int(num_str)

        if merged and merged[-1][0] == prefix:
            last_prefix, last_middle, last_num_str = merged[-1]
            last_num = int(last_num_str)
            if last_num in (0, 1) and num in (0, 1):
                merged[-1] = (prefix, last_middle + middle, num_str)
                continue

        merged.append((prefix, middle, num_str))

    result_parts = [f"{p}{m}{n}" for p, m, n in merged if p]
    return '|'.join(result_parts)


def process_json_file(filepath: str) -> None:
    """处理单个 JSON 文件，仅当 type 字段为 'midi' 时修改 notes"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data: Dict[str, Any] = json.load(f)

        # 只处理 type 为 "midi" 的文件
        if data.get('type') != 'midi':
            print(f"○ 跳过（type 不是 midi）: {filepath}")
            return

        if 'notes' in data and isinstance(data['notes'], str):
            original = data['notes']
            merged = merge_codes(original)
            if merged != original:
                data['notes'] = merged
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"✓ 已更新: {filepath}")
            else:
                print(f"○ 无需更新: {filepath}")
        else:
            print(f"✗ 跳过（无 notes 字段或类型错误）: {filepath}")
    except Exception as e:
        print(f"✗ 处理失败 {filepath}: {e}")


def batch_process(directory: str = '.') -> None:
    """批量处理目录下所有 .json 文件"""
    for filename in os.listdir(directory):
        if filename.lower().endswith('.json'):
            filepath = os.path.join(directory, filename)
            process_json_file(filepath)


if __name__ == '__main__':
    batch_process()
    print("批量处理完成。")