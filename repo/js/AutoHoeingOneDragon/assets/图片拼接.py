# image_stitch.py  将同目录下的所有PNG图片横向拼接在一起，两两中间留出5个像素的空格
import os
from PIL import Image

# 配置参数
SPACE_PIXELS = 5  # 图片之间的空格像素数
OUTPUT_FILENAME = 'stitched_result.png'  # 输出文件名

def find_png_files():
    """查找当前目录下的所有PNG文件"""
    # 获取脚本所在目录的绝对路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # 列出脚本目录下的所有PNG文件
    return [f for f in os.listdir(script_dir) if f.lower().endswith('.png')]

def stitch_images():
    """将所有PNG图片横向拼接在一起"""
    # 获取脚本所在目录的绝对路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # 查找所有PNG文件
    png_files = find_png_files()
    
    if not png_files:
        print("未找到PNG文件")
        return
    
    print(f"找到 {len(png_files)} 个PNG文件")
    print(f"文件列表: {png_files}")
    
    # 打开所有图片并获取尺寸
    images = []
    max_height = 0
    total_width = 0
    
    for png_file in png_files:
        # 使用绝对路径打开图片
        img_path = os.path.join(script_dir, png_file)
        img = Image.open(img_path)
        images.append(img)
        max_height = max(max_height, img.height)
        total_width += img.width
    
    # 计算总宽度（包括空格）
    total_width += (len(images) - 1) * SPACE_PIXELS
    
    # 创建新的画布
    stitched_image = Image.new('RGBA', (total_width, max_height), (255, 255, 255, 255))
    
    # 拼接图片
    current_x = 0
    for i, img in enumerate(images):
        # 计算垂直居中位置
        y = (max_height - img.height) // 2
        stitched_image.paste(img, (current_x, y))
        current_x += img.width + SPACE_PIXELS
    
    # 保存结果
    output_path = os.path.join(script_dir, OUTPUT_FILENAME)
    stitched_image.save(output_path, 'PNG', optimize=True)
    print(f"拼接完成！结果保存在 {output_path}")

if __name__ == '__main__':
    print("开始拼接PNG图片...")
    stitch_images()
