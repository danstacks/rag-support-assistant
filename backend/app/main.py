import uuid
import asyncio
import os
import tempfile
from typing import List
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json

from app.config import get_settings
from app.models import (
    ChatRequest, ChatResponse, SourceDocument,
    IngestRequest, IngestResponse, HealthResponse, PerformanceMetrics
)
from app.vector_store import get_vector_store
from app.llm_service import get_llm_service
from app.document_loader import (
    DocumentLoader, scrape_isovalent_docs, scrape_with_preset,
    ScrapeConfig, SCRAPE_PRESETS, get_confluence_config, get_generic_wiki_config
)
from app.setup_service import get_setup_service, SetupStatus
from app.pipeline_service import (
    get_pipeline_service, PipelineConfig, PipelineFrequency
)

app = FastAPI(
    title="RAG Support Assistant",
    description="AI-powered support assistant using Retrieval-Augmented Generation",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = get_settings()

# Job tracking for crawl operations
_active_jobs = {}

class CrawlJob:
    def __init__(self, job_id: str, url: str):
        self.id = job_id
        self.url = url
        self.status = "starting"
        self.pages_found = 0
        self.pages_processed = 0
        self.documents_indexed = 0
        self.current_page = ""
        self.cancelled = False
        self.error = None
        self.completed = False


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get status of a crawl job"""
    if job_id not in _active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = _active_jobs[job_id]
    return {
        "id": job.id,
        "url": job.url,
        "status": job.status,
        "pages_found": job.pages_found,
        "pages_processed": job.pages_processed,
        "documents_indexed": job.documents_indexed,
        "current_page": job.current_page,
        "cancelled": job.cancelled,
        "completed": job.completed,
        "error": job.error
    }


@app.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a crawl job"""
    if job_id not in _active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = _active_jobs[job_id]
    job.cancelled = True
    job.status = "cancelling"
    return {"status": "success", "message": "Job cancellation requested"}


@app.get("/health", response_model=HealthResponse)
async def health_check():
    vector_store = get_vector_store()
    llm_service = get_llm_service()
    
    ollama_status = llm_service.check_ollama_status()
    doc_count = vector_store.get_document_count()
    
    return HealthResponse(
        status="healthy",
        ollama_status=ollama_status.get('status', 'unknown'),
        vector_store_status="connected" if doc_count >= 0 else "error",
        documents_count=doc_count
    )


@app.get("/monitoring/status")
async def get_monitoring_status():
    """Comprehensive system status for monitoring dashboard"""
    import psutil
    import platform
    from datetime import datetime
    
    vector_store = get_vector_store()
    llm_service = get_llm_service()
    pipeline_service = get_pipeline_service()
    
    # Ollama status
    ollama_info = llm_service.check_ollama_status()
    
    # System resources
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # GPU info (if available)
    gpu_info = None
    try:
        import subprocess
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=name,memory.used,memory.total,utilization.gpu', '--format=csv,noheader,nounits'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(', ')
            if len(parts) >= 4:
                gpu_info = {
                    "name": parts[0],
                    "memory_used_mb": int(parts[1]),
                    "memory_total_mb": int(parts[2]),
                    "utilization_percent": int(parts[3]),
                    "memory_percent": round(int(parts[1]) / int(parts[2]) * 100, 1)
                }
    except Exception:
        pass
    
    # Pipeline status
    pipelines = pipeline_service.list_pipelines()
    active_pipelines = [p for p in pipelines if p.enabled and p.frequency.value != 'once']
    
    # Document stats
    doc_count = vector_store.get_document_count()
    doc_stats = pipeline_service.get_document_stats()
    
    return {
        "timestamp": datetime.now().isoformat(),
        "system": {
            "platform": platform.system(),
            "python_version": platform.python_version(),
            "cpu_percent": cpu_percent,
            "memory": {
                "total_gb": round(memory.total / (1024**3), 1),
                "used_gb": round(memory.used / (1024**3), 1),
                "percent": memory.percent
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 1),
                "used_gb": round(disk.used / (1024**3), 1),
                "percent": round(disk.used / disk.total * 100, 1)
            }
        },
        "gpu": gpu_info,
        "services": {
            "backend": {"status": "running", "healthy": True},
            "ollama": {
                "status": ollama_info.get('status', 'unknown'),
                "healthy": ollama_info.get('status') == 'connected',
                "model": ollama_info.get('configured_model', settings.ollama_model),
                "model_loaded": ollama_info.get('configured_model', settings.ollama_model) in ollama_info.get('models', [])
            },
            "vector_store": {
                "status": "connected" if doc_count >= 0 else "error",
                "healthy": doc_count >= 0,
                "document_count": doc_count
            },
            "embeddings": {
                "status": "ready",
                "healthy": True,
                "model": settings.embedding_model
            }
        },
        "pipelines": {
            "total": len(pipelines),
            "active": len(active_pipelines),
            "tracked_documents": doc_stats.get("total_tracked", 0)
        }
    }


