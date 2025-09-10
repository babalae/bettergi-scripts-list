@echo off
setlocal enabledelayedexpansion

REM �ļ���
set "midi_file=%~1"

REM Ѱ���ļ�
if not exist "%midi_file%" (
    echo ���ļ�ѡȡ
    pause
    exit /b 1
)

REM Ѱ�ҳ���
set "executable="
if exist "main.exe" (
    set "executable=main.exe"
) else if exist "main.py" (
    set "executable=python -u main.py"
) else (
    echo �Ҳ���main.exe��main.py
    pause
    exit /b 1
)

REM ������������
set "command=!executable! --file "%midi_file%""

REM �Ƿ����ɱ���
set /p "gen_report=�Ƿ����ɱ���?(Y/N): "
if /i "!gen_report!"=="Y" (
    set "command=!command! -r"
    echo ȷ�����ɱ���
    goto :execute
)

REM ͨ��ѡȡ
set /p "channels=ѡ��ͨ������ɫ��(���������ɱ���鿴ͨ����Ϣ): "
if not "!channels!"=="" (
    set "command=!command! --channels !channels!"
)

REM ��ֵ����ֵ
set /p "threshold=��ֵ����ֵ?(1-126,Ĭ��ֵΪ64): "
if not "!threshold!"=="" (
    set "command=!command! --threshold !threshold!"
)

:execute
echo ִ��ָ��: !command!
echo.
call !command!

if errorlevel 1 (
    echo.
    echo Program exited with error code !errorlevel!
)

pause