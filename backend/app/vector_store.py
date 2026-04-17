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
    
    CHROMA_MAX_BATCH = 5000

    @staticmethod
    def _sanitize_metadata(docs: List[Document]) -> List[Document]:
        """Ensure every metadata value is a type ChromaDB accepts."""
        for doc in docs:
            clean = {}
            for k, v in doc.metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    clean[k] = v
                elif isinstance(v, (list, tuple)):
                    clean[k] = [str(item) for item in v]
                elif v is None:
                    continue
                else:
                    clean[k] = str(v)
            doc.metadata = clean
        return docs

    def add_documents(self, documents: List[Document]) -> int:
        if not documents:
            return 0
        
        text_splitter = self.get_text_splitter()
        splits = self._sanitize_metadata(text_splitter.split_documents(documents))
        
        for i in range(0, len(splits), self.CHROMA_MAX_BATCH):
            batch = splits[i : i + self.CHROMA_MAX_BATCH]
            self.vector_store.add_documents(batch)
            if len(splits) > self.CHROMA_MAX_BATCH:
                print(f"  [VectorStore] Added batch {i // self.CHROMA_MAX_BATCH + 1}"
                      f" ({len(batch)} chunks, {i + len(batch)}/{len(splits)} total)")
        
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


# =============================================================================
# Hybrid Search Implementation
# =============================================================================

import re
from collections import Counter

def _tokenize(text: str) -> List[str]:
    """Simple tokenizer for BM25"""
    text = text.lower()
    tokens = re.findall(r'\b\w+\b', text)
    # Remove common stop words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'that', 'this', 'with', 'as', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'if', 'then', 'else', 'when', 'where', 'what', 'which', 'who', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'any', 'from', 'by', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'once'}
    return [t for t in tokens if t not in stop_words and len(t) > 2]


def _bm25_score(query_tokens: List[str], doc_tokens: List[str], avg_doc_len: float, k1: float = 1.5, b: float = 0.75) -> float:
    """Calculate BM25 score for a document"""
    doc_len = len(doc_tokens)
    doc_freq = Counter(doc_tokens)
    score = 0.0
    
    for token in query_tokens:
        if token in doc_freq:
            tf = doc_freq[token]
            # Simplified IDF (assuming token appears in at least one doc)
            idf = 1.0
            numerator = tf * (k1 + 1)
            denominator = tf + k1 * (1 - b + b * (doc_len / avg_doc_len))
            score += idf * (numerator / denominator)
    
    return score


def hybrid_search(query: str, k: int = 5, semantic_weight: float = 0.7) -> List[tuple]:
    """
    Perform hybrid search combining semantic similarity and keyword matching.
    
    Args:
        query: The search query
        k: Number of results to return
        semantic_weight: Weight for semantic search (0-1), keyword weight = 1 - semantic_weight
    
    Returns:
        List of (Document, combined_score, confidence) tuples
    """
    vector_store = get_vector_store()
    
    # Get more results than needed for reranking
    fetch_k = k * 3
    
    # Semantic search with scores
    semantic_results = vector_store.similarity_search_with_score(query, k=fetch_k)
    
    if not semantic_results:
        return []
    
    # Normalize semantic scores (lower distance = better, so invert)
    max_dist = max(r[1] for r in semantic_results) if semantic_results else 1
    min_dist = min(r[1] for r in semantic_results) if semantic_results else 0
    dist_range = max_dist - min_dist if max_dist != min_dist else 1
    
    # Build document map with normalized semantic scores
    doc_scores = {}
    for doc, distance in semantic_results:
        doc_id = doc.metadata.get('source', '') + doc.page_content[:100]
        # Convert distance to similarity (0-1, higher is better)
        semantic_score = 1 - ((distance - min_dist) / dist_range)
        doc_scores[doc_id] = {
            'doc': doc,
            'semantic_score': semantic_score,
            'keyword_score': 0.0
        }
    
    # Keyword search using BM25
    query_tokens = _tokenize(query)
    if query_tokens:
        all_doc_tokens = []
        for doc_id, data in doc_scores.items():
            tokens = _tokenize(data['doc'].page_content)
            all_doc_tokens.append(tokens)
            data['tokens'] = tokens
        
        avg_doc_len = sum(len(t) for t in all_doc_tokens) / len(all_doc_tokens) if all_doc_tokens else 1
        
        # Calculate BM25 scores
        bm25_scores = []
        for doc_id, data in doc_scores.items():
            score = _bm25_score(query_tokens, data.get('tokens', []), avg_doc_len)
            bm25_scores.append(score)
            data['keyword_score'] = score
        
        # Normalize BM25 scores
        max_bm25 = max(bm25_scores) if bm25_scores else 1
        if max_bm25 > 0:
            for data in doc_scores.values():
                data['keyword_score'] /= max_bm25
    
    # Combine scores
    keyword_weight = 1 - semantic_weight
    results = []
    for doc_id, data in doc_scores.items():
        combined_score = (data['semantic_score'] * semantic_weight + 
                         data['keyword_score'] * keyword_weight)
        # Confidence is based on how well both methods agree
        agreement = 1 - abs(data['semantic_score'] - data['keyword_score'])
        confidence = combined_score * (0.7 + 0.3 * agreement)  # Boost confidence when methods agree
        results.append((data['doc'], combined_score, confidence))
    
    # Sort by combined score and return top k
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:k]


def calculate_confidence(scores: List[float], docs_retrieved: int) -> float:
    """
    Calculate overall confidence score for a query response.
    
    Args:
        scores: List of relevance scores from retrieved documents
        docs_retrieved: Number of documents retrieved
    
    Returns:
        Confidence score from 0-100
    """
    if not scores or docs_retrieved == 0:
        return 0.0
    
    # Factors affecting confidence:
    # 1. Average relevance score
    avg_score = sum(scores) / len(scores)
    
    # 2. Score consistency (low variance = higher confidence)
    if len(scores) > 1:
        variance = sum((s - avg_score) ** 2 for s in scores) / len(scores)
        consistency = 1 / (1 + variance)
    else:
        consistency = 0.5
    
    # 3. Number of relevant docs (more = higher confidence, up to a point)
    coverage = min(docs_retrieved / 3, 1.0)  # Max confidence at 3+ docs
    
    # Combine factors
    confidence = (avg_score * 0.5 + consistency * 0.3 + coverage * 0.2) * 100
    
    return min(100, max(0, round(confidence, 1)))
