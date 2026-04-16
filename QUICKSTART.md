# Quick Start Guide

Get the RAG Support Assistant running in 5 minutes.

## Prerequisites

Before you begin, install these:

| Requirement | Download | Notes |
|-------------|----------|-------|
| **Python 3.10+** | [python.org](https://python.org) | Check "Add to PATH" during install |
| **Node.js 18+** | [nodejs.org](https://nodejs.org) | LTS version recommended |
| **Ollama** | [ollama.com](https://ollama.com/download) | Local LLM runtime |
| **Git** | [git-scm.com](https://git-scm.com) | To clone the repo |

### GPU (Optional but Recommended)
- NVIDIA GPU with 8GB+ VRAM for fast inference
- Install [CUDA drivers](https://developer.nvidia.com/cuda-downloads) if using GPU

---

## Installation

### Windows

```powershell
# 1. Clone the repository
git clone https://github.com/danstacks/docs-to-expert-rag.git
cd docs-to-expert-rag

# 2. Run the setup script (PowerShell as Administrator)
.\scripts\setup-windows.ps1

# 3. Start the application
.\scripts\start-dev.ps1
```

### Linux/macOS

```bash
# 1. Clone the repository
git clone https://github.com/danstacks/docs-to-expert-rag.git
cd docs-to-expert-rag

# 2. Run the setup script
chmod +x scripts/setup-ubuntu.sh
./scripts/setup-ubuntu.sh

# 3. Start the application
./scripts/start-dev.sh
```

### Docker (Alternative)

```bash
# Make sure Ollama is running on host
ollama serve

# Start with Docker Compose
docker compose up -d

# Open http://localhost:3000
```

---

## First Run

1. **Open your browser** to [http://localhost:3000](http://localhost:3000)

2. **Setup Wizard appears** - it will guide you through:
   - ✅ Verifying Ollama is running
   - ✅ Downloading the AI model (~4GB, one-time)
   - ✅ Loading sample documentation

3. option B: curl to ingest docs
```
curl -X POST http://localhost:8000/ingest/bulk-docs
```

4. **Start asking questions!**

---

## What's Included

```
docs-to-expert-rag/
├── backend/           # FastAPI Python backend
│   ├── app/          # Application code
│   └── requirements.txt
├── frontend/          # React frontend
│   └── src/
├── sample-data/       # Sample Cilium/Isovalent docs
├── scripts/           # Setup and start scripts
└── docs/              # Demo guide and test questions
```

---

## Troubleshooting

### "Ollama not running"
```bash
# Start Ollama manually
ollama serve
```

### "Model not found"
The Setup Wizard will download it automatically, or manually:
```bash
ollama pull mistral:7b-instruct
```

### "Port already in use"
```bash
# Check what's using the port
# Windows:
netstat -ano | findstr :8000
# Linux/macOS:
lsof -i :8000
```

### Slow responses
- First response is slower (model loading)
- Ensure GPU is being used: `nvidia-smi`
- Check Ollama is using GPU in its output

---

## Next Steps

1. **Add your own data** - Click "Add Data" in the app
2. **Customize the prompt** - Edit `backend/app/llm_service.py`
3. **Read the demo guide** - See `docs/DEMO_GUIDE.md`
4. **Test quality** - See `docs/TEST_QUESTIONS.md`

---

## Need Help?

- Check the [full README](README.md) for detailed documentation
- Open an issue on GitHub
- Review the [Demo Guide](docs/DEMO_GUIDE.md) for walkthrough
