from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.routes import health, baby, growth, auth, nutrition
from app.core.database import engine, Base
import app.models.user
import app.models.baby
import app.models.growth_measurement
import app.models.nutrition

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Growth & Nutrition Service", lifespan=lifespan)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(baby.router)
app.include_router(growth.router)
app.include_router(nutrition.router)
