#!/usr/bin/env python3
"""
MCP (Model Context Protocol) Server for RAG Support Assistant

This server exposes the RAG assistant's capabilities as MCP tools that can be
used by AI assistants like Claude Desktop, Cursor, or other MCP-compatible clients.

Tools provided:
- search_knowledge_base: Search the documentation knowledge base
- ask_question: Ask a question and get an AI-generated answer with sources
- list_documents: List all indexed documents
- get_document: Get full content of a specific document
- ingest_url: Add a new URL to the knowledge base
- get_system_status: Get system health and statistics

To use with Claude Desktop, add to claude_desktop_config.json:
{
  "mcpServers": {
    "rag-assistant": {
      "command": "python",
      "args": ["path/to/mcp_server.py"],
      "env": {
        "RAG_API_URL": "http://localhost:8000"
      }
    }
  }
}
"""

import asyncio
import json
import os
import sys
from typing import Any, Sequence

import httpx

# MCP SDK imports
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import (
        Tool,
        TextContent,
        CallToolResult,
        ListToolsResult,
        Resource,
        ListResourcesResult,
        ReadResourceResult,
    )
except ImportError:
    print("MCP SDK not installed. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)

# Configuration
RAG_API_URL = os.environ.get("RAG_API_URL", "http://localhost:8000")

# Create MCP server
server = Server("rag-support-assistant")

# HTTP client for API calls
http_client = httpx.AsyncClient(timeout=60.0)


async def call_api(method: str, endpoint: str, data: dict = None, params: dict = None) -> dict:
    """Make an API call to the RAG backend"""
    url = f"{RAG_API_URL}{endpoint}"
    try:
        if method == "GET":
            response = await http_client.get(url, params=params)
        elif method == "POST":
            if data:
                # Use form data for POST requests
                response = await http_client.post(url, data=data)
            else:
                response = await http_client.post(url)
        elif method == "DELETE":
            response = await http_client.delete(url, params=params)
        elif method == "PUT":
            response = await http_client.put(url, data=data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}


@server.list_tools()
async def list_tools() -> ListToolsResult:
    """List all available MCP tools"""
    return ListToolsResult(tools=[
        Tool(
            name="search_knowledge_base",
            description="Search the RAG knowledge base using semantic/hybrid search. Returns relevant document chunks with relevance scores.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results to return (default: 5)",
                        "default": 5
                    },
                    "use_hybrid": {
                        "type": "boolean",
                        "description": "Use hybrid search (semantic + keyword) for better results (default: true)",
                        "default": True
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="ask_question",
            description="Ask a question about the documentation and get an AI-generated answer with source citations. The answer is grounded in the indexed knowledge base.",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The question to ask"
                    },
                    "include_sources": {
                        "type": "boolean",
                        "description": "Include source documents in the response (default: true)",
                        "default": True
                    }
                },
                "required": ["question"]
            }
        ),
        Tool(
            name="list_documents",
            description="List all documents indexed in the knowledge base with their chunk counts and types.",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of documents to return (default: 50)",
                        "default": 50
                    }
                }
            }
        ),
        Tool(
            name="get_document",
            description="Get the full content of a specific document by its source path/URL.",
            inputSchema={
                "type": "object",
                "properties": {
                    "source": {
                        "type": "string",
                        "description": "The source path or URL of the document"
                    }
                },
                "required": ["source"]
            }
        ),
        Tool(
            name="ingest_url",
            description="Add a new URL to the knowledge base. Can crawl recursively to index multiple pages.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to ingest"
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "Crawl links recursively (default: false)",
                        "default": False
                    },
                    "max_depth": {
                        "type": "integer",
                        "description": "Maximum crawl depth if recursive (default: 2)",
                        "default": 2
                    }
                },
                "required": ["url"]
            }
        ),
        Tool(
            name="get_system_status",
            description="Get the current system status including health, document count, and service status.",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="get_analytics",
            description="Get usage analytics including query statistics, feedback, and knowledge gap analysis.",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        # Export/Import Tools
        Tool(
            name="export_knowledge_base",
            description="Export the entire knowledge base (documents, embeddings, settings) as a downloadable backup.",
            inputSchema={
                "type": "object",
                "properties": {
                    "include_embeddings": {
                        "type": "boolean",
                        "description": "Include vector embeddings in export (larger file but faster restore)",
                        "default": True
                    }
                }
            }
        ),
        Tool(
            name="get_system_monitoring",
            description="Get detailed system monitoring data including CPU, memory, GPU usage, and service status.",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        # Pipeline Management Tools
        Tool(
            name="list_pipelines",
            description="List all configured data ingestion pipelines with their schedules and status.",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="create_pipeline",
            description="Create a new scheduled pipeline to automatically sync documentation from a URL.",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name for the pipeline"
                    },
                    "url": {
                        "type": "string",
                        "description": "URL to crawl"
                    },
                    "frequency": {
                        "type": "string",
                        "description": "How often to run: 'once', 'hourly', 'daily', 'weekly'",
                        "enum": ["once", "hourly", "daily", "weekly"],
                        "default": "daily"
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "Crawl links recursively",
                        "default": True
                    },
                    "max_depth": {
                        "type": "integer",
                        "description": "Maximum crawl depth",
                        "default": 2
                    }
                },
                "required": ["name", "url"]
            }
        ),
        Tool(
            name="run_pipeline",
            description="Manually trigger a pipeline to run immediately.",
            inputSchema={
                "type": "object",
                "properties": {
                    "pipeline_id": {
                        "type": "string",
                        "description": "ID of the pipeline to run"
                    }
                },
                "required": ["pipeline_id"]
            }
        ),
        Tool(
            name="delete_pipeline",
            description="Delete a scheduled pipeline.",
            inputSchema={
                "type": "object",
                "properties": {
                    "pipeline_id": {
                        "type": "string",
                        "description": "ID of the pipeline to delete"
                    }
                },
                "required": ["pipeline_id"]
            }
        ),
        # Persona Management Tools
        Tool(
            name="get_persona",
            description="Get the current AI assistant persona (system prompt and name).",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="set_persona",
            description="Set a custom persona for the AI assistant to change its behavior and tone.",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name for the persona"
                    },
                    "prompt": {
                        "type": "string",
                        "description": "System prompt that defines the assistant's behavior"
                    }
                },
                "required": ["name", "prompt"]
            }
        ),
        Tool(
            name="reset_persona",
            description="Reset the AI assistant persona to the default.",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        # Document Management Tools
        Tool(
            name="delete_document",
            description="Delete a specific document from the knowledge base by its source.",
            inputSchema={
                "type": "object",
                "properties": {
                    "source": {
                        "type": "string",
                        "description": "The source path or URL of the document to delete"
                    }
                },
                "required": ["source"]
            }
        ),
        Tool(
            name="clear_knowledge_base",
            description="Clear ALL documents from the knowledge base. Use with caution!",
            inputSchema={
                "type": "object",
                "properties": {
                    "confirm": {
                        "type": "boolean",
                        "description": "Must be true to confirm deletion"
                    }
                },
                "required": ["confirm"]
            }
        ),
        # Feedback Tools
        Tool(
            name="get_feedback",
            description="Get user feedback history for responses.",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of feedback entries to return",
                        "default": 50
                    }
                }
            }
        ),
        Tool(
            name="submit_feedback",
            description="Submit feedback for a response (useful for automated testing).",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The original query"
                    },
                    "response": {
                        "type": "string",
                        "description": "The response that was given"
                    },
                    "rating": {
                        "type": "integer",
                        "description": "Rating: 1 = not helpful, 2 = helpful",
                        "enum": [1, 2]
                    },
                    "comment": {
                        "type": "string",
                        "description": "Optional comment"
                    }
                },
                "required": ["query", "response", "rating"]
            }
        ),
        # Settings Tools
        Tool(
            name="get_settings",
            description="Get current application settings (model, chunk size, etc.).",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="update_settings",
            description="Update application settings.",
            inputSchema={
                "type": "object",
                "properties": {
                    "ollama_model": {
                        "type": "string",
                        "description": "Ollama model to use (e.g., 'mistral:7b-instruct', 'llama2:13b')"
                    },
                    "chunk_size": {
                        "type": "integer",
                        "description": "Document chunk size for splitting"
                    },
                    "chunk_overlap": {
                        "type": "integer",
                        "description": "Overlap between chunks"
                    },
                    "top_k_results": {
                        "type": "integer",
                        "description": "Number of documents to retrieve for context"
                    }
                }
            }
        )
    ])


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> CallToolResult:
    """Handle tool calls"""
    
    if name == "search_knowledge_base":
        query = arguments.get("query", "")
        num_results = arguments.get("num_results", 5)
        use_hybrid = arguments.get("use_hybrid", True)
        
        result = await call_api("POST", "/search/semantic", data={
            "query": query,
            "k": num_results,
            "use_hybrid": str(use_hybrid).lower()
        })
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        # Format results
        output = f"Found {result.get('total', 0)} results for: {query}\n"
        output += f"Search type: {result.get('search_type', 'unknown')}\n\n"
        
        for i, doc in enumerate(result.get("results", []), 1):
            output += f"--- Result {i} ---\n"
            output += f"Source: {doc.get('source', 'Unknown')}\n"
            output += f"Title: {doc.get('title', 'N/A')}\n"
            output += f"Relevance: {doc.get('relevance_score', 0)}%\n"
            output += f"Content:\n{doc.get('content', '')[:500]}...\n\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "ask_question":
        question = arguments.get("question", "")
        include_sources = arguments.get("include_sources", True)
        
        result = await call_api("POST", "/chat", data={
            "message": question,
            "include_sources": str(include_sources).lower()
        })
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        # Format response
        output = f"Question: {question}\n\n"
        output += f"Answer:\n{result.get('answer', 'No answer generated')}\n\n"
        
        metrics = result.get("metrics", {})
        if metrics:
            output += f"--- Metrics ---\n"
            output += f"Confidence: {metrics.get('confidence', 'N/A')}%\n"
            output += f"Response time: {metrics.get('total_time_ms', 0)}ms\n"
            output += f"Documents used: {metrics.get('documents_retrieved', 0)}\n"
        
        sources = result.get("sources", [])
        if sources and include_sources:
            output += f"\n--- Sources ({len(sources)}) ---\n"
            for i, src in enumerate(sources, 1):
                output += f"{i}. {src.get('source', 'Unknown')}\n"
        
        # Add suggested questions if available
        suggested = metrics.get("suggested_questions", [])
        if suggested:
            output += f"\n--- Suggested Follow-ups ---\n"
            for q in suggested:
                output += f"• {q}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "list_documents":
        limit = arguments.get("limit", 50)
        
        result = await call_api("GET", "/documents/list", params={"limit": limit})
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        docs = result.get("documents", [])
        output = f"Total sources: {result.get('total_sources', 0)}\n"
        output += f"Total chunks: {result.get('total_chunks', 0)}\n\n"
        
        for doc in docs:
            output += f"• {doc.get('source', 'Unknown')} ({doc.get('chunk_count', 0)} chunks, type: {doc.get('type', 'unknown')})\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "get_document":
        source = arguments.get("source", "")
        
        # URL encode the source path
        import urllib.parse
        encoded_source = urllib.parse.quote(source, safe="")
        
        result = await call_api("GET", f"/documents/preview/{encoded_source}")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = f"Document: {result.get('source', source)}\n"
        output += f"Chunks: {result.get('chunk_count', 0)}\n\n"
        
        for chunk in result.get("chunks", []):
            output += f"--- Chunk ---\n{chunk.get('content', '')}\n\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "ingest_url":
        url = arguments.get("url", "")
        recursive = arguments.get("recursive", False)
        max_depth = arguments.get("max_depth", 2)
        
        result = await call_api("POST", "/ingest/url", data={
            "url": url,
            "recursive": str(recursive).lower(),
            "max_depth": max_depth
        })
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = f"Ingestion started for: {url}\n"
        output += f"Job ID: {result.get('job_id', 'N/A')}\n"
        output += f"Status: {result.get('status', 'unknown')}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "get_system_status":
        result = await call_api("GET", "/health")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = "=== RAG Support Assistant Status ===\n\n"
        output += f"Status: {result.get('status', 'unknown')}\n"
        output += f"Ollama: {result.get('ollama_status', 'unknown')}\n"
        output += f"Vector Store: {result.get('vector_store_status', 'unknown')}\n"
        output += f"Documents indexed: {result.get('documents_count', 0)}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "get_analytics":
        result = await call_api("GET", "/analytics")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = "=== RAG Analytics ===\n\n"
        
        docs = result.get("documents", {})
        output += f"Documents: {docs.get('total_sources', 0)} sources, {docs.get('total_chunks', 0)} chunks\n"
        
        queries = result.get("queries", {})
        output += f"\nQueries:\n"
        output += f"  Total: {queries.get('total_queries', 0)}\n"
        output += f"  Last 24h: {queries.get('queries_last_24h', 0)}\n"
        output += f"  Avg response time: {queries.get('avg_response_time_ms', 0)}ms\n"
        output += f"  Avg confidence: {queries.get('avg_confidence', 0)}%\n"
        
        feedback = result.get("feedback", {})
        output += f"\nFeedback:\n"
        output += f"  Positive: {feedback.get('positive', 0)}\n"
        output += f"  Negative: {feedback.get('negative', 0)}\n"
        
        # Knowledge gaps
        low_conf = queries.get("low_confidence_queries", [])
        if low_conf:
            output += f"\nPotential Knowledge Gaps:\n"
            for q in low_conf[:5]:
                output += f"  • {q.get('query', '')} ({q.get('confidence', 0)}% confidence)\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    # Export/Import Tools
    elif name == "export_knowledge_base":
        include_embeddings = arguments.get("include_embeddings", True)
        
        result = await call_api("GET", "/export", params={"include_embeddings": str(include_embeddings).lower()})
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = "=== Knowledge Base Export ===\n\n"
        output += f"Documents: {result.get('document_count', 0)}\n"
        output += f"Pipelines: {result.get('pipeline_count', 0)}\n"
        output += f"Export includes embeddings: {include_embeddings}\n"
        output += f"\nNote: Full export data available via API at /export endpoint\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "get_system_monitoring":
        result = await call_api("GET", "/monitoring/status")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = "=== System Monitoring ===\n\n"
        
        system = result.get("system", {})
        output += f"Platform: {system.get('platform', 'unknown')}\n"
        output += f"Python: {system.get('python_version', 'unknown')}\n"
        output += f"CPU: {system.get('cpu_percent', 0)}%\n"
        
        memory = system.get("memory", {})
        output += f"Memory: {memory.get('used_gb', 0):.1f}GB / {memory.get('total_gb', 0):.1f}GB ({memory.get('percent', 0)}%)\n"
        
        disk = system.get("disk", {})
        output += f"Disk: {disk.get('used_gb', 0):.1f}GB / {disk.get('total_gb', 0):.1f}GB ({disk.get('percent', 0)}%)\n"
        
        gpu = result.get("gpu")
        if gpu:
            output += f"\nGPU: {gpu.get('name', 'unknown')}\n"
            output += f"  Memory: {gpu.get('memory_used_mb', 0)}MB / {gpu.get('memory_total_mb', 0)}MB\n"
            output += f"  Utilization: {gpu.get('utilization_percent', 0)}%\n"
        
        ollama = result.get("ollama", {})
        output += f"\nOllama: {ollama.get('status', 'unknown')}\n"
        output += f"  Model: {ollama.get('current_model', 'N/A')}\n"
        output += f"  Available models: {', '.join(ollama.get('available_models', []))}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    # Pipeline Management Tools
    elif name == "list_pipelines":
        result = await call_api("GET", "/pipelines")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        pipelines = result.get("pipelines", [])
        output = f"=== Pipelines ({len(pipelines)}) ===\n\n"
        
        if not pipelines:
            output += "No pipelines configured.\n"
        else:
            for p in pipelines:
                status = "✓ Enabled" if p.get("enabled") else "✗ Disabled"
                output += f"• {p.get('name', 'Unnamed')} [{status}]\n"
                output += f"  ID: {p.get('id', 'N/A')}\n"
                output += f"  URL: {p.get('url', 'N/A')}\n"
                output += f"  Frequency: {p.get('frequency', 'N/A')}\n"
                output += f"  Last run: {p.get('last_run', 'Never')}\n\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "create_pipeline":
        name_arg = arguments.get("name", "")
        url = arguments.get("url", "")
        frequency = arguments.get("frequency", "daily")
        recursive = arguments.get("recursive", True)
        max_depth = arguments.get("max_depth", 2)
        
        result = await call_api("POST", "/pipelines", data={
            "name": name_arg,
            "url": url,
            "frequency": frequency,
            "recursive": str(recursive).lower(),
            "max_depth": max_depth
        })
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = f"Pipeline created successfully!\n"
        output += f"ID: {result.get('id', 'N/A')}\n"
        output += f"Name: {name_arg}\n"
        output += f"URL: {url}\n"
        output += f"Frequency: {frequency}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "run_pipeline":
        pipeline_id = arguments.get("pipeline_id", "")
        
        result = await call_api("POST", f"/pipelines/{pipeline_id}/run")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = f"Pipeline triggered: {pipeline_id}\n"
        output += f"Status: {result.get('status', 'unknown')}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "delete_pipeline":
        pipeline_id = arguments.get("pipeline_id", "")
        
        result = await call_api("DELETE", f"/pipelines/{pipeline_id}")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = f"Pipeline deleted: {pipeline_id}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    # Persona Management Tools
    elif name == "get_persona":
        result = await call_api("GET", "/persona")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = "=== Current Persona ===\n\n"
        output += f"Name: {result.get('name', 'Default')}\n"
        output += f"Prompt:\n{result.get('prompt', 'N/A')}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "set_persona":
        name_arg = arguments.get("name", "Custom")
        prompt = arguments.get("prompt", "")
        
        result = await call_api("POST", "/persona", data={
            "name": name_arg,
            "prompt": prompt
        })
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = f"Persona updated!\n"
        output += f"Name: {name_arg}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "reset_persona":
        result = await call_api("POST", "/persona/reset")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = "Persona reset to default.\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    # Document Management Tools
    elif name == "delete_document":
        source = arguments.get("source", "")
        import urllib.parse
        encoded_source = urllib.parse.quote(source, safe="")
        
        result = await call_api("DELETE", f"/documents/{encoded_source}")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = f"Document deleted: {source}\n"
        output += f"Chunks removed: {result.get('chunks_deleted', 0)}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "clear_knowledge_base":
        confirm = arguments.get("confirm", False)
        
        if not confirm:
            return CallToolResult(content=[TextContent(type="text", text="Error: Must set confirm=true to clear the knowledge base")])
        
        result = await call_api("POST", "/documents/clear")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = "Knowledge base cleared!\n"
        output += f"Documents removed: {result.get('documents_deleted', 0)}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    # Feedback Tools
    elif name == "get_feedback":
        limit = arguments.get("limit", 50)
        
        result = await call_api("GET", "/feedback", params={"limit": limit})
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        feedback_list = result.get("feedback", [])
        output = f"=== Feedback ({result.get('total', 0)} total) ===\n\n"
        output += f"Positive: {result.get('positive', 0)} | Negative: {result.get('negative', 0)}\n\n"
        
        for f in feedback_list[-10:]:  # Show last 10
            rating = "👍" if f.get("rating") == 2 else "👎"
            output += f"{rating} Query: {f.get('query', 'N/A')[:50]}...\n"
            if f.get("comment"):
                output += f"   Comment: {f.get('comment')}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "submit_feedback":
        query = arguments.get("query", "")
        response = arguments.get("response", "")
        rating = arguments.get("rating", 2)
        comment = arguments.get("comment", "")
        
        result = await call_api("POST", "/feedback", data={
            "query": query,
            "response": response,
            "rating": rating,
            "comment": comment
        })
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = f"Feedback submitted: {'👍 Helpful' if rating == 2 else '👎 Not helpful'}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    # Settings Tools
    elif name == "get_settings":
        result = await call_api("GET", "/settings")
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = "=== Current Settings ===\n\n"
        output += f"Ollama Model: {result.get('ollama_model', 'N/A')}\n"
        output += f"Embedding Model: {result.get('embedding_model', 'N/A')}\n"
        output += f"Chunk Size: {result.get('chunk_size', 'N/A')}\n"
        output += f"Chunk Overlap: {result.get('chunk_overlap', 'N/A')}\n"
        output += f"Top K Results: {result.get('top_k_results', 'N/A')}\n"
        output += f"Hybrid Search: {result.get('enable_hybrid_search', 'N/A')}\n"
        output += f"Conversation Memory: {result.get('enable_conversation_memory', 'N/A')}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    elif name == "update_settings":
        # Build settings dict from provided arguments
        settings = {}
        if "ollama_model" in arguments:
            settings["ollama_model"] = arguments["ollama_model"]
        if "chunk_size" in arguments:
            settings["chunk_size"] = arguments["chunk_size"]
        if "chunk_overlap" in arguments:
            settings["chunk_overlap"] = arguments["chunk_overlap"]
        if "top_k_results" in arguments:
            settings["top_k_results"] = arguments["top_k_results"]
        
        if not settings:
            return CallToolResult(content=[TextContent(type="text", text="No settings provided to update")])
        
        result = await call_api("POST", "/settings", data=settings)
        
        if "error" in result:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        output = "Settings updated!\n"
        for key, value in settings.items():
            output += f"  {key}: {value}\n"
        
        return CallToolResult(content=[TextContent(type="text", text=output)])
    
    else:
        return CallToolResult(content=[TextContent(type="text", text=f"Unknown tool: {name}")])


