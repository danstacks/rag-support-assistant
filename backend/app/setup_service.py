import os
import asyncio
import httpx
from typing import Optional
from pydantic import BaseModel

from app.config import get_settings


class SetupStatus(BaseModel):
    is_first_run: bool = True
    ollama_installed: bool = False
    ollama_running: bool = False
    model_available: bool = False
    model_name: str = ""
    model_pulling: bool = False
    model_pull_progress: Optional[float] = None
    documents_loaded: int = 0
    setup_complete: bool = False
    error: Optional[str] = None


class SetupService:
    def __init__(self):
        self.settings = get_settings()
        self._model_pulling = False
        self._pull_progress = 0.0
    
    async def check_ollama_installed(self) -> bool:
        """Check if Ollama is reachable"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.settings.ollama_base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False
    
    async def check_model_available(self) -> tuple[bool, list[str]]:
        """Check if the configured model is available"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.settings.ollama_base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    models = [m.get('name', '') for m in data.get('models', [])]
                    # Check if our model (or a variant) is available
                    target = self.settings.ollama_model.split(':')[0]
                    available = any(target in m for m in models)
                    return available, models
        except Exception:
            pass
        return False, []
    
    async def pull_model(self, model_name: Optional[str] = None) -> dict:
        """Pull the model from Ollama"""
        model = model_name or self.settings.ollama_model
        self._model_pulling = True
        self._pull_progress = 0.0
        
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream(
                    'POST',
                    f"{self.settings.ollama_base_url}/api/pull",
                    json={"name": model},
                ) as response:
                    async for line in response.aiter_lines():
                        if line:
                            import json
                            try:
                                data = json.loads(line)
                                if 'completed' in data and 'total' in data:
                                    if data['total'] > 0:
                                        self._pull_progress = (data['completed'] / data['total']) * 100
                                if data.get('status') == 'success':
                                    self._model_pulling = False
                                    return {"status": "success", "model": model}
                            except json.JSONDecodeError:
                                pass
            
            self._model_pulling = False
            return {"status": "success", "model": model}
        except Exception as e:
            self._model_pulling = False
            return {"status": "error", "error": str(e)}
    
    def get_pull_progress(self) -> dict:
        """Get current model pull progress"""
        return {
            "pulling": self._model_pulling,
            "progress": self._pull_progress
        }
    
    async def get_document_count(self) -> int:
        """Get number of indexed documents"""
        try:
            from app.vector_store import get_vector_store
            vs = get_vector_store()
            return vs.get_document_count()
        except Exception:
            return 0
    
    def check_setup_complete_file(self) -> bool:
        """Check if setup has been completed before"""
        setup_file = os.path.join(self.settings.chroma_persist_directory, ".setup_complete")
        return os.path.exists(setup_file)
    
    def mark_setup_complete(self):
        """Mark setup as complete"""
        os.makedirs(self.settings.chroma_persist_directory, exist_ok=True)
        setup_file = os.path.join(self.settings.chroma_persist_directory, ".setup_complete")
        with open(setup_file, 'w') as f:
            f.write("1")
    
    async def get_full_status(self) -> SetupStatus:
        """Get complete setup status"""
        status = SetupStatus()
        
        # Check if first run
        status.is_first_run = not self.check_setup_complete_file()
        
        # Check Ollama
        status.ollama_running = await self.check_ollama_installed()
        status.ollama_installed = status.ollama_running  # If running, it's installed
        
        # Check model
        if status.ollama_running:
            status.model_available, _ = await self.check_model_available()
            status.model_name = self.settings.ollama_model
        
        # Check pull status
        status.model_pulling = self._model_pulling
        status.model_pull_progress = self._pull_progress if self._model_pulling else None
        
        # Check documents
        status.documents_loaded = await self.get_document_count()
        
        # Determine if setup is complete
        status.setup_complete = (
            status.ollama_running and 
            status.model_available and 
            status.documents_loaded > 0
        )
        
        return status


_setup_service: Optional[SetupService] = None

def get_setup_service() -> SetupService:
    global _setup_service
    if _setup_service is None:
        _setup_service = SetupService()
    return _setup_service
