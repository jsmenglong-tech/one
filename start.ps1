# 一建知识库系统 - 一键启动脚本（Windows PowerShell）
Write-Host "=== 一建知识库系统启动 ===" -ForegroundColor Cyan

# ── 数据库保护：启动前检查并备份 ──────────────────────────────
$dbPath = "$PWD\backend\data\jzs.db"
$backupDir = "$PWD\backend\data\backups"
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
if (Test-Path $dbPath) {
    $size = (Get-Item $dbPath).Length
    if ($size -gt 4096) {
        $ts = Get-Date -Format "yyyyMMdd_HHmmss"
        Copy-Item $dbPath "$backupDir\jzs_$ts.db" -Force
        Write-Host "数据库已备份 ($([math]::Round($size/1KB, 1)) KB)" -ForegroundColor Green
        # 只保留最近 10 份
        $bkFiles = Get-ChildItem "$backupDir\jzs_*.db" | Sort-Object Name
        if ($bkFiles.Count -gt 10) {
            $bkFiles | Select-Object -First ($bkFiles.Count - 10) | Remove-Item -Force
        }
    }
} else {
    Write-Host "数据库文件不存在，将在启动时自动创建" -ForegroundColor Yellow
}

# ── venv python 路径 ───────────────────────────────────────────
$venvPython = "$PWD\backend\venv\Scripts\python.exe"

# ── 安装后端依赖（仅首次或依赖有变化时需要）────────────────────
$backendReady = & $venvPython -c "import fastapi, uvicorn, sqlalchemy, aiosqlite" 2>$null; $?
if (-not $backendReady) {
    Write-Host "`n[1/4] 安装后端依赖..." -ForegroundColor Yellow
    & $venvPython -m pip install fastapi "uvicorn[standard]" sqlalchemy aiosqlite pydantic pydantic-settings python-multipart httpx openai numpy Pillow python-dotenv aiofiles -q
    Write-Host "后端依赖安装完成" -ForegroundColor Green
} else {
    Write-Host "`n[1/4] 后端依赖已就绪，跳过安装" -ForegroundColor Green
}

# ── 尝试安装 faiss ─────────────────────────────────────────────
$faissOk = & $venvPython -c "import faiss" 2>$null; $?
if (-not $faissOk) {
    Write-Host "`n[2/4] 尝试安装 faiss-cpu..." -ForegroundColor Yellow
    & $venvPython -m pip install faiss-cpu -q 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "faiss-cpu 安装成功" -ForegroundColor Green
    } else {
        Write-Host "faiss-cpu 安装失败，将使用内置降级方案（功能不受影响）" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[2/4] faiss-cpu 已就绪，跳过安装" -ForegroundColor Green
}

# ── 安装前端依赖（仅 node_modules 不存在时）───────────────────
if (-not (Test-Path "$PWD\frontend\node_modules")) {
    Write-Host "`n[3/4] 安装前端依赖..." -ForegroundColor Yellow
    Set-Location frontend
    npm install --legacy-peer-deps -q
    Set-Location ..
    Write-Host "前端依赖安装完成" -ForegroundColor Green
} else {
    Write-Host "`n[3/4] 前端依赖已就绪，跳过安装" -ForegroundColor Green
}

# ── 清理旧进程 ─────────────────────────────────────────────────
Write-Host "`n[4/4] 启动服务..." -ForegroundColor Yellow
foreach ($port in @(8004, 3000)) {
    $oldPid = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess
    if ($oldPid) {
        Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
        Write-Host "已清理端口 $port 的旧进程 (PID $oldPid)" -ForegroundColor Yellow
        Start-Sleep 1
    }
}

Write-Host "后端: http://localhost:8004" -ForegroundColor Cyan
Write-Host "前端: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API文档: http://localhost:8004/docs" -ForegroundColor Cyan
Write-Host ""

# ── 启动后端（在当前终端内运行，不弹新窗口）──────────────────
$rootDir = $PWD.Path
$venvPythonAbs = "$rootDir\backend\venv\Scripts\python.exe"
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

Write-Host "`n▶ 启动后端 (Job)..." -ForegroundColor Cyan
$backendJob = Start-Job -Name "Backend" -ScriptBlock {
    param($pyExe, $root)
    Set-Location "$root\backend"
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    & $pyExe -m uvicorn main:app --host 0.0.0.0 --port 8004
} -ArgumentList $venvPythonAbs, $rootDir

Write-Host "▶ 启动前端 (Job)..." -ForegroundColor Cyan
$frontendJob = Start-Job -Name "Frontend" -ScriptBlock {
    param($root)
    Set-Location "$root\frontend"
    npm run dev
} -ArgumentList $rootDir

Write-Host "`n服务启动中，等待10秒后打开浏览器..." -ForegroundColor Green
Write-Host "（按 Ctrl+C 可停止，输入 'Stop-Job Backend,Frontend' 可终止后台任务）" -ForegroundColor DarkGray

# 实时输出日志到当前终端
$timer = 0
while ($true) {
    Start-Sleep 2
    $timer += 2

    $bOut = Receive-Job -Job $backendJob 2>&1
    $fOut = Receive-Job -Job $frontendJob 2>&1

    if ($bOut) { $bOut | ForEach-Object { Write-Host "[后端] $_" -ForegroundColor DarkCyan } }
    if ($fOut) { $fOut | ForEach-Object { Write-Host "[前端] $_" -ForegroundColor DarkGreen } }

    # 10秒后自动打开浏览器（只开一次）
    if ($timer -eq 10) {
        Start-Process "http://localhost:3000"
        Write-Host "`n✓ 浏览器已打开 http://localhost:3000" -ForegroundColor Green
    }

    # 检查任务是否异常退出
    if ($backendJob.State -eq 'Failed') {
        Write-Host "[后端] 任务异常退出！" -ForegroundColor Red
        Receive-Job -Job $backendJob 2>&1 | Write-Host
        break
    }
    if ($frontendJob.State -eq 'Failed') {
        Write-Host "[前端] 任务异常退出！" -ForegroundColor Red
        Receive-Job -Job $frontendJob 2>&1 | Write-Host
        break
    }
}
