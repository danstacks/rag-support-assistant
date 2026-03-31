import os
import warnings
import logging
from typing import List, Optional

# Suppress noisy warnings and progress bars before importing transformers
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["HF_HUB_VERBOSITY"] = "error"
os.environ["SAFETENSORS_FAST_GPU"] = "1"
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning)
logging.getLogger("sentence_transformers").setLevel(logging.ERROR)
logging.getLogger("transformers").setLevel(logging.ERROR)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

from app.config import get_settings


class VectorStoreManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self.settings = get_settings()
        self._setup_directories()
        self._setup_embeddings()
        self._setup_vector_store()
        self._initialized = True
    
    def _setup_directories(self):
        os.makedirs(self.settings.chroma_persist_directory, exist_ok=True)
        os.makedirs(self.settings.docs_directory, exist_ok=True)
    
    def _setup_embeddings(self):
        try:
            # Try GPU first
            self.embeddings = HuggingFaceEmbeddings(
                model_name=self.settings.embedding_model,
                model_kwargs={'device': 'cuda'},
                encode_kwargs={'normalize_embeddings': True}
            )
        except Exception:
            # Fall back to CPU if GPU not available
            self.embeddings = HuggingFaceEmbeddings(
                model_name=self.settings.embedding_model,
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
    
    def _setup_vector_store(self):
        self.chroma_client = chromadb.PersistentClient(
            path=self.settings.chroma_persist_directory,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        
        self.vector_store = Chroma(
            client=self.chroma_client,
            collection_name=self.settings.chroma_collection_name,
            embedding_function=self.embeddings,
            persist_directory=self.settings.chroma_persist_directory
        )
    
    def get_text_splitter(self) -> RecursiveCharacterTextSplitter:
        return RecursiveCharacterTextSplitter(
            chunk_size=self.settings.chunk_size,
            chunk_overlap=self.settings.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
        )
    
    def add_documents(self, documents: List[Document]) -> int:
        if not documents:
            return 0
        
        text_splitter = self.get_text_splitter()
        splits = text_splitter.split_documents(documents)
        
        if splits:
            self.vector_store.add_documents(splits)
        
        return len(splits)
    
    def add_texts(self, texts: List[str], metadatas: Optional[List[dict]] = None) -> int:
        if not texts:
            return 0
        
        text_splitter = self.get_text_splitter()
        
        documents = []
        for i, text in enumerate(texts):
            metadata = metadatas[i] if metadatas and i < len(metadatas) else {}
            documents.append(Document(page_content=text, metadata=metadata))
        
        return self.add_documents(documents)
    
    def similarity_search(self, query: str, k: Optional[int] = None) -> List[Document]:
        k = k or self.settings.top_k_results
        return self.vector_store.similarity_search(query, k=k)
    
    def similarity_search_with_score(self, query: str, k: Optional[int] = None) -> List[tuple]:
        k = k or self.settings.top_k_results
        return self.vector_store.similarity_search_with_score(query, k=k)
    
    def get_retriever(self, k: Optional[int] = None):
        k = k or self.settings.top_k_results
        return self.vector_store.as_retriever(search_kwargs={"k": k})
    
    def get_document_count(self) -> int:
        try:
            collection = self.chroma_client.get_collection(self.settings.chroma_collection_name)
            return collection.count()
        except Exception:
            return 0
    
    def clear_collection(self):
        try:
            self.chroma_client.delete_collection(self.settings.chroma_collection_name)
            self._setup_vector_store()
        except Exception:
            pass
    
    def list_documents(self, limit: int = 100) -> List[dict]:
        """List unique document sources with metadata"""
        try:
            collection = self.chroma_client.get_collection(self.settings.chroma_collection_name)
            results = collection.get(include=["metadatas"])
            
            # Group by source
            sources = {}
            for i, metadata in enumerate(results.get("metadatas", [])):
                source = metadata.get("source", "unknown")
                if source not in sources:
                    sources[source] = {
                        "source": source,
                        "title": metadata.get("title", source),
                        "type": metadata.get("type", "unknown"),
                        "chunk_count": 0,
                        "ids": []
                    }
                sources[source]["chunk_count"] += 1
                sources[source]["ids"].append(results["ids"][i])
            
            # Sort by chunk count descending
            sorted_sources = sorted(sources.values(), key=lambda x: x["chunk_count"], reverse=True)
            return sorted_sources[:limit]
        except Exception as e:
            print(f"Error listing documents: {e}")
            return []
    
    def delete_by_source(self, source: str) -> int:
        """Delete all chunks from a specific source"""
        try:
            collection = self.chroma_client.get_collection(self.settings.chroma_collection_name)
            results = collection.get(include=["metadatas"])
            
            ids_to_delete = []
            for i, metadata in enumerate(results.get("metadatas", [])):
                if metadata.get("source") == source:
                    ids_to_delete.append(results["ids"][i])
            
            if ids_to_delete:
                collection.delete(ids=ids_to_delete)
            
            return len(ids_to_delete)
        except Exception as e:
            print(f"Error deleting documents: {e}")
            return 0


def get_vector_store() -> VectorStoreManager:
    return VectorStoreManager()
