@echo off
setlocal enabledelayedexpansion

:: 定义目标路径 - 相对于当前批处理文件的位置
:: 根据目录结构: 当前目录 > User > JsScript > AAA-自动巨诗角色养成一条龙
:: 假设批处理文件在"AAA-自动巨诗角色养成一条龙"目录中，向上两级是User目录
set "target=..\..\..\User"

:: 检查目标目录是否存在
if not exist "%target%" (
    echo 错误: 目标目录 "%target%" 不存在!
    pause
    exit /b 1
)

:: 检查链接是否已存在
if exist "User" (
    echo 信息: "User" 链接已存在，无需重复创建。
    pause
    exit /b 0
)

:: 创建符号链接
mklink /j "User" "%target%"

:: 检查命令是否成功执行
if %errorlevel% equ 0 (
    echo 成功: 已创建指向 "%target%" 的 "User" 链接
) else (
    echo 错误: 创建链接失败，请以管理员身份运行批处理文件
)

pause
endlocal