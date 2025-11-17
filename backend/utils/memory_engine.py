import json
from pathlib import Path
from typing import Any, Dict, List

# Directory of this file: backend/utils
BASE_DIR = Path(__file__).resolve().parent
MEM_FILE = BASE_DIR / "memory_store.json"

DEFAULT_MEM: Dict[str, Any] = {"entries": []}


def load_mem() -> Dict[str, Any]:
    """Load memory data from JSON file, or return an empty structure."""
    if not MEM_FILE.exists():
        return DEFAULT_MEM.copy()

    try:
        with MEM_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        # If file is corrupt, fall back to empty
        return DEFAULT_MEM.copy()


def save_mem(data: Dict[str, Any]) -> None:
    """Save the memory data back to JSON."""
    MEM_FILE.parent.mkdir(parents=True, exist_ok=True)
    with MEM_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# --------------------------------------------------------------------
# Helpers used by other modules
# --------------------------------------------------------------------


def get_all_memory_entries() -> Dict[str, Any]:
    """
    Used by similarity.py.

    Returns the full memory structure, including the "entries" list.
    """
    return load_mem()


def save_memory_entry(notam: str, aviation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Used by parser_logic.py.

    Appends a single entry {notam, aviation} to the memory file.
    """
    data = load_mem()
    entries: List[Dict[str, Any]] = data.get("entries") or []
    entries.append(
        {
            "notam": notam,
            "aviation": aviation,
        }
    )
    data["entries"] = entries
    save_mem(data)
    return {"status": "saved", "total_entries": len(entries)}


def memory_lookup(query: str | None = None, **kwargs: Any) -> List[Dict[str, Any]]:
    """
    Used by fallback_chain.py (and possibly others).

    Very simple implementation: returns all entries whose NOTAM text
    contains the query substring (case-insensitive). If no query is
    given, returns an empty list.
    """
    if not query:
        return []

    data = load_mem()
    entries: List[Dict[str, Any]] = data.get("entries") or []
    q = query.lower()
    results = [e for e in entries if q in str(e.get("notam", "")).lower()]
    return results


def memory_learn(notam: str | None = None, aviation: Dict[str, Any] | None = None, **kwargs: Any) -> Dict[str, Any]:
    """
    Used by fallback_chain.py.

    Simple wrapper around save_memory_entry so the rest of the code can
    call `memory_learn(...)` and not worry about details.
    """
    if notam is None:
        notam = ""
    if aviation is None:
        aviation = {}
    return save_memory_entry(notam, aviation)


def clear_memory() -> Dict[str, Any]:
    """Reset the memory store."""
    save_mem(DEFAULT_MEM.copy())
    return {"status": "cleared"}
