# Sample Data for Demo

This folder contains sample documentation files you can use to quickly test the RAG assistant.

## Quick Load

### Option 1: Via UI
1. Click "Add Data" in the app header
2. Go to "Upload Files" tab
3. Drag and drop these files or browse to select them

### Option 2: Via API
```bash
curl -X POST "http://localhost:8000/ingest/directory?directory=./sample-data"
```

## Included Files

| File | Description |
|------|-------------|
| `cilium-quickstart.md` | Cilium installation and basic usage |
| `hubble-observability.md` | Network observability with Hubble |
| `tetragon-security.md` | Security monitoring with Tetragon |

## Adding Your Own Data

You can add any documentation in these formats:
- `.md` - Markdown files
- `.txt` - Plain text files
- `.html` - HTML files
- `.rst` - reStructuredText files

## Example Questions After Loading

Once you've loaded the sample data, try asking:

1. "How do I install Cilium?"
2. "What is Hubble and how do I use it?"
3. "How can I detect container escape attempts with Tetragon?"
4. "What are the common troubleshooting steps for Cilium?"
5. "How do I monitor network flows?"
