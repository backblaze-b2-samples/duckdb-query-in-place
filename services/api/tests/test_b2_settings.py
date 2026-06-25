from app.config import B2_USER_AGENT
from app.config.settings import Settings
from main import REQUIRED_B2_SETTINGS


def test_b2_s3_url_is_derived_from_region():
    settings = Settings(b2_region="region-test-001")
    assert settings.b2_s3_url == "https://s3.region-test-001.backblazeb2.com"


def test_standardized_b2_env_names():
    required_env_names = {env_name for _, env_name in REQUIRED_B2_SETTINGS}
    assert required_env_names == {
        "B2_APPLICATION_KEY_ID",
        "B2_APPLICATION_KEY",
        "B2_BUCKET_NAME",
        "B2_REGION",
    }


def test_public_url_base_uses_standardized_env(monkeypatch):
    monkeypatch.setenv("B2_PUBLIC_URL_BASE", "https://cdn.example.com")
    assert Settings().b2_public_url_base == "https://cdn.example.com"


def test_b2_user_agent_identifies_samples_repo():
    assert "b2ai-duckdb-query-in-place" in B2_USER_AGENT
    assert "(backblaze-b2-samples)" in B2_USER_AGENT
