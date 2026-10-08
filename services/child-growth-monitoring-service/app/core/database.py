from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError
from app.core.config import settings

# Automatically fix the URL if the user forgot to change postgresql:// to postgresql+psycopg://
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Supabase's transaction pooler string often includes `?pgbouncer=true` for Prisma.
# Psycopg (libpq) does not recognize this parameter and will throw an error. We must strip it.
database_url = database_url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")

engine_kwargs = {}
if not database_url.startswith("sqlite"):
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

# Create database engine
engine = create_engine(
    database_url,
    pool_pre_ping=True,  # Enable connection health checks
    **engine_kwargs
)

# Create SessionLocal class for database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for SQLAlchemy models
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_db_connection() -> bool:
    """Verify database connectivity."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except OperationalError:
        return False
