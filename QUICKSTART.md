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

### 1. Verify prerequisites

```bash
python3 --version        # Python 3.10+
node --version           # Node.js 18+
```

Start Ollama and pull the model (one-time ~4 GB download):

```bash
ollama serve                       # leave running in a terminal
ollama pull mistral:7b-instruct
```

### 2. Clone the repos

```bash
# The RAG assistant
git clone https://github.com/danstacks/docs-to-expert-rag.git rag-support-assistant
cd rag-support-assistant
git checkout brmc-dev

# (Optional) The SONiC project for local HLD docs
cd ~/src
git clone https://github.com/sonic-net/SONiC.git
# This gives you ~/src/SONiC/doc/ which sonic.yaml expects
```

### 3. Activate the domain config

```bash
cd rag-support-assistant
cp domains/sonic.yaml domain.yaml
```

If you cloned SONiC somewhere other than `~/src/SONiC`, edit `domain.yaml` and update the path under `local_directories.sonic-hld.path`.

### 4. Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 5. Set up the frontend

```bash
cd ../frontend
npm install
```

### 6. Start everything

**Option A** — use the dev script:

```bash
cd rag-support-assistant
./scripts/start-dev.sh
```

**Option B** — start manually in separate terminals:

```bash
# Terminal 1: Ollama (if not already running)
ollama serve

# Terminal 2: Backend
cd rag-support-assistant/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3: Frontend
cd rag-support-assistant/frontend
npm run dev
```

### 7. Ingest docs

Open [http://localhost:3000](http://localhost:3000) in your browser. From there you can either:

- Use the **Setup Wizard** and click "Load Documentation" (triggers bulk ingest)
- Or hit the API directly:

```bash
# Bulk ingest: loads local directories first, then scrapes web presets
curl -X POST http://localhost:8000/ingest/bulk-docs

# Or ingest just a local directory:
curl -X POST http://localhost:8000/ingest/directory \
  -H "Content-Type: application/json" \
  -d '{"directory": "/full/path/to/SONiC/doc"}'

# Query parameter form also works:
curl -X POST "http://localhost:8000/ingest/directory?directory=/full/path/to/SONiC/doc"
```

The local directory load should finish in under a minute. Web scraping presets will take longer depending on rate limits.

### 8. Start asking questions!

Once ingestion completes, chat at [http://localhost:3000](http://localhost:3000).

### Docker (Alternative)

```bash
# Make sure Ollama is running on host
ollama serve

# Start with Docker Compose
docker compose up -d

# Open http://localhost:3000
```

---

## What's Included

```
rag-support-assistant/
├── backend/           # FastAPI Python backend
│   ├── app/           # Application code
│   └── requirements.txt
├── frontend/          # React frontend
│   └── src/
├── domains/           # Example domain YAML configs (sonic, cilium)
├── sample-data/       # Sample documentation files
├── scripts/           # Setup and start scripts
└── docs/              # Demo guide and test questions
```

---

## Troubleshooting

### "Ollama not running"

```bash
ollama serve
```

### "Model not found"

The Setup Wizard will download it automatically, or manually:

```bash
ollama pull mistral:7b-instruct
```

### "Port already in use"

```bash
# Windows:
netstat -ano | findstr :8000
# Linux/macOS:
lsof -i :8000
```

### "Batch size exceeds max"

This happens when ingesting a large directory. Make sure you have the latest code which batches ChromaDB inserts automatically.

### Slow responses

- First response is slower (model loading)
- Ensure GPU is being used: `nvidia-smi`
- Check Ollama is using GPU in its output

---

## Next Steps

1. **Add your own data** — click "Add Data" in the app or use the ingest API
2. **Switch domains** — copy a different YAML from `domains/` to `domain.yaml`
3. **Customize the prompt** — edit the persona in your `domain.yaml`
4. **Read the demo guide** — see `docs/DEMO_GUIDE.md`
5. **Test quality** — see `docs/TEST_QUESTIONS.md`

---

## Need Help?

- Check the [full README](README.md) for detailed documentation
- Open an issue on GitHub
- Review the [Demo Guide](docs/DEMO_GUIDE.md) for walkthrough
