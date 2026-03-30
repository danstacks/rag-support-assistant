#!/bin/bash

# Isovalent Support Assistant - Ubuntu Server Setup Script
# For Cisco UCS with NVIDIA L40S GPU

set -e

echo "=========================================="
echo "Isovalent Support Assistant Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run as root. Run as regular user with sudo access."
    exit 1
fi

# Update system
echo ""
echo "Step 1: Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_status "System updated"

# Install basic dependencies
echo ""
echo "Step 2: Installing basic dependencies..."
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    python3.11 \
    python3.11-venv \
    python3-pip \
    ca-certificates \
    gnupg
print_status "Basic dependencies installed"

# Check NVIDIA driver
echo ""
echo "Step 3: Checking NVIDIA GPU..."
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi
    print_status "NVIDIA driver detected"
else
    print_warning "NVIDIA driver not found. Installing..."
    sudo apt install -y nvidia-driver-535
    print_warning "Please reboot after setup and run this script again"
fi

# Install Docker if not present
echo ""
echo "Step 4: Setting up Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # Add the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add user to docker group
    sudo usermod -aG docker $USER
    print_status "Docker installed. You may need to log out and back in for group changes."
else
    print_status "Docker already installed"
fi

# Install NVIDIA Container Toolkit
echo ""
echo "Step 5: Setting up NVIDIA Container Toolkit..."
if ! dpkg -l | grep -q nvidia-container-toolkit; then
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
        sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
        sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
    sudo apt update
    sudo apt install -y nvidia-container-toolkit
    sudo nvidia-ctk runtime configure --runtime=docker
    sudo systemctl restart docker
    print_status "NVIDIA Container Toolkit installed"
else
    print_status "NVIDIA Container Toolkit already installed"
fi

# Install Ollama
echo ""
echo "Step 6: Installing Ollama..."
if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
    print_status "Ollama installed"
else
    print_status "Ollama already installed"
fi

# Start Ollama service
echo ""
echo "Step 7: Starting Ollama service..."
sudo systemctl enable ollama
sudo systemctl start ollama
sleep 3
print_status "Ollama service started"

# Pull LLM model
echo ""
echo "Step 8: Pulling LLM model (this may take a while)..."
ollama pull mistral:7b-instruct
print_status "LLM model pulled"

# Install Node.js
echo ""
echo "Step 9: Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    print_status "Node.js installed"
else
    print_status "Node.js already installed"
fi

# Setup project
echo ""
echo "Step 10: Setting up project..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Backend setup
echo "Setting up backend..."
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env if not exists
if [ ! -f .env ]; then
    cp .env.example .env
    print_status "Created .env file"
fi

# Create data directories
mkdir -p data/chroma_db data/docs
deactivate

# Frontend setup
echo "Setting up frontend..."
cd ../frontend
npm install

print_status "Project setup complete"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "To start the application:"
echo ""
echo "Option 1: Run directly"
echo "  Terminal 1: cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Option 2: Use Docker Compose"
echo "  docker compose up -d"
echo ""
echo "Then open http://localhost:3000 in your browser"
echo ""
print_warning "If this is a fresh install, you may need to log out and back in for Docker group changes."
