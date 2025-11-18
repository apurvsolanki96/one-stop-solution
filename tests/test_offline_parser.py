
import re, json, os
from tools import offline_parser_py as parser

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
sample_file = os.path.join(ROOT, "awy outputs only.txt")

def normalize_line(s):
    s = s.strip().upper()
    s = re.sub(r'\s+', ' ', s)
    s = s.replace('.', '')
    return s

def expected_lines_for_block(block_out):
    # split lines and normalize
    lines = [l.strip() for l in block_out.splitlines() if l.strip()]
    return [normalize_line(l) for l in lines]

def parser_lines_from_result(parsed):
    lines = []
    for p in parsed:
        if p.get('low') and p.get('high'):
            lines.append(f"{p['route']} {p['desc']} FL{p['low']}-FL{p['high']}")
        elif p.get('low'):
            lines.append(f"{p['route']} {p['desc']} FL{p['low']}")
        else:
            lines.append(f"{p['route']} {p['desc']}")
    return [normalize_line(l) for l in lines]

def test_all_samples():
    text = open(sample_file, 'r', encoding='utf-8').read()
    pairs = re.findall(r'i\/p:\s*(.*?)\s*O\/P:\s*(.*?)(?=(?:\ni\/p:)|\Z)', text, flags=re.I|re.S)
    mismatches = []
    for idx,(inp, expected) in enumerate(pairs):
        exp = expected_lines_for_block(expected)
        parsed = parser.parse_notam(inp)
        got = parser_lines_from_result(parsed)
        # compare sets for len>0; if both empty continue
        if not exp and not got:
            continue
        if set(exp) != set(got):
            mismatches.append({'idx': idx, 'expected': exp, 'got': got})
    if mismatches:
        # write sample mismatch file for debugging
        open(os.path.join(ROOT, 'parser_mismatches.json'),'w',encoding='utf-8').write(json.dumps(mismatches, indent=2))
    assert not mismatches, f"Found {len(mismatches)} mismatches; see parser_mismatches.json"
