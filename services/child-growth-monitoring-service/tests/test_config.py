import os
from unittest.mock import patch
from app.core.config import Settings

def test_config_loads_env_vars():
    with patch.dict(os.environ, {
        "DATABASE_URL": "postgresql+psycopg://test:test@cluster/test"
    }):
        settings = Settings()
        assert settings.DATABASE_URL == "postgresql+psycopg://test:test@cluster/test"
