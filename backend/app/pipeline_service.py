"""
Pipeline Service for Scheduled Document Scraping

Supports:
- One-time scraping
- Scheduled pipelines (hourly, daily, weekly)
- Incremental updates (only changed/added/deleted docs)
- Content hashing to detect changes
"""

import os
import json
import hashlib
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
import threading

from app.config import get_settings
from app.document_loader import DocumentLoader, ScrapeConfig, SCRAPE_PRESETS
from app.vector_store import get_vector_store
from app.crypto_service import encrypt_credential, decrypt_credential


class PipelineFrequency(str, Enum):
    ONCE = "once"           # One-time scrape
    HOURLY = "hourly"       # Every hour
    DAILY = "daily"         # Every 24 hours
    WEEKLY = "weekly"       # Every 7 days
    CUSTOM = "custom"       # Custom interval in minutes


@dataclass
class PipelineConfig:
    """Configuration for a scraping pipeline"""
    id: str
    name: str
    scrape_config: Dict[str, Any]  # ScrapeConfig as dict
    frequency: PipelineFrequency = PipelineFrequency.ONCE
    custom_interval_minutes: int = 60  # For CUSTOM frequency
    enabled: bool = True
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    last_run_stats: Optional[Dict[str, int]] = None  # added, updated, deleted, unchanged


@dataclass
class DocumentHash:
    """Track document content for change detection"""
    url: str
    content_hash: str
    title: str
    last_seen: str
    chunk_ids: List[str] = field(default_factory=list)


