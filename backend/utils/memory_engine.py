def memory_lookup_fix(code: str):
    """
    Compatibility helper expected by fix_validator / other modules.
    Given a fix/waypoint/code string (e.g. 'KRD' or 'GITOV'), return the
    first matching memory entry dict where the fix appears.

    Matching rules (in order):
      - exact match against aviation['fix'] if present
      - exact match against aviation codes inside aviation dict (any value)
      - substring match inside the 'notam' text
      - substring match inside the 'aviation' fields when serialized

    Returns the entry dict or None when no match found.
    """
    if not code:
        return None
    try:
        needle = str(code).strip().upper()
        entries = get_all_memory_entries()
        for e in entries:
            # check structured aviation keys first
            aviation = e.get("aviation") or {}
            # If 'fix' is a dedicated key, check it
            fix_val = aviation.get("fix") or aviation.get("icao") or aviation.get("code")
            if isinstance(fix_val, str) and fix_val.upper() == needle:
                return e
            # check any aviation values for exact token match
            for v in aviation.values():
                if isinstance(v, str) and v.upper() == needle:
                    return e
                # if it's list-like, check elements
                if isinstance(v, (list, tuple)):
                    for item in v:
                        if isinstance(item, str) and item.upper() == needle:
                            return e
            # fallback: substring match in notam or aviation serialized
            notam_text = (e.get("notam") or "").upper()
            if needle in notam_text:
                return e
            try:
                # small, cheap serialization check
                avi_ser = json.dumps(aviation).upper()
                if needle in avi_ser:
                    return e
            except Exception:
                pass
        return None
    except Exception:
        # Never bubble an exception here; return None on failure
        return None


# keep older alias names for compatibility if used elsewhere
memory_find_fix = memory_lookup_fix
