# Folder Structure Blueprint

This document defines the target repository structure for the AI-driven child growth monitoring system. It separates runtime applications, research assets, data, documentation, and operational configuration.

## Status Legend

- `[current]` exists in the repository today.
- `[planned]` is reserved for an implementation that is not present yet.
- `[generated]` is produced by code, training, or deployment and should not be committed unless explicitly required.
- `[local]` is machine-specific or secret and must remain untracked.

## Target Repository Tree

```text
Baby-growth-monitoring-system/
|
|-- README.md                                      [current]
|-- docker-compose.yml                             [current]
|-- .env                                           [local]
|-- .gitignore                                     [current]
|
|-- docs/                                          [current]
|   |-- architecture/                              [current]
|   |   |-- folder-structure.md                    [current]
|   |   |-- system-overview.md                     [planned]
|   |   |-- service-boundaries.md                  [planned]
|   |   |-- data-flow.md                            [planned]
|   |   `-- decisions/                              [planned]
|   |       `-- ADR-001-domain-based-services.md    [planned]
|   |-- api/                                       [current]
|   |   |-- gateway-openapi.yaml                   [planned]
|   |   |-- growth-service-openapi.yaml             [planned]
|   |   `-- error-contract.md                       [planned]
|   |-- dataset/                                   [current]
|   |   |-- data-dictionary.md                     [planned]
|   |   |-- CHDR-mapping.md                        [planned]
|   |   `-- privacy-and-ethics.md                  [planned]
|   |-- research/                                  [current]
|   |   |-- problem-definition.md                  [planned]
|   |   |-- methodology.md                         [planned]
|   |   |-- evaluation-protocol.md                 [planned]
|   |   `-- reproducibility.md                     [planned]
|   `-- operations/                                [planned]
|       |-- local-development.md                   [planned]
|       |-- deployment.md                           [planned]
|       `-- observability.md                       [planned]
|
|-- data/                                          [current]
|   |-- raw/                                       [current]
|   |   `-- .gitkeep                               [planned]
|   |-- external/                                  [current]
|   |   `-- WHO Standards/                          [current]
|   |-- interim/                                   [current]
|   |-- processed/                                 [current]
|   |-- features/                                  [current]
|   |-- splits/                                    [current]
|   `-- schemas/                                   [current]
|       |-- chdr.schema.json                       [planned]
|       |-- measurement.schema.json                [planned]
|       `-- prediction.schema.json                 [planned]
|
|-- gateway/                                       [current]
|   |-- Dockerfile                                 [current]
|   |-- requirements.txt                           [current]
|   |-- .dockerignore                              [current]
|   |-- app/
|   |   |-- __init__.py                            [current]
|   |   |-- main.py                                [current]
|   |   |-- config.py                              [current]
|   |   |-- routes/
|   |   |   |-- __init__.py                        [current]
|   |   |   |-- health.py                          [current]
|   |   |   |-- growth.py                          [planned]
|   |   |   |-- nutrition.py                       [planned]
|   |   |   `-- proxy.py                            [planned]
|   |   `-- clients/
|   |       |-- __init__.py                        [planned]
|   |       `-- service_client.py                  [planned]
|   `-- tests/
|       |-- __init__.py                            [current]
|       |-- test_health.py                         [current]
|       `-- test_routes.py                         [planned]
|
|-- services/                                      [current]
|   `-- child-growth-monitoring-service/           [current]
|       |-- Dockerfile                             [current]
|       |-- requirements.txt                       [current]
|       |-- .dockerignore                          [current]
|       |-- app/
|       |   |-- __init__.py                        [current]
|       |   |-- main.py                            [current]
|       |   |-- api/
|       |   |   |-- __init__.py                    [current]
|       |   |   `-- routes/
|       |   |       |-- __init__.py                [current]
|       |   |       |-- health.py                  [current]
|       |   |       |-- growth.py                  [planned]
|       |   |       |-- nutrition.py               [planned]
|       |   |       `-- explainability.py          [planned]
|       |   |-- core/
|       |   |   |-- __init__.py                    [current]
|       |   |   |-- config.py                      [current]
|       |   |   |-- database.py                    [current]
|       |   |   |-- logging.py                     [planned]
|       |   |   `-- security.py                    [planned]
|       |   |-- models/                            [current]
|       |   |   |-- __init__.py                    [current]
|       |   |   |-- child.py                       [planned]
|       |   |   |-- measurement.py                 [planned]
|       |   |   `-- prediction.py                  [planned]
|       |   |-- schemas/                           [current]
|       |   |   |-- __init__.py                    [current]
|       |   |   |-- child.py                       [planned]
|       |   |   |-- measurement.py                 [planned]
|       |   |   |-- prediction.py                  [planned]
|       |   |   `-- nutrition.py                   [planned]
|       |   |-- services/                          [current]
|       |   |   |-- __init__.py                    [current]
|       |   |   |-- growth_service.py              [planned]
|       |   |   |-- nutrition_service.py           [planned]
|       |   |   `-- xai_service.py                 [planned]
|       |   |-- repositories/                      [planned]
|       |   |   |-- child_repository.py            [planned]
|       |   |   |-- measurement_repository.py      [planned]
|       |   |   `-- prediction_repository.py       [planned]
|       |   `-- utils/                             [current]
|       |       |-- __init__.py                    [current]
|       |       |-- validators.py                  [planned]
|       |       `-- dates.py                       [planned]
|       |-- ml/
|       |   |-- features/                          [current]
|       |   |   |-- definitions.py                 [planned]
|       |   |   `-- build_features.py              [planned]
|       |   |-- preprocessing/                     [current]
|       |   |   |-- cleaning.py                    [planned]
|       |   |   |-- normalization.py               [planned]
|       |   |   `-- pipeline.py                    [planned]
|       |   |-- sequences/                         [current]
|       |   |   |-- builder.py                     [planned]
|       |   |   `-- masking.py                     [planned]
|       |   |-- training/                          [current]
|       |   |   |-- train_gru.py                   [planned]
|       |   |   |-- train_lstm.py                  [planned]
|       |   |   `-- train_transformer.py           [planned]
|       |   |-- inference/                         [current]
|       |   |   |-- predictor.py                   [planned]
|       |   |   `-- model_loader.py                [planned]
|       |   |-- registry/                          [current]
|       |   |   |-- model_registry.py              [planned]
|       |   |   `-- metadata/                      [planned]
|       |   |       `-- .gitkeep                   [planned]
|       |   `-- models/                            [current]
|       |       |-- gru/                           [current]
|       |       |-- lstm/                          [current]
|       |       `-- transformer/                   [current]
|       |-- nutrition/                             [current]
|       |   |-- knowledge/                         [planned]
|       |   |-- rules/                             [planned]
|       |   |-- recommendation_engine.py           [planned]
|       |   `-- localization.py                    [planned]
|       |-- xai/                                   [current]
|       |   |-- explainers/                        [planned]
|       |   |-- feature_importance.py              [planned]
|       |   `-- report_builder.py                  [planned]
|       `-- tests/                                 [current]
|           |-- __init__.py                        [current]
|           |-- test_config.py                     [current]
|           |-- test_health.py                     [current]
|           |-- api/                               [planned]
|           |-- services/                          [planned]
|           |-- ml/                                [planned]
|           |-- nutrition/                         [planned]
|           `-- xai/                               [planned]
|
|-- research/                                      [current]
|   |-- notebooks/                                 [current]
|   |-- scripts/                                   [current]
|   |   |-- ingest_data.py                         [planned]
|   |   |-- prepare_dataset.py                     [planned]
|   |   |-- train_models.py                        [planned]
|   |   `-- evaluate_models.py                     [planned]
|   |-- experiments/                               [current]
|   |   |-- configs/                               [planned]
|   |   |-- runs/                                  [generated]
|   |   `-- reports/                               [generated]
|   `-- evaluation/                                [current]
|       |-- metrics.py                             [planned]
|       |-- baselines.py                           [planned]
|       `-- results/                               [generated]
|
|-- frontend/                                      [current: reserved]
|   |-- package.json                               [planned]
|   |-- src/                                       [planned]
|   |   |-- app/                                   [planned]
|   |   |-- components/                            [planned]
|   |   |-- features/                              [planned]
|   |   |-- services/                              [planned]
|   |   `-- types/                                 [planned]
|   `-- tests/                                     [planned]
|
`-- .github/                                      [planned]
    `-- workflows/                                [planned]
        |-- ci.yml                                [planned]
        `-- data-validation.yml                   [planned]
```