@server.list_resources()
async def list_resources() -> ListResourcesResult:
    """List available resources (documents in the knowledge base)"""
    result = await call_api("GET", "/documents/list", params={"limit": 100})
    
    if "error" in result:
        return ListResourcesResult(resources=[])
    
    resources = []
    for doc in result.get("documents", []):
        source = doc.get("source", "")
        resources.append(Resource(
            uri=f"rag://document/{source}",
            name=doc.get("title", source),
            description=f"{doc.get('type', 'unknown')} document with {doc.get('chunk_count', 0)} chunks",
            mimeType="text/plain"
        ))
    
    return ListResourcesResult(resources=resources)


@server.read_resource()
async def read_resource(uri: str) -> ReadResourceResult:
    """Read a specific resource"""
    if uri.startswith("rag://document/"):
        source = uri.replace("rag://document/", "")
        import urllib.parse
        encoded_source = urllib.parse.quote(source, safe="")
        
        result = await call_api("GET", f"/documents/preview/{encoded_source}")
        
        if "error" in result:
            return ReadResourceResult(contents=[TextContent(type="text", text=f"Error: {result['error']}")])
        
        content = ""
        for chunk in result.get("chunks", []):
            content += chunk.get("content", "") + "\n\n"
        
        return ReadResourceResult(contents=[TextContent(type="text", text=content)])
    
    return ReadResourceResult(contents=[TextContent(type="text", text=f"Unknown resource: {uri}")])


async def main():
    """Run the MCP server"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
