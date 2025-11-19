# backend/utils/memory_engine.py
"""
File-backed memory engine for NOTAM memory.
Provides a stable API and compatibility functions used across the app.
"""

from pathlib import Path
import json
import threading
import datetime
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent
MEM_FILE = BASE_DIR / "memory_store.json"
_LOCK = threading.Lock()

_DEFAULT_MEM: Dict[str, Any] = {"entries": []}


def _read_file() -> Dict[str, Any]:
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
        return _DEFAULT_MEM.copy()


def _write_file(data: Dict[str, Any]) -> None:
    MEM_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = MEM_FILE.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    tmp.replace(MEM_FILE)


def get_all() -> Dict[str, Any]:
    """Return the whole memory store as a dict."""
    return _read_file()


def get_all_memory_entries() -> List[Dict[str, Any]]:
    """Compatibility: return list of memory entries only."""
    data = _read_file()
    return data.get("entries", []) or []


def get_all_entries() -> List[Dict[str, Any]]:
    """Alias for get_all_memory_entries (legacy name)."""
    return get_all_memory_entries()


def save_memory_entry(notam: str, aviation: Dict[str, Any]) -> Dict[str, Any]:
    """Append and persist an entry, return saved entry wrapper."""
    mem = _read_file()
    entries: List[Dict[str, Any]] = mem.get("entries", []) or []
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
    """API wrapper used by routes: accepts dict or raw string."""
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
    if aviation is None:
        aviation = {}
    return save_memory_entry(notam or "", aviation)


def clear_memory() -> Dict[str, Any]:
    """Reset the store to default (atomic write)."""
    with _LOCK:
        _write_file(_DEFAULT_MEM.copy())
    return {"status": "cleared"}


def memory_lookup_fix(code: str) -> Optional[Dict[str, Any]]:
    """
    Compatibility helper expected by fix_validator.
    Search entries for a matching fix code or substring in notam/aviation.
    Returns the first matching entry dict or None.
    """
    if not code:
        return None
    needle = str(code).strip().upper()
    try:
        entries = get_all_memory_entries()
        for e in entries:
            aviation = e.get("aviation") or {}
            # check common keys
            for k in ("fix", "icao", "code", "id"):
                v = aviation.get(k)
                if isinstance(v, str) and v.upper() == needle:
                    return e
            # check any aviation string values and list items
            for v in aviation.values():
                if isinstance(v, str) and v.upper() == needle:
                    return e
                if isinstance(v, (list, tuple)):
                    for item in v:
                        if isinstance(item, str) and item.upper() == needle:
                            return e
            # substring search in notam
            notam_text = (e.get("notam") or "").upper()
            if needle in notam_text:
                return e
            # serialized aviation search
            try:
                if needle in json.dumps(aviation).upper():
                    return e
            except Exception:
                pass
        return None
    except Exception:
        return None


# Backwards-compatible aliases
memory_find_fix = memory_lookup_fix
