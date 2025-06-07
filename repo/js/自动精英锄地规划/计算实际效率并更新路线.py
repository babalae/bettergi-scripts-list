import os
import re
import sys
import math
import time
import tkinter as tk
from tkinter import filedialog


try:
    from bs4 import BeautifulSoup
    import pandas as pd
except ImportError:
    print("检测到必要的模块（BeautifulSoup 或 pandas）尚未安装。")
    print("正在尝试为您自动安装...")
    
    # 获取当前运行 Python 的可执行文件路径
    python_executable = sys.executable
    
    # 使用 pip 安装缺失的模块
    # 注意：'bs4' 在 PyPI 上的包名是 'beautifulsoup4'
    os.system(f'"{python_executable}" -m pip install beautifulsoup4 pandas')
    
    print("\n安装完成！请重新运行此程序。")
    # 退出程序，提示用户重新启动
    sys.exit()


os.chdir(os.path.dirname(os.path.abspath(__file__)))

def select_html_file_gui():
    """
    弹出一个GUI窗口，让用户选择一个HTML文件。

    Returns:
        str: 用户选择的文件的完整路径。如果用户取消选择，则返回一个空字符串。
    """
    # 创建一个Tkinter的根窗口，但我们不需要显示它
    # withdraw()方法可以隐藏这个多余的窗口
    root = tk.Tk()
    root.withdraw()

    # 定义文件类型，让用户可以方便地筛选
    # ("描述", "文件后缀")
    file_types = [
        ("HTML 文件", "*.html")
    ]

    # 打开文件选择对话框
    file_path = filedialog.askopenfilename(
        title="请选择日志分析功能另存为的html文件",
        filetypes=file_types
    )

    return file_path


def parse_duration(text):
    h = m = s = 0
    if match := re.search(r'(\d+)小时', text):
        h = int(match.group(1))
    if match := re.search(r'(\d+)分钟', text):
        m = int(match.group(1))
    if match := re.search(r'(\d+)秒', text):
        s = int(match.group(1))
    total_seconds = h * 3600 + m * 60 + s
    return f"{total_seconds // 3600:02}:{(total_seconds % 3600) // 60:02}:{total_seconds % 60:02}"

# 临时记录所有任务运行数据
task_data = {}

# 解析 HTML
html_file = select_html_file_gui()
with open(html_file, "r", encoding="utf-8") as file:
    soup = BeautifulSoup(file, "html.parser")

for h2 in soup.find_all("h2"):
    h2_text = h2.get_text(strip=True)
    if not h2_text.startswith("配置组"):
        continue

    config_name = h2_text.replace("配置组：", "", 1)
    h3_1 = h2.find_next("h3")
    h3_2 = h3_1.find_next("h3") if h3_1 else None
    next_tag = h3_2

    while True:
        next_tag = next_tag.find_next()
        if next_tag is None or next_tag.name == "h2":
            break
        if next_tag.name == "div" and "sticky-table" in next_tag.get("class", []):
            table = next_tag.find("table")
            if not table:
                continue

            rows = table.find("tbody").find_all("tr")
            i = 0
            while i < len(rows):
                row = rows[i]
                if "sub-row" in row.get("class", []):
                    i += 1
                    continue

                tds = row.find_all("td")
                if not tds:
                    i += 1
                    continue

                task_name = tds[0].get_text(strip=True)
                if task_name.startswith("拾取物") or task_name.startswith("锄地总计"):
                    i += 1
                    continue

                try:
                    mora_per_sec = float(tds[15].get_text(strip=True))
                    mora = int(tds[14].get_text(strip=True))
                except (IndexError, ValueError):
                    i += 1
                    continue

                if task_name not in task_data:
                    task_data[task_name] = {
                        "mora_per_sec_list": [],
                        "mora_list": []
                    }

                task_data[task_name]["mora_per_sec_list"].append(mora_per_sec)
                task_data[task_name]["mora_list"].append(mora)

                i += 1
                if i < len(rows) and "sub-row" in rows[i].get("class", []):
                    i += 1

# 构建 DataFrame
# 构建结果并过滤平均摩拉为0或空的记录
result = []
for task_name, values in task_data.items():
    if not values["mora_per_sec_list"]:
        continue
    avg_mps = round(sum(values["mora_per_sec_list"]) / len(values["mora_per_sec_list"]), 2)
    if math.isnan(avg_mps) or avg_mps == 0:
        continue  # ✅ 跳过0或空的记录
    row = [task_name, avg_mps] + values["mora_list"]
    result.append(row)

efficiency = dict(i[:2] for i in result)

# ---------------------------------

# 定义输入和输出文件名
input_excel_file = 'info.xlsx'
output_txt_file = 'dynamic_index.txt'
sheet_name = 'index'

try:
    # 1. 从 info.xlsx 中读取 'index' sheet 的内容
    # header=0 表示将第一行作为表头
    df = pd.read_excel(input_excel_file, sheet_name=sheet_name, header=0)

    # 2. 定义一个函数来更新行
    # 如果'路线名称'在 efficiency 字典中，则返回新值，否则返回原值
    def update_efficiency(row):
        route_name = row['路线名称']
        # dict.get(key, default_value) 是一个安全获取字典值的方法
        # 如果 route_name 存在于字典中，则返回对应的值
        # 如果不存在，则返回 row['秒均'] 这个默认值（即原值）
        return efficiency.get(route_name, row['秒均'])

    # 3. 遍历每一行，应用上述函数来更新 "秒均" 列
    # axis=1 表示按行应用函数
    df['秒均'] = df.apply(update_efficiency, axis=1)

    # 4. 将更新后的数据存储到文件
    # sep='\t' 表示使用制表符作为分隔符
    # index=False 表示不将 DataFrame 的索引写入文件
    # encoding='utf-8' 确保中文字符在txt文件中正确显示
    df.to_csv(output_txt_file, sep='\t', index=False, encoding='utf-8')

    print(f"处理完成！更新后的数据已保存到文件：{output_txt_file}")
    time.sleep(2)

except FileNotFoundError:
    print(f"错误：找不到文件 '{input_excel_file}'。请确保该文件与脚本在同一目录下。")
except KeyError as e:
    print(f"错误：Excel文件中缺少必要的列: {e}。请检查'路线名称'或'秒均'列是否存在。")
except Exception as e:
    print(f"发生了一个意外错误: {e}")

