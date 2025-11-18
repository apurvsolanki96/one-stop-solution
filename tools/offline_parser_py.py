
import re, math

def normalize(text):
    return re.sub(r'[\u2013\u2014]', '-', text).strip()

def shorten_desc(desc):
    if not desc: return ''
    s = re.sub(r'(?i)VORDME|VOR|NDB|DME|AERODROME|RWY|RUNWAY|TAXIWAY|TWY', '', desc).strip()
    m = re.search(r'\(([A-Z0-9]{2,4})\)', s)
    if m:
        # if hyphen present, try to include last token after hyphen, e.g. '... (KRD)-GITOV' -> 'KRD-GITOV'
        if '-' in s:
            last = s.split('-')[-1].strip()
            lastcode = re.search(r'([A-Z0-9]{2,6})', last)
            if lastcode:
                return (m.group(1) + '-' + lastcode.group(1)).upper()
        return m.group(1)
    if '/' in s:
        parts = [p.strip() for p in s.split('/') if p.strip()]
        if len(parts) > 1:
            last = parts[-1]
            m2 = re.search(r'([A-Z0-9]{2,4})', last)
            if m2: return m2.group(1)
            return '-'.join([p[:3].upper() for p in parts[-2:]])
    if '-' in s:
        parts = [p.strip() for p in s.split('-') if p.strip()]
        if len(parts) >= 2:
            a = re.sub(r'[^A-Z0-9]', '', parts[0].split()[-1])[:6]
            b = re.sub(r'[^A-Z0-9]', '', parts[-1].split()[-1])[:6]
            return (a + '-' + b).upper()
    toks = [t for t in s.split() if t]
    return '-'.join(toks[-2:]).upper()


    return re.sub(r'[\u2013\u2014]', '-', text).strip()

def meter_to_fl(m):
    feet = m * 3.28084
    fl = math.floor(feet / 100)
    return fl

def extract_fl_range(text):
    if not text:
        return None
    t = text.upper()
    t = normalize(t)
    m = re.search(r'\bFL\s*(\d{1,3})\s*[-–]\s*FL\s*(\d{1,3})\b', t)
    if m:
        return {'low': m.group(1).zfill(3), 'high': m.group(2).zfill(3)}
    m = re.search(r'\bFROM\s+FL\s*(\d{1,3})\s+TO\s+FL\s*(\d{1,3})\b', t)
    if m:
        return {'low': m.group(1).zfill(3), 'high': m.group(2).zfill(3)}
    m = re.search(r'(\d{3,6})\s*M\b', t)
    if m:
        meters = int(m.group(1).replace(',',''))
        fl = meter_to_fl(meters)
        if re.search(r'AND\s*BELOW', t):
            return {'low':'000','high': str(fl).zfill(3)}
        if re.search(r'AND\s*ABOVE', t):
            return {'low': str(fl).zfill(3), 'high':'999'}
        return {'low': str(fl).zfill(3), 'high': str(fl).zfill(3)}
    m = re.search(r'\bFL\s*(\d{1,3})\b', t)
    if m:
        return {'low': m.group(1).zfill(3), 'high': m.group(1).zfill(3)}
    m = re.search(r'\bFROM\s+(\d{1,6})\s*M\s+TO\s+(\d{1,6})\s*M\b', t)
    if m:
        low = meter_to_fl(int(m.group(1)))
        high = meter_to_fl(int(m.group(2)))
        return {'low': str(low).zfill(3), 'high': str(high).zfill(3)}
    return None

def extract_routes(lines):
    routes=[]
    route_rx = re.compile(r'^\s*([A-Z]{1,2}\d{1,4}|[A-Z]\d{1,3})\b[:\.\)]?\s*(.*)$', re.I)
    for i,line in enumerate(lines):
        ln = line.strip()
        ln2 = re.sub(r'^\d+\.\s*','',ln)
        m = route_rx.match(ln2)
        if m and re.search(r'[A-Z]{1,2}\d{1,4}', m.group(1), re.I) and not '/' in m.group(1) and not 'NOTAM' in m.group(2).upper():
            code = m.group(1).upper()
            rest = m.group(2) or ''
            if not rest and i+1 < len(lines):
                rest = lines[i+1].strip()
            rest = re.sub(r':+','', rest).replace(' - ','-').strip()
            routes.append({'code':code,'desc':rest,'idx':i})
            continue
        inline = re.search(r'\b([A-Z]{1,2}\d{1,4})\b[\s\:]*([A-Z0-9\-\s\/\(\)]+)(FL|FROM|WITH|$)', ln, re.I)
        if inline:
            code = inline.group(1).upper()
            desc = inline.group(2).strip()
            if 'NOTAM' in desc.upper() or '/' in desc[:3]:
                # ignore header-like matches
                pass
            else:
                routes.append({'code':code,'desc':desc,'idx':i})
    return routes

def parse_notam(text):
    lines = [l.strip() for l in re.split(r'\\r?\\n', text) if l.strip()]
    results=[]
    routes = extract_routes(lines)
    for r in routes:
        window = ' '.join(lines[r['idx']: r['idx']+4])
        fl = extract_fl_range(window) or extract_fl_range(' '.join(lines))
        if fl:
            results.append({'route': r['code'], 'desc': shorten_desc(r['desc']), 'low': fl['low'], 'high': fl['high']})
        else:
            anyfl = extract_fl_range(' '.join(lines))
            if anyfl:
                results.append({'route': r['code'], 'desc': shorten_desc(r['desc']), 'low': anyfl['low'], 'high': anyfl['high']})
            else:
                results.append({'route': r['code'], 'desc': shorten_desc(r['desc']), 'low': None, 'high': None})
    if not results:
        # last resort: find patterns like "W187:TUSLI - KARVI" anywhere
        for line in lines:
            m = re.search(r'\\b([A-Z]{1,2}\\d{1,4})\\b[\\s:\\)]*([A-Z\\-\\s\\/]+)\\b.*(FL\\s*\\d{1,3}[-–]FL\\s*\\d{1,3}|FROM\\s+FL\\s*\\d{1,3}\\s+TO\\s+FL\\s*\\d{1,3}|\\d{3,6}M)', line, re.I)
            if m:
                code = m.group(1).upper()
                desc = m.group(2).strip()
                fl = extract_fl_range(line) or extract_fl_range(' '.join(lines))
                results.append({'route': code, 'desc': shorten_desc(desc), 'low': fl['low'] if fl else None, 'high': fl['high'] if fl else None})
    return results
