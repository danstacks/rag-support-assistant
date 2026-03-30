# Windows Setup Script for Docs to Expert RAG System
# Run this script as Administrator for best results

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Docs to Expert - Windows Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ProjectDir = Split-Path -Parent $PSScriptRoot

# Step 1: Check Python
Write-Host "Step 1: Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  Python not found. Please install Python 3.10+ from https://python.org" -ForegroundColor Red
    exit 1
}

# Step 2: Check Node.js
Write-Host "Step 2: Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  Found: Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Step 3: Check/Install Ollama
Write-Host "Step 3: Checking Ollama..." -ForegroundColor Yellow
try {
    $ollamaVersion = ollama --version 2>&1
    Write-Host "  Found: $ollamaVersion" -ForegroundColor Green
} catch {
    Write-Host "  Ollama not found." -ForegroundColor Yellow
    Write-Host "  Please install Ollama from https://ollama.com/download" -ForegroundColor Yellow
    Write-Host ""
    $install = Read-Host "  Open Ollama download page? (y/n)"
    if ($install -eq 'y') {
        Start-Process "https://ollama.com/download"
    }
    Write-Host ""
    Write-Host "  After installing Ollama, run this script again." -ForegroundColor Yellow
    exit 1
}

# Step 4: Setup Backend
Write-Host "Step 4: Setting up Backend..." -ForegroundColor Yellow
$backendPath = Join-Path $ProjectDir "backend"
Push-Location $backendPath

# Create virtual environment
if (-not (Test-Path "venv")) {
    Write-Host "  Creating virtual environment..." -ForegroundColor Gray
    python -m venv venv
}

# Activate and install dependencies
Write-Host "  Installing Python dependencies..." -ForegroundColor Gray
& ".\venv\Scripts\Activate.ps1"
pip install -r requirements.txt --quiet

# Create .env if not exists
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  Created .env configuration file" -ForegroundColor Green
}

# Create data directories
New-Item -ItemType Directory -Force -Path "data\chroma_db" | Out-Null
New-Item -ItemType Directory -Force -Path "data\docs" | Out-Null

Pop-Location
Write-Host "  Backend setup complete!" -ForegroundColor Green

# Step 5: Setup Frontend
Write-Host "Step 5: Setting up Frontend..." -ForegroundColor Yellow
$frontendPath = Join-Path $ProjectDir "frontend"
Push-Location $frontendPath

Write-Host "  Installing npm dependencies..." -ForegroundColor Gray
npm install --silent

Pop-Location
Write-Host "  Frontend setup complete!" -ForegroundColor Green

# Step 6: Check if Ollama is running
Write-Host "Step 6: Checking Ollama service..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -ErrorAction SilentlyContinue
    Write-Host "  Ollama is running!" -ForegroundColor Green
} catch {
    Write-Host "  Starting Ollama..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Host "  Ollama started!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "  1. Run: .\scripts\start-dev.ps1" -ForegroundColor Yellow
Write-Host "  2. Open: http://localhost:3000" -ForegroundColor Yellow
Write-Host "  3. The Setup Wizard will guide you through the rest!" -ForegroundColor Yellow
Write-Host ""
Write-Host "  The wizard will help you:" -ForegroundColor Gray
Write-Host "    - Download the AI model (~4GB)" -ForegroundColor Gray
Write-Host "    - Load sample documentation" -ForegroundColor Gray
Write-Host "    - Start asking questions!" -ForegroundColor Gray
Write-Host ""

$start = Read-Host "Start the application now? (y/n)"
if ($start -eq 'y') {
    & "$ProjectDir\scripts\start-dev.ps1"
}
