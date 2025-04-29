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


def process_pathing_files():
    """Process all pathing files and generate LeyLineOutcropData structure"""
    # Path to the directory containing pathing files
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pathing_dir = os.path.join(script_dir, "assets", "pathing")
    
    print(f"Looking for pathing files in: {pathing_dir}")
    
    nodes = []
    node_id_map = {}  # Map to track nodes by ID
    next_node_id = 1
    
    # Get all pathing JSON files
    pathing_files = []
    for root, _, files in os.walk(pathing_dir):
        for file in files:
            if file.endswith('.json'):
                pathing_files.append(os.path.join(root, file))
    
    print(f"Found {len(pathing_files)} pathing files")
    
    # Process each pathing file
    for file_path in pathing_files:
        file_name = os.path.basename(file_path)
        
        # Skip non-pathing files if needed
        if not file_name[0].isalpha():
            continue
            
        # Extract region from filename (e.g., "蒙德1-风起地-1.json" -> "蒙德")
        try:
            region = file_name.split('-')[0]
        except IndexError:
            print(f"Skipping file with invalid format: {file_name}")
            continue
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                path_data = json.load(f)
            
            positions = path_data.get("positions", [])
            
            if not positions:
                print(f"No positions found in {file_name}")
                continue
            
            first_pos = positions[0]
            last_pos = positions[-1]
            
            # Process teleport points as nodes
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
                    next_node_id += 1
                    nodes.append(teleport_node)
                    node_id_map[teleport_node["id"]] = teleport_node
                
                # Process target node if it exists
                if last_pos.get("type") == "target":
                    target_x = format_coord(float(last_pos["x"]))
                    target_y = format_coord(float(last_pos["y"]))
                    
                    # Check if we already have a nearby blossom node
                    target_node = find_nearby_node(nodes, target_x, target_y, "blossom")
                    
                    if not target_node:
                        # Create new blossom node
                        new_target = {
                            "id": next_node_id,
                            "type": "blossom",
                            "region": region,
                            "position": {"x": target_x, "y": target_y},
                            "prev": [],
                            "next": []
                        }
                        # Add teleport node id to prev list
                        new_target["prev"].append(teleport_node["id"])
                        
                        next_node_id += 1
                        nodes.append(new_target)
                        node_id_map[new_target["id"]] = new_target
                        target_node = new_target
                    else:
                        # Check if teleport_node["id"] already exists in target_node["prev"] 
                        if teleport_node["id"] not in target_node["prev"]:
                            target_node["prev"].append(teleport_node["id"])
                    
                    # Add target to teleport's next array
                    # Use relative path for route
                    relative_path = os.path.relpath(file_path, os.path.dirname(os.path.dirname(pathing_dir)))
                    relative_path = relative_path.replace("\\", "/")  # Ensure consistent path format
                    
                    route_info = {
                        "target": target_node["id"],
                        "route": relative_path
                    }
                    
                    # Check if this route is already in teleport's next array
                    route_exists = False
                    for route in teleport_node["next"]:
                        if route["target"] == target_node["id"]:
                            route_exists = True
                            break
                    
                    if not route_exists:
                        teleport_node["next"].append(route_info)
                        
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    
    print(f"Generated {len(nodes)} nodes")
    
    # Save to JSON file
    ley_line_data = {"node": nodes}
    output_path = os.path.join(script_dir, "LeyLineOutcropData.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(ley_line_data, f, ensure_ascii=False, indent=4)
    
    print(f"Saved LeyLineOutcropData.json with {len(nodes)} nodes")
    return ley_line_data


if __name__ == "__main__":
    process_pathing_files() 