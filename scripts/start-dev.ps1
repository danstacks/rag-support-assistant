# Development startup script for Windows
# Starts both backend and frontend in development mode

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RAG Support Assistant - Dev Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Determine project directory robustly
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $ScriptDir) {
    $ScriptDir = Get-Location
}
$ProjectDir = Split-Path -Parent $ScriptDir

# Verify we're in the right place
$backendPath = Join-Path $ProjectDir "backend"
$frontendPath = Join-Path $ProjectDir "frontend"

if (-not (Test-Path $backendPath) -or -not (Test-Path $frontendPath)) {
    Write-Host "  Error: Cannot find project directory." -ForegroundColor Red
    Write-Host "  Expected backend at: $backendPath" -ForegroundColor Gray
    Write-Host "  Please run this script from the scripts folder." -ForegroundColor Yellow
    exit 1
}

Write-Host "  Project: $ProjectDir" -ForegroundColor Gray
Write-Host ""

# ============================================
# Check Ollama
# ============================================
Write-Host "Checking Ollama..." -ForegroundColor Yellow
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaCmd) {
    Write-Host "  Ollama is not installed." -ForegroundColor Red
    Write-Host "  Please install from https://ollama.com/download" -ForegroundColor Yellow
    Write-Host ""
    $install = Read-Host "  Open Ollama download page? (y/n)"
    if ($install -eq 'y') {
        Start-Process "https://ollama.com/download"
    }
    Write-Host ""
    Write-Host "  After installing, CLOSE this terminal and open a new one." -ForegroundColor Cyan
    exit 1
}

# Check if Ollama is running, start if not
$ollamaRunning = $false
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
    $ollamaRunning = $true
    Write-Host "  Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "  Starting Ollama..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    
    # Wait for Ollama to start
    $attempts = 0
    while ($attempts -lt 10) {
        Start-Sleep -Seconds 1
        $attempts++
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
            $ollamaRunning = $true
            Write-Host "  Ollama started!" -ForegroundColor Green
            break
        } catch {}
    }
    
    if (-not $ollamaRunning) {
        Write-Host "  Warning: Ollama may still be starting..." -ForegroundColor Yellow
    }
}

# Check for model (informational only)
if ($ollamaRunning) {
    Write-Host "Checking for AI model..." -ForegroundColor Yellow
    try {
        $models = (Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 5).models
        if ($models -and $models.Count -gt 0) {
            Write-Host "  Model available: $($models[0].name)" -ForegroundColor Green
        } else {
            Write-Host "  No model found - the app will help you download one" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  Could not check models" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# Setup Backend if needed
# ============================================
Write-Host "Checking Backend..." -ForegroundColor Yellow

$venvActivate = Join-Path $backendPath "venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvActivate)) {
    Write-Host "  Setting up backend (first run)..." -ForegroundColor Yellow
    Push-Location $backendPath
    
    Write-Host "  Creating virtual environment..." -ForegroundColor Gray
    & python -m venv venv 2>&1 | Out-Null
    
    if (Test-Path $venvActivate) {
        & $venvActivate
        Write-Host "  Installing dependencies..." -ForegroundColor Gray
        & pip install -r requirements.txt 2>&1 | Out-Null
    }
    
    Pop-Location
}

# Create .env if missing
$envPath = Join-Path $backendPath ".env"
$envExamplePath = Join-Path $backendPath ".env.example"
if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Copy-Item $envExamplePath $envPath
        Write-Host "  Created .env configuration" -ForegroundColor Green
    } else {
        "OLLAMA_MODEL=mistral" | Out-File -FilePath $envPath -Encoding utf8
        Write-Host "  Created default .env" -ForegroundColor Green
    }
}

# Create data directories
New-Item -ItemType Directory -Force -Path (Join-Path $backendPath "data\chroma_db") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $backendPath "data\docs") | Out-Null

Write-Host "  Backend ready" -ForegroundColor Green

# ============================================
# Setup Frontend if needed
# ============================================
Write-Host "Checking Frontend..." -ForegroundColor Yellow

$nodeModulesPath = Join-Path $frontendPath "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "  Installing npm dependencies (first run)..." -ForegroundColor Yellow
    Push-Location $frontendPath
    & npm install 2>&1 | Out-Null
    Pop-Location
}
Write-Host "  Frontend ready" -ForegroundColor Green

Write-Host ""

# ============================================
# Start Services
# ============================================
Write-Host "Starting services..." -ForegroundColor Yellow

# Start backend in new window (escape paths properly for spaces)
$backendCmd = @"
Set-Location '$backendPath'
& '.\venv\Scripts\Activate.ps1'
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Write-Host "  Backend starting on http://localhost:8000" -ForegroundColor Green

# Wait for backend to be ready
Write-Host "  Waiting for backend..." -ForegroundColor Gray
$backendReady = $false
$maxAttempts = 30
for ($i = 0; $i -lt $maxAttempts; $i++) {
    Start-Sleep -Seconds 1
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        $backendReady = $true
        break
    } catch {}
}

if ($backendReady) {
    Write-Host "  Backend is ready!" -ForegroundColor Green
} else {
    Write-Host "  Backend still starting (check the backend window for errors)" -ForegroundColor Yellow
}

# Start frontend in new window
$frontendCmd = @"
Set-Location '$frontendPath'
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Write-Host "  Frontend starting on http://localhost:3000" -ForegroundColor Green

# Wait a moment for frontend to start
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor Gray
Write-Host ""
Write-Host "  Two new PowerShell windows opened for the servers." -ForegroundColor Gray
Write-Host "  Close them to stop the application." -ForegroundColor Gray
Write-Host ""

# Auto-open browser
Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"