## Ownership Rules

### Runtime applications

- `gateway/` owns the public HTTP boundary, request routing, authentication, rate limiting, and service-to-service clients.
- `services/child-growth-monitoring-service/` owns growth prediction, nutrition recommendations, explainability, persistence, and model inference.
- `frontend/` owns the user interface only. It must call the gateway and must not connect directly to internal services or databases.

### Data and machine learning

- `data/raw/` is immutable source data. Never overwrite it during preprocessing.
- `data/interim/` contains temporary cleaning and transformation outputs.
- `data/processed/` contains validated, analysis-ready datasets.
- `data/features/` contains model-ready feature tables or serialized feature artifacts.
- `data/splits/` contains reproducible train, validation, and test split definitions.
- `data/external/` contains third-party references such as WHO growth standards.
- Model binaries and large generated artifacts should use an artifact store or Git LFS; do not commit them to normal source control.
- `research/notebooks/` is for exploration. Reusable logic belongs in `ml/`, `nutrition/`, `xai/`, or `research/scripts/`.

### Contracts and boundaries

- `app/schemas/` defines API and persistence validation models for the service.
- `data/schemas/` defines file-level dataset contracts and should be versioned with the dataset pipeline.
- API changes require an update to the relevant OpenAPI document and route tests.
- Internal ML code must not import FastAPI route modules. Routes call application services; application services call repositories and ML components.

## Runtime Flow

```text
Frontend
   |
   v
API Gateway :8000
   |
   v
Child Growth Monitoring Service :8001
   |             |              |
   v             v              v
Database     ML Inference   Nutrition/XAI
```

The local deployment is defined by `docker-compose.yml`. The gateway is exposed on port `8000`, the child-growth service on port `8001`, and both containers communicate over the `app-network` Docker network.

## Naming and Hygiene

- Use lowercase `snake_case` for Python modules and directories.
- Keep tests under the component they verify and name them `test_<behavior>.py`.
- Keep secrets in `.env` or a secret manager; commit only a documented `.env.example`.
- Do not commit `__pycache__/`, `.pytest_cache/`, local databases, raw personally identifiable data, model checkpoints, experiment runs, or generated reports.
- Every new top-level directory should have a clear owner and a short README when its purpose is not obvious.

## Recommended Implementation Order

1. Define versioned dataset contracts under `data/schemas/` and document the CHDR mapping.
2. Implement ingestion, cleaning, feature construction, and deterministic data splits under `research/scripts/` and the service ML package.
3. Add model training, registry metadata, and inference interfaces for GRU, LSTM, and Transformer models.
4. Implement service schemas, repositories, application services, and API routes.
5. Add nutrition recommendation and explainability components behind service interfaces.
6. Publish gateway contracts, add frontend integration, and complete end-to-end tests.
7. Add CI, deployment, monitoring, and reproducibility documentation.
