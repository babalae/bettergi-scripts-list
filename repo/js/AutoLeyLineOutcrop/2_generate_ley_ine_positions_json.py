import os
import json
import re
from collections import defaultdict

# 配置
current_dir = os.path.dirname(os.path.abspath(__file__))
input_folder = os.path.join(current_dir, "assets", "pathing", "target")
template_path = os.path.join(current_dir, "assets", "mapPositions.json")
output_folder = os.path.join(current_dir)
os.makedirs(output_folder, exist_ok=True)


# 读取模板文件（人工维护的 mapPositions）
with open(template_path, 'r', encoding='utf-8') as f:
    template_data = json.load(f)

# 先把所有采集路线分类到子类下面
subclass_data = defaultdict(list)

for filename in os.listdir(input_folder):
    if filename.endswith('.json'):
        filepath = os.path.join(input_folder, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        name = data['info']['name']
        positions = data['positions']

        # 解析名字
        match = re.match(r'(\D+)(\d*)-(.+)-(\d+)', name)
        if not match:
            print(f"无法解析文件名: {name}")
            continue

        big_category = match.group(1)  # 纳塔
        subclass_number = match.group(2)  # 2
        subclass_name = match.group(3)  # 硫晶支脉
        order = int(match.group(4))  # 文件名里的 order

        subclass_fullname = f"{big_category}{subclass_number}-{subclass_name}"

        for pos in positions:
            subclass_data[subclass_fullname].append({
                "big_category": big_category,
                "x": int(pos['x']),
                "y": int(pos['y']),
                "order": order
            })

# 整理最终 leyLinePositions
leyLinePositions = defaultdict(list)

for subclass_name, points in subclass_data.items():
    steps = max(p['order'] for p in points)

    for p in points:
        leyLinePositions[p['big_category']].append({
            "x": p['x'],
            "y": p['y'],
            "strategy": subclass_name,
            "steps": steps,
            "order": p['order']
        })

# 把 leyLinePositions 写回到模板数据里
template_data['leyLinePositions'] = leyLinePositions

# 输出最终合成文件
final_output_path = os.path.join(output_folder, 'config.json')
with open(final_output_path, 'w', encoding='utf-8') as f:
    json.dump(template_data, f, ensure_ascii=False, indent=2)

print(f"已生成最终文件: {final_output_path}")