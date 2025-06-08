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