class PipelineService:
    def __init__(self):
        self.settings = get_settings()
        self.pipelines: Dict[str, PipelineConfig] = {}
        self.document_hashes: Dict[str, DocumentHash] = {}  # url -> hash
        self._scheduler_running = False
        self._scheduler_thread: Optional[threading.Thread] = None
        self._load_state()
    
    def _get_state_file(self) -> str:
        return os.path.join(self.settings.chroma_persist_directory, "pipeline_state.json")
    
    def _get_hashes_file(self) -> str:
        return os.path.join(self.settings.chroma_persist_directory, "document_hashes.json")
    
    def _load_state(self):
        """Load pipeline state from disk"""
        state_file = self._get_state_file()
        if os.path.exists(state_file):
            try:
                with open(state_file, 'r') as f:
                    data = json.load(f)
                    for pid, pdata in data.get('pipelines', {}).items():
                        self.pipelines[pid] = PipelineConfig(**pdata)
            except Exception as e:
                print(f"Error loading pipeline state: {e}")
        
        hashes_file = self._get_hashes_file()
        if os.path.exists(hashes_file):
            try:
                with open(hashes_file, 'r') as f:
                    data = json.load(f)
                    for url, hdata in data.items():
                        self.document_hashes[url] = DocumentHash(**hdata)
            except Exception as e:
                print(f"Error loading document hashes: {e}")
    
    def _save_state(self):
        """Save pipeline state to disk"""
        os.makedirs(self.settings.chroma_persist_directory, exist_ok=True)
        
        state_file = self._get_state_file()
        with open(state_file, 'w') as f:
            json.dump({
                'pipelines': {pid: asdict(p) for pid, p in self.pipelines.items()}
            }, f, indent=2)
        
        hashes_file = self._get_hashes_file()
        with open(hashes_file, 'w') as f:
            json.dump({url: asdict(h) for url, h in self.document_hashes.items()}, f, indent=2)
    
    def _compute_hash(self, content: str) -> str:
        """Compute content hash for change detection"""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]
    
    def _calculate_next_run(self, pipeline: PipelineConfig) -> Optional[str]:
        """Calculate next run time based on frequency"""
        if pipeline.frequency == PipelineFrequency.ONCE:
            return None
        
        now = datetime.now()
        
        if pipeline.frequency == PipelineFrequency.HOURLY:
            next_run = now + timedelta(hours=1)
        elif pipeline.frequency == PipelineFrequency.DAILY:
            next_run = now + timedelta(days=1)
        elif pipeline.frequency == PipelineFrequency.WEEKLY:
            next_run = now + timedelta(weeks=1)
        elif pipeline.frequency == PipelineFrequency.CUSTOM:
            next_run = now + timedelta(minutes=pipeline.custom_interval_minutes)
        else:
            return None
        
        return next_run.isoformat()
    
    def _encrypt_sensitive_fields(self, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Encrypt sensitive fields in scrape config before saving"""
        sensitive_fields = ['auth_token', 'basic_auth_password', 'cookie_string']
        encrypted = config_dict.copy()
        
        for field in sensitive_fields:
            if field in encrypted and encrypted[field]:
                encrypted[field] = encrypt_credential(encrypted[field])
        
        return encrypted
    
    def _decrypt_sensitive_fields(self, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Decrypt sensitive fields in scrape config before use"""
        sensitive_fields = ['auth_token', 'basic_auth_password', 'cookie_string']
        decrypted = config_dict.copy()
        
        for field in sensitive_fields:
            if field in decrypted and decrypted[field]:
                try:
                    decrypted[field] = decrypt_credential(decrypted[field])
                except ValueError as e:
                    print(f"Warning: Could not decrypt {field}: {e}")
                    decrypted[field] = None
        
        return decrypted
    
    def create_pipeline(
        self,
        name: str,
        scrape_config: ScrapeConfig,
        frequency: PipelineFrequency = PipelineFrequency.ONCE,
        custom_interval_minutes: int = 60
    ) -> PipelineConfig:
        """Create a new scraping pipeline with encrypted credentials"""
        import uuid
        pipeline_id = str(uuid.uuid4())[:8]
        
        # Encrypt sensitive fields before saving
        config_dict = asdict(scrape_config)
        encrypted_config = self._encrypt_sensitive_fields(config_dict)
        
        pipeline = PipelineConfig(
            id=pipeline_id,
            name=name,
            scrape_config=encrypted_config,
            frequency=frequency,
            custom_interval_minutes=custom_interval_minutes,
            enabled=True
        )
        
        # Calculate first run time
        if frequency != PipelineFrequency.ONCE:
            pipeline.next_run = datetime.now().isoformat()  # Run immediately first time
        
        self.pipelines[pipeline_id] = pipeline
        self._save_state()
        
        return pipeline
    
    def create_pipeline_from_preset(
        self,
        preset_name: str,
        frequency: PipelineFrequency = PipelineFrequency.ONCE,
        custom_interval_minutes: int = 60,
        max_pages: int = None,
        max_depth: int = None,
        recursive: bool = None,
        platform: str = None,
        auth_token: str = None,
        basic_username: str = None,
        basic_password: str = None,
        cookies: str = None
    ) -> PipelineConfig:
        """Create a pipeline from a preset configuration"""
        if preset_name not in SCRAPE_PRESETS:
            raise ValueError(f"Unknown preset: {preset_name}")
        
        config = SCRAPE_PRESETS[preset_name]()
        
        # Override config with provided values
        if max_pages is not None:
            config.max_pages = max_pages
        if max_depth is not None:
            config.max_depth = max_depth
        if recursive is not None:
            config.recursive = recursive
        if platform:
            config.platform = platform
        if auth_token:
            config.auth_token = auth_token
        if basic_username:
            config.basic_auth_username = basic_username
            config.basic_auth_password = basic_password or ''
        if cookies:
            config.cookie_string = cookies
            
        return self.create_pipeline(
            name=f"{preset_name.title()} Docs",
            scrape_config=config,
            frequency=frequency,
            custom_interval_minutes=custom_interval_minutes
        )
    
    def get_pipeline(self, pipeline_id: str) -> Optional[PipelineConfig]:
        return self.pipelines.get(pipeline_id)
    
    def list_pipelines(self) -> List[PipelineConfig]:
        return list(self.pipelines.values())
    
    def delete_pipeline(self, pipeline_id: str) -> bool:
        if pipeline_id in self.pipelines:
            del self.pipelines[pipeline_id]
            self._save_state()
            return True
        return False
    
    def toggle_pipeline(self, pipeline_id: str, enabled: bool) -> bool:
        if pipeline_id in self.pipelines:
            self.pipelines[pipeline_id].enabled = enabled
            self._save_state()
            return True
        return False
    
    async def run_pipeline(self, pipeline_id: str, incremental: bool = True) -> Dict[str, int]:
        """
        Run a pipeline scrape
        
        Args:
            pipeline_id: The pipeline to run
            incremental: If True, only process changed/new documents
        
        Returns:
            Stats dict with added, updated, deleted, unchanged counts
        """
        pipeline = self.pipelines.get(pipeline_id)
        if not pipeline:
            raise ValueError(f"Pipeline not found: {pipeline_id}")
        
        stats = {"added": 0, "updated": 0, "deleted": 0, "unchanged": 0}
        
        # Reconstruct ScrapeConfig from dict, decrypting sensitive fields
        decrypted_config = self._decrypt_sensitive_fields(pipeline.scrape_config)
        scrape_config = ScrapeConfig(**decrypted_config)
        
        # Scrape documents
        loader = DocumentLoader()
        documents = await loader.scrape_with_config(scrape_config)
        
        vector_store = get_vector_store()
        current_urls = set()
        
        for doc in documents:
            url = doc.metadata.get('source', '')
            current_urls.add(url)
            content_hash = self._compute_hash(doc.page_content)
            
            existing = self.document_hashes.get(url)
            
            if existing:
                if existing.content_hash == content_hash:
                    # Unchanged
                    stats["unchanged"] += 1
                    existing.last_seen = datetime.now().isoformat()
                else:
                    # Updated - remove old chunks and add new
                    if incremental:
                        # In a real implementation, we'd delete specific chunks
                        # For now, we just add the new version
                        pass
                    
                    chunks_added = vector_store.add_documents([doc])
                    self.document_hashes[url] = DocumentHash(
                        url=url,
                        content_hash=content_hash,
                        title=doc.metadata.get('title', url),
                        last_seen=datetime.now().isoformat()
                    )
                    stats["updated"] += 1
            else:
                # New document
                chunks_added = vector_store.add_documents([doc])
                self.document_hashes[url] = DocumentHash(
                    url=url,
                    content_hash=content_hash,
                    title=doc.metadata.get('title', url),
                    last_seen=datetime.now().isoformat()
                )
                stats["added"] += 1
        
        # Check for deleted documents (URLs we had before but didn't see this time)
        pipeline_urls = {url for url, h in self.document_hashes.items() 
                        if url.startswith(scrape_config.url.split('/')[2])}  # Same domain
        deleted_urls = pipeline_urls - current_urls
        
        for url in deleted_urls:
            # Mark as deleted (in production, would remove from vector store)
            del self.document_hashes[url]
            stats["deleted"] += 1
        
        # Update pipeline state
        pipeline.last_run = datetime.now().isoformat()
        pipeline.last_run_stats = stats
        pipeline.next_run = self._calculate_next_run(pipeline)
        
        self._save_state()
        
        print(f"Pipeline {pipeline.name}: +{stats['added']} added, ~{stats['updated']} updated, -{stats['deleted']} deleted, ={stats['unchanged']} unchanged")
        
        return stats
    
    async def run_due_pipelines(self):
        """Run all pipelines that are due"""
        now = datetime.now()
        
        for pipeline in self.pipelines.values():
            if not pipeline.enabled:
                continue
            
            if pipeline.frequency == PipelineFrequency.ONCE:
                continue
            
            if pipeline.next_run:
                next_run = datetime.fromisoformat(pipeline.next_run)
                if now >= next_run:
                    print(f"Running scheduled pipeline: {pipeline.name}")
                    try:
                        await self.run_pipeline(pipeline.id, incremental=True)
                    except Exception as e:
                        print(f"Pipeline {pipeline.name} failed: {e}")
    
    def start_scheduler(self, check_interval_seconds: int = 60):
        """Start background scheduler for pipelines"""
        if self._scheduler_running:
            return
        
        self._scheduler_running = True
        
        def scheduler_loop():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            while self._scheduler_running:
                try:
                    loop.run_until_complete(self.run_due_pipelines())
                except Exception as e:
                    print(f"Scheduler error: {e}")
                
                # Sleep until next check
                import time
                time.sleep(check_interval_seconds)
            
            loop.close()
        
        self._scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
        self._scheduler_thread.start()
        print("Pipeline scheduler started")
    
    def stop_scheduler(self):
        """Stop the background scheduler"""
        self._scheduler_running = False
        if self._scheduler_thread:
            self._scheduler_thread.join(timeout=5)
        print("Pipeline scheduler stopped")
    
    def get_document_stats(self) -> Dict[str, Any]:
        """Get statistics about tracked documents"""
        return {
            "total_tracked": len(self.document_hashes),
            "pipelines_count": len(self.pipelines),
            "active_pipelines": sum(1 for p in self.pipelines.values() if p.enabled and p.frequency != PipelineFrequency.ONCE),
        }


# Singleton instance
_pipeline_service: Optional[PipelineService] = None

def get_pipeline_service() -> PipelineService:
    global _pipeline_service
    if _pipeline_service is None:
        _pipeline_service = PipelineService()
    return _pipeline_service
