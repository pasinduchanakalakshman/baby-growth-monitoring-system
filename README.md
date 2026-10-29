# Multi-Modal AI System for Early Childhood Health Monitoring and Development Assessment


## Research Component
Explainable Sequence-Aware AI Framework for Early Prediction of Child Growth Faltering and Personalized Sri Lankan Nutrition Recommendations  

---

## Key Features

- **Longitudinal Growth Tracking:** Tracks weight, height, and age-based z-scores (WAZ, HAZ, WHZ) aligned with WHO and Sri Lankan CHDR standards.
- **Early Risk Prediction:** 180-day growth faltering risk assessment powered by machine learning (XGBoost baseline & sequence-aware models).
- **Explainable AI (XAI):** Integrated SHAP explanations offering both clinical factor breakdowns and mother-friendly growth insights.
- **Personalized Nutrition Guidance:** Culturally adapted Sri Lankan dietary and complementary feeding recommendations based on growth trends.
- **Role-Based Access & Onboarding:** Secure parent/caregiver authentication, child profile management, and measurement history.

---

## System Architecture

The project is structured as a domain-driven microservices architecture:

- **`frontend/`**: Interactive dashboard built with React 19, TypeScript, Vite, Tailwind CSS, and Recharts.
- **`gateway/`**: FastAPI API Gateway handling centralized request routing, CORS, and reverse-proxying.
- **`services/child-growth-monitoring-service/`**: Core FastAPI backend handling data persistence, ML inference pipelines, XAI generation, and nutrition rule engine.
- **`research-environment/`**: Dedicated environment for model experimentation, dataset cleaning, and training pipelines.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts, Lucide Icons |
| **Backend & Gateway** | Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL, Alembic |
| **Machine Learning & XAI** | XGBoost, Scikit-learn, SHAP, CatBoost, TensorFlow |
| **Containerization & Testing** | Docker, Docker Compose, Pytest, Vitest |

---

## Quick Start

### 1. Run with Docker Compose
```bash
docker-compose up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **API Gateway:** [http://localhost:8000](http://localhost:8000)
- **Child Growth Service:** [http://localhost:8001](http://localhost:8001)

### 2. Run Tests
Execute the cross-platform unit test runner:
```powershell
.\run-unit-tests.ps1 all
```
Supported test suites: `growth`, `validation`, `backend`, `ml`, `frontend`, `auth`, `all`, `coverage`.

---
