# 获取当前文件夹及其子目录中的所有文件
Get-ChildItem -File -Recurse | ForEach-Object {
    # 读取文件内容
    $content = Get-Content $_.FullName -Raw
    
    # 检查文件是否包含BOM
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Write-Host ("Processing file: " + $_.FullName)
        
        # 使用UTF8编码（无BOM）重新写入文件
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($_.FullName, $content, $utf8NoBom)
        
        Write-Host ("Conversion completed: " + $_.Name) -ForegroundColor Green
    }
}

Write-Host "All done!" -ForegroundColor Green