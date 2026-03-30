# Contributing to Docs to Expert RAG

Thank you for your interest in contributing! This project was created for Cisco Live 2026 to demonstrate RAG-based support assistants.

## How to Contribute

### Reporting Issues

- Use GitHub Issues to report bugs or suggest features
- Include steps to reproduce for bugs
- Provide system information (OS, GPU, Python version)

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/danstacks/docs-to-expert-rag.git
cd docs-to-expert-rag

# Backend development
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend development
cd ../frontend
npm install
npm run dev
```

### Code Style

- **Python**: Follow PEP 8, use type hints
- **JavaScript/React**: Use functional components, hooks
- **Commits**: Use conventional commits (feat:, fix:, docs:, etc.)

### Areas for Contribution

- **Documentation sources**: Add loaders for more doc formats
- **UI improvements**: Enhance the chat interface
- **Performance**: Optimize embedding and retrieval
- **Testing**: Add unit and integration tests
- **MCP integration**: Help build Model Context Protocol support

## Questions?

Open an issue or reach out during the Cisco Live session!
