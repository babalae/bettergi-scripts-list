#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import os
import math


def format_coord(num):
    """Format coordinate to 2 decimal places"""
    return round(num, 2)


def calculate_distance(x1, y1, x2, y2):
    """Calculate Euclidean distance between two points"""
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def find_nearby_node(nodes, x, y, node_type, max_distance=50):
    """Find a node of given type within specified distance"""
    for node in nodes:
        if node["type"] != node_type:
            continue
        
        node_x = node["position"]["x"]
        node_y = node["position"]["y"]
        
        if calculate_distance(node_x, node_y, x, y) < max_distance:
            return node
    
    return None


def parse_region_from_filename(filename):
    """Parse region from filename (e.g., "蒙德3-奔狼领-2.json" -> "蒙德3")"""
    parts = filename.split('-')
    if len(parts) < 2:
        return None
    return parts[0]


def extract_route_number(filename):
    """Extract route number and area from filename (e.g., "蒙德3-奔狼领-2.json" -> ("蒙德3", "奔狼领", 2))
       Also supports decimal route numbers (e.g., "蒙德2-清泉镇-3.5.json" -> ("蒙德2", "清泉镇", 3.5))"""
    parts = filename.split('-')
    if len(parts) < 3:
        return None, None, None
    
    region = parts[0]
    area = parts[1]
    
    # Extract number from last part (remove .json)
    num_part = parts[2].split('.json')[0]
    try:
        # Support both integer and decimal route numbers
        num = float(num_part)
        return region, area, num
    except ValueError:
        return region, area, None


