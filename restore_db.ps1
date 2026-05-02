# 数据库恢复脚本
$dbPath = "$PSScriptRoot\backend\data\jzs.db"
$backupDir = "$PSScriptRoot\backend\data\backups"

if (-not (Test-Path $backupDir)) {
    Write-Host "备份目录不存在，无可用备份" -ForegroundColor Red
    exit 1
}

$backups = Get-ChildItem "$backupDir\jzs_*.db" | Sort-Object Name -Descending
if ($backups.Count -eq 0) {
    Write-Host "没有找到任何备份文件" -ForegroundColor Red
    exit 1
}

Write-Host "=== 可用备份列表 ===" -ForegroundColor Cyan
for ($i = 0; $i -lt $backups.Count; $i++) {
    $f = $backups[$i]
    $size = [math]::Round($f.Length / 1KB, 1)
    Write-Host "  [$i] $($f.Name)  ($size KB)  $($f.LastWriteTime)" -ForegroundColor White
}

Write-Host ""
$choice = Read-Host "请输入要恢复的备份编号（默认 0 = 最新）"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "0" }

$selected = $backups[[int]$choice]
if (-not $selected) {
    Write-Host "无效编号" -ForegroundColor Red
    exit 1
}

# 备份当前数据库
if (Test-Path $dbPath) {
    $ts = Get-Date -Format "yyyyMMdd_HHmmss"
    Copy-Item $dbPath "$backupDir\jzs_before_restore_$ts.db" -Force
    Write-Host "当前数据库已保存为: jzs_before_restore_$ts.db" -ForegroundColor Yellow
}

Copy-Item $selected.FullName $dbPath -Force
Write-Host "已恢复: $($selected.Name) -> jzs.db" -ForegroundColor Green
Write-Host "请重新启动后端服务" -ForegroundColor Cyan
