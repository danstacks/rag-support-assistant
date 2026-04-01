# From Docs to Expert: Scaling Support with RAG

<p align="center">
  <img src="docs/images/banner.png" alt="Support Assistant" width="800">
</p>

<p align="center">
  <strong>Cisco Live 2026</strong><br>
  <em>From Docs to Expert: Scaling Support with Retrieval-Augmented Generation</em>
</p>

<p align="center">
  <a href="#the-problem">The Problem</a> •
  <a href="#the-solution">The Solution</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#build-your-own">Build Your Own</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## The Problem

> *The rapid pace of technology adoption and the sheer volume of proprietary documentation create a significant hurdle for support teams, leading to fragmented operational knowledge and delays in critical troubleshooting.*

When Cisco acquired Isovalent, our support teams faced a familiar challenge: hundreds of pages of documentation across Cilium, Hubble, Tetragon, and enterprise features. L1/L2 engineers needed to quickly become experts on technology they'd never seen before.

**Sound familiar?** Every acquisition, every new product launch, every major update creates the same problem.

## The Solution

This project demonstrates a **proven methodology** for transforming L1/L2 technical support by engineering a custom LLM agent built on RAG (Retrieval-Augmented Generation) principles:

- 📚 **Ingest your documentation** - crawl websites, upload files, or paste content
- 🧠 **Create a knowledge base** - automatically chunk, embed, and index
- 💬 **Deploy a support agent** - answer questions grounded in YOUR data
- 🔒 **Keep it private** - runs entirely on your UCS server with local LLM

**This is not a demo you watch. It's a template you take and build your own.**

### Why RAG for Support?

| Traditional Approach | RAG Approach |
|---------------------|--------------|
| Engineers search through docs manually | Agent retrieves relevant sections instantly |
| Knowledge lives in senior engineers' heads | Knowledge is democratized and searchable |
| New hires take months to ramp up | New hires have an expert assistant from day 1 |
| Answers vary by who you ask | Answers are consistent and source-cited |
| Documentation updates require retraining | Just re-ingest - no model retraining needed |

## Features

### Core Capabilities
- **RAG-based Q&A**: Answers questions using your documentation with source citations
- **Local LLM**: Runs entirely on your hardware via Ollama - data stays private
- **Modern Web UI**: Clean chat interface with streaming responses
- **GPU Accelerated**: Leverages NVIDIA GPUs for fast inference

### Data Ingestion
- 🌐 **Web Crawler**: Scrape any website with configurable depth and authentication
- 🏢 **Enterprise Wiki Support**: Connect to Confluence, SharePoint, or other internal wikis
- 📄 **Document Upload**: PDF, DOCX, Markdown, HTML, and text files
- 📝 **Paste Text**: Directly input content from any source
- 🔄 **Scheduled Pipelines**: Keep your knowledge base in sync with automatic updates

### Enterprise Features
- 💬 **Chat History**: Persistent conversation history with export capability
- 📊 **Document Management**: View, search, and delete individual document sources
- ⚙️ **Model Selection**: Switch between different Ollama models on the fly
- 👍 **Feedback System**: Thumbs up/down rating for response quality tracking
- 🔐 **Authentication Support**: Bearer tokens, Basic Auth, and cookie-based auth for protected sources
- 📦 **Export/Import**: Backup and restore your entire knowledge base
- 🔌 **MCP Integration**: Use with Claude Desktop, Cursor, or other MCP-compatible AI assistants

### Advanced Features (New!)
- 🔍 **Hybrid Search**: Combines semantic + keyword (BM25) search for better results
- 📈 **Confidence Scoring**: See how confident the AI is in each response
- 💡 **Suggested Questions**: Auto-generated follow-up questions
- 🧠 **Conversation Memory**: Multi-turn conversations with context retention
- 📊 **Analytics Dashboard**: Query patterns, knowledge gaps, and usage stats
- ⌨️ **Keyboard Shortcuts**: Ctrl+K (focus), Ctrl+N (new chat), Ctrl+H (history)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Web UI  │────▶│  FastAPI Backend │────▶│     Ollama      │
│   (Port 3000)   │     │   (Port 8000)    │     │  (Port 11434)   │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │    ChromaDB      │
                        │  (Vector Store)  │
                        └──────────────────┘
