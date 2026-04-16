# RAG Support Assistant — Domain Configuration Refactor

## What Changed

The RAG Support Assistant was originally hardcoded for Cilium/Isovalent documentation. We refactored it to be **domain-agnostic**, driven by a single `domain.yaml` configuration file. Switching the assistant to support a different technology (SONiC, Kubernetes, Terraform, etc.) now requires only swapping a YAML file — no code changes.

## Architecture

```
domain.yaml                  ← Active config (gitignored, your local choice)
domains/
  cilium.yaml                ← Example: original Cilium setup
  sonic.yaml                 ← Example: SONiC networking
backend/app/
  domain_config.py           ← YAML loader with DomainConfig dataclass
  document_loader.py         ← Scrape presets now loaded from YAML
  llm_service.py             ← Prompt template and persona from YAML
  config.py                  ← Collection name defaults from YAML
  main.py                    ← /domain API, /ingest/bulk-docs, dynamic presets
  pipeline_service.py        ← Uses get_scrape_presets() instead of hardcoded dict
```

## How the YAML Config Works

The `domain.yaml` file controls:

- **`domain.name`** — Display name (e.g. "SONiC"), used in API responses and UI
- **`domain.collection_name`** — ChromaDB collection name for vector storage
- **`prompt.context_intro`** — Opening line of the RAG query prompt
- **`prompt.default_persona_prompt`** — Full system prompt with `{context}` placeholder
- **`scrape_presets`** — Named scrape configurations (URL, depth, domains, platform)
- **`bulk_scrape_presets`** — List of preset names to scrape together via `/ingest/bulk-docs`

Resolution order for the config file:
1. `DOMAIN_CONFIG_PATH` environment variable
2. `domain.yaml` in the working directory
3. `domain.yaml` in the project root

## Switching Domains

```bash
# Switch to Cilium
cp domains/cilium.yaml domain.yaml

# Switch to SONiC
cp domains/sonic.yaml domain.yaml

# Restart the backend to pick up changes
```

## Key API Endpoints

- `GET /domain` — Returns active domain name, presets, and collection info
- `GET /ingest/presets` — Lists available scrape presets from YAML
- `POST /ingest/bulk-docs` — Scrapes all presets in `bulk_scrape_presets`
- `POST /ingest/preset/{name}` — Scrapes a single named preset

## Branch

This work was done on the `brmc-dev` branch.
