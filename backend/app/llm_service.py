import ollama
import time
import json
import os
from typing import List, Optional, Generator, Dict, Any
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate

from app.config import get_settings
from app.vector_store import get_vector_store


DEFAULT_PERSONA = """You are a technical expert assistant for Isovalent and Cilium technologies.

Your expertise includes:
- Cilium (eBPF-based networking, security, and observability)
- Hubble (network observability)  
- Tetragon (security observability and runtime enforcement)
- Isovalent Enterprise features
- Kubernetes networking and security

GUIDELINES:
1. You ONLY know what is provided in the context below - do not make up information
2. If the context doesn't contain enough information to answer, clearly state that you don't have enough information in your knowledge base to answer accurately
3. Include relevant code examples, commands, or configuration snippets when available in the context
4. Be precise and technical - your users are engineers
5. Do NOT include inline citations in your response - sources are shown separately

Context from documentation:
{context}

Remember: Only answer based on the provided context. If unsure, say so."""


# Persona storage file
PERSONA_FILE = "data/persona.json"

QUERY_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""Based on the following context from Isovalent/Cilium documentation, answer the user's question.

Context:
{context}

Question: {question}

Answer:"""
)


class PersonaManager:
    """Manages the assistant's persona/system prompt configuration"""
    
    def __init__(self, persona_file: str = PERSONA_FILE):
        self.persona_file = persona_file
        self._ensure_file_exists()
    
    def _ensure_file_exists(self):
        os.makedirs(os.path.dirname(self.persona_file), exist_ok=True)
        if not os.path.exists(self.persona_file):
            self.save_persona(DEFAULT_PERSONA, "Isovalent Technical Expert")
    
    def get_persona(self) -> Dict[str, str]:
        try:
            with open(self.persona_file, 'r') as f:
                return json.load(f)
        except:
            return {"name": "Isovalent Technical Expert", "prompt": DEFAULT_PERSONA}
    
    def save_persona(self, prompt: str, name: str = "Custom Assistant") -> Dict[str, str]:
        data = {"name": name, "prompt": prompt}
        with open(self.persona_file, 'w') as f:
            json.dump(data, f, indent=2)
        return data
    
    def reset_to_default(self) -> Dict[str, str]:
        return self.save_persona(DEFAULT_PERSONA, "Isovalent Technical Expert")


class LLMService:
    def __init__(self):
        self.settings = get_settings()
        self.vector_store = get_vector_store()
        self.persona_manager = PersonaManager()
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
    
    def get_persona(self) -> Dict[str, str]:
        return self.persona_manager.get_persona()
    
    def set_persona(self, prompt: str, name: str = "Custom Assistant") -> Dict[str, str]:
        return self.persona_manager.save_persona(prompt, name)
    
    def reset_persona(self) -> Dict[str, str]:
        return self.persona_manager.reset_to_default()
    
    def generate_response(
        self,
        query: str,
        include_sources: bool = True
    ) -> tuple[str, List[dict], Dict[str, Any]]:
        """Generate response with performance metrics"""
        start_time = time.time()
        
        # Retrieval phase
        retrieval_start = time.time()
        documents = self._get_relevant_documents(query)
        retrieval_time = time.time() - retrieval_start
        
        context = self._format_context(documents)
        prompt = QUERY_PROMPT.format(context=context, question=query)
        
        # Get current persona
        persona = self.persona_manager.get_persona()
        system_prompt = persona.get("prompt", DEFAULT_PERSONA)
        
        # Generation phase
        generation_start = time.time()
        response = ollama.chat(
            model=self.settings.ollama_model,
            messages=[
                {"role": "system", "content": system_prompt.format(context="")},
                {"role": "user", "content": prompt}
            ]
        )
        generation_time = time.time() - generation_start
        
        answer = response['message']['content']
        total_time = time.time() - start_time
        
        # Extract token counts from response if available
        eval_count = response.get('eval_count', 0)
        prompt_eval_count = response.get('prompt_eval_count', 0)
        
        # Performance metrics
        metrics = {
            "total_time_ms": round(total_time * 1000),
            "retrieval_time_ms": round(retrieval_time * 1000),
            "generation_time_ms": round(generation_time * 1000),
            "documents_retrieved": len(documents),
            "prompt_tokens": prompt_eval_count,
            "completion_tokens": eval_count,
            "total_tokens": prompt_eval_count + eval_count,
            "model": self.settings.ollama_model,
            "persona": persona.get("name", "Default")
        }
        
        sources = []
        if include_sources:
            for doc in documents:
                sources.append({
                    'content': doc.page_content[:500] + "..." if len(doc.page_content) > 500 else doc.page_content,
                    'source': doc.metadata.get('source', 'Unknown'),
                    'title': doc.metadata.get('title', '')
                })
        
        return answer, sources, metrics
    
    def generate_response_stream(
        self,
        query: str
    ) -> Generator[str, None, None]:
        documents = self._get_relevant_documents(query)
        context = self._format_context(documents)
        
        prompt = QUERY_PROMPT.format(context=context, question=query)
        
        # Get current persona
        persona = self.persona_manager.get_persona()
        system_prompt = persona.get("prompt", DEFAULT_PERSONA)
        
        stream = ollama.chat(
            model=self.settings.ollama_model,
            messages=[
                {"role": "system", "content": system_prompt.format(context="")},
                {"role": "user", "content": prompt}
            ],
            stream=True
        )
        
        for chunk in stream:
            if 'message' in chunk and 'content' in chunk['message']:
                yield chunk['message']['content']
    
    def check_ollama_status(self) -> dict:
        try:
            import httpx
            # Direct HTTP check to Ollama API as fallback
            try:
                response = ollama.list()
                # Handle different response formats from Ollama API
                if hasattr(response, 'models'):
                    models_list = response.models
                elif isinstance(response, dict):
                    models_list = response.get('models', [])
                else:
                    models_list = []
                
                model_names = []
                for m in models_list:
                    if hasattr(m, 'model'):
                        model_names.append(m.model)
                    elif hasattr(m, 'name'):
                        model_names.append(m.name)
                    elif isinstance(m, dict):
                        model_names.append(m.get('name', m.get('model', 'unknown')))
                    else:
                        model_names.append(str(m))
                
                return {
                    'status': 'connected',
                    'models': model_names,
                    'configured_model': self.settings.ollama_model
                }
            except Exception:
                # Fallback: try direct HTTP request
                resp = httpx.get(f"{self.settings.ollama_base_url}/api/tags", timeout=5.0)
                if resp.status_code == 200:
                    data = resp.json()
                    model_names = [m.get('name', '') for m in data.get('models', [])]
                    return {
                        'status': 'connected',
                        'models': model_names,
                        'configured_model': self.settings.ollama_model
                    }
                raise Exception(f"HTTP {resp.status_code}")
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
