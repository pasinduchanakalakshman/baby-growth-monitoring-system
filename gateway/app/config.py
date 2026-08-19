from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    CHILD_GROWTH_MONITORING_URL: str = "http://child-growth-monitoring-service:8000"

    class Config:
        env_file = ".env"

settings = Settings()
