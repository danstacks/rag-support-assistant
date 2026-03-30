from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # Ollama settings
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral:7b-instruct"
    ollama_embedding_model: str = "nomic-embed-text"
    
    # ChromaDB settings
    chroma_persist_directory: str = "./data/chroma_db"
    chroma_collection_name: str = "isovalent_docs"
    
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
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
