from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str

    class Config:
        env_file = ".env"

settings = Settings()
