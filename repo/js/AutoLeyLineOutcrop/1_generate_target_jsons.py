import os
import json
import shutil

def create_target_jsons():
    """
    Create modified JSON files in assets/pathing/target directory based on 
    JSON files in assets/pathing. Each new file will keep the info section 
    but contain only the last position with ID set to 1, keeping only id, x, y, type fields
    and setting move_mode to walk.
    """
    # Get current directory and create paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    source_dir = os.path.join(current_dir, "assets", "pathing")
    target_dir = os.path.join(source_dir, "target")
    
    # Create target directory if it doesn't exist
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        print(f"创建目标文件夹: {target_dir}")
    
    # Count variables
    processed_count = 0
    created_count = 0
    
    # Process only the files directly in the assets/pathing folder (not subfolders)
    for filename in os.listdir(source_dir):
        file_path = os.path.join(source_dir, filename)
        
        # Skip directories and non-JSON files
        if os.path.isdir(file_path) or not filename.endswith('.json'):
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Skip files that don't have the expected structure
            if 'info' not in data or 'positions' not in data or not data['positions']:
                print(f"跳过文件 {filename}: 文件结构不符")
                continue
                
            # Create new JSON with only the info section and last position
            new_data = {
                'info': data['info'],
                'positions': []
            }
            
            # Get the last position, keep only id, x, y, type fields and set move_mode to walk
            last_position = data['positions'][-1]
            simplified_position = {
                'id': 1,
                'x': last_position['x'],
                'y': last_position['y'],
                'type': 'target',  # Keep type, default to 'target' if not present
                'move_mode': 'walk'
            }
            new_data['positions'] = [simplified_position]
            
            # Save to target directory
            target_path = os.path.join(target_dir, filename)
            with open(target_path, 'w', encoding='utf-8') as f:
                json.dump(new_data, f, indent=2, ensure_ascii=False)
                
            processed_count += 1
            created_count += 1
            print(f"已处理: {filename} → {os.path.join('target', filename)}")
            
        except Exception as e:
            print(f"处理 {filename} 时出错: {e}")
    
    print(f"\n任务完成!")
    print(f"已处理 {processed_count} 个JSON文件")
    print(f"已创建 {created_count} 个目标文件")

if __name__ == "__main__":
    print("开始生成目标JSON文件...")
    print("此脚本将:")
    print("1. 读取 assets/pathing 下的所有JSON文件")
    print("2. 为每个文件创建一个新版本，只保留最后一个点位的id、x、y、type字段，并将move_mode设为walk")
    print("3. 将新文件保存到 assets/pathing/target 目录")
    print("="*50)
    
    create_target_jsons() 