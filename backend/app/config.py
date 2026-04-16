from pydantic_settings import BaseSettings
from functools import lru_cache
import os
import json
from typing import Optional


def _default_collection_name() -> str:
    """Read collection name from domain.yaml when available, fall back to env."""
    try:
        from app.domain_config import load_domain_config
        dc = load_domain_config()
        if dc.collection_name:
            return dc.collection_name
    except Exception:
        pass
    return "rag_docs"


class Settings(BaseSettings):
    # Ollama settings
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral:7b-instruct"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_context_window: int = 8192  # Max context tokens (8K)
    
    # ChromaDB settings
    chroma_persist_directory: str = "./data/chroma_db"
    chroma_collection_name: str = _default_collection_name()
    
    # Embedding settings
    embedding_model: str = "all-MiniLM-L6-v2"
    
    # RAG settings
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k_results: int = 5
    
    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Documentation sources
    docs_directory: str = "./data/docs"
    
    # Authentication (optional - if set, API requires this key)
    api_key: Optional[str] = None
    
    # Feature flags
    enable_hybrid_search: bool = True
    enable_conversation_memory: bool = True
    conversation_memory_limit: int = 5  # Number of previous turns to include
    
    # MCP (Model Context Protocol) settings
    mcp_enabled: bool = False  # Disabled by default, user can enable in UI
    mcp_server_port: int = 3001  # Port for MCP server if running standalone
    mcp_auto_start: bool = False  # Auto-start MCP server with backend
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Runtime settings that can be changed without restart
_runtime_settings_file = "./data/runtime_settings.json"
_runtime_settings = {}

def _load_runtime_settings():
    """Load runtime settings from file"""
    global _runtime_settings
    try:
        if os.path.exists(_runtime_settings_file):
            with open(_runtime_settings_file, 'r') as f:
                _runtime_settings = json.load(f)
    except Exception as e:
        print(f"Failed to load runtime settings: {e}")
        _runtime_settings = {}

def _save_runtime_settings():
    """Save runtime settings to file"""
    try:
        os.makedirs(os.path.dirname(_runtime_settings_file), exist_ok=True)
        with open(_runtime_settings_file, 'w') as f:
            json.dump(_runtime_settings, f, indent=2)
    except Exception as e:
        print(f"Failed to save runtime settings: {e}")

def get_runtime_setting(key: str, default=None):
    """Get a runtime setting"""
    if not _runtime_settings:
        _load_runtime_settings()
    return _runtime_settings.get(key, default)

def set_runtime_setting(key: str, value):
    """Set a runtime setting and persist"""
    _runtime_settings[key] = value
    _save_runtime_settings()

# Load runtime settings on module import
_load_runtime_settings()


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache():
    """Clear the settings cache to reload from env"""
    get_settings.cache_clear()