```

## Quick Start

### One-Line Install (Ubuntu Server)

```bash
curl -fsSL https://raw.githubusercontent.com/danstacks/rag-support-assistant/main/install.sh | bash
```

This will:
1. Install all dependencies (Python, Node.js, Ollama)
2. Download the AI model (~4GB)
3. Set up the application
4. Launch the Setup Wizard

### Manual Install

```bash
# Clone the repository
git clone https://github.com/danstacks/rag-support-assistant.git
cd rag-support-assistant

# Run the automated setup (Ubuntu with NVIDIA GPU)
chmod +x scripts/setup-ubuntu.sh
./scripts/setup-ubuntu.sh

# Start the application
./start.sh

# Open http://localhost:3000 in your browser
```

### Windows (One-Command Install)

```powershell
# Paste this entire line into PowerShell:
git clone https://github.com/danstacks/rag-support-assistant.git; cd rag-support-assistant; powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

**That's it!** The script will automatically:
1. ✅ Install Python 3.12 (via winget) if missing
2. ✅ Install Node.js LTS (via winget) if missing  
3. ✅ Install Ollama (via official installer) if missing
4. ✅ Create Python virtual environment
5. ✅ Install all packages
6. ✅ Start Ollama service
7. ✅ Launch the application

**To start again later:**
```powershell
cd rag-support-assistant
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

## Build Your Own

This project is designed as a **template**. Here's how to adapt it for your organization:

### Step 1: Deploy the Infrastructure
Follow the Quick Start above to get the base system running on your UCS server.

### Step 2: Ingest YOUR Documentation
Replace the Isovalent sample data with your own:

| Your Data Source | How to Ingest |
|------------------|---------------|
| **Confluence** | Use "Connect Wiki" tab → Select Confluence → Enter URL + API token |
| **SharePoint** | Use "Connect Wiki" tab → Select SharePoint → Enter site URL + auth |
| Internal wiki/docs site | Use "Crawl Website" - enter URL, enable recursive |
| PDF/Word documents | Use "Upload Files" - drag & drop (supports PDF, DOCX) |
| Markdown/HTML files | Use "Upload Files" - drag & drop |
| Runbooks & SOPs | Use "Paste Text" for quick additions |

#### Connecting to Confluence
1. Go to **Add Data** → **Connect Wiki** tab
2. Select **Confluence** as the platform
3. Enter your Confluence URL (e.g., `https://yourcompany.atlassian.net/wiki`)
4. Optionally specify a Space Key to limit scope
5. For authentication:
   - **Confluence Cloud**: Use your email + API token (generate at Atlassian Account → Security → API tokens)
   - **Confluence Server**: Use username + password or Personal Access Token

#### Connecting to SharePoint
1. Go to **Add Data** → **Connect Wiki** tab
2. Select **SharePoint** as the platform
3. Enter your SharePoint site URL
4. For authentication, you may need:
   - App registration credentials, or
   - Browser cookies (for SSO-protected sites)

### Step 3: Customize the Agent
Edit `backend/app/llm_service.py` to change the system prompt:

```python
SYSTEM_PROMPT = """You are a support assistant for [YOUR COMPANY].
You help L1/L2 engineers with questions about [YOUR PRODUCTS].
Always cite your sources and admit when you don't know something."""
```

### Step 4: Test & Iterate
Use the [Test Questions Guide](docs/TEST_QUESTIONS.md) to validate quality:
- Create questions with known answers → verify accuracy
- Create out-of-scope questions → verify it doesn't hallucinate

---

## Prerequisites

