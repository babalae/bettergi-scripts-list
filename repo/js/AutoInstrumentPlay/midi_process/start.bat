@echo off
setlocal enabledelayedexpansion

REM 文件名
set "midi_file=%~1"

REM 寻找文件
if not exist "%midi_file%" (
    echo 无文件选取
    pause
    exit /b 1
)

REM 寻找程序
set "executable="
if exist "main.exe" (
    set "executable=main.exe"
) else if exist "main.py" (
    set "executable=python -u main.py"
) else (
    echo 找不到main.exe或main.py
    pause
    exit /b 1
)

REM 潩潩潩潩潩潩
set "command=!executable! --file "%midi_file%""

REM 是否生成报告
set /p "gen_report=是否生成报告?(Y/N): "
if /i "!gen_report!"=="Y" (
    set "command=!command! -r"
    echo 确认生成报告
    goto :execute
)

REM 通道选取
set /p "channels=选择通道（音色）(可以先生成报告查看通道信息): "
if not "!channels!"=="" (
    set "command=!command! --channels !channels!"
)

REM 二值化阈值
set /p "threshold=二值化阈值?(1-126,默认值为64): "
if not "!threshold!"=="" (
    set "command=!command! --threshold !threshold!"
)

:execute
echo 执行指令: !command!
echo.
call !command!

if errorlevel 1 (
    echo.
    echo Program exited with error code !errorlevel!
)

pause