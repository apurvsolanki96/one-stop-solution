import json
from pathlib import Path

# Where we store the memory JSON file (next to this script)
BASE_DIR = Path(__file__).resolve().parent  # backend/utils
MEM_FILE = BASE_DIR / "memory_store.json"

DEFAULT_MEM = {"entries": []}


def load_mem():
    """Load memory data from JSON file, or return an empty structure."""
    if not MEM_FILE.exists():
        return DEFAULT_MEM.copy()

    try:
        with MEM_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        # If file is corrupt, fall back to empty
        return DEFAULT_MEM.copy()


def save_mem(data: dict):
    """Save the memory data back to JSON."""
    MEM_FILE.parent.mkdir(parents=True, exist_ok=True)
    with MEM_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def get_all_memory_entries():
    """
    Used by similarity.py.

    Returns the full memory structure, including the "entries" list.
    """
    return load_mem()


def save_memory_entry(notam: str, aviation: dict):
    """
    Used by parser_logic.py.

    Appends a single entry {notam, aviation} to the memory file.
    """
    data = load_mem()
    entries = data.get("entries") or []
    entries.append({
        "notam": notam,
        "aviation": aviation,
    })
    data["entries"] = entries
    save_mem(data)
    return {
        "status": "saved",
        "total_entries": len(entries),
    }


def clear_memory():
    """Reset the memory store."""
    save_mem(DEFAULT_MEM.copy())
    return {"status": "cleared"}
