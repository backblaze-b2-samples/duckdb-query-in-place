import re

from pydantic import field_validator
from pydantic_settings import BaseSettings

B2_USER_AGENT = "b2ai-duckdb-query-in-place (backblaze-b2-samples)"
B2_REGION_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d{3}$")


class Settings(BaseSettings):
    b2_region: str = ""
    b2_application_key_id: str = ""
    b2_application_key: str = ""
    b2_bucket_name: str = ""
    b2_public_url_base: str = ""

    api_port: int = 8000
    # Explicit allowlist by default — covers Next on :3000 and the
    # fallback :3001 it picks if 3000 is busy. Production deploys should
    # override with the exact frontend origin.
    api_cors_origins: str = "http://localhost:3000,http://localhost:3001"
    # Optional dev-only escape hatch: a regex that matches additional
    # allowed origins. Empty by default — set this to e.g.
    # `^http://localhost:\d+$` to accept any localhost port without
    # listing each one. NEVER ship this to production.
    api_cors_origin_regex: str = ""

    # Upload limits
    max_file_size: int = 100 * 1024 * 1024  # 100MB

    # Small durable counters (downloads, etc). Point at a persistent
    # volume in production if you care about surviving restarts.
    download_count_file: str = "data/download_count.json"

    # Durable catalog of materialized queries (SQL + result pointer +
    # timestamp). Same atomic-write pattern as the download counter.
    query_history_file: str = "data/query_history.json"

    # Result-preview cap: how many rows a SQL query returns to the browser
    # before being truncated. Materialize writes the full result to B2.
    max_query_rows: int = 1000

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @field_validator("b2_region")
    @classmethod
    def validate_b2_region(cls, value: str) -> str:
        if value == "":
            return value
        if not B2_REGION_PATTERN.fullmatch(value):
            raise ValueError(
                "B2_REGION must be a Backblaze region token like "
                "us" "-west-" "004"
            )
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",")]

    @property
    def b2_s3_url(self) -> str:
        if not self.b2_region:
            return ""
        return f"https://s3.{self.b2_region}.backblazeb2.com"


settings = Settings()
