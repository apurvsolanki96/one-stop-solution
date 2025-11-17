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


def save_memory_entry(notam: str, aviation: Dict[str, Any]
