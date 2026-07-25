"""
medidata/mysql_connector.py

Connects to the hospital's local MySQL instance. Read-only by design —
the CLI's DB user should be granted SELECT-only privileges at the MySQL
level; this module never issues INSERT/UPDATE/DELETE.

Password is never stored in state.db. It's resolved from the
MEDIDATA_MYSQL_PASSWORD environment variable (or a `.env` file) at the
start of every run.
"""

from __future__ import annotations

import os

import mysql.connector
from mysql.connector import Error


class MySQLConfig:
    def __init__(self, host: str, port: int, database: str, user: str, password: str):
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password

    def as_connect_kwargs(self) -> dict:
        return {
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "user": self.user,
            "password": self.password,
        }


def resolve_password() -> str:
    password = os.environ.get("MEDIDATA_MYSQL_PASSWORD")
    if not password:
        raise ConnectionError(
            "MEDIDATA_MYSQL_PASSWORD is not set. Export it or put it in a .env "
            "file before running this command — the CLI never stores your "
            "MySQL password on disk."
        )
    return password


def test_connection(cfg: MySQLConfig) -> bool:
    """Opens and immediately closes a connection to verify the config works."""
    try:
        conn = mysql.connector.connect(**cfg.as_connect_kwargs(), connection_timeout=5)
        conn.close()
        return True
    except Error as e:
        raise ConnectionError(f"MySQL connection failed: {e}")


def get_connection(cfg: MySQLConfig):
    """Returns a live connection for callers (map-doctor, sync) to use."""
    try:
        return mysql.connector.connect(**cfg.as_connect_kwargs(), connection_timeout=10)
    except Error as e:
        raise ConnectionError(f"MySQL connection failed: {e}")
