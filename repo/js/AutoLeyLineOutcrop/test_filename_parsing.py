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
                if area and "-" in area:
                    # 特殊格式
                    area_parts = area.split("-")
                    if len(area_parts) == 2:
                        formatted = f"{region_name}{region_num}-{area_parts[1]}-{int(route_num)}-{int(route_sub_num)}"
                    else:
                        formatted = f"{region_name}{region_num}-{area}-{int(route_num)}-{int(route_sub_num)}"
                else:
                    # 非预期情况，但仍处理
                    formatted = f"{region_name}{region_num}-{area}-{int(route_num)}-{int(route_sub_num)}"
            else:  # 标准格式
                if area and "-" in area:
                    # 特殊格式
                    area_parts = area.split("-")
                    if len(area_parts) == 2:
                        formatted = f"{region_name}{region_num}-{area_parts[1]}-{int(route_num)}"
                    else:
                        formatted = f"{region_name}{region_num}-{int(route_num)}"
                else:
                    # 标准格式
                    formatted = f"{region_name}{region_num}-{int(route_num)}"
            print(f"  格式化区域: {formatted}")
        else:
            print(f"  解析失败")
        print("")
