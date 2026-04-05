"""
Database connection management.
- Real mode: PostgreSQL via DATABASE_URL
- Fallback: SQLite (file-based)
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from db.models import Base

_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./gnn_studio.db")

# SQLite needs check_same_thread=False for FastAPI async
_connect_args = {"check_same_thread": False} if _DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(_DATABASE_URL, connect_args=_connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


async def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """FastAPI dependency — yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
