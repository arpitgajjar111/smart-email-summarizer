"""
History Router
Endpoints for retrieving, searching, and managing summary history.
"""

import logging
from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from models.schemas import HistoryResponse
from services import history_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/history", response_model=HistoryResponse, summary="Get summary history")
async def get_history(
    search: Optional[str] = Query(None, description="Search term to filter history"),
    limit: int = Query(20, ge=1, le=100, description="Number of results to return")
):
    """
    Retrieve saved summary history.
    Optionally filter by a search term that matches original text or summary content.
    """
    items = history_service.get_history(search=search, limit=limit)
    return HistoryResponse(items=items, total=len(items))


@router.delete("/history/{item_id}", summary="Delete a history item")
async def delete_history_item(item_id: str):
    """Delete a specific summary from history by its ID."""
    deleted = history_service.delete_summary(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"History item '{item_id}' not found.")
    return {"message": f"Summary {item_id} deleted successfully."}


@router.delete("/history", summary="Clear all history")
async def clear_history():
    """Clear all saved summary history."""
    count = history_service.clear_history()
    return {"message": f"Cleared {count} history items."}