def read_pathing_file(file_path):
    """Read a pathing file and return its data"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return None


def get_first_and_last_positions(path_data):
    """Extract first and last positions from pathing data"""
    if not path_data or "positions" not in path_data:
        return None, None
    
    positions = path_data["positions"]
    if not positions or len(positions) < 1:  # Changed from 2 to 1 to handle single-position files
        return None, None
    
    return positions[0], positions[-1]


def generate_relative_path(file_path, script_dir):
    """Generate the appropriate relative path for routes"""
    # Get the path relative to the script directory
    relative_path = os.path.relpath(file_path, os.path.dirname(script_dir))
    # Standardize path separator
    relative_path = relative_path.replace("\\", "/")
    
    # Remove the "AutoLeyLineOutcrop/" prefix if present
    if relative_path.startswith("AutoLeyLineOutcrop/"):
        relative_path = relative_path[len("AutoLeyLineOutcrop/"):]
    
    return relative_path


def generate_ley_line_data():
    """Process pathing files and generate LeyLineOutcropData.json"""
    # Path to the directory containing pathing files
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pathing_dir = os.path.join(script_dir, "assets", "pathing")
    
    print(f"Looking for pathing files in: {pathing_dir}")
    
    # Initialize data structures
    nodes = []
    node_map = {}  # Map to track nodes by ID
    next_node_id = 1
    
    # Used to group files by region and area
    region_area_files = {}
    file_data = {}  # Store file data for each path
    
    # Get all pathing JSON files (excluding rerun files and target directory)
    pathing_files = []
    target_files = {}  # Map target files by region/area/num for reference
    
    for root, _, files in os.walk(pathing_dir):
        for file in files:
            if not file.endswith('.json') or 'rerun' in file or 'rerun' in root:
                continue
                
            file_path = os.path.join(root, file)
            
            # Process target directory files separately
            if "target" in root.split(os.path.sep):
                region, area, num = extract_route_number(file)
                if region and area and num:
                    key = f"{region}-{area}-{num}"
                    target_files[key] = file_path
                continue
            
            pathing_files.append(file_path)
            
            # Read and store file data
            path_data = read_pathing_file(file_path)
            if path_data:
                file_data[file_path] = path_data
            
            # Group files by region and area
            region, area, num = extract_route_number(file)
            if region and area and num:
                key = f"{region}-{area}"
                if key not in region_area_files:
                    region_area_files[key] = []
                region_area_files[key].append((num, file_path))
    
    # Sort files within each group by route number
    for key in region_area_files:
        region_area_files[key].sort()  # Sort by route number
    
    print(f"Found {len(pathing_files)} pathing files (excluding rerun and target files)")
    
    # First pass: Process teleport points (routes that start with teleport)
    for file_path, path_data in file_data.items():
        first_pos, _ = get_first_and_last_positions(path_data)
        if not first_pos:
            continue
        
        # Extract region from filename
        file_name = os.path.basename(file_path)
        region = parse_region_from_filename(file_name)
        if not region:
            continue
        
        # Process teleport points
        if first_pos.get("type") == "teleport":
            x = format_coord(float(first_pos["x"]))
            y = format_coord(float(first_pos["y"]))
            
            # Check if we already have a nearby teleport node
            teleport_node = find_nearby_node(nodes, x, y, "teleport")
            
            if not teleport_node:
                # Create new teleport node
                teleport_node = {
                    "id": next_node_id,
                    "type": "teleport",
                    "region": region,
                    "position": {"x": x, "y": y},
                    "prev": [],
                    "next": []
                }
                nodes.append(teleport_node)
                node_map[next_node_id] = teleport_node
                next_node_id += 1
            
            # Store teleport node in node_map
            node_map[teleport_node["id"]] = teleport_node
    
    # Build a map of first positions for path-type routes
    # This will help us connect path routes to each other
    path_first_positions = {}
    for file_path, path_data in file_data.items():
        first_pos, _ = get_first_and_last_positions(path_data)
        if not first_pos or first_pos.get("type") != "path":
            continue
        
        file_name = os.path.basename(file_path)
        region, area, num = extract_route_number(file_name)
        if not region or not area or not num:
            continue
        
        key = f"{region}-{area}-{num}"
        path_first_positions[key] = {
            "x": format_coord(float(first_pos["x"])),
            "y": format_coord(float(first_pos["y"])),
            "file_path": file_path
        }
    
    # Second pass: Process all target points to create blossom nodes
    # Also maintain a map from file info to target nodes
    region_area_num_to_target = {}

    for file_path, path_data in file_data.items():
        _, last_pos = get_first_and_last_positions(path_data)
        if not last_pos:
            continue
        
        # Extract region from filename
        file_name = os.path.basename(file_path)
        region = parse_region_from_filename(file_name)
        if not region:
            continue
        
        region, area, num = extract_route_number(file_name)
        if not region or not area or not num:
            continue
        
        # Process last points as blossom nodes (regardless of type)
        target_x = format_coord(float(last_pos["x"]))
        target_y = format_coord(float(last_pos["y"]))
        
        # Determine node type - default to blossom if type is not specified or is target
        node_type = last_pos.get("type", "blossom")
        if node_type == "target":
            node_type = "blossom"
        
        # Check if we already have a nearby node of the same type
        blossom_node = find_nearby_node(nodes, target_x, target_y, node_type)
        
        if not blossom_node:
            # Create new node
            blossom_node = {
                "id": next_node_id,
                "type": node_type,
                "region": region,
                "position": {"x": target_x, "y": target_y},
                "prev": [],
                "next": []
            }
            nodes.append(blossom_node)
            node_map[next_node_id] = blossom_node
            next_node_id += 1
        
        # Store the node in our region-area-num map
        key = f"{region}-{area}"
        if key not in region_area_num_to_target:
            region_area_num_to_target[key] = {}
        region_area_num_to_target[key][num] = {
            "node": blossom_node,
            "file_path": file_path
        }
    
    # Special handling for files with only target positions (like 纳塔4-溶水域-2.json)
    for file_path in pathing_files:
        file_name = os.path.basename(file_path)
        region, area, num = extract_route_number(file_name)
        if not region or not area or not num:
            continue
            
        # Check if this file has target data but no blossom node yet
        key = f"{region}-{area}"
        if key in region_area_num_to_target and num not in region_area_num_to_target[key]:
            # Check if we have a target file for this route
            target_key = f"{region}-{area}-{num}"
            if target_key in target_files:
                target_path = target_files[target_key]
                target_data = read_pathing_file(target_path)
                
                if target_data and "positions" in target_data and target_data["positions"]:
                    # Create node from the target file
                    target_pos = target_data["positions"][0]
                    # Determine node type - default to blossom if type is not specified or is target
                    node_type = target_pos.get("type", "blossom")
                    if node_type == "target":
                        node_type = "blossom"
                    
                    target_x = format_coord(float(target_pos["x"]))
                    target_y = format_coord(float(target_pos["y"]))
                    
                    # Check if we already have a nearby node of the same type
                    blossom_node = find_nearby_node(nodes, target_x, target_y, node_type)
                    
                    if not blossom_node:
                        # Create new node
                        blossom_node = {
                            "id": next_node_id,
                            "type": node_type,
                            "region": region,
                            "position": {"x": target_x, "y": target_y},
                            "prev": [],
                            "next": []
                        }
                        nodes.append(blossom_node)
                        node_map[next_node_id] = blossom_node
                        next_node_id += 1
                    
                    # Add to region_area_num_to_target map
                    if key not in region_area_num_to_target:
                        region_area_num_to_target[key] = {}
                    region_area_num_to_target[key][num] = {
                        "node": blossom_node,
                        "file_path": file_path
                    }
    
    # Third pass: Connect teleport points to their destination nodes
    for file_path, path_data in file_data.items():
        first_pos, last_pos = get_first_and_last_positions(path_data)
        if not first_pos or not last_pos:
            continue
        
        # Extract file info
        file_name = os.path.basename(file_path)
        region, area, num = extract_route_number(file_name)
        
        # Skip if we can't parse the file name
        if not region or not area or not num:
            continue
        
        # For teleport source type, connect to destination
        if first_pos.get("type") == "teleport":
            # Find teleport node
            x = format_coord(float(first_pos["x"]))
            y = format_coord(float(first_pos["y"]))
            teleport_node = find_nearby_node(nodes, x, y, "teleport")
            
            # Find destination node
            dest_x = format_coord(float(last_pos["x"]))
            dest_y = format_coord(float(last_pos["y"]))
            
            # Determine node type, default to blossom for target or if not specified
            dest_type = last_pos.get("type", "blossom")
            if dest_type == "target":
                dest_type = "blossom"
                
            dest_node = find_nearby_node(nodes, dest_x, dest_y, dest_type)
            
            if teleport_node and dest_node:
                # Add connection
                relative_path = generate_relative_path(file_path, script_dir)
                
                # Add destination to teleport's next array if not already there
                route_exists = False
                for route in teleport_node["next"]:
                    if route["target"] == dest_node["id"]:
                        route_exists = True
                        break
                
                if not route_exists:
                    teleport_node["next"].append({
                        "target": dest_node["id"],
                        "route": relative_path
                    })
                
                # Add teleport to destination's prev array if not already there
                if teleport_node["id"] not in dest_node["prev"]:
                    dest_node["prev"].append(teleport_node["id"])
    
    # Fourth pass: Connect nodes based on numerical sequence and handle branch paths
    for region_area, num_to_target in region_area_num_to_target.items():
        route_numbers = sorted(num_to_target.keys())
        
        # Connect each route to the next numerically
        for i in range(len(route_numbers) - 1):
            current_num = route_numbers[i]
            next_num = route_numbers[i + 1]
            
            current_info = num_to_target[current_num]
            next_info = num_to_target[next_num]
            
            current_node = current_info["node"]
            next_node = next_info["node"]
            next_file_path = next_info["file_path"]
            
            # Create the connection
            relative_path = generate_relative_path(next_file_path, script_dir)
            
            # Check if this is a main path or a branch path
            is_branch = False
            
            # If route number has decimal part (like 3.5), it's a branch
            if current_num != int(current_num) or next_num != int(next_num):
                is_branch = True
            
            # For branch paths, we also need to connect to the next main path
            # For example, if we have 3, 3.5, 4, we need to connect 3 to both 3.5 and 4
            if not is_branch and i + 2 < len(route_numbers):
                # Check if the next route is a branch (has decimal part)
                possible_branch_num = route_numbers[i + 1]
                if int(possible_branch_num) == int(current_num) + 1 and possible_branch_num != int(possible_branch_num):
                    # This is a branch route, also connect current to route after branch
                    future_num = route_numbers[i + 2]
                    future_info = num_to_target[future_num]
                    future_node = future_info["node"]
                    future_file_path = future_info["file_path"]
                    
                    # Create the connection to the future node
                    future_relative_path = generate_relative_path(future_file_path, script_dir)
                    
                    # Add future node to current's next array if not already there
                    future_route_exists = False
                    for route in current_node["next"]:
                        if route["target"] == future_node["id"]:
                            future_route_exists = True
                            break
                    
                    if not future_route_exists:
                        current_node["next"].append({
                            "target": future_node["id"],
                            "route": future_relative_path
                        })
                    
                    # Add current node to future's prev array if not already there
                    if current_node["id"] not in future_node["prev"]:
                        future_node["prev"].append(current_node["id"])
            
            # Regular connection to the next numerical route
            # Add next node to current's next array if not already there
            route_exists = False
            for route in current_node["next"]:
                if route["target"] == next_node["id"]:
                    route_exists = True
                    break
            
            if not route_exists:
                current_node["next"].append({
                    "target": next_node["id"],
                    "route": relative_path
                })
            
            # Add current node to next's prev array if not already there
            if current_node["id"] not in next_node["prev"]:
                next_node["prev"].append(current_node["id"])
    
    # Fifth pass: Connect "path" type sources to their destinations
    for file_path, path_data in file_data.items():
        first_pos, last_pos = get_first_and_last_positions(path_data)
        if not first_pos or not last_pos:
            continue
        
        # Skip if not a path type
        if first_pos.get("type") != "path":
            continue
        
        # Extract file info
        file_name = os.path.basename(file_path)
        region, area, num = extract_route_number(file_name)
        
        # Skip if we can't parse the file name
        if not region or not area or not num:
            continue
        
        # Try to find the source in previous route 
        prev_num = num - 1
        key = f"{region}-{area}"
        if key in region_area_num_to_target and prev_num in region_area_num_to_target[key]:
            prev_info = region_area_num_to_target[key][prev_num]
            prev_node = prev_info["node"]
            
            # Find the current destination node
            dest_x = format_coord(float(last_pos["x"]))
            dest_y = format_coord(float(last_pos["y"]))
            
            # Determine node type, default to blossom for target or if not specified
            dest_type = last_pos.get("type", "blossom")
            if dest_type == "target":
                dest_type = "blossom"
                
            dest_node = find_nearby_node(nodes, dest_x, dest_y, dest_type)
            
            if prev_node and dest_node:
                # Add connection from previous node to current destination
                relative_path = generate_relative_path(file_path, script_dir)
                
                # Add destination to previous node's next array if not already there
                route_exists = False
                for route in prev_node["next"]:
                    if route["target"] == dest_node["id"]:
                        route_exists = True
                        break
                
                if not route_exists:
                    prev_node["next"].append({
                        "target": dest_node["id"],
                        "route": relative_path
                    })
                
                # Add previous node to destination's prev array if not already there
                if prev_node["id"] not in dest_node["prev"]:
                    dest_node["prev"].append(prev_node["id"])
    
    # Save to JSON file
    ley_line_data = {"node": nodes}
    output_path = os.path.join(script_dir, "LeyLineOutcropData.json")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(ley_line_data, f, ensure_ascii=False, indent=4)
    
    print(f"Generated LeyLineOutcropData.json with {len(nodes)} nodes")
    return ley_line_data


if __name__ == "__main__":
    generate_ley_line_data()