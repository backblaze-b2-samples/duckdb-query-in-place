"""Unit tests for the query service: SQL guards + server-side dest keys.

These tests never touch B2 or a real DuckDB engine — the repo functions are
monkeypatched. They cover the security-relevant behavior: that only read
statements pass the guard, and that the materialize destination is always a
server-sanitized `query-results/...parquet` key regardless of user input.
"""

import pytest

from app.service import query as query_service


@pytest.fixture(autouse=True)
def isolate_history(tmp_path, monkeypatch):
    """Redirect the durable history file to a temp path per test."""
    from app.config import settings

    monkeypatch.setattr(
        settings, "query_history_file", str(tmp_path / "history.json")
    )
    yield


def test_run_query_rejects_non_select():
    for bad in ["DROP TABLE t", "set lock_configuration=false", "ATTACH 'x'"]:
        with pytest.raises(query_service.QueryError):
            query_service.run_query(bad)


def test_run_query_rejects_multiple_statements():
    with pytest.raises(query_service.QueryError):
        query_service.run_query("SELECT 1; DROP TABLE t")


def test_run_query_passes_select(monkeypatch):
    captured = {}

    def fake_repo(sql, cap):
        captured["sql"] = sql
        captured["cap"] = cap
        return {
            "columns": ["a"],
            "rows": [[1]],
            "row_count": 1,
            "truncated": False,
            "duration_ms": 1.2,
        }

    monkeypatch.setattr(query_service, "repo_run_query", fake_repo)
    result = query_service.run_query("SELECT 1 AS a", max_rows=5)
    assert result.columns == ["a"]
    assert result.row_count == 1
    assert captured["sql"] == "SELECT 1 AS a"
    assert captured["cap"] == 5


def test_run_query_caps_max_rows(monkeypatch):
    """A user-supplied max_rows can never exceed the server cap."""
    from app.config import settings

    monkeypatch.setattr(settings, "max_query_rows", 100)
    captured = {}
    monkeypatch.setattr(
        query_service,
        "repo_run_query",
        lambda sql, cap: captured.update(cap=cap)
        or {
            "columns": [],
            "rows": [],
            "row_count": 0,
            "truncated": False,
            "duration_ms": 0.0,
        },
    )
    query_service.run_query("SELECT 1", max_rows=10_000)
    assert captured["cap"] == 100


def test_materialize_builds_server_sanitized_key(monkeypatch):
    captured = {}

    def fake_repo(sql, dest_key):
        captured["dest_key"] = dest_key
        return {"key": dest_key, "rows_written": 3}

    monkeypatch.setattr(query_service, "repo_materialize", fake_repo)
    # Malicious-looking name must not control the write path.
    saved = query_service.materialize_query(
        "SELECT 1", name="../../etc/passwd OR drop"
    )
    assert saved.result_key.startswith("query-results/")
    assert saved.result_key.endswith(".parquet")
    assert ".." not in saved.result_key
    assert "/" not in saved.result_key[len("query-results/") :]
    assert captured["dest_key"] == saved.result_key


def test_materialize_rejects_non_select(monkeypatch):
    monkeypatch.setattr(
        query_service, "repo_materialize", lambda sql, k: {"key": k, "rows_written": 0}
    )
    with pytest.raises(query_service.QueryError):
        query_service.materialize_query("DELETE FROM t", name="x")


def test_history_round_trip(monkeypatch):
    monkeypatch.setattr(
        query_service,
        "repo_materialize",
        lambda sql, dest_key: {"key": dest_key, "rows_written": 7},
    )
    assert query_service.get_query_count() == 0
    query_service.materialize_query("SELECT 1", name="first")
    query_service.materialize_query("SELECT 2", name="second")
    assert query_service.get_query_count() == 2
    history = query_service.get_query_history()
    # Newest first.
    assert history[0].name == "second"
    assert history[1].name == "first"
    assert history[0].rows_written == 7