### Hardware Requirements
- **Server**: Cisco UCS or any server with NVIDIA GPU
- **GPU**: NVIDIA GPU with 8GB+ VRAM (tested on L40S, works with T4, A10, etc.)
- **RAM**: 16GB+ recommended
- **Storage**: 20GB+ for models and vector store

### Software Requirements (Ubuntu Server)

1. **Install Ollama**:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. **Pull the LLM model**:
   ```bash
   ollama pull mistral:7b-instruct
   ```

3. **Install Python 3.10+** (if not already installed):
   ```bash
   sudo apt update
   sudo apt install python3.10 python3.10-venv python3-pip
   ```

4. **Install Node.js 18+** (for frontend):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

## Installation

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env if needed to customize settings
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## Running the Application

### 1. Start Ollama (if not running as service)

```bash
ollama serve
```

### 2. Start the Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start the Frontend

```bash
cd frontend
npm run dev
```

### 4. Access the Application

Open your browser to `http://localhost:3000`

## Adding Your Data

### Option 1: Web UI (Recommended)

Click the **"Add Data"** button in the header to open the Data Manager:

| Tab | Use Case |
|-----|----------|
| **Crawl Website** | Enter a URL and let the crawler fetch documentation automatically |
| **Upload Files** | Drag & drop or browse for .md, .txt, .html files |
| **Paste Text** | Copy/paste content directly from any source |

### Option 2: Load Sample Data

Quick-start with included Cilium/Isovalent documentation:

```bash
curl -X POST "http://localhost:8000/ingest/directory?directory=./sample-data"
```

### Option 3: API

```bash
# Crawl a website
curl -X POST "http://localhost:8000/ingest/url" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.example.com", "recursive": true, "max_depth": 2}'

# Upload files
curl -X POST "http://localhost:8000/ingest/files" \
  -F "files=@document1.md" \
  -F "files=@document2.txt"

# Ingest text directly
curl -X POST "http://localhost:8000/ingest/text" \
  -F "content=Your documentation text here..." \
  -F "source_name=My Document"

# Load from directory
curl -X POST "http://localhost:8000/ingest/directory?directory=/path/to/docs"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and status |
| `/chat` | POST | Send a message and get response |
| `/chat/stream` | POST | Streaming chat response |
| `/ingest/url` | POST | Crawl and ingest from URL(s) |
| `/ingest/files` | POST | Upload and ingest files |
| `/ingest/text` | POST | Ingest raw text content |
| `/ingest/directory` | POST | Ingest from local directory |
| `/ingest/status` | GET | Get ingestion status |
| `/documents/count` | GET | Get indexed document count |
| `/documents` | DELETE | Clear all indexed documents |
| `/ollama/status` | GET | Check Ollama connection |
| `/ollama/pull` | POST | Pull a new model |

## Configuration

Edit `backend/.env` to customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_MODEL` | `mistral:7b-instruct` | LLM model for chat |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Embedding model |
| `CHUNK_SIZE` | `1000` | Document chunk size |
| `TOP_K_RESULTS` | `5` | Number of context docs |

## Adding MCP Support (Future)

The architecture is designed to support MCP (Model Context Protocol) integration. To add MCP:

1. Create MCP server definitions in `backend/app/mcp/`
2. Register tools for workflows like:
   - Kubernetes cluster inspection
   - Cilium policy validation
   - Hubble flow queries
   - Tetragon event analysis

## Troubleshooting

### Ollama not connecting
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
sudo systemctl restart ollama
```

### GPU not being used
```bash
# Verify CUDA is available
nvidia-smi

