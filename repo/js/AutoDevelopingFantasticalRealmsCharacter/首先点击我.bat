@echo off
setlocal enabledelayedexpansion

:: ����Ŀ��·�� - ����ڵ�ǰ�������ļ���λ��
:: ����Ŀ¼�ṹ: ��ǰĿ¼ > User > JsScript > AAA-�Զ���ʫ��ɫ����һ����
:: �����������ļ���"AAA-�Զ���ʫ��ɫ����һ����"Ŀ¼�У�����������UserĿ¼
set "target=..\..\..\User"

:: ���Ŀ��Ŀ¼�Ƿ����
if not exist "%target%" (
    echo ����: Ŀ��Ŀ¼ "%target%" ������!
    pause
    exit /b 1
)

:: ��������Ƿ��Ѵ���
if exist "User" (
    echo ��Ϣ: "User" �����Ѵ��ڣ������ظ�������
    pause
    exit /b 0
)

:: ������������
mklink /j "User" "%target%"

:: ��������Ƿ�ɹ�ִ��
if %errorlevel% equ 0 (
    echo �ɹ�: �Ѵ���ָ�� "%target%" �� "User" ����
) else (
    echo ����: ��������ʧ�ܣ����Թ���Ա��������������ļ�
)

pause
endlocal