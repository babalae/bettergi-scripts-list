import os
import sys
import time
import json
import logging
import subprocess
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# 配置参数
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, "config.json")
LOG_MONITOR_PATH = os.path.join(SCRIPT_DIR, "监控异常.txt")
ENCODING = "utf-8"
RECONNECT_SCRIPT_NAME = "autoreconnection.py"

# 创建日志目录（如果不存在）
os.makedirs(SCRIPT_DIR, exist_ok=True)

# 初始化日志系统
logging.basicConfig(
    filename=LOG_MONITOR_PATH,
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
# 同时输出到控制台
console = logging.StreamHandler()
console.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
console.setFormatter(formatter)
logging.getLogger().addHandler(console)

# 记录状态
last_position = 0
processed_times = {}
last_processed_date = None
reconnect_count = 0
current_log_file = None

# 重启验证相关变量
reconnect_attempts = 0  # 当前重启尝试次数
max_reconnect_attempts = 3  # 最大尝试次数
reconnect_in_progress = False  # 标记是否有重启操作正在进行
reconnect_start_time = 0  # 重启开始时间戳
reconnect_success_detected = False  # 是否检测到成功重启的日志

def configure_log_directory():
    """引导用户配置日志目录"""
    print("="*50)
    print("日志监控程序配置")
    print("="*50)
    print("请指定1Remote日志文件所在的目录")
    print("日志文件命名格式为: 1Remote.log_YYYYMMDD.md")
    print("="*50)
    
    while True:
        log_dir = input("请输入日志目录完整路径: ").strip()
        
        # 验证路径是否存在
        if not os.path.exists(log_dir):
            print(f"错误: 路径不存在 - {log_dir}")
            continue
        
        # 验证是否是目录
        if not os.path.isdir(log_dir):
            print(f"错误: 这不是一个目录 - {log_dir}")
            continue
        
        # 验证目录中是否有日志文件
        log_files = [f for f in os.listdir(log_dir) 
                     if f.startswith("1Remote.log_") and f.endswith(".md")]
        
        if not log_files:
            print(f"警告: 目录中没有找到日志文件 - {log_dir}")
            choice = input("是否继续使用此目录? (y/n): ").strip().lower()
            if choice != 'y':
                continue
        
        return log_dir

def load_config():
    """从配置文件加载日志目录"""
    if not os.path.exists(CONFIG_FILE):
        return None
    
    try:
        with open(CONFIG_FILE, 'r', encoding=ENCODING) as f:
            config = json.load(f)
            log_dir = config.get('log_dir')
            
            # 验证目录是否存在
            if not os.path.isdir(log_dir):
                logging.error(f"配置文件中的目录不存在: {log_dir}")
                return None
            
            return log_dir
        
    except (json.JSONDecodeError, UnicodeDecodeError):
        logging.error("配置文件损坏，请重新配置")
        return None
    except Exception as e:
        logging.error(f"加载配置失败: {str(e)}")
        return None

def save_config(log_dir):
    """保存日志目录到配置文件"""
    config = {'log_dir': log_dir}
    try:
        with open(CONFIG_FILE, 'w', encoding=ENCODING) as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        logging.info(f"配置已保存到: {CONFIG_FILE}")
        return True
    except Exception as e:
        logging.error(f"保存配置失败: {str(e)}")
        return False

def get_today_log_file(log_dir):
    """获取指定目录下当天的日志文件"""
    today = datetime.now().strftime("%Y%m%d")
    file_pattern = f"1Remote.log_{today}.md"
    
    # 查找符合日期模式的文件
    for entry in os.scandir(log_dir):
        if entry.is_file() and entry.name == file_pattern:
            return entry.path
    
    return None

def execute_reconnect():
    """执行重连操作"""
    global reconnect_count, reconnect_attempts, reconnect_in_progress, reconnect_start_time, reconnect_success_detected
    
    # 如果已经达到最大尝试次数，重置并返回失败
    if reconnect_attempts >= max_reconnect_attempts:
        logging.warning(f"【达到最大重试次数】已尝试{max_reconnect_attempts}次重启，停止重试")
        reconnect_attempts = 0
        reconnect_in_progress = False
        return False
    
    try:
        reconnect_script_path = os.path.join(SCRIPT_DIR, RECONNECT_SCRIPT_NAME)
        
        # 记录开始时间
        start_time = time.time()
        # 调用外部重启脚本
        result = subprocess.run(
            [sys.executable, reconnect_script_path],
            check=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        # 计算耗时
        elapsed = time.time() - start_time
        
        # 重置成功标记，设置重启状态
        reconnect_success_detected = False
        reconnect_in_progress = True
        reconnect_start_time = time.time()
        reconnect_attempts += 1
        reconnect_count += 1
        
        logging.info(f"【重启尝试 {reconnect_attempts}/{max_reconnect_attempts}】执行成功，耗时：{elapsed:.2f}s，总重启次数：{reconnect_count}")
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"【重启失败】错误代码：{e.returncode}\nstdout: {e.stdout.strip()}\nstderr: {e.stderr.strip()}")
    except FileNotFoundError:
        logging.error(f"【重启失败】未找到重启脚本：{reconnect_script_path}")
    except subprocess.TimeoutExpired:
        logging.error(f"【重启失败】执行超时（超过30秒）")
    except Exception as e:
        logging.error(f"【重启异常】未知错误：{str(e)}", exc_info=True)
    
    reconnect_attempts += 1
    logging.warning(f"【重启尝试 {reconnect_attempts}/{max_reconnect_attempts}】失败")
    return False

def process_log_line(line):
    """处理日志行并检查是否需要重启及重启是否成功"""
    global last_position, processed_times, reconnect_in_progress, reconnect_success_detected, reconnect_attempts
    
    # 检查是否是重启成功的标志日志
    if reconnect_in_progress and 'Warning' in line and '[AxMsRdpClient09Host.cs(ReConn:42)]' in line and 'RDP Host: Call ReConn' in line:
        logging.info(f"【重启成功验证】检测到成功标志: {line}")
        reconnect_success_detected = True
        reconnect_in_progress = False
        reconnect_attempts = 0  # 重置尝试次数
        return True
    
    # 原有逻辑：检查是否需要重启
    if 'Warning' in line:
        if 'OnRdpClientDisconnected' in line and not reconnect_in_progress:
            logging.warning(f"【触发重启】{line}")
            return execute_reconnect()
        elif 'ReConn:42' in line:
            logging.info(f"【忽略信号】{line}")
        else:
            logging.info(f"【未知警告】{line}")
    
    # 时间戳处理
    try:
        if '[' in line and ']' in line:
            timestamp_str = line.split(']')[0][1:]
            log_time = datetime.strptime(timestamp_str, "%H:%M:%S.%f").time()
            
            time_key = timestamp_str.replace(':', '').replace('.', '')
            if time_key not in processed_times:
                processed_times[time_key] = True
                logging.info(f"【新警告记录】{line}")
    except ValueError:
        logging.error(f"【无效时间戳】{line}")
    
    return False

def monitor_log_file(log_file):
    """监控指定的日志文件"""
    global last_position, processed_times, last_processed_date
    
    try:
        # 检查是否为新的一天
        current_date = datetime.now().date()
        if current_date != last_processed_date:
            processed_times.clear()
            last_processed_date = current_date
            logging.info(f"【新的一天】开始监控{current_date}的日志文件")
        
        # 获取文件大小
        file_size = os.path.getsize(log_file)
        
        # 从上次结束位置读取新内容
        with open(log_file, 'r', encoding=ENCODING) as f:
            if file_size < last_position:
                logging.warning("【文件被截断或重置】重新从头开始读取")
                f.seek(0)
            else:
                f.seek(last_position)
            new_lines = f.read().splitlines()
            
        # 处理新增内容
        for line in new_lines:
            process_log_line(line)
        
        # 更新最后读取位置
        last_position = file_size
        
    except Exception as e:
        logging.error(f"【监控异常】{str(e)}", exc_info=True)

class LogFileHandler(FileSystemEventHandler):
    """处理日志文件变化事件"""
    def __init__(self, log_dir):
        self.log_dir = log_dir
    
    def on_modified(self, event):
        global current_log_file
        
        if not event.is_directory:
            # 检查是否是当天日志文件
            today_file = get_today_log_file(self.log_dir)
            if today_file and event.src_path == today_file:
                monitor_log_file(today_file)

def start_monitoring(log_dir):
    """启动日志监控（静默等待日志文件生成）"""
    global current_log_file, last_position, reconnect_in_progress, reconnect_start_time, reconnect_success_detected, reconnect_attempts
    
    # 验证监控目录是否有效（仅在启动时检查一次）
    if not os.path.isdir(log_dir):
        logging.error(f"【错误】监控目录不存在或无效: {log_dir}")
        return False

    try:
        while True:  # 外层循环：处理跨天切换
            # 静默等待当天日志文件生成（每5秒检查一次）
            while True:
                current_log_file = get_today_log_file(log_dir)
                if current_log_file:
                    logging.info(f"【找到日志文件】开始监控: {current_log_file}")
                    last_position = os.path.getsize(current_log_file)  # 初始化读取位置
                    break
                # 无日志文件时不输出错误，仅静默等待
                time.sleep(5)

            # 创建事件处理器和观察器
            event_handler = LogFileHandler(log_dir)
            observer = Observer()
            observer.schedule(event_handler, path=log_dir, recursive=False)
            observer.start()

            # 监控循环：每1秒检查一次是否跨天或重启超时
            try:
                while True:
                    # 检查重启超时
                    if reconnect_in_progress:
                        elapsed_time = time.time() - reconnect_start_time
                        if elapsed_time > 20:  # 超过20秒
                            if not reconnect_success_detected:
                                logging.warning(f"【重启验证超时】20秒内未检测到成功标志，尝试重新启动")
                                # 停止当前监控，准备重试
                                observer.stop()
                                observer.join()
                                
                                # 如果未达到最大尝试次数，重新执行重启
                                if reconnect_attempts < max_reconnect_attempts:
                                    execute_reconnect()
                                else:
                                    # 达到最大尝试次数，重置状态
                                    reconnect_in_progress = False
                                    reconnect_attempts = 0
                                
                                # 重新启动监控
                                event_handler = LogFileHandler(log_dir)
                                observer = Observer()
                                observer.schedule(event_handler, path=log_dir, recursive=False)
                                observer.start()
                            else:
                                # 已检测到成功标志，重置状态
                                reconnect_in_progress = False
                    
                    # 检查是否跨天
                    today_file = get_today_log_file(log_dir)
                    if today_file != current_log_file:
                        # 跨天：停止当前监控，进入外层循环等待新文件
                        observer.stop()
                        observer.join()
                        logging.info(f"【跨天切换】当前日志文件已过期，等待新日志文件...")
                        break
                    
                    time.sleep(1)  # 缩短检查间隔为1秒，提高响应速度
            except KeyboardInterrupt:
                observer.stop()
                observer.join()
                return True
            observer.join()
    except Exception as e:
        logging.error(f"【监控异常】{str(e)}", exc_info=True)
        return False

if __name__ == "__main__":
    print("="*50)
    print("日志监控程序")
    print("作者：火山")
    print("="*50)
    
    # 尝试加载配置
    log_watch_dir = load_config()
    
    if not log_watch_dir:
        log_watch_dir = configure_log_directory()
        if not save_config(log_watch_dir):
            print("配置保存失败，程序退出")
            sys.exit(1)
    
    print("="*50)
    print(f"监控目录: {log_watch_dir}")
    # 修改状态提示文本，更准确反映程序状态
    print("正在监控中（等待当天日志文件生成）...")
    
    try:
        start_monitoring(log_watch_dir)
        print("监控已成功启动")
        print("作者：火山")
    except Exception as e:
        logging.error(f"【启动失败】{str(e)}", exc_info=True)
        print(f"监控启动失败: {str(e)}")
        print("请检查错误日志: 监控异常.txt")