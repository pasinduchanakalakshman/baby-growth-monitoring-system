from fastapi import FastAPI
from app.api.routes import health, baby, growth, auth

app = FastAPI(title="Growth & Nutrition Service")

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(baby.router)
app.include_router(growth.router)
