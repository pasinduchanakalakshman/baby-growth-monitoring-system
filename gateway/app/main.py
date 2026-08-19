from fastapi import FastAPI
from app.routes import health

app = FastAPI(title="API Gateway")

app.include_router(health.router)
