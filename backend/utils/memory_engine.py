
# Batch 7E-5 — Memory Engine
import json, os
from difflib import SequenceMatcher

BASE_PATH = os.path.dirname(__file__)
MEM_FILE = os.path.join(BASE_PATH,"memory_store.json")

def load_mem():
    try:
        with open(MEM_FILE,"r") as f:
            return json.load(f)
    except:
        return {"fixes":{}, "segments":[]}

def save_mem(data):
    with open(MEM_FILE,"w") as f:
        json.dump(data,f,indent=2)

def memory_lookup(fix):
    mem=load_mem()
    fix=fix.upper()
    if fix in mem.get("fixes",{}):
        return mem["fixes"][fix]
    # similarity search
    for k,v in mem.get("fixes",{}).items():
        if SequenceMatcher(None, fix, k).ratio()>0.8:
            return v
    return None

def save_entry(entry):
    mem=load_mem()
    # save fix corrections
    for key,val in entry.get("fixes",{}).items():
        mem.setdefault("fixes",{})[key.upper()] = val.upper()
    # save segments
    if "segments" in entry:
        for seg in entry["segments"]:
            if seg not in mem["segments"]:
                mem["segments"].append(seg)
    save_mem(mem)
    return {"status":"saved","memory":mem}

def get_all_memory_entries():
    """
    Compatibility helper used by similarity module.

    Returns the full in-memory structure loaded from the JSON file.
    """
    return load_mem()


def save_memory_entry(notam: str, aviation: dict):
    """
    Compatibility helper used by parser_logic.

    Stores a single memory entry combining the raw NOTAM text and the
    parsed aviation structure into the memory JSON file.
    """
    data = load_mem()

    # Use a generic "entries" list so we don't break existing keys
    entries = data.get("entries")
    if entries is None:
        entries = []
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


def get_all():
    return load_mem()

def clear_memory():
    save_mem({"fixes":{}, "segments":[]})
    return {"status":"cleared"}
