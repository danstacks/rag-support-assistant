# Development startup script for Windows
# Starts both backend and frontend in development mode

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ProjectDir) { $ProjectDir = Split-Path -Parent $PSScriptRoot }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Docs to Expert - Development Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is running
Write-Host "Checking Ollama..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -ErrorAction SilentlyContinue
    Write-Host "  Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "  Ollama is not running. Please start Ollama first:" -ForegroundColor Red
    Write-Host "    ollama serve" -ForegroundColor White
    Write-Host ""
    Write-Host "  Then run this script again." -ForegroundColor Yellow
    exit 1
}

# Check for model
Write-Host "Checking for model..." -ForegroundColor Yellow
$models = (Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get).models
$hasModel = $models | Where-Object { $_.name -like "*mistral*" }
if (-not $hasModel) {
    Write-Host "  Mistral model not found. The setup wizard will help you download it." -ForegroundColor Yellow
} else {
    Write-Host "  Model found: $($hasModel[0].name)" -ForegroundColor Green
}

Write-Host ""

# Start Backend
Write-Host "Starting Backend..." -ForegroundColor Yellow
$backendPath = Join-Path $ProjectDir "backend"

# Check for virtual environment
$venvPath = Join-Path $backendPath "venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvPath)) {
    Write-Host "  Creating virtual environment..." -ForegroundColor Yellow
    Push-Location $backendPath
    python -m venv venv
    & $venvPath
    pip install -r requirements.txt
    Pop-Location
}

# Copy .env if not exists
$envPath = Join-Path $backendPath ".env"
$envExamplePath = Join-Path $backendPath ".env.example"
if (-not (Test-Path $envPath) -and (Test-Path $envExamplePath)) {
    Copy-Item $envExamplePath $envPath
    Write-Host "  Created .env from .env.example" -ForegroundColor Green
}

# Start backend in new window
$backendCmd = "cd '$backendPath'; & '.\venv\Scripts\Activate.ps1'; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Write-Host "  Backend starting on http://localhost:8000" -ForegroundColor Green

# Wait for backend to be ready
Write-Host "  Waiting for backend..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
do {
    Start-Sleep -Seconds 1
    $attempt++
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -ErrorAction SilentlyContinue
        $backendReady = $true
    } catch {
        $backendReady = $false
    }
} while (-not $backendReady -and $attempt -lt $maxAttempts)

if ($backendReady) {
    Write-Host "  Backend is ready!" -ForegroundColor Green
} else {
    Write-Host "  Backend may still be starting..." -ForegroundColor Yellow
}

Write-Host ""

# Start Frontend
Write-Host "Starting Frontend..." -ForegroundColor Yellow
$frontendPath = Join-Path $ProjectDir "frontend"

# Check for node_modules
$nodeModulesPath = Join-Path $frontendPath "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "  Installing npm dependencies..." -ForegroundColor Yellow
    Push-Location $frontendPath
    npm install
    Pop-Location
}

# Start frontend in new window
$frontendCmd = "cd '$frontendPath'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Write-Host "  Frontend starting on http://localhost:3000" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Open http://localhost:3000 in your browser" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press any key to open in browser..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Start-Process "http://localhost:3000"
