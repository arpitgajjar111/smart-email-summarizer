"""
History Service
In-memory storage for summary history with search capability.
In production, replace with a database (PostgreSQL, SQLite, etc.)
"""

import uuid
import logging
from datetime import datetime
from typing import List, Optional, Dict
from models.schemas import HistoryItem

logger = logging.getLogger(__name__)

# In-memory store: list of history dicts
_history_store: List[Dict] = []
MAX_HISTORY = 100  # Keep last 100 summaries


def save_summary(
    original_text: str,
    summary: str,
    model_used: str,
    length_preset: str,
    original_word_count: int,
    summary_word_count: int,
    reduction_percentage: float,
) -> str:
    """
    Save a summary to the in-memory history store.
    Returns the generated unique ID.
    """
    item_id = str(uuid.uuid4())[:8]
    item = {
        "id": item_id,
        "original_preview": original_text[:150].replace("\n", " ").strip() + "...",
        "summary": summary,
        "model_used": model_used,
        "length_preset": length_preset,
        "original_word_count": original_word_count,
        "summary_word_count": summary_word_count,
        "reduction_percentage": reduction_percentage,
        "created_at": datetime.utcnow(),
    }
    _history_store.insert(0, item)  # newest first

    # Trim to max
    if len(_history_store) > MAX_HISTORY:
        _history_store.pop()

    logger.info(f"Saved summary {item_id} to history ({len(_history_store)} total)")
    return item_id


def get_history(search: Optional[str] = None, limit: int = 20) -> List[HistoryItem]:
    """
    Retrieve history, optionally filtered by search query.
    """
    items = _history_store[:limit]

    if search:
        query = search.lower()
        items = [
            i for i in items
            if query in i["original_preview"].lower()
            or query in i["summary"].lower()
        ]

    return [HistoryItem(**item) for item in items]


def delete_summary(item_id: str) -> bool:
    """
    Delete a specific summary from history by ID.
    Returns True if found and deleted, False otherwise.
    """
    global _history_store
    original_len = len(_history_store)
    _history_store = [i for i in _history_store if i["id"] != item_id]
    return len(_history_store) < original_len


def clear_history() -> int:
    """Clear all history. Returns number of items cleared."""
    global _history_store
    count = len(_history_store)
    _history_store = []
    return count
