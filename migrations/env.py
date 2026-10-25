import os, sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.infrastructure.database import Base
import app.infrastructure.models  # noqa: F401  (registers all models)
config = context.config
if config.config_file_name is not None:
    try: fileConfig(config.config_file_name)
    except Exception: pass
db_url = os.getenv("DATABASE_URL", "")
if db_url.startswith("postgresql://"): db_url = "postgresql+psycopg://" + db_url[len("postgresql://"):]
if db_url: config.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))
target_metadata = Base.metadata
def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction(): context.run_migrations()
def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction(): context.run_migrations()
if context.is_offline_mode(): run_migrations_offline()
else: run_migrations_online()