# Check Ollama GPU usage
ollama run mistral:7b-instruct --verbose
```

### Slow embeddings
The first run downloads the embedding model. Subsequent runs use GPU acceleration.

## Demo Walkthrough

For the Cisco Live session, follow this demo flow:

### 1. Show the Problem (2 min)
- Open Cilium documentation - show how vast it is
- Demonstrate a complex support question that requires reading multiple pages

### 2. Introduce RAG Solution (3 min)
- Explain the architecture diagram
- Highlight: Local LLM, Vector Store, Document Ingestion

### 3. Live Demo (10 min)

**Ingest Documentation:**
```bash
curl -X POST "http://localhost:8000/ingest/isovalent-docs"
```

**Ask Questions:**
- "How do I install Cilium on a Kubernetes cluster?"
- "What is the difference between CiliumNetworkPolicy and NetworkPolicy?"
- "How do I troubleshoot connectivity issues with Hubble?"
- "Explain how eBPF works in Cilium"

**Show Source Citations:**
- Expand the sources panel to show where answers come from
- Click through to original documentation

### 4. Under the Hood (5 min)
- Show the vector store: `curl http://localhost:8000/documents/count`
- Explain chunking and embeddings
- Show Ollama running locally: `nvidia-smi`

## Adapting for Your Use Case

This project can be adapted for any documentation:

1. **Change the documentation sources** in `backend/app/document_loader.py`
2. **Customize the system prompt** in `backend/app/llm_service.py`
3. **Adjust chunking parameters** in `backend/.env`
4. **Swap the LLM model** - try `mixtral:8x7b` for better quality or `mistral:7b` for speed

## MCP Integration

The RAG Support Assistant includes an MCP (Model Context Protocol) server that allows AI assistants like Claude Desktop, Cursor, or Windsurf to use your knowledge base directly.

### Available MCP Tools

**Core Tools:**
| Tool | Description |
|------|-------------|
| `search_knowledge_base` | Search docs with semantic/hybrid search |
| `ask_question` | Ask a question and get an AI-generated answer |
| `list_documents` | List all indexed documents |
| `get_document` | Get full content of a specific document |
| `ingest_url` | Add a new URL to the knowledge base |
| `delete_document` | Delete a specific document |
| `clear_knowledge_base` | Clear all documents (requires confirmation) |

**System & Analytics:**
| Tool | Description |
|------|-------------|
| `get_system_status` | Get system health and statistics |
| `get_system_monitoring` | Detailed CPU, memory, GPU, and service status |
| `get_analytics` | Usage analytics and knowledge gaps |
| `get_settings` | View current application settings |
| `update_settings` | Change model, chunk size, etc. |
| `export_knowledge_base` | Export entire knowledge base for backup |

**Pipeline Management:**
| Tool | Description |
|------|-------------|
| `list_pipelines` | List all scheduled data sync pipelines |
| `create_pipeline` | Create a new scheduled pipeline |
| `run_pipeline` | Manually trigger a pipeline |
| `delete_pipeline` | Delete a pipeline |

**Persona & Feedback:**
| Tool | Description |
|------|-------------|
| `get_persona` | Get current AI assistant persona |
| `set_persona` | Set custom persona/system prompt |
| `reset_persona` | Reset to default persona |
| `get_feedback` | View user feedback history |
| `submit_feedback` | Submit feedback for a response |

### Setup for Claude Desktop

1. Install the MCP dependency:
   ```bash
   pip install mcp
   ```

2. Add to your Claude Desktop config (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "rag-assistant": {
         "command": "python",
         "args": ["/path/to/rag-support-assistant/backend/mcp_server.py"],
         "env": {
           "RAG_API_URL": "http://localhost:8000"
         }
       }
     }
   }
   ```

3. Make sure the RAG backend is running (`./start.sh`)

4. Restart Claude Desktop - you can now ask Claude to search your knowledge base!

### Example Usage in Claude

> "Search my knowledge base for information about Cilium network policies"

> "Ask my RAG assistant: How do I install Tetragon?"

> "Show me the analytics from my RAG system"

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Resources

- [Cilium Documentation](https://docs.cilium.io/)
- [Ollama](https://ollama.com/)
- [LangChain](https://python.langchain.com/)
- [ChromaDB](https://www.trychroma.com/)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Cisco Live 2026</strong><br>
  <em>From Docs to Expert: Scaling Support with Retrieval-Augmented Generation</em><br>
  <strong>Built by Dan Stacks</strong>
</p>
