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
