# Windows Setup Script for RAG Support Assistant
# One-command setup - handles everything automatically

# Bypass execution policy for this script
if ($ExecutionContext.SessionState.LanguageMode -eq 'ConstrainedLanguage') {
    Write-Host "Please run PowerShell as Administrator or enable script execution." -ForegroundColor Red
    exit 1
}

$ErrorActionPreference = "Continue"  # Don't stop on non-critical errors

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RAG Support Assistant - Windows Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Estimated total time: 5-10 minutes (first run)" -ForegroundColor Gray
Write-Host "  (Most time is downloading the AI model)" -ForegroundColor Gray
Write-Host ""

# Determine project directory (handle running from different locations)
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $ScriptDir) {
    $ScriptDir = Get-Location
}
$ProjectDir = Split-Path -Parent $ScriptDir

# Verify we're in the right place
if (-not (Test-Path (Join-Path $ProjectDir "backend"))) {
    Write-Host "  Error: Cannot find project directory." -ForegroundColor Red
    Write-Host "  Please run this script from the scripts folder." -ForegroundColor Yellow
    exit 1
}

Write-Host "  Project: $ProjectDir" -ForegroundColor Gray
Write-Host ""

# ============================================
# Step 1: Check Python (with version validation)
# ============================================
Write-Host "Step 1/7: Checking Python..." -ForegroundColor Yellow
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    # Try python3 as fallback
    $pythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
}

$needPython = $false
if ($pythonCmd) {
    $pythonVersionOutput = & $pythonCmd.Source --version 2>&1
    $pythonVersionMatch = [regex]::Match($pythonVersionOutput, '(\d+)\.(\d+)')
    if ($pythonVersionMatch.Success) {
        $majorVersion = [int]$pythonVersionMatch.Groups[1].Value
        $minorVersion = [int]$pythonVersionMatch.Groups[2].Value
        if ($majorVersion -ge 3 -and $minorVersion -ge 10) {
            Write-Host "  Found: $pythonVersionOutput" -ForegroundColor Green
        } else {
            Write-Host "  Found Python $majorVersion.$minorVersion but need 3.10+. Upgrading..." -ForegroundColor Yellow
            $needPython = $true
        }
    } else {
        Write-Host "  Found: $pythonVersionOutput" -ForegroundColor Green
    }
} else {
    $needPython = $true
}

if ($needPython) {
    Write-Host "  Python not found. Installing via winget..." -ForegroundColor Yellow
    
    # Check if winget is available
    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($wingetCmd) {
        Write-Host "  Running: winget install Python.Python.3.12" -ForegroundColor Gray
        Write-Host "  (This may take 1-2 minutes, please wait...)" -ForegroundColor Gray
        Write-Host ""
        
        # Run winget directly (not in a job) so we see output and errors
        & winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "  winget install may have had issues (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
            Write-Host "  Checking if Python was installed anyway..." -ForegroundColor Gray
        }
        
        Write-Host ""
        
        # Refresh PATH - need to get fresh values from registry
        $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        $env:Path = "$machinePath;$userPath"
        
        # Also add common Python install locations directly
        $pythonPaths = @(
            "$env:LOCALAPPDATA\Programs\Python\Python312",
            "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts",
            "$env:LOCALAPPDATA\Programs\Python\Python311",
            "$env:LOCALAPPDATA\Programs\Python\Python311\Scripts",
            "$env:ProgramFiles\Python312",
            "$env:ProgramFiles\Python312\Scripts",
            "C:\Python312",
            "C:\Python312\Scripts"
        )
        foreach ($p in $pythonPaths) {
            if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
                $env:Path = "$p;$env:Path"
            }
        }
        
        # Verify installation
        $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
        if ($pythonCmd) {
            $ver = & python --version 2>&1
            Write-Host "  Python installed successfully! ($ver)" -ForegroundColor Green
        } else {
            Write-Host "  Python was installed but PATH not updated in this session." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Please close this PowerShell window and run the setup again:" -ForegroundColor Cyan
            Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1" -ForegroundColor White
            Write-Host ""
            exit 0
        }
    } else {
        Write-Host "  winget not available. Please install Python manually:" -ForegroundColor Red
        Write-Host "  https://python.org/downloads" -ForegroundColor Yellow
        Write-Host "  IMPORTANT: Check 'Add Python to PATH' during installation!" -ForegroundColor Yellow
        Start-Process "https://python.org/downloads"
        exit 1
    }
}

# ============================================
# Step 2: Check Node.js (with version validation)
# ============================================
Write-Host "Step 2/7: Checking Node.js..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue

$needNode = $false
if ($nodeCmd) {
    $nodeVersionOutput = & node --version 2>&1
    $nodeVersionMatch = [regex]::Match($nodeVersionOutput, 'v?(\d+)')
    if ($nodeVersionMatch.Success) {
        $majorVersion = [int]$nodeVersionMatch.Groups[1].Value
        if ($majorVersion -ge 18) {
            Write-Host "  Found: Node.js $nodeVersionOutput" -ForegroundColor Green
        } else {
            Write-Host "  Found Node.js v$majorVersion but need v18+. Upgrading..." -ForegroundColor Yellow
            $needNode = $true
        }
    } else {
        Write-Host "  Found: Node.js $nodeVersionOutput" -ForegroundColor Green
    }
} else {
    $needNode = $true
}