@app.get("/monitoring/logs")
async def get_recent_logs(limit: int = 50):
    """Get recent application logs (if logging to file)"""
    import os
    log_file = os.path.join(settings.chroma_persist_directory, "app.log")
    
    logs = []
    if os.path.exists(log_file):
        try:
            with open(log_file, 'r') as f:
                lines = f.readlines()
                logs = lines[-limit:]
        except Exception:
            pass
    
    return {"logs": logs, "count": len(logs)}


@app.get("/monitoring/metrics")
async def get_metrics():
    """Get application metrics for monitoring"""
    vector_store = get_vector_store()
    pipeline_service = get_pipeline_service()
    
    pipelines = pipeline_service.list_pipelines()
    
    # Calculate pipeline stats
    total_added = 0
    total_updated = 0
    total_deleted = 0
    
    for p in pipelines:
        if p.last_run_stats:
            total_added += p.last_run_stats.get('added', 0)
            total_updated += p.last_run_stats.get('updated', 0)
            total_deleted += p.last_run_stats.get('deleted', 0)
    
    return {
        "documents": {
            "total_chunks": vector_store.get_document_count(),
            "tracked_urls": pipeline_service.get_document_stats().get("total_tracked", 0)
        },
        "pipelines": {
            "total": len(pipelines),
            "active": sum(1 for p in pipelines if p.enabled),
            "total_documents_added": total_added,
            "total_documents_updated": total_updated,
            "total_documents_deleted": total_deleted
        }
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        llm_service = get_llm_service()
        
        answer, sources, metrics = llm_service.generate_response(
            query=request.message,
            include_sources=request.include_sources
        )
        
        source_docs = [
            SourceDocument(
                content=s['content'],
                source=s['source'],
                score=s.get('score')
            )
            for s in sources
        ]
        
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        return ChatResponse(
            answer=answer,
            sources=source_docs,
            conversation_id=conversation_id,
            metrics=PerformanceMetrics(**metrics)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    try:
        llm_service = get_llm_service()
        
        async def generate():
            for chunk in llm_service.generate_response_stream(request.message):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/url")
async def ingest_url(request: IngestRequest, background_tasks: BackgroundTasks):
    """Start a crawl job and return job ID for status tracking"""
    urls = []
    if request.url:
        urls.append(request.url)
    if request.urls:
        urls.extend(request.urls)
    
    if not urls:
        raise HTTPException(status_code=400, detail="No URLs provided")
    
    # Create job for tracking
    job_id = str(uuid.uuid4())[:8]
    job = CrawlJob(job_id, urls[0])
    _active_jobs[job_id] = job
    
    print(f"[Crawl] Starting job {job_id} for {urls[0]}")
    
    # Run crawl in background - define as sync wrapper for background_tasks
    def run_crawl_sync():
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_crawl_async())
        finally:
            loop.close()
    
    async def run_crawl_async():
        try:
            print(f"[Crawl] Job {job_id} starting crawl...")
            loader = DocumentLoader()
            vector_store = get_vector_store()
            
            job.status = "crawling"
            total_docs = 0
            
            for url in urls:
                if job.cancelled:
                    job.status = "cancelled"
                    job.completed = True
                    print(f"[Crawl] Job {job_id} cancelled")
                    return
                
                job.current_page = url
                print(f"[Crawl] Job {job_id} scraping {url}")
                documents = await loader.scrape_url(
                    url,
                    recursive=request.recursive,
                    max_depth=request.max_depth,
                    job=job
                )
                
                if job.cancelled:
                    job.status = "cancelled"
                    job.completed = True
                    return
                
                job.status = "indexing"
                print(f"[Crawl] Job {job_id} indexing {len(documents)} documents")
                count = vector_store.add_documents(documents)
                job.documents_indexed += count
                total_docs += count
            
            job.status = "completed"
            job.completed = True
            print(f"[Crawl] Job {job_id} completed: {total_docs} documents indexed")
            
        except Exception as e:
            job.status = "error"
            job.error = str(e)
            job.completed = True
            print(f"[Crawl] Job {job_id} error: {e}")
    
    # Use FastAPI's background tasks
    background_tasks.add_task(run_crawl_sync)
    
    return {
        "status": "started",
        "job_id": job_id,
        "message": f"Crawl job started for {len(urls)} URL(s)"
    }


@app.post("/ingest/isovalent-docs", response_model=IngestResponse)
async def ingest_isovalent_docs():
    try:
        vector_store = get_vector_store()
        
        documents = await scrape_isovalent_docs()
        count = vector_store.add_documents(documents)
        
        return IngestResponse(
            status="success",
            documents_processed=count,
            message=f"Successfully ingested {count} document chunks from Isovalent/Cilium documentation"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ingest/presets")
async def get_scrape_presets():
    """Get available scraping presets"""
    return {
        "presets": list(SCRAPE_PRESETS.keys()),
        "descriptions": {
            "isovalent": "All Isovalent open source docs (Cilium + Tetragon)",
            "cilium": "Cilium documentation only (~500 pages)",
            "hubble": "Hubble observability docs (~100 pages)",
            "tetragon": "Tetragon security docs (~200 pages)",
        }
    }


@app.post("/ingest/preset/{preset_name}", response_model=IngestResponse)
async def ingest_preset(preset_name: str):
    """Scrape documentation using a preset configuration"""
    try:
        if preset_name not in SCRAPE_PRESETS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unknown preset: {preset_name}. Available: {list(SCRAPE_PRESETS.keys())}"
            )
        
        vector_store = get_vector_store()
        documents = await scrape_with_preset(preset_name)
        count = vector_store.add_documents(documents)
        
        return IngestResponse(
            status="success",
            documents_processed=count,
            message=f"Successfully ingested {count} document chunks using '{preset_name}' preset"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/advanced")
async def ingest_advanced(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    recursive: bool = Form(True),
    max_depth: int = Form(3),
    max_pages: int = Form(500),
    allowed_domains: str = Form(""),  # Comma-separated
    url_patterns: str = Form(""),  # Comma-separated regex patterns
    exclude_patterns: str = Form(""),  # Comma-separated regex patterns
    rate_limit: float = Form(0.5),
    auth_token: str = Form(None),
    platform: str = Form("auto"),
    # Authentication options
    basic_auth_username: str = Form(None),
    basic_auth_password: str = Form(None),
    cookie_string: str = Form(None)  # Raw cookie string from browser dev tools
):
    """Advanced scraping with full configuration options including authentication"""
    # Create job for tracking
    job_id = str(uuid.uuid4())[:8]
    job = CrawlJob(job_id, url)
    _active_jobs[job_id] = job
    
    print(f"[Crawl] Starting advanced job {job_id} for {url}")
    
    config = ScrapeConfig(
        url=url,
        recursive=recursive,
        max_depth=max_depth,
        max_pages=max_pages,
        allowed_domains=[d.strip() for d in allowed_domains.split(",") if d.strip()],
        url_patterns=[p.strip() for p in url_patterns.split(",") if p.strip()],
        exclude_patterns=[p.strip() for p in exclude_patterns.split(",") if p.strip()],
        rate_limit=rate_limit,
        auth_token=auth_token if auth_token else None,
        platform=platform,
        basic_auth_username=basic_auth_username if basic_auth_username else None,
        basic_auth_password=basic_auth_password if basic_auth_password else None,
        cookie_string=cookie_string if cookie_string else None
    )
    
    def run_crawl_sync():
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_crawl_async())
        finally:
            loop.close()
    
    async def run_crawl_async():
        try:
            print(f"[Crawl] Job {job_id} starting advanced crawl...")
            loader = DocumentLoader()
            vector_store = get_vector_store()
            
            job.status = "crawling"
            
            documents = await loader.scrape_with_config(config, job=job)
            
            if job.cancelled:
                job.status = "cancelled"
                job.completed = True
                print(f"[Crawl] Job {job_id} cancelled")
                return
            
            job.status = "indexing"
            print(f"[Crawl] Job {job_id} indexing {len(documents)} documents")
            count = vector_store.add_documents(documents)
            job.documents_indexed = count
            
            job.status = "completed"
            job.completed = True
            print(f"[Crawl] Job {job_id} completed: {count} documents indexed")
            
        except Exception as e:
            job.status = "error"
            job.error = str(e)
            job.completed = True
            print(f"[Crawl] Job {job_id} error: {e}")
    
    background_tasks.add_task(run_crawl_sync)
    
    return {
        "status": "started",
        "job_id": job_id,
        "message": f"Crawl job started for {url}"
    }


@app.post("/ingest/confluence", response_model=IngestResponse)
async def ingest_confluence(
    base_url: str = Form(...),
    space_key: str = Form(...),
    auth_token: str = Form(None),
    max_pages: int = Form(500)
):
    """Scrape a Confluence wiki space"""
    try:
        config = get_confluence_config(base_url, space_key, auth_token)
        config.max_pages = max_pages
        
        loader = DocumentLoader()
        vector_store = get_vector_store()
        
        documents = await loader.scrape_with_config(config)
        count = vector_store.add_documents(documents)
        
        return IngestResponse(
            status="success",
            documents_processed=count,
            message=f"Successfully ingested {count} document chunks from Confluence space '{space_key}'"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/directory", response_model=IngestResponse)
async def ingest_directory(directory: str = None):
    try:
        loader = DocumentLoader()
        vector_store = get_vector_store()
        
        dir_path = directory or settings.docs_directory
        documents = loader.load_directory(dir_path)
        count = vector_store.add_documents(documents)
        
        return IngestResponse(
            status="success",
            documents_processed=count,
            message=f"Successfully ingested {count} document chunks from {dir_path}"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents/count")
async def get_document_count():
    vector_store = get_vector_store()
    return {"count": vector_store.get_document_count()}


@app.delete("/documents")
async def clear_documents():
    vector_store = get_vector_store()
    vector_store.clear_collection()
    return {"status": "success", "message": "All documents cleared"}


# ============== Pipeline Endpoints ==============

@app.get("/pipelines")
async def list_pipelines():
    """List all configured pipelines"""
    service = get_pipeline_service()
    pipelines = service.list_pipelines()
    return {
        "pipelines": [
            {
                "id": p.id,
                "name": p.name,
                "frequency": p.frequency,
                "enabled": p.enabled,
                "last_run": p.last_run,
                "next_run": p.next_run,
                "last_run_stats": p.last_run_stats,
                "url": p.scrape_config.get("url", "")
            }
            for p in pipelines
        ],
        "stats": service.get_document_stats()
    }


@app.post("/pipelines")
async def create_pipeline(
    name: str = Form(...),
    url: str = Form(...),
    frequency: str = Form("once"),
    custom_interval_minutes: int = Form(60),
    recursive: bool = Form(True),
    max_depth: int = Form(3),
    max_pages: int = Form(500),
    auth_token: str = Form(None),
    platform: str = Form("auto")
):
    """Create a new scraping pipeline"""
    try:
        service = get_pipeline_service()
        
        # Build scrape config
        scrape_config = ScrapeConfig(
            url=url,
            recursive=recursive,
            max_depth=max_depth,
            max_pages=max_pages,
            auth_token=auth_token if auth_token else None,
            platform=platform
        )
        
        # Parse frequency
        freq = PipelineFrequency(frequency)
        
        pipeline = service.create_pipeline(
            name=name,
            scrape_config=scrape_config,
            frequency=freq,
            custom_interval_minutes=custom_interval_minutes
        )
        
        return {
            "status": "success",
            "pipeline": {
                "id": pipeline.id,
                "name": pipeline.name,
                "frequency": pipeline.frequency,
                "next_run": pipeline.next_run
            },
            "message": f"Pipeline '{name}' created successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipelines/preset")
async def create_pipeline_from_preset(
    preset_name: str = Form(...),
    frequency: str = Form("once"),
    custom_interval_minutes: int = Form(60)
):
    """Create a pipeline from a preset (cilium, tetragon, hubble, isovalent)"""
    try:
        service = get_pipeline_service()
        freq = PipelineFrequency(frequency)
        
        pipeline = service.create_pipeline_from_preset(
            preset_name=preset_name,
            frequency=freq,
            custom_interval_minutes=custom_interval_minutes
        )
        
        return {
            "status": "success",
            "pipeline": {
                "id": pipeline.id,
                "name": pipeline.name,
                "frequency": pipeline.frequency
            },
            "message": f"Pipeline created from '{preset_name}' preset"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipelines/{pipeline_id}/run")
async def run_pipeline(pipeline_id: str, incremental: bool = True):
    """Manually trigger a pipeline run"""
    try:
        service = get_pipeline_service()
        stats = await service.run_pipeline(pipeline_id, incremental=incremental)
        
        return {
            "status": "success",
            "stats": stats,
            "message": f"Pipeline completed: +{stats['added']} added, ~{stats['updated']} updated, -{stats['deleted']} deleted"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/pipelines/{pipeline_id}")
async def update_pipeline(pipeline_id: str, enabled: bool = Form(...)):
    """Enable or disable a pipeline"""
    service = get_pipeline_service()
    if service.toggle_pipeline(pipeline_id, enabled):
        return {"status": "success", "message": f"Pipeline {'enabled' if enabled else 'disabled'}"}
    raise HTTPException(status_code=404, detail="Pipeline not found")


@app.delete("/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str):
    """Delete a pipeline"""
    service = get_pipeline_service()
    if service.delete_pipeline(pipeline_id):
        return {"status": "success", "message": "Pipeline deleted"}
    raise HTTPException(status_code=404, detail="Pipeline not found")


# =============================================================================
# Document Management Endpoints
# =============================================================================

@app.get("/documents/list")
async def list_documents(limit: int = 100):
    """List all indexed document sources with chunk counts"""
    vector_store = get_vector_store()
    documents = vector_store.list_documents(limit=limit)
    return {
        "documents": documents,
        "total_sources": len(documents),
        "total_chunks": sum(d["chunk_count"] for d in documents)
    }


@app.delete("/documents/source")
async def delete_document_source(source: str):
    """Delete all chunks from a specific source"""
    vector_store = get_vector_store()
    deleted_count = vector_store.delete_by_source(source)
    if deleted_count > 0:
        return {
            "status": "success",
            "message": f"Deleted {deleted_count} chunks from '{source}'"
        }
    return {
        "status": "warning",
        "message": f"No documents found with source '{source}'"
    }


# =============================================================================
# Feedback/Analytics Endpoints
# =============================================================================

# In-memory feedback storage (in production, use a database)
_feedback_store = []

@app.post("/feedback")
async def submit_feedback(
    message_id: str = Form(None),
    query: str = Form(...),
    response: str = Form(...),
    rating: int = Form(...),  # 1 = thumbs down, 2 = thumbs up
    comment: str = Form(None)
):
    """Submit feedback on a response"""
    from datetime import datetime
    
    feedback = {
        "id": f"fb-{len(_feedback_store)+1}",
        "message_id": message_id,
        "query": query,
        "response": response[:500],  # Truncate for storage
        "rating": rating,
        "comment": comment,
        "timestamp": datetime.now().isoformat()
    }
    _feedback_store.append(feedback)
    
    # Also save to file for persistence
    feedback_file = os.path.join(settings.chroma_persist_directory, "feedback.json")
    try:
        existing = []
        if os.path.exists(feedback_file):
            with open(feedback_file, 'r') as f:
                existing = json.load(f)
        existing.append(feedback)
        with open(feedback_file, 'w') as f:
            json.dump(existing, f, indent=2)
    except Exception as e:
        print(f"Failed to save feedback: {e}")
    
    return {"status": "success", "message": "Feedback recorded"}


@app.get("/feedback")
async def get_feedback(limit: int = 100):
    """Get recent feedback"""
    feedback_file = os.path.join(settings.chroma_persist_directory, "feedback.json")
    try:
        if os.path.exists(feedback_file):
            with open(feedback_file, 'r') as f:
                feedback = json.load(f)
            return {
                "feedback": feedback[-limit:],
                "total": len(feedback),
                "positive": sum(1 for f in feedback if f.get("rating") == 2),
                "negative": sum(1 for f in feedback if f.get("rating") == 1)
            }
    except Exception:
        pass
    return {"feedback": [], "total": 0, "positive": 0, "negative": 0}


@app.get("/analytics")
async def get_analytics():
    """Get usage analytics"""
    from datetime import datetime
    
    vector_store = get_vector_store()
    pipeline_service = get_pipeline_service()
    
    # Get feedback stats
    feedback_file = os.path.join(settings.chroma_persist_directory, "feedback.json")
    feedback_stats = {"total": 0, "positive": 0, "negative": 0}
    try:
        if os.path.exists(feedback_file):
            with open(feedback_file, 'r') as f:
                feedback = json.load(f)
            feedback_stats = {
                "total": len(feedback),
                "positive": sum(1 for f in feedback if f.get("rating") == 2),
                "negative": sum(1 for f in feedback if f.get("rating") == 1)
            }
    except Exception:
        pass
    
    # Get document stats
    doc_count = vector_store.get_document_count()
    documents = vector_store.list_documents(limit=1000)
    
    return {
        "timestamp": datetime.now().isoformat(),
        "documents": {
            "total_chunks": doc_count,
            "total_sources": len(documents),
            "by_type": {}
        },
        "feedback": feedback_stats,
        "pipelines": {
            "total": len(pipeline_service.list_pipelines()),
            "active": sum(1 for p in pipeline_service.list_pipelines() if p.enabled)
        }
    }


@app.post("/pipelines/scheduler/start")
async def start_scheduler():
    """Start the background pipeline scheduler"""
    service = get_pipeline_service()
    service.start_scheduler()
    return {"status": "success", "message": "Scheduler started"}


@app.post("/pipelines/scheduler/stop")
async def stop_scheduler():
    """Stop the background pipeline scheduler"""
    service = get_pipeline_service()
    service.stop_scheduler()
    return {"status": "success", "message": "Scheduler stopped"}


@app.get("/pipelines/frequencies")
async def get_frequencies():
    """Get available pipeline frequencies"""
    return {
        "frequencies": [
            {"value": "once", "label": "One-time", "description": "Run once and don't repeat"},
            {"value": "hourly", "label": "Hourly", "description": "Run every hour"},
            {"value": "daily", "label": "Daily", "description": "Run every 24 hours"},
            {"value": "weekly", "label": "Weekly", "description": "Run every 7 days"},
            {"value": "custom", "label": "Custom", "description": "Set custom interval in minutes"},
        ]
    }


@app.get("/ollama/status")
async def ollama_status():
    llm_service = get_llm_service()
    return llm_service.check_ollama_status()


@app.post("/ollama/pull")
async def pull_model(model: str = None):
    llm_service = get_llm_service()
    return llm_service.pull_model(model)


@app.get("/persona")
async def get_persona():
    """Get the current assistant persona configuration"""
    llm_service = get_llm_service()
    return llm_service.get_persona()


@app.post("/persona")
async def set_persona(name: str = Form(...), prompt: str = Form(...)):
    """Set a custom assistant persona"""
    llm_service = get_llm_service()
    return llm_service.set_persona(prompt, name)


@app.post("/persona/reset")
async def reset_persona():
    """Reset persona to the default Isovalent expert"""
    llm_service = get_llm_service()
    return llm_service.reset_persona()


@app.post("/ingest/files", response_model=IngestResponse)
async def ingest_files(files: List[UploadFile] = File(...)):
    """Upload and ingest multiple files (markdown, text, html, pdf, docx)"""
    import tempfile
    try:
        loader = DocumentLoader()
        vector_store = get_vector_store()
        
        total_docs = 0
        processed_files = []
        
        for file in files:
            content = await file.read()
            ext = os.path.splitext(file.filename)[1].lower()
            
            # Handle binary files (PDF, DOCX) differently
            if ext in ['.pdf', '.docx']:
                # Save to temp file and use loader
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                
                try:
                    if ext == '.pdf':
                        doc = loader.load_pdf_file(tmp_path)
                    else:
                        doc = loader.load_docx_file(tmp_path)
                    
                    # Update source to original filename
                    doc.metadata['source'] = file.filename
                    doc.metadata['filename'] = file.filename
                    
                    if doc.page_content:
                        count = vector_store.add_documents([doc])
                        total_docs += count
                        processed_files.append(file.filename)
                finally:
                    os.unlink(tmp_path)
            else:
                # Handle text-based files
                try:
                    text_content = content.decode('utf-8')
                except UnicodeDecodeError:
                    text_content = content.decode('latin-1')
                
                doc_type = 'markdown' if ext == '.md' else 'html' if ext == '.html' else 'text'
                
                from langchain_core.documents import Document
                doc = Document(
                    page_content=text_content,
                    metadata={
                        'source': file.filename,
                        'type': doc_type,
                        'filename': file.filename
                    }
                )
                
                count = vector_store.add_documents([doc])
                total_docs += count
                processed_files.append(file.filename)
        
        return IngestResponse(
            status="success",
            documents_processed=total_docs,
            message=f"Successfully ingested {total_docs} chunks from {len(processed_files)} file(s): {', '.join(processed_files)}"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/text", response_model=IngestResponse)
async def ingest_text(
    content: str = Form(...),
    source_name: str = Form("manual_input"),
    doc_type: str = Form("text")
):
    """Ingest raw text content directly"""
    try:
        vector_store = get_vector_store()
        
        from langchain_core.documents import Document
        doc = Document(
            page_content=content,
            metadata={
                'source': source_name,
                'type': doc_type
            }
        )
        
        count = vector_store.add_documents([doc])
        
        return IngestResponse(
            status="success",
            documents_processed=count,
            message=f"Successfully ingested {count} chunks from '{source_name}'"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ingest/status")
async def get_ingestion_status():
    """Get current ingestion status and statistics"""
    vector_store = get_vector_store()
    doc_count = vector_store.get_document_count()
    
    return {
        "status": "ready",
        "documents_indexed": doc_count,
        "vector_store": "chromadb",
        "embedding_model": get_settings().embedding_model
    }


# ============== Setup Wizard Endpoints ==============

@app.get("/setup/status", response_model=SetupStatus)
async def get_setup_status():
    """Get current setup status for the wizard"""
    setup_service = get_setup_service()
    return await setup_service.get_full_status()


@app.post("/setup/pull-model")
async def setup_pull_model(background_tasks: BackgroundTasks, model: str = None):
    """Pull the LLM model (runs in background)"""
    setup_service = get_setup_service()
    
    # Check if already pulling
    progress = setup_service.get_pull_progress()
    if progress['pulling']:
        return {"status": "already_pulling", "progress": progress['progress']}
    
    # Start pull in background
    background_tasks.add_task(setup_service.pull_model, model)
    return {"status": "started", "model": model or get_settings().ollama_model}


@app.get("/setup/pull-progress")
async def get_pull_progress():
    """Get model pull progress"""
    setup_service = get_setup_service()
    return setup_service.get_pull_progress()


@app.post("/setup/complete")
async def mark_setup_complete():
    """Mark setup as complete"""
    setup_service = get_setup_service()
    setup_service.mark_setup_complete()
    return {"status": "success"}


@app.post("/setup/load-sample-data")
async def load_sample_data():
    """Load the included sample data"""
    try:
        loader = DocumentLoader()
        vector_store = get_vector_store()
        
        # Try multiple possible paths for sample data
        possible_paths = [
            "./sample-data",
            "../sample-data",
            "/app/sample-data",
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                documents = loader.load_directory(path)
                if documents:
                    count = vector_store.add_documents(documents)
                    return {
                        "status": "success",
                        "documents_processed": count,
                        "message": f"Loaded {count} document chunks from sample data"
                    }
        
        return {
            "status": "error",
            "message": "Sample data directory not found"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# =============================================================================
# Settings Endpoints
# =============================================================================

@app.get("/settings")
async def get_settings():
    """Get current application settings"""
    return {
        "ollama_model": settings.ollama_model,
        "ollama_base_url": settings.ollama_base_url,
        "embedding_model": settings.embedding_model,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "top_k": settings.top_k_results
    }


@app.post("/settings")
async def update_settings(
    ollama_model: str = None,
    chunk_size: int = None,
    chunk_overlap: int = None,
    top_k: int = None
):
    """Update application settings (requires restart for some changes)"""
    # Note: In a production app, you'd persist these to a config file
    # For now, we update the in-memory settings
    updated = {}
    
    if ollama_model:
        settings.ollama_model = ollama_model
        updated["ollama_model"] = ollama_model
    if chunk_size:
        settings.chunk_size = chunk_size
        updated["chunk_size"] = chunk_size
    if chunk_overlap is not None:
        settings.chunk_overlap = chunk_overlap
        updated["chunk_overlap"] = chunk_overlap
    if top_k:
        settings.top_k_results = top_k
        updated["top_k"] = top_k
    
    return {"status": "success", "updated": updated}


@app.get("/ollama/models")
async def list_ollama_models():
    """List available Ollama models"""
    llm_service = get_llm_service()
    status = llm_service.check_ollama_status()
    return {
        "models": status.get("models", []),
        "current_model": settings.ollama_model
    }


@app.post("/ollama/pull")
async def pull_ollama_model(model: str):
    """Pull/download a new Ollama model"""
    try:
        import ollama
        ollama.pull(model)
        return {"status": "success", "message": f"Model {model} pulled successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Export/Import Endpoints
# =============================================================================

@app.get("/export/data")
async def export_data():
    """Export all application data (vector store, persona, pipelines) as a downloadable JSON file"""
    import json
    from datetime import datetime
    from fastapi.responses import Response
    
    vector_store = get_vector_store()
    llm_service = get_llm_service()
    pipeline_service = get_pipeline_service()
    
    # Get all documents from vector store
    try:
        collection = vector_store.chroma_client.get_collection(vector_store.settings.chroma_collection_name)
        print(f"[Export] Getting documents from collection: {collection.name}")
        all_data = collection.get(include=["documents", "metadatas", "embeddings"])
        print(f"[Export] Retrieved {len(all_data.get('ids', []))} document chunks")
        
        documents_export = []
        for i in range(len(all_data.get('ids', []))):
            doc = {
                "id": all_data['ids'][i],
                "content": all_data['documents'][i] if all_data.get('documents') else None,
                "metadata": all_data['metadatas'][i] if all_data.get('metadatas') else {},
                "embedding": all_data['embeddings'][i] if all_data.get('embeddings') else None
            }
            documents_export.append(doc)
        print(f"[Export] Prepared {len(documents_export)} documents for export")
    except Exception as e:
        print(f"[Export] Error getting documents: {e}")
        import traceback
        traceback.print_exc()
        documents_export = []
    
    # Get persona config
    persona = llm_service.get_persona()
    
    # Get pipelines
    pipelines = pipeline_service.list_pipelines()
    pipelines_export = [
        {
            "id": p.id,
            "name": p.name,
            "source_type": p.source_type,
            "source_config": p.source_config,
            "frequency": p.frequency.value,
            "enabled": p.enabled
        }
        for p in pipelines
    ]
    
    export_data = {
        "export_version": "1.0",
        "exported_at": datetime.now().isoformat(),
        "persona": persona,
        "pipelines": pipelines_export,
        "documents": documents_export,
        "document_count": len(documents_export)
    }
    
    # Return as downloadable JSON file
    json_str = json.dumps(export_data, indent=2)
    filename = f"rag-assistant-export-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    
    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@app.post("/import/data")
async def import_data(file: UploadFile = File(...), merge: bool = Form(False)):
    """Import application data from an exported JSON file
    
    Args:
        file: The exported JSON file
        merge: If True, merge with existing data. If False, replace all data.
    """
    import json
    
    vector_store = get_vector_store()
    llm_service = get_llm_service()
    pipeline_service = get_pipeline_service()
    
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        
        if data.get('export_version') != '1.0':
            return {"status": "error", "message": "Unsupported export version"}
        
        results = {
            "persona_imported": False,
            "pipelines_imported": 0,
            "documents_imported": 0
        }
        
        # Import persona
        if data.get('persona'):
            llm_service.set_persona(
                name=data['persona'].get('name', 'Imported Persona'),
                prompt=data['persona'].get('prompt', '')
            )
            results["persona_imported"] = True
        
        # Import pipelines
        if data.get('pipelines'):
            for p in data['pipelines']:
                try:
                    pipeline_service.create_pipeline(
                        name=p.get('name', 'Imported Pipeline'),
                        source_type=p.get('source_type', 'url'),
                        source_config=p.get('source_config', {}),
                        frequency=p.get('frequency', 'once')
                    )
                    results["pipelines_imported"] += 1
                except Exception:
                    pass  # Skip duplicate or invalid pipelines
        
        # Import documents
        if data.get('documents'):
            if not merge:
                # Clear existing documents first
                try:
                    vector_store.clear()
                except Exception:
                    pass
            
            # Add documents with embeddings
            docs_with_embeddings = [d for d in data['documents'] if d.get('embedding')]
            
            if docs_with_embeddings:
                ids = [d['id'] for d in docs_with_embeddings]
                documents = [d['content'] for d in docs_with_embeddings]
                metadatas = [d['metadata'] for d in docs_with_embeddings]
                embeddings = [d['embedding'] for d in docs_with_embeddings]
                
                try:
                    collection = vector_store.chroma_collection
                    collection.add(
                        ids=ids,
                        documents=documents,
                        metadatas=metadatas,
                        embeddings=embeddings
                    )
                    results["documents_imported"] = len(docs_with_embeddings)
                except Exception as e:
                    return {"status": "error", "message": f"Failed to import documents: {str(e)}"}
        
        return {
            "status": "success",
            "message": f"Import complete: {results['documents_imported']} documents, {results['pipelines_imported']} pipelines, persona: {'yes' if results['persona_imported'] else 'no'}",
            "results": results
        }
        
    except json.JSONDecodeError:
        return {"status": "error", "message": "Invalid JSON file"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
