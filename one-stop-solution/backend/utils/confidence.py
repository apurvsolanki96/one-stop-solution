
# Batch 7E-4 — Confidence Engine

def score_fl(fl_info):
    score=1.0
    if fl_info.get("adjusted"): score-=0.15
    return max(score,0)

def score_segments(segments):
    if not segments: return 0
    good=0
    for s in segments:
        if len(s.get("from",""))>=3 and len(s.get("to",""))>=3:
            good+=1
    return good/len(segments)

def score_memory_usage(segments):
    # placeholder: later expanded
    return 0.1

def evaluate(segments, fl_info):
    w_fl=0.4
    w_seg=0.5
    w_mem=0.1
    fls=score_fl(fl_info)
    segs=score_segments(segments)
    mems=score_memory_usage(segments)
    return round(fls*w_fl + segs*w_seg + mems*w_mem,3)
