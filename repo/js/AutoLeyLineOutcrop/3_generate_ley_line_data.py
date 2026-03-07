#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import os
import sys
import re

def format_coord(num):
    return round(float(num), 2)

def calculate_distance(x1, y1, x2, y2):
    return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5

# 定义区域排序顺序
REGION_ORDER = {
    "蒙德": 1,
    "璃月": 2,
    "稻妻": 3,
    "须弥": 4,
    "枫丹": 5,
    "纳塔": 6,
    "挪德卡莱": 7,
    "未知区域": 99  # 未知区域放最后
}

def get_region_sort_key(region_name):
    """获取区域的排序键值，用于排序"""
    # 从完整区域名称（如"枫丹1-1"）中提取基本区域名称（如"枫丹"）
    base_region = re.match(r"^([^0-9]+)", region_name)
    if base_region:
        base_region = base_region.group(1)
        return REGION_ORDER.get(base_region, 99)
    return 99

def normalize_region_name(region_name, region_num, route_num, route_sub_num=None):
    """规范化区域名称，确保命名一致性
    例如：
    - 标准格式: 蒙德3, 奔狼领, 2 -> 蒙德3-2
    - 特殊格式: 蒙德2, 清泉镇, 4, 1 -> 蒙德2-4-1
    """
    if route_sub_num is not None:
        # 特殊格式
        return f"{region_name}{region_num}-{route_num}-{route_sub_num}"
    else:
        # 标准格式
        return f"{region_name}{region_num}-{route_num}"

def is_same_region_base(region1, region2):
    """检查两个区域名称是否属于同一基本区域
    例如，"蒙德2-4-1"和"蒙德2-4-2"属于同一基本区域"蒙德2-4"
    """
    # 提取区域名称的基本部分（例如从"蒙德2-4-1"提取"蒙德2-4"）
    base_region1 = re.match(r"^([^-]+-\d+)", region1)
    base_region2 = re.match(r"^([^-]+-\d+)", region2)
    
    return (base_region1 and base_region2 and 
            base_region1.group(1) == base_region2.group(1))

def parse_region_area_number(filename):
    """从文件名解析区域、地区和编号
    支持两种格式:
    1. 标准格式: 蒙德3-奔狼领-2.json -> ("蒙德", 3, "奔狼领", 2)
    2. 特殊格式: 蒙德2-清泉镇-4-1.json -> ("蒙德", 2, "清泉镇", 4, 1)
    """
    # 先尝试匹配特殊格式（带有额外连字符的格式）
    special_pattern = r"^([^0-9]+)(\d+)-(.+)-(\d+)-(\d+(?:\.\d+)?)\.json$"
    match = re.match(special_pattern, filename)
    if match:
        region_name = match.group(1)
        region_num = int(match.group(2))
        area = match.group(3)
        route_num = int(match.group(4))
        route_sub_num = int(match.group(5))
        return region_name, region_num, area, route_num, route_sub_num
    
    # 如果不是特殊格式，尝试匹配标准格式
    standard_pattern = r"^([^0-9]+)(\d+)-(.+)-(\d+(?:\.\d+)?)\.json$"
    match = re.match(standard_pattern, filename)
    if match:
        region_name = match.group(1)
        region_num = int(match.group(2))
        area = match.group(3)
        route_num = int(match.group(4))
        return region_name, region_num, area, route_num
    
    # 如果都不匹配，返回默认值
    print(f"警告：无法解析文件名 {filename}")
    return None, None, None, None

