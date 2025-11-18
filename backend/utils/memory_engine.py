# backend/utils/memory_engine.py
import json
from pathlib import Path
from typing import Any, Dict, List
import threading
import datetime

BASE_DIR = Path(__file__).resolve().parent
MEM_FILE = BASE_DIR / "memory_store.json"
_LOCK = threading.Lock()

DEFAULT_MEM: Dict[str, Any] = {"entries": []}

def load_mem() -> Dict[str, Any]:
    """Return the memory dict or default structure."""
    if not MEM_FILE.exists():
        return DEFAULT_MEM.copy()
    try:
        with MEM_FILE.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
            if not isinstance(data, dict):
                return DEFAULT_MEM.copy()
            if "entries" not in data:
                data["entries"] = []
            return data
    except Exception:
        return DEFAULT_MEM.copy()

def save_mem(data: Dict[str, Any]) -> None:
    """Write JSON atomically."""
    MEM_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = MEM_FILE.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    tmp.replace(MEM_FILE)

def get_all() -> Dict[str, Any]:
    """Return the whole memory store."""
    return load_mem()

def save_memory_entry(notam: str, aviation: Dict[str, Any]) -> Dict[str, Any]:
    """Append an entry and persist it."""
    mem = load_mem()
    entries: List[Dict[str, Any]] = mem.get("entries", [])
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
        save_mem(mem)
    return {"status": "saved", "entry": entry}

def save_entry(data: Any) -> Dict[str, Any]:
    """API-friendly wrapper. Accepts dict or string."""
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
    if notam is None:
        notam = ""
    if aviation is None:
        aviation = {}
    return save_memory_entry(notam, aviation)

def clear_memory() -> Dict[str, Any]:
    """Reset store to default."""
    with _LOCK:
        save_mem(DEFAULT_MEM.copy())
    return {"status": "cleared"}
