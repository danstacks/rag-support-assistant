# Demo Guide: From Docs to Expert

## Cisco Live 2026 Session Guide

**Session:** From Docs to Expert: Scaling Support with Retrieval-Augmented Generation

**Abstract:** *The rapid pace of technology adoption and the sheer volume of proprietary documentation create a significant hurdle for support teams, leading to fragmented operational knowledge and delays in critical troubleshooting. This challenge demands an automation strategy to consolidate and weaponize internal data. This session details a proven methodology for transforming your L1 and L2 technical support by engineering a custom LLM agent built on RAG principles, using only your organization's documentation, and deploying it on a UCS server.*

---

## Session Narrative

**The Story:** When Cisco acquired Isovalent, our support teams faced a challenge: hundreds of pages of documentation across Cilium, Hubble, Tetragon, and enterprise features. L1/L2 engineers needed to become experts overnight.

**The Solution:** We built a RAG-based support agent that turns documentation into an intelligent assistant. Today, you'll see how it works - and you'll leave with everything you need to build your own.

---

## Pre-Demo Checklist

### 1. Hardware Verification
```bash
# Verify GPU is available
nvidia-smi

# Expected: NVIDIA L40S with driver loaded
```

### 2. Services Running
```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Check Backend
curl http://localhost:8000/health

# Check Frontend
# Open http://localhost:3000
```

### 3. Pre-load Documentation
```bash
# Ingest sample docs before the demo
curl -X POST "http://localhost:8000/ingest/directory?directory=./sample-data"

# Verify document count
curl http://localhost:8000/documents/count
```

---

## Demo Script

### Opening (3 minutes)

**Set the Scene:**
> "How many of you have been through an acquisition? A major product launch? A platform migration?"
> 
> "Every time, support teams face the same challenge: hundreds of pages of new documentation, and customers calling on day one expecting expert answers."
>
> "When Cisco acquired Isovalent, we had Cilium, Hubble, Tetragon - technologies our L1/L2 engineers had never seen. We needed a way to turn documentation into expertise, fast."

**The Problem Statement (show slide or quote):**
> "The rapid pace of technology adoption and the sheer volume of proprietary documentation create a significant hurdle for support teams, leading to fragmented operational knowledge and delays in critical troubleshooting."

**The Promise:**
> "Today I'm going to show you how we solved this - and more importantly, you're going to leave with everything you need to build your own."

**Visual:** Show the Cilium docs homepage, scroll through to show volume

---

### Architecture Overview (3 minutes)

**Show the diagram:**
```
User Question → Embedding → Vector Search → Context + LLM → Answer
```

**Key Points:**
1. **Document Ingestion**: Docs are chunked and converted to embeddings
2. **Vector Store**: ChromaDB stores embeddings for fast similarity search
3. **Retrieval**: Find the most relevant chunks for each question
4. **Generation**: LLM generates answer using retrieved context
5. **Privacy**: Everything runs locally on your GPU

---

### Live Demo (10 minutes)

#### Part 1: The Interface

1. Open http://localhost:3000
2. Point out:
   - Clean chat interface
   - Status indicators (Ollama connected, doc count)
   - Settings panel

#### Part 2: Ask Questions

**Start simple:**
> "How do I install Cilium?"

- Show the response
- Expand sources to show citations
- Click a source link

**Get more complex:**
> "What's the difference between CiliumNetworkPolicy and Kubernetes NetworkPolicy?"

- Highlight how it synthesizes from multiple sources

**Troubleshooting scenario:**
> "My pods can't communicate after installing Cilium. How do I debug this?"

- Show step-by-step guidance
- Point out specific commands suggested

**Deep technical:**
> "Explain how Cilium uses eBPF for packet processing"

- Show it handles complex technical concepts

#### Part 3: Test RAG Quality (Important!)

**Show a question that SHOULD fail gracefully:**

> "Is it possible with Tetragon to block pluggable peripherals access to the end device? I am thinking as an alternative to endpoint protection software. Could you use eBPF to filter/block/observe peripherals being connected to a device and what said peripheral attempts to do?"

**Why this matters:**
- This question uses Isovalent terminology (Tetragon, eBPF) but asks about an **unsupported use case**
- Tetragon is for cloud-native/container security, NOT endpoint device management
- A good RAG system should admit it doesn't have this information
- A bad system would hallucinate capabilities

**Talking points:**
- "A trustworthy AI admits what it doesn't know"
- "Notice it doesn't invent USB-blocking features"
- "This is why we show sources - you can verify the grounding"

See [TEST_QUESTIONS.md](TEST_QUESTIONS.md) for more test cases.

#### Part 4: Under the Hood

**Show the API:**
```bash
# Document count
curl http://localhost:8000/documents/count

# Health check
curl http://localhost:8000/health
```

**Show GPU usage:**
```bash
nvidia-smi
# Point out Ollama using GPU memory
```

---

### Call to Action: Build Your Own (5 minutes)

**This is the key moment - transition from "demo" to "template":**

> "Everything you've seen today is open source and available right now. Let me show you how easy it is to make this YOUR support agent."

**Live Demo: Add New Data**
1. Click "Add Data" button
2. Show the three options:
   - **Crawl Website**: "Point it at your docs site"
   - **Upload Files**: "Drag in your runbooks"
   - **Paste Text**: "Quick additions from anywhere"

**Show the Customization Points:**
```python
# backend/app/llm_service.py
SYSTEM_PROMPT = """You are a support assistant for [YOUR COMPANY]..."""
```

**The Takeaway:**
> "You don't need a data science team. You don't need to fine-tune models. You need a UCS server with a GPU, your documentation, and about an hour of setup time."
>
> "The GitHub repo has everything: setup scripts, sample data, test questions, and documentation. Scan the QR code, clone the repo, and you can have this running for YOUR team by next week."

---

### Q&A Prep

**Common Questions:**

**Q: How accurate is it?**
A: It's grounded in your actual docs. The sources panel shows exactly where answers come from. It won't hallucinate facts not in your docs.

**Q: How much does it cost?**
A: Zero ongoing cost - runs on your own hardware. Initial investment is the GPU server.

**Q: Can it handle updates?**
A: Yes! Re-run ingestion when docs change. Can be automated via CI/CD.

**Q: What about sensitive docs?**
A: Perfect use case - data never leaves your infrastructure.

**Q: How does it compare to fine-tuning?**
A: RAG is faster to set up, easier to update, and more transparent. Fine-tuning is better for style/tone changes.

---

## Troubleshooting During Demo

### Ollama Not Responding
```bash
sudo systemctl restart ollama
# Wait 10 seconds
curl http://localhost:11434/api/tags
```

### Slow Responses
- First response is always slower (model loading)
- Subsequent responses should be 2-5 seconds

### No Sources Showing
- Check document count: `curl http://localhost:8000/documents/count`
- If 0, re-run ingestion

### Frontend Not Loading
```bash
cd frontend
npm run dev
# Check for port conflicts
```

---

## Post-Demo

### Share the Repo
- GitHub link in slides
- QR code for easy access

### Resources to Mention
- Ollama: https://ollama.com
- Cilium: https://cilium.io
- LangChain: https://langchain.com

---

## Backup Plan

If live demo fails:
1. Have screenshots/video ready
2. Show code walkthrough instead
3. Use pre-recorded demo video

**Pre-record a backup video before the session!**
