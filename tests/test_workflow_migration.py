import os
import sqlite3
import subprocess
import sys
from pathlib import Path


def test_fresh_sqlite_migrations_include_builder(tmp_path):
    path = tmp_path / "migration.db"
    env = {**os.environ, "DATABASE_URL": f"sqlite+aiosqlite:///{path}"}
    result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=Path(__file__).resolve().parents[1], env=env, check=False, capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    with sqlite3.connect(path) as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"agent_definitions", "workflows", "workflow_runs"} <= tables
