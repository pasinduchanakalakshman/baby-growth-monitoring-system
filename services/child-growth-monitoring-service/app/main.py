from fastapi import FastAPI
from app.api.routes import health
from app.core.database import engine, Base

# In a real app we might handle table creation using Alembic, 
# but for now we'll just let SQLAlchemy create tables on startup if needed (or do nothing if no models yet).
# Base.metadata.create_all(bind=engine)

app = FastAPI(title="Growth & Nutrition Service")

app.include_router(health.router)
