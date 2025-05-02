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
    """Extract route number and area from filename (e.g., "蒙德3-奔狼领-2.json" -> ("蒙德3", "奔狼领", 2))"""
    parts = filename.split('-')
    if len(parts) < 3:
        return None, None, None
    
    region = parts[0]
    area = parts[1]
    
    # Extract number from last part (remove .json)
    num_part = parts[2].split('.')[0]
    try:
        num = int(num_part)
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
    if not positions or len(positions) < 2:
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
    for root, _, files in os.walk(pathing_dir):
        # Skip target directory
        if "target" in root.split(os.path.sep):
            continue
            
        for file in files:
            if file.endswith('.json') and 'rerun' not in file and 'rerun' not in root:
                file_path = os.path.join(root, file)
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
        if not last_pos or last_pos.get("type") != "target":
            continue
        
        # Extract region from filename
        file_name = os.path.basename(file_path)
        region = parse_region_from_filename(file_name)
        if not region:
            continue
        
        region, area, num = extract_route_number(file_name)
        if not region or not area or not num:
            continue
        
        # Process target points as blossom nodes
        target_x = format_coord(float(last_pos["x"]))
        target_y = format_coord(float(last_pos["y"]))
        
        # Check if we already have a nearby blossom node
        blossom_node = find_nearby_node(nodes, target_x, target_y, "blossom")
        
        if not blossom_node:
            # Create new blossom node
            blossom_node = {
                "id": next_node_id,
                "type": "blossom",
                "region": region,
                "position": {"x": target_x, "y": target_y},
                "prev": [],
                "next": []
            }
            nodes.append(blossom_node)
            node_map[next_node_id] = blossom_node
            next_node_id += 1
        
        # Store the blossom node in our region-area-num map
        key = f"{region}-{area}"
        if key not in region_area_num_to_target:
            region_area_num_to_target[key] = {}
        region_area_num_to_target[key][num] = {
            "node": blossom_node,
            "file_path": file_path
        }
    
    # Third pass: Connect teleport points to their target blossoms
    for file_path, path_data in file_data.items():
        first_pos, last_pos = get_first_and_last_positions(path_data)
        if not first_pos or not last_pos:
            continue
        
        # Skip if this isn't a valid target
        if last_pos.get("type") != "target":
            continue
        
        # Extract file info
        file_name = os.path.basename(file_path)
        region, area, num = extract_route_number(file_name)
        
        # Skip if we can't parse the file name
        if not region or not area or not num:
            continue
        
        # For teleport source type, connect to target
        if first_pos.get("type") == "teleport":
            # Find teleport node
            x = format_coord(float(first_pos["x"]))
            y = format_coord(float(first_pos["y"]))
            teleport_node = find_nearby_node(nodes, x, y, "teleport")
            
            # Find target blossom node
            target_x = format_coord(float(last_pos["x"]))
            target_y = format_coord(float(last_pos["y"]))
            target_node = find_nearby_node(nodes, target_x, target_y, "blossom")
            
            if teleport_node and target_node:
                # Add connection
                relative_path = generate_relative_path(file_path, script_dir)
                
                # Add target to teleport's next array if not already there
                route_exists = False
                for route in teleport_node["next"]:
                    if route["target"] == target_node["id"]:
                        route_exists = True
                        break
                
                if not route_exists:
                    teleport_node["next"].append({
                        "target": target_node["id"],
                        "route": relative_path
                    })
                
                # Add teleport to target's prev array if not already there
                if teleport_node["id"] not in target_node["prev"]:
                    target_node["prev"].append(teleport_node["id"])
    
    # Fourth pass: Connect nodes based on numerical sequence
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
    
    # Fifth pass: Connect "path" type sources to their targets
    for file_path, path_data in file_data.items():
        first_pos, last_pos = get_first_and_last_positions(path_data)
        if not first_pos or not last_pos:
            continue
        
        # Skip if not a path type or not a valid target
        if first_pos.get("type") != "path" or last_pos.get("type") != "target":
            continue
        
        # Extract file info
        file_name = os.path.basename(file_path)
        region, area, num = extract_route_number(file_name)
        
        # Skip if we can't parse the file name
        if not region or not area or not num:
            continue
        
        # Try to find the source in previous route target
        prev_num = num - 1
        key = f"{region}-{area}"
        if key in region_area_num_to_target and prev_num in region_area_num_to_target[key]:
            prev_info = region_area_num_to_target[key][prev_num]
            prev_node = prev_info["node"]
            
            # Find the current target node
            target_x = format_coord(float(last_pos["x"]))
            target_y = format_coord(float(last_pos["y"]))
            target_node = find_nearby_node(nodes, target_x, target_y, "blossom")
            
            if prev_node and target_node:
                # Add connection from previous target to current target
                relative_path = generate_relative_path(file_path, script_dir)
                
                # Add target to previous node's next array if not already there
                route_exists = False
                for route in prev_node["next"]:
                    if route["target"] == target_node["id"]:
                        route_exists = True
                        break
                
                if not route_exists:
                    prev_node["next"].append({
                        "target": target_node["id"],
                        "route": relative_path
                    })
                
                # Add previous node to target's prev array if not already there
                if prev_node["id"] not in target_node["prev"]:
                    target_node["prev"].append(prev_node["id"])
    
    # Save to JSON file
    ley_line_data = {"node": nodes}
    output_path = os.path.join(script_dir, "LeyLineOutcropData.json")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(ley_line_data, f, ensure_ascii=False, indent=4)
    
    print(f"Generated LeyLineOutcropData.json with {len(nodes)} nodes")
    return ley_line_data


if __name__ == "__main__":
    generate_ley_line_data() 