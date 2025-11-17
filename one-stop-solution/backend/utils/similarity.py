
import re
from utils.memory_engine import get_all_memory_entries

# tokenize for cosine-like similarity
def tokenize(text):
    text = text.upper()
    text = re.sub(r"[^A-Z0-9 ]"," ", text)
    return [t for t in text.split() if t]

def cosine_like(a_tokens, b_tokens):
    if not a_tokens or not b_tokens:
        return 0.0
    a_set = set(a_tokens)
    b_set = set(b_tokens)
    inter = len(a_set & b_set)
    union = len(a_set | b_set)
    if union == 0:
        return 0.0
    return inter / union

# extract operational core (E-line + route refs)
def extract_operational(text):
    text = text.upper()
    parts=[]
    e = re.search(r"E\)(.*?)(?=[A-Z]\)|$)", text)
    if e:
        parts.append(e.group(1))
    # route names
    rtes = re.findall(r"\b[A-Z][A-Z0-9]{1,4}\b", text)
    parts.extend(rtes)
    return " ".join(parts)

SIM_THRESHOLD = 0.75

def find_similar_memory(notam_text):
    memories = get_all_memory_entries()
    if not memories:
        return None

    op_text = extract_operational(notam_text)
    op_tokens = tokenize(op_text)
    full_tokens = tokenize(notam_text)

    best_score = 0.0
    best_item = None

    for entry in memories:
        mem_notam = entry["notam"]
        mem_output = entry["output"]
        mem_ts = entry["timestamp"]

        mem_op = extract_operational(mem_notam)
        mem_op_tokens = tokenize(mem_op)
        mem_full_tokens = tokenize(mem_notam)

        op_sim = cosine_like(op_tokens, mem_op_tokens)
        full_sim = cosine_like(full_tokens, mem_full_tokens)

        final_score = 0.70 * op_sim + 0.30 * full_sim

        if final_score >= SIM_THRESHOLD:
            if final_score > best_score:
                best_score = final_score
                best_item = entry
            elif abs(final_score - best_score) < 1e-6:
                # tie → choose newest
                if entry["timestamp"] > best_item["timestamp"]:
                    best_item = entry

    if best_item:
        return best_item["output"]
    return None
