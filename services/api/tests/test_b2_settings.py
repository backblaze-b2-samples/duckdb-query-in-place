import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import B2_USER_AGENT
from app.config.b2_contract import REQUIRED_B2_SETTINGS
from app.config.settings import Settings

REPO_ROOT = Path(__file__).resolve().parents[3]
REQUIRED_B2_ENV_NAMES = {
    "B2_APPLICATION_KEY_ID",
    "B2_APPLICATION_KEY",
    "B2_BUCKET_NAME",
    "B2_REGION",
}
OPTIONAL_B2_ENV_NAMES = {"B2_PUBLIC_URL_BASE"}


def test_b2_s3_url_is_derived_from_region():
    settings = Settings(b2_region="region-test-001")
    assert settings.b2_s3_url == "https://s3.region-test-001.backblazeb2.com"


@pytest.mark.parametrize(
    "region",
    [
        "us" + "-west-" + "004.backblazeb2.com@attacker.example/",
        "us" + "-west-" + "004:443@attacker.example/",
        "region-test-001/path",
        "region-test-001@attacker.example",
        "region-test-001:443",
        "region-test-001.evil",
        "region-test-001 evil",
        "region-test-001?x=1",
        "REGION-TEST-001",
        "region_test_001",
    ],
)
def test_b2_region_rejects_url_metacharacters(region):
    with pytest.raises(ValidationError, match="B2_REGION"):
        Settings(b2_region=region)


def test_deprecated_b2_env_extras_do_not_crash_settings_load(
    tmp_path, monkeypatch
):
    deprecated_endpoint = "B2_" + "ENDPOINT"
    deprecated_public_url = "B2_PUBLIC" + "_URL"
    for key in REQUIRED_B2_ENV_NAMES | OPTIONAL_B2_ENV_NAMES | {
        deprecated_endpoint,
        deprecated_public_url,
    }:
        monkeypatch.delenv(key, raising=False)

    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "B2_REGION=region-test-001",
                "B2_APPLICATION_KEY_ID=test-key-id",
                "B2_APPLICATION_KEY=test-key",
                "B2_BUCKET_NAME=test-bucket",
                f"{deprecated_endpoint}=https://s3.region-test-001.backblazeb2.com",
                f"{deprecated_public_url}=https://public.example.com",
            ]
        )
    )
    monkeypatch.chdir(tmp_path)

    settings = Settings()

    assert settings.b2_region == "region-test-001"
    assert settings.b2_public_url_base == ""


def test_standardized_b2_env_names():
    required_env_names = {env_name for _, env_name in REQUIRED_B2_SETTINGS}
    assert required_env_names == REQUIRED_B2_ENV_NAMES


def test_b2_env_contract_does_not_drift():
    assert _doctor_required_b2_vars() == REQUIRED_B2_ENV_NAMES
    assert _env_example_b2_keys() == (
        REQUIRED_B2_ENV_NAMES | OPTIONAL_B2_ENV_NAMES
    )


def test_public_url_base_uses_standardized_env(monkeypatch):
    monkeypatch.setenv("B2_PUBLIC_URL_BASE", "https://cdn.example.com")
    assert Settings().b2_public_url_base == "https://cdn.example.com"


def test_b2_user_agent_identifies_samples_repo():
    assert "b2ai-duckdb-query-in-place" in B2_USER_AGENT
    assert "(backblaze-b2-samples)" in B2_USER_AGENT


def _env_example_b2_keys() -> set[str]:
    keys: set[str] = set()
    for raw_line in (REPO_ROOT / ".env.example").read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key = line.split("=", 1)[0]
        if key.startswith("B2_"):
            keys.add(key)
    return keys


def _doctor_required_b2_vars() -> set[str]:
    doctor = (REPO_ROOT / "scripts/doctor.mjs").read_text()
    match = re.search(
        r"const REQUIRED_B2_VARS = \[(?P<body>.*?)\];",
        doctor,
        flags=re.DOTALL,
    )
    assert match is not None
    return set(re.findall(r'"(B2_[A-Z0-9_]+)"', match.group("body")))
