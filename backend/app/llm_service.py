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
    
    def _format_conversation_history(self, history: List[Dict[str, str]]) -> str:
        """Format conversation history for context"""
        if not history:
            return ""
        
        formatted = []
        for msg in history[-self.settings.conversation_memory_limit:]:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role == 'user':
                formatted.append(f"User: {content}")
            else:
                formatted.append(f"Assistant: {content[:500]}...")  # Truncate long responses
        
        return "\n".join(formatted)
    
    def _get_relevant_documents(self, query: str, use_hybrid: bool = True) -> tuple[List[Document], List[float]]:
        """Get relevant documents with optional hybrid search"""
        if use_hybrid and self.settings.enable_hybrid_search:
            from app.vector_store import hybrid_search
            results = hybrid_search(query, k=self.settings.top_k_results)
            documents = [r[0] for r in results]
            scores = [r[2] for r in results]  # confidence scores
            return documents, scores
        else:
            documents = self.vector_store.similarity_search(query)
            return documents, [0.7] * len(documents)  # Default confidence
    
    def get_persona(self) -> Dict[str, str]:
        return self.persona_manager.get_persona()
    
    def set_persona(self, prompt: str, name: str = "Custom Assistant") -> Dict[str, str]:
        return self.persona_manager.save_persona(prompt, name)
    
    def reset_persona(self) -> Dict[str, str]:
        return self.persona_manager.reset_to_default()
    
    def generate_response(
        self,
        query: str,
        include_sources: bool = True,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> tuple[str, List[dict], Dict[str, Any]]:
        """Generate response with performance metrics, hybrid search, and conversation memory"""
        from app.vector_store import calculate_confidence
        start_time = time.time()
        
        # Retrieval phase with hybrid search
        retrieval_start = time.time()
        documents, scores = self._get_relevant_documents(query)
        retrieval_time = time.time() - retrieval_start
        
        # Calculate confidence score
        confidence = calculate_confidence(scores, len(documents))
        
        context = self._format_context(documents)
        
        # Add conversation history if enabled and provided
        history_context = ""
        if self.settings.enable_conversation_memory and conversation_history:
            history_context = self._format_conversation_history(conversation_history)
            if history_context:
                history_context = f"\n\nPrevious conversation:\n{history_context}\n\n"
        
        prompt = QUERY_PROMPT.format(context=context, question=query)
        if history_context:
            prompt = f"{history_context}Current question context:\n{prompt}"
        
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
        
        # Generate suggested follow-up questions
        suggested_questions = self._generate_follow_up_questions(query, answer, documents)
        
        # Performance metrics with confidence
        metrics = {
            "total_time_ms": round(total_time * 1000),
            "retrieval_time_ms": round(retrieval_time * 1000),
            "generation_time_ms": round(generation_time * 1000),
            "documents_retrieved": len(documents),
            "prompt_tokens": prompt_eval_count,
            "completion_tokens": eval_count,
            "total_tokens": prompt_eval_count + eval_count,
            "model": self.settings.ollama_model,
            "persona": persona.get("name", "Default"),
            "confidence": confidence,
            "hybrid_search": self.settings.enable_hybrid_search,
            "suggested_questions": suggested_questions
        }
        
        sources = []
        if include_sources:
            for i, doc in enumerate(documents):
                sources.append({
                    'content': doc.page_content[:500] + "..." if len(doc.page_content) > 500 else doc.page_content,
                    'source': doc.metadata.get('source', 'Unknown'),
                    'title': doc.metadata.get('title', ''),
                    'relevance_score': round(scores[i] * 100, 1) if i < len(scores) else None
                })
        
        return answer, sources, metrics
    
    def _generate_follow_up_questions(self, query: str, answer: str, documents: List[Document]) -> List[str]:
        """Generate suggested follow-up questions based on the query and response"""
        suggestions = []
        
        # Extract key topics from documents
        topics = set()
        for doc in documents[:3]:
            content = doc.page_content.lower()
            # Look for common technical terms
            if 'install' in content and 'install' not in query.lower():
                suggestions.append(f"How do I install this?")
            if 'config' in content and 'config' not in query.lower():
                suggestions.append(f"What configuration options are available?")
            if 'troubleshoot' in content or 'error' in content:
                suggestions.append(f"What are common issues and how to troubleshoot them?")
            if 'example' in content:
                suggestions.append(f"Can you show me an example?")
        
        # Add generic follow-ups based on query type
        query_lower = query.lower()
        if 'what is' in query_lower or 'what are' in query_lower:
            suggestions.append("How does this work in practice?")
        if 'how to' in query_lower:
            suggestions.append("What are the prerequisites?")
            suggestions.append("Are there any best practices?")
        
        # Return unique suggestions, max 3
        seen = set()
        unique = []
        for s in suggestions:
            if s.lower() not in seen:
                seen.add(s.lower())
                unique.append(s)
        
        return unique[:3]
    
    def generate_response_stream(
        self,
        query: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Generator[str, None, None]:
        documents, scores = self._get_relevant_documents(query)
        context = self._format_context(documents)
        
        # Add conversation history if enabled
        history_context = ""
        if self.settings.enable_conversation_memory and conversation_history:
            history_context = self._format_conversation_history(conversation_history)
            if history_context:
                history_context = f"\n\nPrevious conversation:\n{history_context}\n\n"
        
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
