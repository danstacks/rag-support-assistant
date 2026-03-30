from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the message sender: 'user' or 'assistant'")
    content: str = Field(..., description="Content of the message")
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    message: str = Field(..., description="User's question or message")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID for context")
    include_sources: bool = Field(True, description="Whether to include source documents in response")


class SourceDocument(BaseModel):
    content: str = Field(..., description="Content snippet from the source")
    source: str = Field(..., description="Source file or URL")
    score: Optional[float] = Field(None, description="Relevance score")


class PerformanceMetrics(BaseModel):
    total_time_ms: int = Field(..., description="Total response time in milliseconds")
    retrieval_time_ms: int = Field(..., description="Time spent retrieving documents")
    generation_time_ms: int = Field(..., description="Time spent generating response")
    documents_retrieved: int = Field(..., description="Number of documents retrieved")
    prompt_tokens: int = Field(0, description="Number of prompt tokens")
    completion_tokens: int = Field(0, description="Number of completion tokens")
    total_tokens: int = Field(0, description="Total tokens used")
    model: str = Field(..., description="Model used for generation")
    persona: str = Field(..., description="Persona used for response")


class ChatResponse(BaseModel):
    answer: str = Field(..., description="Assistant's response")
    sources: List[SourceDocument] = Field(default_factory=list, description="Source documents used")
    conversation_id: str = Field(..., description="Conversation ID for follow-up")
    metrics: Optional[PerformanceMetrics] = Field(None, description="Performance metrics for the response")


class DocumentUpload(BaseModel):
    content: str = Field(..., description="Document content")
    source: str = Field(..., description="Source identifier (filename or URL)")
    doc_type: str = Field("markdown", description="Document type: markdown, html, text")


class IngestRequest(BaseModel):
    url: Optional[str] = Field(None, description="URL to scrape and ingest")
    urls: Optional[List[str]] = Field(None, description="Multiple URLs to scrape")
    recursive: bool = Field(False, description="Whether to follow links recursively")
    max_depth: int = Field(2, description="Maximum depth for recursive scraping")


class IngestResponse(BaseModel):
    status: str
    documents_processed: int
    message: str


class HealthResponse(BaseModel):
    status: str
    ollama_status: str
    vector_store_status: str
    documents_count: int
