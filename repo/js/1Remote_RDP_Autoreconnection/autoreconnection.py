import pyautogui
import time

print("正在执行会话关闭后操作...")
time.sleep(2)   
# 返回Windows桌面（Win+D）
pyautogui.hotkey('winleft', 'd')  # 更通用的Win+D组合键
time.sleep(1)  # 等待1秒

# 按下Alt+M键（半秒后松开）
pyautogui.keyDown('alt')  # 按住Alt键
pyautogui.press('m')      # 按M键
time.sleep(0.5)           # 精确等待0.5秒（半秒）
pyautogui.keyUp('alt')    # 松开Alt键
pyautogui.keyUp('m')      # 松开M键（确保按键无粘连）

time.sleep(0.1)  # 等待0.1秒

# 按两次回车键，间隔0.3秒
pyautogui.press('enter')
time.sleep(0.3)  # 等待0.3秒
pyautogui.press('enter')

print("操作完成！")