def generate_new_data_structure_from_pathing():
    """直接从assets/pathing目录读取文件生成新的数据结构"""
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pathing_dir = os.path.join(script_dir, "assets", "pathing")
    target_dir = os.path.join(pathing_dir, "target")
    
    # 检查目录是否存在
    if not os.path.exists(pathing_dir):
        print(f"错误：找不到路径目录 {pathing_dir}")
        return None
      # 初始化新数据结构，分开存储 blossom 和 teleport
    new_data = {
        "teleports": [],  # 传送点节点
        "blossoms": [],   # 地脉花节点
        "edges": [],      # 边集合
        "indexes": {
            "edgesBySource": {},
            "edgesByTarget": {}
        }
    }
      # 创建独立的ID计数器和节点映射
    next_teleport_id = 1  # 传送点专用ID计数器
    next_blossom_id = 1000   # 地脉花专用ID计数器
    teleport_nodes = {}   # 按坐标存储传送点节点 (x, y) -> node_id
    target_nodes = {}     # 按坐标存储目标点节点 (x, y) -> node_id
    
    # 创建文件路径映射 
    file_paths = {}
    
    # 第一遍：读取所有路径文件并创建节点
    print("第一遍：读取路径文件并创建节点...")
    for root, _, files in os.walk(pathing_dir):
        for file in sorted(files):
            # 跳过非JSON文件和重运行文件
            if not file.endswith('.json') or 'rerun' in file or 'rerun' in root:
                continue
            
            # 跳过target目录
            if "target" in root.split(os.path.sep):
                continue
                
            file_path = os.path.join(root, file)
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    path_data = json.load(f)
                
                # 记录文件路径
                relative_path = os.path.relpath(file_path, script_dir)
                relative_path = relative_path.replace("\\", "/")
                file_paths[file] = relative_path
                
                # 检查文件是否有position数据
                if "positions" not in path_data or not path_data["positions"]:
                    continue
                
                # 获取第一个位置点（通常是传送点）
                first_pos = path_data["positions"][0]
                if "type" in first_pos and first_pos["type"] == "teleport":
                    x = format_coord(first_pos["x"])
                    y = format_coord(first_pos["y"])                      # 解析区域信息
                    result = parse_region_area_number(file)
                    if len(result) == 5:  # 特殊格式
                        region_name, region_num, _, _, _ = result
                    else:  # 标准格式或无法解析
                        region_name, region_num, _, _ = result
                    # 传送点仅显示区域名称，不显示编号
                    region = f"{region_name}" if region_name else "未知区域"
                      # 检查是否已存在相同坐标的传送点
                    existing_node = False
                    for coord, node_id in teleport_nodes.items():
                        if calculate_distance(coord[0], coord[1], x, y) < 10:  # 将阈值从50降低到10
                            existing_node = True
                            break
                    if not existing_node:                        # 创建新的传送点节点
                        teleport_node = {
                            "id": next_teleport_id,
                            "region": region,
                            "position": {"x": x, "y": y}
                        }
                        new_data["teleports"].append(teleport_node)
                        teleport_nodes[(x, y)] = next_teleport_id
                        next_teleport_id += 1
                        print(f"  创建传送点: ID={teleport_node['id']}, 区域={region}, 坐标=({x}, {y})")
            except Exception as e:
                print(f"  警告：处理文件 {file} 时出错: {e}")
    
    # 第二遍：读取target目录文件并创建目标节点
    print("\n第二遍：读取target文件并创建目标节点...")
    for file in sorted(os.listdir(target_dir)):
        if not file.endswith('.json'):
            continue
            
        file_path = os.path.join(target_dir, file)
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                target_data = json.load(f)
              # 检查文件是否有position数据
            if "positions" not in target_data or not target_data["positions"]:
                continue
                
            # 获取第一个位置点（通常是目标点）
            target_pos = target_data["positions"][0]
            x = format_coord(target_pos["x"])
            y = format_coord(target_pos["y"])              
            result = parse_region_area_number(file)
            if len(result) == 5:  # 特殊格式
                region_name, region_num, area, route_num, route_sub_num = result
                # 使用规范化函数来生成区域名
                region = normalize_region_name(region_name, region_num, route_num, route_sub_num)
            else:  # 标准格式或无法解析
                region_name, region_num, area, route_num = result
                # 使用规范化函数来生成区域名
                region = normalize_region_name(region_name, region_num, route_num) if region_name and region_num and route_num else "未知区域"            # 检查是否已存在相同坐标的目标点和相同区域名
            existing_node = False
            existing_node_id = None
            for coord, node_id in target_nodes.items():
                if calculate_distance(coord[0], coord[1], x, y) < 10:  # 阈值为10
                    # 找到这个节点，检查它的区域是否与当前区域相同
                    for blossom in new_data["blossoms"]:
                        if blossom["id"] == node_id:
                            # 检查区域名完全相同
                            if blossom["region"] == region:
                                existing_node = True
                                existing_node_id = node_id
                                break
                            
                            # 检查区域名基本部分是否相同（如"蒙德2-4"和"蒙德2-4-2"）
                            # 提取区域名称的基本部分（例如从"蒙德2-4-1"提取"蒙德2-4"）
                            current_base_region = re.match(r"^([^-]+-\d+)", region)
                            existing_base_region = re.match(r"^([^-]+-\d+)", blossom["region"])
                            
                            if (current_base_region and existing_base_region and 
                                current_base_region.group(1) == existing_base_region.group(1)):
                                print(f"    注意: 坐标 ({x}, {y}) 与已存在节点 '{blossom['region']}' 区域基本部分相同，视为同一节点")
                                existing_node = True
                                existing_node_id = node_id
                                break
                    
                    if not existing_node:
                        print(f"    注意: 坐标 ({x}, {y}) 附近有另一个区域的节点，但将创建新节点")
            
            if not existing_node:
                # 创建新的目标点节点
                target_node = {
                    "id": next_blossom_id,
                    "region": region,
                    "position": {"x": x, "y": y}
                }
                new_data["blossoms"].append(target_node)
                target_nodes[(x, y)] = next_blossom_id
                next_blossom_id += 1
                print(f"  创建目标点: ID={target_node['id']}, 区域={region}, 坐标=({x}, {y})")
        except Exception as e:
            print(f"  警告：处理目标文件 {file} 时出错: {e}")
    
    # 第三遍：创建边和索引
    print("\n第三遍：创建边和索引...")
    for file in sorted(os.listdir(pathing_dir)):
        if not file.endswith('.json') or 'rerun' in file:
            continue
            
        # 跳过target和rerun目录中的文件
        if file not in file_paths:
            continue
              # 解析文件名
        result = parse_region_area_number(file)
        if len(result) == 5:  # 特殊格式
            region_name, region_num, area, route_num, route_sub_num = result
        else:  # 标准格式
            region_name, region_num, area, route_num = result
            route_sub_num = None
            
        if not region_name or not region_num or not area or not route_num:
            continue
            
        # 构建对应的target文件名
        target_file = file
        
        # 检查target文件是否存在
        target_path = os.path.join(target_dir, target_file)
        if not os.path.exists(target_path):
            print(f"  警告：找不到对应的目标文件 {target_file}")
            continue
            
        try:
            # 读取路径文件获取源传送点
            file_path = os.path.join(pathing_dir, file)
            with open(file_path, 'r', encoding='utf-8') as f:
                path_data = json.load(f)
                
            # 读取目标文件获取目标点
            with open(target_path, 'r', encoding='utf-8') as f:
                target_data = json.load(f)
                
            # 获取传送点坐标
            if "positions" in path_data and path_data["positions"]:
                first_pos = path_data["positions"][0]
                source_x = format_coord(first_pos["x"])
                source_y = format_coord(first_pos["y"])
                
                # 获取目标点坐标
                if "positions" in target_data and target_data["positions"]:
                    target_pos = target_data["positions"][0]
                    target_x = format_coord(target_pos["x"])
                    target_y = format_coord(target_pos["y"])                        # 查找源节点ID
                    source_id = None
                    for coord, node_id in teleport_nodes.items():
                        if calculate_distance(coord[0], coord[1], source_x, source_y) < 10:  # 将阈值从50降低到10
                            source_id = node_id
                            break
                            
                    # 查找目标节点ID
                    target_id = None
                    for coord, node_id in target_nodes.items():
                        if calculate_distance(coord[0], coord[1], target_x, target_y) < 10:  # 将阈值从50降低到10
                            target_id = node_id
                            break
                    
                    # 如果找到了源节点和目标节点，创建边
                    if source_id and target_id:                        # 添加边
                        edge = {
                            "source": source_id,
                            "target": target_id,
                            "route": file_paths[file],
                            # 保存原始位置信息，用于在排序后更新ID（稍后会删除）
                            "sourcePosition": {
                                "x": source_x,
                                "y": source_y
                            },
                            "targetPosition": {
                                "x": target_x,
                                "y": target_y
                            }
                        }
                        new_data["edges"].append(edge)
                        
                        # 更新索引
                        if str(source_id) not in new_data["indexes"]["edgesBySource"]:
                            new_data["indexes"]["edgesBySource"][str(source_id)] = []
                        new_data["indexes"]["edgesBySource"][str(source_id)].append(target_id)
                        
                        if str(target_id) not in new_data["indexes"]["edgesByTarget"]:
                            new_data["indexes"]["edgesByTarget"][str(target_id)] = []
                        new_data["indexes"]["edgesByTarget"][str(target_id)].append(source_id)
                        
                        print(f"  创建边: {source_id} -> {target_id}, 路径={file_paths[file]}")
        except Exception as e:
            print(f"  警告：处理边关系时出错 {file}: {e}")    # 检查每个目标点是否至少有一条有向边
    print("\n检查目标点的连通性...")
    orphaned_targets = []
    for blossom in new_data["blossoms"]:
        target_id = blossom["id"]
        
        # 检查是否有边指向此目标点
        has_edge = False
        for edge in new_data["edges"]:
            if edge["target"] == target_id:
                has_edge = True
                break
                
        if not has_edge:
            orphaned_targets.append(blossom)
            print(f"  警告: 目标点 ID={target_id}, 区域={blossom['region']}, 坐标=({blossom['position']['x']}, {blossom['position']['y']}) 没有入边")
    
    # 处理没有边的目标点 - 尝试使用连续编号的路径
    if orphaned_targets:
        print(f"\n尝试为 {len(orphaned_targets)} 个孤立目标点寻找连续路径...")
        
        # 先按区域分组目标点
        region_targets = {}
        for orphan in orphaned_targets:
            region = orphan["region"]
            if region not in region_targets:
                region_targets[region] = []
            region_targets[region].append(orphan)
        
        # 然后按区域处理
        for region, targets in region_targets.items():
            print(f"\n处理区域 {region} 的 {len(targets)} 个孤立目标点...")
            
            # 获取该区域的所有边
            region_edges = []
            for edge in new_data["edges"]:
                # 找到起点对应的传送点
                source_teleport = None
                for teleport in new_data["teleports"]:
                    if teleport["id"] == edge["source"]:
                        source_teleport = teleport
                        break
                
                if source_teleport and source_teleport["region"] == region:
                    region_edges.append(edge)
            if not region_edges:
                print(f"  区域 {region} 没有现有路径，无法连接孤立目标点")
                continue
                
            # 从每条边的路径中提取区域和编号
            route_info = []
            for edge in region_edges:
                route = edge["route"]
                file_name = os.path.basename(route)
                result = parse_region_area_number(file_name)
                if len(result) == 5:  # 特殊格式
                    region_name, region_num, area, route_num, route_sub_num = result
                else:  # 标准格式
                    region_name, region_num, area, route_num = result
                    route_sub_num = None
                    
                if region_name and region_num and area and route_num:
                    info = {
                        "edge": edge,
                        "region_name": region_name,
                            "region_num": region_num,
                            "area": area,
                            "route_num": route_num,
                            "file_name": file_name
                        }
                    if route_sub_num is not None:
                        info["route_sub_num"] = route_sub_num
                        route_info.append(info)
            
            # 按区域和地区分组
            area_routes = {}
            for info in route_info:
                key = f"{info['region_name']}{info['region_num']}-{info['area']}"
                if key not in area_routes:
                    area_routes[key] = []
                area_routes[key].append(info)
            
            # 对每个地区内的路线按编号排序
            for key, routes in area_routes.items():
                routes.sort(key=lambda x: x["route_num"])
            
            # 查找区域内每个孤立目标点附近的路径
            for orphan in targets:
                print(f"  处理目标点 ID={orphan['id']}, 坐标=({orphan['position']['x']}, {orphan['position']['y']})")
                
                # 找到最近的传送点
                nearest_teleport = None
                min_distance = float('inf')
                
                for teleport in new_data["teleports"]:
                    if teleport["region"] == orphan["region"]:
                        distance = calculate_distance(
                            teleport["position"]["x"], teleport["position"]["y"],
                            orphan["position"]["x"], orphan["position"]["y"]
                        )
                        
                        if distance < min_distance:
                            min_distance = distance
                            nearest_teleport = teleport
                
                if not nearest_teleport:
                    print(f"    未找到区域 {orphan['region']} 内的传送点")
                    continue
                
                # 查找以这个传送点为起点的所有路径
                teleport_routes = []
                for key, routes in area_routes.items():
                    for info in routes:
                        if info["edge"]["source"] == nearest_teleport["id"]:
                            teleport_routes.append(info)
                
                if not teleport_routes:
                    print(f"    未找到以传送点 ID={nearest_teleport['id']} 为起点的路径")
                    continue
                
                # 按路线编号排序
                teleport_routes.sort(key=lambda x: x["route_num"])
                
                # 找到编号最大的路径
                last_route = teleport_routes[-1]
                next_num = last_route["route_num"] + 1
                print(f"    找到传送点 ID={nearest_teleport['id']} 的最后一条路径: {last_route['file_name']}")
                
                # 检查是否是特殊格式路径
                if "-" in last_route['area']:
                    # 特殊格式路径（如"清泉镇-4"）
                    area_parts = last_route['area'].split("-")
                    if len(area_parts) == 2:
                        print(f"    建议手动创建新路径: {last_route['region_name']}{last_route['region_num']}-{area_parts[0]}-{area_parts[1]}-{next_num}.json")
                    else:
                        print(f"    建议手动创建新路径: {last_route['region_name']}{last_route['region_num']}-{last_route['area']}-{next_num}.json")
                else:
                    # 标准格式路径
                    print(f"    建议手动创建新路径: {last_route['region_name']}{last_route['region_num']}-{last_route['area']}-{next_num}.json")
                
                print(f"    从传送点 ({nearest_teleport['position']['x']}, {nearest_teleport['position']['y']}) 到目标点 ({orphan['position']['x']}, {orphan['position']['y']})")
      # 按区域排序传送点和地脉花
    print("\n按区域对节点进行排序...")
    
    # 对传送点按区域排序
    new_data["teleports"] = sorted(new_data["teleports"], key=lambda x: get_region_sort_key(x["region"]))
    
    # 对地脉花按区域排序
    new_data["blossoms"] = sorted(new_data["blossoms"], key=lambda x: get_region_sort_key(x["region"]))
      # 更新排序后的ID（可选）
    for i, teleport in enumerate(new_data["teleports"]):
        teleport["id"] = i + 1
    
    for i, blossom in enumerate(new_data["blossoms"]):
        blossom["id"] = i + 1000
      # 更新边的引用
    for edge in new_data["edges"]:
        # 查找新的source ID
        for teleport in new_data["teleports"]:
            if calculate_distance(teleport["position"]["x"], teleport["position"]["y"], 
                                 edge["sourcePosition"]["x"], edge["sourcePosition"]["y"]) < 10:
                edge["source"] = teleport["id"]
                break
        
        # 查找新的target ID
        for blossom in new_data["blossoms"]:
            if calculate_distance(blossom["position"]["x"], blossom["position"]["y"],
                                 edge["targetPosition"]["x"], edge["targetPosition"]["y"]) < 10:
                edge["target"] = blossom["id"]
                break
    
    # 在更新ID后删除位置信息
    print("\n删除边数据中的位置信息...")
    for edge in new_data["edges"]:
        if "sourcePosition" in edge:
            del edge["sourcePosition"]
        if "targetPosition" in edge:
            del edge["targetPosition"]
    
    # 按照target的顺序排列edges
    print("\n按照目标节点(target)的顺序排列边...")
    new_data["edges"] = sorted(new_data["edges"], key=lambda x: x["target"])
    
    # 创建节点到节点的顺序边
    sequential_edges_count = create_sequential_edges(new_data)
    
    # 重新排序所有边（包括新的顺序边）
    print("\n重新排序所有边...")
    new_data["edges"] = sorted(new_data["edges"], key=lambda x: (x.get("type", "teleport"), x["target"]))
    
    # 重建索引
    new_data["indexes"] = {
        "edgesBySource": {},
        "edgesByTarget": {}
    }
    
    for edge in new_data["edges"]:
        source_id = edge["source"]
        target_id = edge["target"]
        
        if str(source_id) not in new_data["indexes"]["edgesBySource"]:
            new_data["indexes"]["edgesBySource"][str(source_id)] = []
        new_data["indexes"]["edgesBySource"][str(source_id)].append(target_id)
        
        if str(target_id) not in new_data["indexes"]["edgesByTarget"]:
            new_data["indexes"]["edgesByTarget"][str(target_id)] = []
        new_data["indexes"]["edgesByTarget"][str(target_id)].append(source_id)
    
    # 保存新数据结构
    output_file = os.path.join(script_dir, "LeyLineOutcropData.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
    print(f"\n已生成新的数据结构: {output_file}")
    print(f"传送点数量: {len(new_data['teleports'])}")
    print(f"地脉花数量: {len(new_data['blossoms'])}")
    print(f"总节点数量: {len(new_data['teleports']) + len(new_data['blossoms'])}")
    print(f"传送点到地脉花边数量: {len([e for e in new_data['edges'] if e.get('type', 'teleport') == 'teleport'])}")
    print(f"节点间顺序边数量: {sequential_edges_count}")
    print(f"总边数量: {len(new_data['edges'])}")
    print(f"区域排序顺序: {', '.join([k for k, v in sorted(REGION_ORDER.items(), key=lambda item: item[1]) if v < 99])}")
    # 报告孤立目标点
    remaining_orphans = 0
    orphaned_blossoms = []
    for blossom in new_data["blossoms"]:
        target_id = blossom["id"]
        has_edge = False
        for edge in new_data["edges"]:
            if edge["target"] == target_id:
                has_edge = True
                break
        if not has_edge:
            remaining_orphans += 1
            orphaned_blossoms.append(blossom)
    
    if remaining_orphans > 0:
        print(f"\n注意: 仍有 {remaining_orphans} 个目标点没有入边")
        print("这些目标点按区域排序如下:")
        # 按区域分组展示孤立目标点
        orphaned_by_region = {}
        for orphan in orphaned_blossoms:
            region = orphan["region"]
            base_region = re.match(r"^([^0-9]+)", region)
            if base_region:
                base_region = base_region.group(1)
                if base_region not in orphaned_by_region:
                    orphaned_by_region[base_region] = []
                orphaned_by_region[base_region].append(orphan)
        
        # 按照指定顺序显示区域
        for region_name, _ in sorted(REGION_ORDER.items(), key=lambda item: item[1]):
            if region_name in orphaned_by_region:
                print(f"\n  {region_name}区域的孤立目标点:")
                for orphan in orphaned_by_region[region_name]:
                    print(f"    ID={orphan['id']}, 区域={orphan['region']}, 坐标=({orphan['position']['x']}, {orphan['position']['y']})")
        
        print("\n请按照之前的建议手动创建连续编号的路径文件")
    else:
        print("\n✓ 所有目标点都至少有一条入边")
    
    return new_data

def create_sequential_edges(new_data):
    """创建节点到节点的顺序边，实现正确的分支逻辑
    
    正确的分支规则：
    1. 主路线到分支: 蒙德2-3 → 蒙德2-4-1, 蒙德2-4-2 
    2. 分支到同序号分支: 蒙德2-4-1 → 蒙德2-5-1 (优先) → 蒙德2-5 (备选) → 终点
    3. 分支到同序号分支: 蒙德2-4-2 → 蒙德2-5-2 (优先) → 蒙德2-5 (备选) → 终点
    4. 分支内部不连接: 蒙德2-4-1 和 蒙德2-4-2 之间不相互连接
    5. 主路线到主路线: 当没有分支时的直接连接
    
    基于实际路径文件查找对应的路线
    """
    print("\n创建节点到节点的顺序边...")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pathing_dir = os.path.join(script_dir, "assets", "pathing")
    
    # 按基本区域分组地脉花节点（区域名+区域编号，如"蒙德2"）
    region_groups = {}
    for blossom in new_data["blossoms"]:
        region = blossom["region"]
        parts = region.split("-")
        if len(parts) >= 2:
            # 提取基本区域名：区域名+区域编号（如"蒙德2"）
            import re
            match = re.match(r'^([^0-9]+)(\d+)', parts[0])
            if match:
                region_name = match.group(1)  # 如 "蒙德"
                region_num = match.group(2)   # 如 "2"
                base_region = region_name + region_num  # 如 "蒙德2"
                if base_region not in region_groups:
                    region_groups[base_region] = []
                region_groups[base_region].append(blossom)
    
    # 创建地脉花节点的映射：region -> blossom
    region_to_blossom = {}
    for blossom in new_data["blossoms"]:
        region_to_blossom[blossom["region"]] = blossom
    
    # 收集所有存在的路径文件
    available_routes = {}
    for root, _, files in os.walk(pathing_dir):
        for file in sorted(files):
            if not file.endswith('.json') or 'rerun' in file or 'rerun' in root:
                continue
            if "target" in root.split(os.path.sep):
                continue
            
            relative_path = os.path.relpath(os.path.join(root, file), script_dir)
            relative_path = relative_path.replace("\\", "/")
            available_routes[file] = relative_path
    
    sequential_edges = []
    
    # 为每个区域创建顺序边
    for base_region, blossoms in region_groups.items():
        print(f"\n处理区域: {base_region}")
        
        # 将节点分为主路线和分支路线
        main_routes = {}  # {route_num: blossom}
        branch_routes = {}  # {route_num: {branch_num: blossom}}
        
        for blossom in blossoms:
            region = blossom["region"]
            parts = region.split("-")
            
            if len(parts) == 2:  # 主路线格式："蒙德2-3" 
                try:
                    route_num = int(parts[1])
                    main_routes[route_num] = blossom
                    print(f"  主路线: {region} (路线{route_num})")
                except ValueError:
                    print(f"    警告：无法解析主路线编号: {region}")
                    
            elif len(parts) == 3:  # 分支路线格式："蒙德2-4-1"
                try:
                    route_num = int(parts[1])
                    branch_num = int(parts[2])
                    if route_num not in branch_routes:
                        branch_routes[route_num] = {}
                    branch_routes[route_num][branch_num] = blossom
                    print(f"  分支路线: {region} (路线{route_num}, 分支{branch_num})")
                except ValueError:
                    print(f"    警告：无法解析分支路线编号: {region}")
        
        print(f"  找到 {len(main_routes)} 个主路线，{len(branch_routes)} 个分支组")
          # 辅助函数：查找路径文件
        def find_route_file(source_region, target_region):
            # 从目标区域推断文件名
            result = None
            print(f"    查找路径文件: {source_region} → {target_region}")
            
            for blossom in new_data["blossoms"]:
                if blossom["region"] == target_region:
                    # 尝试通过目标区域构造文件名
                    parts = target_region.split("-")
                    print(f"      目标区域部分: {parts}")
                    
                    if len(parts) == 2:  # 主路线
                        # 例如: 蒙德2-3 -> 蒙德2-xxx-3.json
                        pattern = f"-{parts[1]}.json"
                        print(f"      主路线模式: {pattern}")
                        for filename in available_routes.keys():
                            if pattern in filename and parts[0] in filename:
                                result = available_routes[filename]
                                print(f"      找到匹配文件: {filename} -> {result}")
                                break
                    elif len(parts) == 3:  # 分支路线
                        # 例如: 蒙德2-4-1 -> 蒙德2-xxx-4-1.json
                        pattern = f"-{parts[1]}-{parts[2]}.json"
                        print(f"      分支路线模式: {pattern}")
                        for filename in available_routes.keys():
                            if pattern in filename and parts[0] in filename:
                                result = available_routes[filename]
                                print(f"      找到匹配文件: {filename} -> {result}")
                                break
                    
                    if not result:
                        print(f"      警告：未找到匹配的路径文件")
                        print(f"      可用文件: {list(available_routes.keys())[:10]}...")  # 只显示前10个
                    break
            return result# 1. 创建主路线到分支路线的连接
        for main_route_num, main_blossom in main_routes.items():
            # 找到下一个路线号，看是否有分支
            next_route_num = main_route_num + 1
            
            if next_route_num in branch_routes:
                # 连接到下一个路线号的所有分支
                for branch_num, branch_blossom in branch_routes[next_route_num].items():
                    route_file = find_route_file(main_blossom["region"], branch_blossom["region"])
                    
                    if route_file:
                        edge = {
                            "source": main_blossom["id"],
                            "target": branch_blossom["id"],
                            "route": route_file
                        }
                        sequential_edges.append(edge)
                        print(f"    主路线到分支: {main_blossom['region']} → {branch_blossom['region']}")
        
        # 2. 创建分支到下一个分支的连接（同序号优先）
        for route_num, branches in branch_routes.items():
            next_route_num = route_num + 1
            
            for branch_num, branch_blossom in branches.items():
                # 优先连接到同序号的下一个分支
                target_found = False
                
                # 第一优先级：同序号分支 (蒙德2-4-1 → 蒙德2-5-1)
                if next_route_num in branch_routes and branch_num in branch_routes[next_route_num]:
                    target_blossom = branch_routes[next_route_num][branch_num]
                    route_file = find_route_file(branch_blossom["region"], target_blossom["region"])
                    
                    if route_file:
                        edge = {
                            "source": branch_blossom["id"],
                            "target": target_blossom["id"],
                            "route": route_file
                        }
                        sequential_edges.append(edge)
                        print(f"    分支到同序号分支: {branch_blossom['region']} → {target_blossom['region']}")
                        target_found = True
                
                # 第二优先级：主路线 (蒙德2-4-1 → 蒙德2-5)
                if not target_found and next_route_num in main_routes:
                    target_blossom = main_routes[next_route_num]
                    route_file = find_route_file(branch_blossom["region"], target_blossom["region"])
                    
                    if route_file:
                        edge = {
                            "source": branch_blossom["id"],
                            "target": target_blossom["id"],
                            "route": route_file
                        }
                        sequential_edges.append(edge)
                        print(f"    分支到主路线: {branch_blossom['region']} → {target_blossom['region']}")
                        target_found = True
                
                # 如果没有找到目标，则为路线终点
                if not target_found:
                    print(f"    分支终点: {branch_blossom['region']} (无下一个目标)")
        
        # 3. 创建主路线到主路线的连接（当没有分支时）
        sorted_main_routes = sorted(main_routes.keys())
        for i in range(len(sorted_main_routes) - 1):
            current_route = sorted_main_routes[i]
            next_route = sorted_main_routes[i + 1]
            
            # 只有在下一个路线没有分支时，才创建主路线到主路线的连接
            if next_route not in branch_routes:
                source_blossom = main_routes[current_route]
                target_blossom = main_routes[next_route]
                route_file = find_route_file(source_blossom["region"], target_blossom["region"])
                
                if route_file:
                    edge = {
                        "source": source_blossom["id"],
                        "target": target_blossom["id"],
                        "route": route_file
                    }
                    sequential_edges.append(edge)
                    print(f"    主路线连接: {source_blossom['region']} → {target_blossom['region']}")
    
    # 将新的顺序边添加到数据中
    new_data["edges"].extend(sequential_edges)
    print(f"\n总共创建了 {len(sequential_edges)} 条顺序边")
    
    return len(sequential_edges)

def test_filename_parsing():
    """测试文件名解析功能，确保能正确处理各种格式"""
    test_files = [
        "蒙德1-风啸山岭-1.json",       # 标准格式
        "璃月3-轻策庄-2.json",         # 标准格式
        "蒙德2-清泉镇-4-1.json",       # 特殊格式（双连字符数字）
        "须弥2-须弥城-3-2.json",       # 特殊格式
        "纳塔1-区域-5.5.json"          # 小数点路线编号
    ]
    
    print("测试文件名解析结果:")
    for filename in test_files:
        result = parse_region_area_number(filename)
        if len(result) == 5:  # 特殊格式
            region_name, region_num, area, route_num, route_sub_num = result
            print(f"文件: {filename} (特殊格式)")
            print(f"  区域名称: {region_name}")
            print(f"  区域编号: {region_num}")
            print(f"  地区: {area}")
            print(f"  路线编号: {route_num}")
            print(f"  路线子编号: {route_sub_num}")
        else:  # 标准格式
            region_name, region_num, area, route_num = result
            print(f"文件: {filename} (标准格式)")
            print(f"  区域名称: {region_name}")
            print(f"  区域编号: {region_num}")
            print(f"  地区: {area}")
            print(f"  路线编号: {route_num}")
          # 测试格式化逻辑
        if region_name and region_num and route_num:
            if len(result) == 5:  # 特殊格式
                route_sub_num = result[4]
                # 特殊格式显示为: 蒙德2-5-1 (区域名-区域编号-路线编号-路线子编号)
                formatted = f"{region_name}{region_num}-{int(route_num)}-{int(route_sub_num)}"
            else:  # 标准格式
                # 标准格式显示为: 枫丹1-1 (区域名-区域编号-路线编号)
                formatted = f"{region_name}{region_num}-{int(route_num)}"
            print(f"  格式化区域: {formatted}")
        else:
            print(f"  解析失败")
        print("")


if __name__ == "__main__":
    # 测试文件名解析
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        test_filename_parsing()
    else:
        generate_new_data_structure_from_pathing()

