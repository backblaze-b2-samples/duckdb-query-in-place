import logging

from fastapi import APIRouter, HTTPException

from app.service.query import (
    QueryError,
    get_query_history,
    materialize_query,
    run_query,
)
from app.types import (
    MaterializeRequest,
    QueryRequest,
    QueryResult,
    SavedQuery,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/query/run", response_model=QueryResult)
async def run_query_endpoint(req: QueryRequest):
    """Run a read SQL query against files in B2 and return a row preview."""
    try:
        result = run_query(req.sql, req.max_rows)
    except QueryError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    logger.info(
        "Query run: rows=%d truncated=%s duration_ms=%s",
        result.row_count,
        result.truncated,
        result.duration_ms,
    )
    return result


@router.post("/query/materialize", response_model=SavedQuery)
async def materialize_endpoint(req: MaterializeRequest):
    """Write a query's full result back to B2 as a Parquet slice."""
    try:
        return materialize_query(req.sql, req.name)
    except QueryError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None


@router.get("/query/history", response_model=list[SavedQuery])
async def query_history_endpoint(limit: int = 50):
    if limit < 1 or limit > 200:
        raise HTTPException(
            status_code=400, detail="Limit must be between 1 and 200"
        )
    return get_query_history(limit=limit)
