#!/bin/bash

# ============================================================
# RAG Support Assistant - One-Line Installer
# ============================================================
# Usage: curl -fsSL https://raw.githubusercontent.com/danstacks/rag-support-assistant/main/install.sh | bash
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║   📚 RAG Support Assistant Installer                          ║"
    echo "║   From Docs to Expert: Scaling Support with RAG               ║"
    echo "║                                                               ║"
    echo "║   Built by Dan Stacks                                         ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_info() { echo -e "${BLUE}[i]${NC} $1"; }

# Configuration
REPO_URL="https://github.com/danstacks/rag-support-assistant.git"
INSTALL_DIR="$HOME/rag-support-assistant"
OLLAMA_MODEL="mistral:7b-instruct"

print_banner

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run as root. Run as a regular user with sudo access."
    exit 1
fi

# Check OS
if [ ! -f /etc/os-release ]; then
    print_error "This installer is designed for Ubuntu/Debian systems."
    exit 1
fi

source /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    print_warning "This script is optimized for Ubuntu. Proceeding anyway..."
fi

echo ""
print_info "This installer will:"
echo "  1. Install system dependencies (Python, Node.js, Docker)"
echo "  2. Install Ollama for local LLM inference"
echo "  3. Download the AI model (~4GB)"
echo "  4. Set up the RAG Support Assistant"
echo "  5. Launch the Setup Wizard"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# ============================================================
# Step 1: System Dependencies
# ============================================================
echo ""
echo -e "${CYAN}Step 1/7: Installing system dependencies...${NC}"

sudo apt update
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-venv \
    python3-pip \
    ca-certificates \
    gnupg \
    lsb-release

print_status "System dependencies installed"

# ============================================================
# Step 2: Install Node.js 18+
# ============================================================
echo ""
echo -e "${CYAN}Step 2/7: Installing Node.js...${NC}"

if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 18 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    print_status "Node.js $(node -v) installed"
else
    print_status "Node.js $(node -v) already installed"
fi

# ============================================================
# Step 3: Install Ollama
# ============================================================
echo ""
echo -e "${CYAN}Step 3/7: Installing Ollama...${NC}"

if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
    print_status "Ollama installed"
else
    print_status "Ollama already installed"
fi

# Start Ollama service
sudo systemctl enable ollama 2>/dev/null || true
sudo systemctl start ollama 2>/dev/null || ollama serve &>/dev/null &
sleep 3
print_status "Ollama service running"

# ============================================================
# Step 4: Check for NVIDIA GPU (optional)
# ============================================================
echo ""
echo -e "${CYAN}Step 4/7: Checking for GPU...${NC}"

if command -v nvidia-smi &> /dev/null; then
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
    print_status "NVIDIA GPU detected: $GPU_NAME"
    print_info "GPU acceleration will be used for faster inference"
else
    print_warning "No NVIDIA GPU detected. CPU inference will be used (slower but works fine)"
fi

# ============================================================
# Step 5: Clone Repository
# ============================================================
echo ""
echo -e "${CYAN}Step 5/7: Downloading RAG Support Assistant...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    read -p "Remove and reinstall? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        print_info "Using existing installation"
    fi
fi

if [ ! -d "$INSTALL_DIR" ]; then
    git clone "$REPO_URL" "$INSTALL_DIR"
    print_status "Repository cloned to $INSTALL_DIR"
else
    cd "$INSTALL_DIR"
    git pull origin main 2>/dev/null || true
    print_status "Repository updated"
fi

cd "$INSTALL_DIR"

# ============================================================
# Step 6: Setup Backend & Frontend
# ============================================================
echo ""
echo -e "${CYAN}Step 6/7: Setting up application...${NC}"

# Backend
print_info "Setting up Python backend..."
cd "$INSTALL_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

if [ ! -f .env ]; then
    cp .env.example .env
fi
mkdir -p data/chroma_db data/docs
deactivate
print_status "Backend configured"

# Frontend
print_info "Setting up React frontend..."
cd "$INSTALL_DIR/frontend"
npm install --silent
print_status "Frontend configured"

# ============================================================
# Step 7: Pull LLM Model
# ============================================================
echo ""
echo -e "${CYAN}Step 7/7: Downloading AI model (~4GB)...${NC}"
print_info "This may take several minutes depending on your connection..."

ollama pull $OLLAMA_MODEL

print_status "Model downloaded"

# ============================================================
# Create launcher script
# ============================================================
cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "Starting RAG Support Assistant..."

# Start Ollama if not running
if ! pgrep -x "ollama" > /dev/null; then
    echo "Starting Ollama..."
    ollama serve &>/dev/null &
    sleep 3
fi

# Start backend
echo "Starting backend on http://localhost:8000..."
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Start frontend
echo "Starting frontend on http://localhost:3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  RAG Support Assistant is running!                            ║"
echo "║                                                               ║"
echo "║  Open in browser: http://localhost:3000                       ║"
echo "║                                                               ║"
echo "║  Press Ctrl+C to stop                                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
EOF
chmod +x "$INSTALL_DIR/start.sh"

# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║   ✅ Installation Complete!                                   ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "To start the application:"
echo ""
echo -e "  ${CYAN}cd $INSTALL_DIR && ./start.sh${NC}"
echo ""
echo -e "Or run these commands in separate terminals:"
echo ""
echo -e "  ${YELLOW}Terminal 1 (Backend):${NC}"
echo -e "  cd $INSTALL_DIR/backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo ""
echo -e "  ${YELLOW}Terminal 2 (Frontend):${NC}"
echo -e "  cd $INSTALL_DIR/frontend && npm run dev"
echo ""
echo -e "Then open ${CYAN}http://localhost:3000${NC} in your browser."
echo ""
echo -e "The ${YELLOW}Setup Wizard${NC} will guide you through the rest!"
echo ""

# Ask to start now
read -p "Start the application now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$INSTALL_DIR"
    ./start.sh
fi
