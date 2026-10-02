# 使用说明

该脚本的功能非常简单，识别长效历练点的数量并写入脚本目录下的`count.txt`中，建议搭配外部PowerShell/Python脚本使用以实现额外的任务调度能力。

> 该脚本仅在分辨率1920*1080的条件下完成测试，其他分辨率请自行测试可用性，理论上通用
> 仅支持简体中文

## 抛砖引玉

下面是一个PowerShell脚本的示例，读取该脚本识别到的历练点数量并作为控制是否执行一条龙"每日委托"的条件。

> 建议在每次执行一条龙领取日常奖励后运行该脚本，否则数据不会更新

```powershell
using namespace System;
using namespace System.Diagnostics;
using namespace System.Threading;

$gi = New-Object ProcessStartInfo('{原神安装目录}\YuanShen.exe');
$gi.Arguments = '-screen-width 1920 -screen-height 1080 -screen-fullscreen 1';
$gi.UseShellExecute = $true;
[Process]::Start($gi);
Write-Host '原神，启动！'
[Thread]::Sleep(10000);
$bgiStartOption = New-Object ProcessStartInfo('{BetterGI安装目录}\BetterGI.exe');
$bgiStartOption.UseShellExecute = $true;
$encounterPoints = [int]([double](Get-Content -Path "{BetterGI安装目录}\User\JsScript\RecognizeEncounterPoints\count.txt").Trim())
if ($encounterPoints -gt 4) {
    Write-Host "当前剩余 $encounterPoints 个长效历练点，跳过每日委托"
}
else {
    Write-Host "当前历练点数量不足4个，开始执行每日委托"
    $bgiStartOption.Arguments =  '--startOneDragon "每日委托"';
    $bgi = [Process]::Start($bgiStartOption);
    if ($bgi.WaitForExit(1800000)) {
        Write-Host '每日委托执行结束，准备启动一条龙'
    }
    else {
        Write-Host '每日委托执行时间异常，将退出软件并启动一条龙'
    }
    if (!$bgi.HasExited) {
        $bgi.Kill();
        $bgi.WaitForExit();
    }
}
$bgiStartOption.Arguments = '--startOneDragon "默认配置"';
$bgi = [Process]::Start($bgiStartOption);
$bgi.WaitForExit();
Write-Host '下班！'
[Thread]::Sleep(5000);
$shutdown = New-Object ProcessStartInfo('shutdown.exe');
$shutdown.Arguments = '/l';
$shutdown.UseShellExecute = $true;
[Process]::Start($shutdown);
```