if ($needNode) {
    Write-Host "  Node.js not found. Installing via winget..." -ForegroundColor Yellow
    
    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($wingetCmd) {
        Write-Host "  Running: winget install OpenJS.NodeJS.LTS" -ForegroundColor Gray
        Write-Host "  (This may take 1-2 minutes, please wait...)" -ForegroundColor Gray
        Write-Host ""
        
        # Run winget directly (not in a job) so we see output and errors
        & winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "  winget install may have had issues (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
            Write-Host "  Checking if Node.js was installed anyway..." -ForegroundColor Gray
        }
        
        Write-Host ""
        
        # Refresh PATH
        $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        $env:Path = "$machinePath;$userPath"
        
        # Add common Node.js install locations
        $nodePaths = @(
            "C:\Program Files\nodejs",
            "$env:APPDATA\npm"
        )
        foreach ($p in $nodePaths) {
            if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
                $env:Path = "$p;$env:Path"
            }
        }
        
        # Verify installation
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCmd) {
            $ver = & node --version 2>&1
            Write-Host "  Node.js installed successfully! ($ver)" -ForegroundColor Green
        } else {
            Write-Host "  Node.js was installed but PATH not updated in this session." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Please close this PowerShell window and run the setup again:" -ForegroundColor Cyan
            Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1" -ForegroundColor White
            Write-Host ""
            exit 0
        }
    } else {
        Write-Host "  winget not available. Please install Node.js manually:" -ForegroundColor Red
        Write-Host "  https://nodejs.org" -ForegroundColor Yellow
        Start-Process "https://nodejs.org"
        exit 1
    }
}

# ============================================
# Step 3: Check Ollama
# ============================================
Write-Host "Step 3/7: Checking Ollama..." -ForegroundColor Yellow
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue

if ($ollamaCmd) {
    $ollamaVersion = & ollama --version 2>&1
    Write-Host "  Found: $ollamaVersion" -ForegroundColor Green
} else {
    Write-Host "  Ollama not found. Installing..." -ForegroundColor Yellow
    
    # Try winget first (cleaner install)
    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    $ollamaInstalled = $false
    
    if ($wingetCmd) {
        Write-Host "  Running: winget install Ollama.Ollama" -ForegroundColor Gray
        Write-Host "  (This may take 1-2 minutes, please wait...)" -ForegroundColor Gray
        Write-Host ""
        
        # Run winget directly (not in a job) so we see output and errors
        & winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "  winget install may have had issues (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
            Write-Host "  Checking if Ollama was installed anyway..." -ForegroundColor Gray
        }
        
        Write-Host ""
        
        # Refresh PATH
        $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        $env:Path = "$machinePath;$userPath"
        
        # Add common Ollama location
        $ollamaPaths = @(
            "$env:LOCALAPPDATA\Programs\Ollama",
            "$env:LOCALAPPDATA\Ollama",
            "C:\Program Files\Ollama"
        )
        foreach ($p in $ollamaPaths) {
            if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
                $env:Path = "$p;$env:Path"
            }
        }
        
        Start-Sleep -Seconds 2
        $ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
        if ($ollamaCmd) {
            $ollamaInstalled = $true
            Write-Host "  Ollama installed successfully!" -ForegroundColor Green
        }
    }
    
    # Fallback to official installer if winget didn't work
    if (-not $ollamaInstalled) {
        Write-Host "  Trying official Ollama installer..." -ForegroundColor Gray
        try {
            Invoke-RestMethod -Uri "https://ollama.com/install.ps1" | Invoke-Expression
            
            # Refresh PATH again
            $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
            $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
            $env:Path = "$machinePath;$userPath"
            
            Start-Sleep -Seconds 3
            $ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
            if ($ollamaCmd) {
                Write-Host "  Ollama installed successfully!" -ForegroundColor Green
            } else {
                Write-Host "  Ollama was installed but PATH not updated in this session." -ForegroundColor Yellow
                Write-Host ""
                Write-Host "  Please close this PowerShell window and run the setup again:" -ForegroundColor Cyan
                Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1" -ForegroundColor White
                Write-Host ""
                exit 0
            }
        } catch {
            Write-Host "  Failed to install Ollama: $_" -ForegroundColor Red
            Write-Host "  Please install manually from: https://ollama.com/download" -ForegroundColor Yellow
            Start-Process "https://ollama.com/download"
            exit 1
        }
    }
}

# ============================================
# Step 4: Setup Backend
# ============================================
Write-Host "Step 4/7: Setting up Backend (~60 seconds)..." -ForegroundColor Yellow
$backendPath = Join-Path $ProjectDir "backend"

