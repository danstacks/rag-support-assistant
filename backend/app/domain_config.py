"""
Domain Configuration Loader

Loads domain-specific settings (scrape presets, prompts, branding) from a YAML
file so the RAG assistant can be pointed at any documentation set without
changing code.
"""

import os
import yaml
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from functools import lru_cache


@dataclass
class ScrapePresetConfig:
    """One scrape-preset entry from the YAML file."""
    url: str
    description: str = ""
    recursive: bool = True
    max_depth: int = 3
    max_pages: int = 500
    allowed_domains: List[str] = field(default_factory=list)
    url_patterns: List[str] = field(default_factory=list)
    exclude_patterns: List[str] = field(default_factory=list)
    rate_limit: float = 0.5
    platform: str = "auto"


@dataclass
class LocalDirectoryConfig:
    """A local directory to ingest during bulk loading."""
    path: str
    description: str = ""
    extensions: List[str] = field(default_factory=lambda: [".md", ".txt", ".rst", ".html"])


@dataclass
class DomainConfig:
    """Top-level domain configuration parsed from YAML."""
    name: str = "RAG Assistant"
    collection_name: str = "rag_docs"
    prompt_context_intro: str = "Based on the following context from the documentation"
    default_persona_name: str = "RAG Assistant"
    default_persona_prompt: str = ""
    sample_data_dir: str = "./sample-data"
    scrape_presets: Dict[str, ScrapePresetConfig] = field(default_factory=dict)
    bulk_scrape_presets: List[str] = field(default_factory=list)
    local_directories: Dict[str, LocalDirectoryConfig] = field(default_factory=dict)


def _resolve_config_path() -> str:
    """Return the path to the domain YAML config file.

    Resolution order:
      1. ``DOMAIN_CONFIG_PATH`` environment variable
      2. ``domain.yaml`` in the backend working directory
      3. ``../domain.yaml`` (project root when cwd is ``backend/``)
    """
    env_path = os.environ.get("DOMAIN_CONFIG_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path

    candidates = [
        os.path.join(os.getcwd(), "domain.yaml"),
        os.path.join(os.getcwd(), "..", "domain.yaml"),
        os.path.join(os.path.dirname(__file__), "..", "..", "domain.yaml"),
    ]
    for candidate in candidates:
        if os.path.isfile(candidate):
            return os.path.abspath(candidate)

    return ""


def _parse_preset(name: str, raw: Dict[str, Any]) -> ScrapePresetConfig:
    known_fields = {f.name for f in ScrapePresetConfig.__dataclass_fields__.values()}
    filtered = {k: v for k, v in raw.items() if k in known_fields}
    return ScrapePresetConfig(**filtered)


def load_domain_config(path: Optional[str] = None) -> DomainConfig:
    """Load and parse the domain YAML file.

    Returns a default ``DomainConfig`` if no file is found, keeping the
    application fully functional without a YAML config.
    """
    config_path = path or _resolve_config_path()
    if not config_path or not os.path.isfile(config_path):
        print("[DomainConfig] No domain.yaml found – using defaults")
        return DomainConfig()

    with open(config_path, "r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}

    domain_block = raw.get("domain", {})
    prompt_block = raw.get("prompt", {})
    presets_block = raw.get("scrape_presets", {})
    bulk_block = raw.get("bulk_scrape_presets", [])
    local_dirs_block = raw.get("local_directories", {})

    presets: Dict[str, ScrapePresetConfig] = {}
    for preset_name, preset_data in presets_block.items():
        if isinstance(preset_data, dict):
            presets[preset_name] = _parse_preset(preset_name, preset_data)

    local_dirs: Dict[str, LocalDirectoryConfig] = {}
    for dir_name, dir_data in (local_dirs_block or {}).items():
        if isinstance(dir_data, dict):
            expanded_path = os.path.expanduser(dir_data.get("path", ""))
            local_dirs[dir_name] = LocalDirectoryConfig(
                path=expanded_path,
                description=dir_data.get("description", ""),
                extensions=dir_data.get("extensions", [".md", ".txt", ".rst", ".html"]),
            )

    persona_prompt = prompt_block.get("default_persona_prompt", "")
    if not persona_prompt:
        domain_name = domain_block.get("name", "RAG Assistant")
        persona_prompt = (
            f"You are a knowledgeable technical assistant powered by RAG "
            f"(Retrieval-Augmented Generation), specializing in {domain_name}.\n\n"
            "You answer questions based on the documentation and content that has "
            "been indexed in your knowledge base.\n\n"
            "GUIDELINES:\n"
            "1. You ONLY know what is provided in the context below - do not make up information\n"
            "2. If the context doesn't contain enough information to answer, clearly state that "
            "you don't have enough information in your knowledge base to answer accurately\n"
            "3. Include relevant code examples, commands, or configuration snippets when available "
            "in the context\n"
            "4. Be precise and helpful - adapt your technical level to match the question\n"
            "5. Do NOT include inline citations in your response - sources are shown separately\n\n"
            "Context from documentation:\n{context}\n\n"
            "Remember: Only answer based on the provided context. If unsure, say so."
        )

    config = DomainConfig(
        name=domain_block.get("name", "RAG Assistant"),
        collection_name=domain_block.get("collection_name", "rag_docs"),
        prompt_context_intro=prompt_block.get(
            "context_intro",
            "Based on the following context from the documentation",
        ),
        default_persona_name=prompt_block.get("default_persona_name", "RAG Assistant"),
        default_persona_prompt=persona_prompt,
        sample_data_dir=domain_block.get("sample_data_dir", "./sample-data"),
        scrape_presets=presets,
        bulk_scrape_presets=bulk_block if isinstance(bulk_block, list) else [],
        local_directories=local_dirs,
    )

    print(f"[DomainConfig] Loaded domain '{config.name}' with "
          f"{len(config.scrape_presets)} preset(s) from {config_path}")
    return config


@lru_cache(maxsize=1)
def get_domain_config() -> DomainConfig:
    """Singleton accessor – caches on first call."""
    return load_domain_config()


def reload_domain_config() -> DomainConfig:
    """Force-reload from disk (e.g. after editing the YAML)."""
    get_domain_config.cache_clear()
    return get_domain_config()
