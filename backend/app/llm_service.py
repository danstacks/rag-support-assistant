import ollama
from typing import List, Optional, Generator
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate

from app.config import get_settings
from app.vector_store import get_vector_store


SYSTEM_PROMPT = """You are an expert support assistant for Isovalent and Cilium technologies. 
You help users with questions about:
- Cilium (eBPF-based networking, security, and observability)
- Hubble (network observability)
- Tetragon (security observability and runtime enforcement)
- Isovalent Enterprise features
- Kubernetes networking and security

Guidelines:
1. Provide accurate, helpful answers based on the provided context
2. If the context doesn't contain enough information, say so clearly
3. Include relevant code examples, commands, or configuration snippets when helpful
4. Reference specific documentation sections when applicable
5. Be concise but thorough

Context from documentation:
{context}

Remember: Only answer based on the provided context. If you're unsure, say so."""

QUERY_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""Based on the following context from Isovalent/Cilium documentation, answer the user's question.

Context:
{context}

Question: {question}

Answer:"""
)


class LLMService:
    def __init__(self):
        self.settings = get_settings()
        self.vector_store = get_vector_store()
        self._verify_ollama_connection()
    
    def _verify_ollama_connection(self) -> bool:
        try:
            ollama.list()
            return True
        except Exception as e:
            print(f"Warning: Could not connect to Ollama: {e}")
            return False
    
    def _format_context(self, documents: List[Document]) -> str:
        context_parts = []
        for i, doc in enumerate(documents, 1):
            source = doc.metadata.get('source', 'Unknown')
            title = doc.metadata.get('title', '')
            context_parts.append(f"[Source {i}: {title or source}]\n{doc.page_content}\n")
        return "\n---\n".join(context_parts)
    
    def _get_relevant_documents(self, query: str) -> List[Document]:
        return self.vector_store.similarity_search(query)
    
    def generate_response(
        self,
        query: str,
        include_sources: bool = True
    ) -> tuple[str, List[dict]]:
        documents = self._get_relevant_documents(query)
        context = self._format_context(documents)
        
        prompt = QUERY_PROMPT.format(context=context, question=query)
        
        response = ollama.chat(
            model=self.settings.ollama_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT.format(context="")},
                {"role": "user", "content": prompt}
            ]
        )
        
        answer = response['message']['content']
        
        sources = []
        if include_sources:
            for doc in documents:
                sources.append({
                    'content': doc.page_content[:500] + "..." if len(doc.page_content) > 500 else doc.page_content,
                    'source': doc.metadata.get('source', 'Unknown'),
                    'title': doc.metadata.get('title', '')
                })
        
        return answer, sources
    
    def generate_response_stream(
        self,
        query: str
    ) -> Generator[str, None, None]:
        documents = self._get_relevant_documents(query)
        context = self._format_context(documents)
        
        prompt = QUERY_PROMPT.format(context=context, question=query)
        
        stream = ollama.chat(
            model=self.settings.ollama_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT.format(context="")},
                {"role": "user", "content": prompt}
            ],
            stream=True
        )
        
        for chunk in stream:
            if 'message' in chunk and 'content' in chunk['message']:
                yield chunk['message']['content']
    
    def check_ollama_status(self) -> dict:
        try:
            models = ollama.list()
            model_names = [m['name'] for m in models.get('models', [])]
            return {
                'status': 'connected',
                'models': model_names,
                'configured_model': self.settings.ollama_model
            }
        except Exception as e:
            return {
                'status': 'disconnected',
                'error': str(e)
            }
    
    def pull_model(self, model_name: Optional[str] = None) -> dict:
        model = model_name or self.settings.ollama_model
        try:
            ollama.pull(model)
            return {'status': 'success', 'model': model}
        except Exception as e:
            return {'status': 'error', 'error': str(e)}


def get_llm_service() -> LLMService:
    return LLMService()