try {
    Push-Location $backendPath
    
    # Create virtual environment
    $venvPath = Join-Path $backendPath "venv"
    if (-not (Test-Path $venvPath)) {
        Write-Host "  Creating virtual environment..." -ForegroundColor Gray
        $result = & python -m venv venv 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Failed to create virtual environment: $result" -ForegroundColor Red
            Pop-Location
            exit 1
        }
    }
    
    # Activate virtual environment
    $activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
    if (Test-Path $activateScript) {
        & $activateScript
    } else {
        Write-Host "  Virtual environment activation script not found" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    # Install dependencies
    Write-Host "  Installing Python dependencies (this may take a minute)..." -ForegroundColor Gray
    & .\venv\Scripts\pip.exe install -r requirements.txt
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Warning: Some pip packages may have had issues" -ForegroundColor Yellow
    } else {
        Write-Host "  Python dependencies installed!" -ForegroundColor Green
    }
    
    # Create .env if not exists
    $envPath = Join-Path $backendPath ".env"
    $envExamplePath = Join-Path $backendPath ".env.example"
    if (-not (Test-Path $envPath)) {
        if (Test-Path $envExamplePath) {
            Copy-Item $envExamplePath $envPath
            Write-Host "  Created .env configuration file" -ForegroundColor Green
        } else {
            # Create minimal .env
            "OLLAMA_MODEL=mistral:7b-instruct" | Out-File -FilePath $envPath -Encoding utf8
            Write-Host "  Created minimal .env file" -ForegroundColor Green
        }
    }
    
    # Create data directories
    New-Item -ItemType Directory -Force -Path "data\chroma_db" | Out-Null
    New-Item -ItemType Directory -Force -Path "data\docs" | Out-Null
    
    Pop-Location
    Write-Host "  Backend setup complete!" -ForegroundColor Green
} catch {
    Write-Host "  Backend setup error: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# ============================================
# Step 5: Setup Frontend
# ============================================
Write-Host "Step 5/7: Setting up Frontend (~30 seconds)..." -ForegroundColor Yellow
$frontendPath = Join-Path $ProjectDir "frontend"

try {
    Push-Location $frontendPath
    
    Write-Host "  Installing npm dependencies (this may take a minute)..." -ForegroundColor Gray
    & npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Warning: npm install had some warnings (usually OK)" -ForegroundColor Yellow
    } else {
        Write-Host "  npm dependencies installed!" -ForegroundColor Green
    }
    
    Pop-Location
    Write-Host "  Frontend setup complete!" -ForegroundColor Green
} catch {
    Write-Host "  Frontend setup error: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# ============================================
# Step 6: Start Ollama if not running
# ============================================
Write-Host "Step 6/7: Starting Ollama service..." -ForegroundColor Yellow
$ollamaRunning = $false
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
    $ollamaRunning = $true
    Write-Host "  Ollama is running!" -ForegroundColor Green
} catch {
    Write-Host "  Starting Ollama..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    
    # Wait for Ollama to start with progress
    Write-Host "  Waiting for Ollama" -NoNewline -ForegroundColor Gray
    $attempts = 0
    while ($attempts -lt 15) {
        Write-Host "." -NoNewline -ForegroundColor Gray
        Start-Sleep -Seconds 1
        $attempts++
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
            $ollamaRunning = $true
            break
        } catch {}
    }
    Write-Host "" # newline
    
    if ($ollamaRunning) {
        Write-Host "  Ollama started!" -ForegroundColor Green
    } else {
        Write-Host "  Ollama may still be starting..." -ForegroundColor Yellow
    }
}

# ============================================
# Step 7: Download Mistral model
# ============================================
Write-Host "Step 7/7: Downloading AI model..." -ForegroundColor Yellow

# Check if any model is already downloaded
$hasModel = $false
try {
    $models = (Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 5).models
    if ($models -and $models.Count -gt 0) {
        $hasModel = $true
        Write-Host "  Model already available: $($models[0].name)" -ForegroundColor Green
    }
} catch {}

if (-not $hasModel) {
    Write-Host "  Downloading Mistral model (~4GB)" -ForegroundColor Yellow
    Write-Host "  This is a one-time download and takes 2-5 minutes." -ForegroundColor Gray
    Write-Host "  You'll see download progress below:" -ForegroundColor Gray
    Write-Host ""
    
    # Download mistral:latest and create the 7b-instruct alias
    & ollama pull mistral:latest
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  Creating model alias..." -ForegroundColor Gray
        & ollama cp mistral:latest mistral:7b-instruct 2>&1 | Out-Null
        Write-Host "  Mistral model downloaded successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  Model download may have had issues. You can download manually:" -ForegroundColor Yellow
        Write-Host "    ollama pull mistral:latest" -ForegroundColor White
        Write-Host "    ollama cp mistral:latest mistral:7b-instruct" -ForegroundColor White
    }
}

# ============================================
# Done!
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  To start the application:" -ForegroundColor White
Write-Host "    .\scripts\start-dev.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Or start manually:" -ForegroundColor Gray
Write-Host "    Terminal 1: cd backend && .\venv\Scripts\Activate.ps1 && uvicorn app.main:app --reload" -ForegroundColor Gray
Write-Host "    Terminal 2: cd frontend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Then open: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting the application..." -ForegroundColor Yellow
Write-Host ""
$startScript = Join-Path $ProjectDir "scripts\start-dev.ps1"
& $startScript
