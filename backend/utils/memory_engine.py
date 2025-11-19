# backend/utils/memory_engine.py
"""
File-backed memory engine for NOTAM memory.
Provides a small, stable API used across the app.

Exports:
 - get_all() -> dict  (current store)
 - get_all_memory_entries() -> list (compat alias for older callers)
 - save_entry(data) -> dict (API-facing save)
 - save_memory_entry(notam, aviation) -> dict (lower-level)
 - memory_learn(notam, aviation) -> dict
 - clear_memory() -> dict
"""

from pathlib import Path
import json
import threading
import datetime
from typing import Any, Dict, List

BASE_DIR = Path(__file__).resolve().parent
MEM_FILE = BASE_DIR / "memory_store.json"
_LOCK = threading.Lock()

_DEFAULT_MEM: Dict[str, Any] = {"entries": []}


def _read_file() -> Dict[str, Any]:
    """Load memory JSON; return a dict with 'entries' list."""
    if not MEM_FILE.exists():
        return _DEFAULT_MEM.copy()
    try:
        with MEM_FILE.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
            if not isinstance(data, dict):
                return _DEFAULT_MEM.copy()
            if "entries" not in data:
                data["entries"] = []
            return data
    except Exception:
        # On any error return the default structure
        return _DEFAULT_MEM.copy()


def _write_file(data: Dict[str, Any]) -> None:
    """Atomically write memory JSON to disk."""
    MEM_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = MEM_FILE.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    tmp.replace(MEM_FILE)


def get_all() -> Dict[str, Any]:
    """
    Return the full memory store as a dict: {"entries": [...]}
    """
    return _read_file()


def get_all_memory_entries() -> List[Dict[str, Any]]:
    """
    Compatibility function expected by other modules.
    Returns the list of entries only.
    """
    data = _read_file()
    return data.get("entries", [])


def save_memory_entry(notam: str, aviation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add a memory entry and persist. Returns saved entry in a response dict.
    """
    mem = _read_file()
    entries: List[Dict[str, Any]] = mem.get("entries", []) or []
    # compute new id (simple incremental)
    entry_id = (entries[-1]["id"] + 1) if entries else 1
    entry = {
        "id": entry_id,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "notam": notam or "",
        "aviation": aviation or {}
    }
    entries.append(entry)
    mem["entries"] = entries
    with _LOCK:
        _write_file(mem)
    return {"status": "saved", "entry": entry}


def save_entry(data: Any) -> Dict[str, Any]:
    """
    API-level wrapper used by routes. Accepts dict or string payload.
    """
    if data is None:
        return {"error": "no data provided"}
    if isinstance(data, str):
        return save_memory_entry(data, {})
    if not isinstance(data, dict):
        return {"error": "invalid payload"}
    notam = data.get("notam") or data.get("text") or ""
    aviation = data.get("aviation") or {}
    return save_memory_entry(notam, aviation)


def memory_learn(notam: str = "", aviation: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Convenience wrapper to save a memory entry.
    """
    if aviation is None:
        aviation = {}
    return save_memory_entry(notam or "", aviation)


def clear_memory() -> Dict[str, Any]:
    """Reset store to default."""
    with _LOCK:
        _write_file(_DEFAULT_MEM.copy())
    return {"status": "cleared"}


# Aliases for compatibility (if elsewhere code imports different names)
get_all_entries = get_all_memory_entries
