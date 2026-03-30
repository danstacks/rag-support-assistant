#!/bin/bash

# ============================================================
# RAG Support Assistant - One-Line Installer
# ============================================================
# Usage: curl -fsSL https://raw.githubusercontent.com/danstacks/rag-support-assistant/main/install.sh | bash
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
    echo -e "${CYAN}"
    echo "================================================================="
    echo "   RAG Support Assistant Installer"
    echo "   From Docs to Expert: Scaling Support with RAG"
    echo "   Built by Dan Stacks"
    echo "================================================================="
    echo -e "${NC}"
}

print_status() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[X]${NC} $1"; }
print_info() { echo -e "${BLUE}[i]${NC} $1"; }

REPO_URL="https://github.com/danstacks/rag-support-assistant.git"
INSTALL_DIR="$HOME/rag-support-assistant"
OLLAMA_MODEL="mistral:7b-instruct"

print_banner

if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run as root. Run as a regular user with sudo access."
    exit 1
fi

if [ ! -f /etc/os-release ]; then
    print_error "This installer is designed for Ubuntu/Debian systems."
    exit 1
fi

source /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    print_warning "This script is optimized for Ubuntu. Proceeding anyway..."
fi

# Get server IP address upfront
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="127.0.0.1"
fi

echo ""
print_info "This installer will:"
echo "  1. Install system dependencies (Python, Node.js)"
echo "  2. Install Ollama for local LLM inference"
echo "  3. Download the AI model (~4GB)"
echo "  4. Set up and launch the RAG Support Assistant"
echo ""

echo "How should the application be accessed?"
echo ""
echo "  1) Network access (http://$SERVER_IP:3000) [DEFAULT]"
echo "     - Accessible from other devices on your network"
echo ""
echo "  2) Localhost only (http://localhost:3000)"
echo "     - More secure, only accessible from this machine"
echo ""
read -p "Select option [1/2] (press Enter for network): " -n 1 -r ACCESS_MODE </dev/tty
echo ""

if [[ "$ACCESS_MODE" == "2" ]]; then
    NETWORK_MODE="localhost"
    DISPLAY_HOST="localhost"
    print_info "Mode: Localhost only"
else
    NETWORK_MODE="network"
    DISPLAY_HOST="$SERVER_IP"
    print_info "Mode: Network access at http://$SERVER_IP:3000"
fi

echo ""
read -p "Start the application after install? (Y/n): " -n 1 -r START_AFTER </dev/tty
echo ""
if [[ "$START_AFTER" =~ ^[Nn]$ ]]; then
    AUTO_START="no"
    print_info "Will not auto-start after install"
else
    AUTO_START="yes"
    print_info "Will start automatically after install"
fi
echo ""

echo ""
echo -e "${CYAN}Step 1/7: Installing system dependencies...${NC}"

sudo apt update
sudo apt install -y curl wget git build-essential python3 python3-venv python3-pip ca-certificates gnupg lsb-release

print_status "System dependencies installed"

echo ""
echo -e "${CYAN}Step 2/7: Installing Node.js...${NC}"

if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 18 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    print_status "Node.js $(node -v) installed"
else
    print_status "Node.js $(node -v) already installed"
fi

echo ""
echo -e "${CYAN}Step 3/7: Installing Ollama...${NC}"

if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
    print_status "Ollama installed"
else
    print_status "Ollama already installed"
fi

sudo systemctl enable ollama 2>/dev/null || true
sudo systemctl start ollama 2>/dev/null || ollama serve &>/dev/null &
sleep 3
print_status "Ollama service running"

echo ""
echo -e "${CYAN}Step 4/7: Checking for GPU...${NC}"

if command -v nvidia-smi &> /dev/null; then
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
    print_status "NVIDIA GPU detected: $GPU_NAME"
    print_info "GPU acceleration will be used for faster inference"
else
    print_warning "No NVIDIA GPU detected. CPU inference will be used (slower but works fine)"
fi

echo ""
echo -e "${CYAN}Step 5/7: Downloading RAG Support Assistant...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    read -p "Remove and reinstall? (y/n) " -n 1 -r REPLY </dev/tty
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

echo ""
echo -e "${CYAN}Step 6/7: Setting up application...${NC}"

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

print_info "Setting up React frontend..."
cd "$INSTALL_DIR/frontend"
npm install --silent
print_status "Frontend configured"

echo ""
echo -e "${CYAN}Step 7/7: Downloading AI model (~4GB)...${NC}"
print_info "This may take several minutes depending on your connection..."

ollama pull $OLLAMA_MODEL

print_status "Model downloaded"

# Create start.sh with the selected network mode baked in
cat > "$INSTALL_DIR/start.sh" << STARTSCRIPT
#!/bin/bash
cd "\$(dirname "\$0")"

# Network configuration (set during install)
NETWORK_MODE="$NETWORK_MODE"
SERVER_IP="\$(hostname -I | awk '{print \$1}')"
if [ -z "\$SERVER_IP" ]; then
    SERVER_IP="127.0.0.1"
fi

if [[ "\$NETWORK_MODE" == "network" ]]; then
    FRONTEND_HOST="--host"
    BACKEND_HOST="0.0.0.0"
    DISPLAY_URL="http://\$SERVER_IP:3000"
    API_URL="http://\$SERVER_IP:8000"
else
    FRONTEND_HOST=""
    BACKEND_HOST="127.0.0.1"
    DISPLAY_URL="http://localhost:3000"
    API_URL="http://localhost:8000"
fi

echo ""
echo "Starting RAG Support Assistant..."

if ! pgrep -x "ollama" > /dev/null; then
    echo "Starting Ollama..."
    ollama serve &>/dev/null &
    sleep 3
fi

echo "Starting backend..."
cd backend
source venv/bin/activate
uvicorn app.main:app --host \$BACKEND_HOST --port 8000 &
BACKEND_PID=\$!
cd ..

echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo "Starting frontend..."
cd frontend
npm run dev -- \$FRONTEND_HOST &
FRONTEND_PID=\$!
cd ..

sleep 2
echo ""
echo "================================================================="
echo "  RAG Support Assistant is running!"
echo ""
echo "  Open in browser: \$DISPLAY_URL"
echo ""
echo "  API endpoint:    \$API_URL"
echo "  Press Ctrl+C to stop"
echo "================================================================="
echo ""

trap "kill \$BACKEND_PID \$FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
STARTSCRIPT
chmod +x "$INSTALL_DIR/start.sh"

echo ""
echo -e "${GREEN}=================================================================${NC}"
echo -e "${GREEN}   Installation Complete!${NC}"
echo -e "${GREEN}=================================================================${NC}"
echo ""

if [[ "$AUTO_START" == "yes" ]]; then
    echo -e "Starting the application..."
    echo ""
    cd "$INSTALL_DIR"
    ./start.sh
else
    echo -e "To start the application later, run:"
    echo ""
    echo -e "  ${CYAN}cd $INSTALL_DIR && ./start.sh${NC}"
    echo ""
    echo -e "Then open ${CYAN}http://$DISPLAY_HOST:3000${NC} in your browser."
    echo ""
fi
