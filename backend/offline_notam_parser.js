/**
 * backend/offline_notam_parser.js
 *
 * Offline NOTAM airway (AWY) extractor + "memory" learning fallback.
 *
 * Usage:
 *  node offline_notam_parser.js parse "<NOTAM TEXT HERE>"
 *  node offline_notam_parser.js parse-file path/to/notam.txt
 *  node offline_notam_parser.js add-memory "<NOTAM TEXT>" "<EXPECTED_OUTPUT_JSON_ARRAY>"
 *
 * Memory file: ./memory.json
 *
 * Output format (normalized strings): e.g.
 *   "L736 NEDRA-GOMED FL045-FL130"
 *   "W187 TUSLI-DNH FL000-FL341"
 *
 * Keep simple, purely local — no web calls.
 *
 * Author: Code Copilot (assistant)
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, 'memory.json');

/* ===========================
   Utilities
   =========================== */
function ensureMemoryFile() {
  if (!fs.existsSync(MEMORY_PATH)) {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify([], null, 2), 'utf8');
  }
}
function readMemory() {
  ensureMemoryFile();
  return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
}
function writeMemory(arr) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(arr, null, 2), 'utf8');
}
function addMemoryEntry(entry) {
  const mem = readMemory();
  mem.push(entry);
  writeMemory(mem);
}

/* ===========================
   Normalizers
   =========================== */
function padFL(numStr) {
  // Accept "FL45", "FL045", "45", "045" etc.
  if (!numStr) return null;
  numStr = String(numStr).toUpperCase().replace(/^FL/, '').replace(/\D/g, '');
  if (!numStr) return null;
  return 'FL' + numStr.padStart(3, '0');
}
function normalizeSegment(awy, fromNode, toNode, fromFL, toFL) {
  const awyNorm = awy ? awy.toUpperCase().replace(/\s+/g, '') : '';
  const nodes = [ (fromNode||'').trim(), (toNode||'').trim() ]
    .filter(Boolean)
    .join('-');
  const flFrom = padFL(fromFL);
  const flTo = padFL(toFL);
  const flPart = (flFrom && flTo) ? ` ${flFrom}-${flTo}` : (flFrom ? ` ${flFrom}` : '');
  const main = (awyNorm || nodes) ? `${awyNorm}${awyNorm && nodes ? ' ' : ''}${nodes}${flPart}` : null;
  return main ? main.trim() : null;
}

/* ===========================
   Regex-based extractors
   =========================== */

const AWY_CODE_RE = /\b([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\b/; // simple AWY-like (L736, W187, A822, etc.)

function extractFromOPBlock(text) {
  // O/P: lines often already in desired format (one-per-line), try to find O/P: and take following lines
  const opMatch = text.match(/O\/P:\s*([\s\S]+)/i);
  if (!opMatch) return [];
  const opText = opMatch[1].trim();
  // Split by newline or multiple spaces / semicolon
  const lines = opText.split(/\r?\n|;|\u00A0/).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (let ln of lines) {
    // Common pattern: AWY N1-N2 FLnnn-FLnnn
    // Examples in your data: "L736 NEDRA-GOMED FL045-FL130", "W187 TUSLI-DNH FL000-FL341"
    const m = ln.match(/([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\s+([A-Z0-9'()\- ]+?)\s+FL?(\d{1,3})\s*[-\u2013]\s*FL?(\d{1,3})/i);
    if (m) {
      out.push(normalizeSegment(m[1], ...m[2].split(/\s*-\s*/), m[3], m[4]));
      continue;
    }
    // Or: "W187 TUSLI-KARVI FL000-FL157W112 TUSLI-VIKUP FL000-FL157" -> split by whitespace between segments
    const segs = ln.split(/\s{2,}|\s(?=[A-Z]\d{1,4}\s)|\u00A0/).map(s => s.trim()).filter(Boolean);
    for (let s of segs) {
      const mm = s.match(/([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\s+([A-Z0-9'()\- ]+?)\s+FL?(\d{1,3})\s*[-\u2013]\s*FL?(\d{1,3})/i);
      if (mm) out.push(normalizeSegment(mm[1], ...mm[2].split(/\s*-\s*/), mm[3], mm[4]));
    }
  }
  return out.filter(Boolean);
}

function extractSegmentsFromE(text) {
  // Many NOTAMs contain E) followed by human-readable descriptions of closed segments.
  // We'll try to capture patterns like:
  //   "FLW ATS RTE SEGMENTS CLSD:L736 NEDRA-GOMED FL045-FL130N5 KALININGRAD/KHRABROVO VORDME(KRD)-GITOV FL045-FL130."
  // Strategy:
  //  - Extract text after E) up to O/P: (if present) or end
  //  - Find multiple matches of: <AWYcode> <node>-<node> FLxxx-FLyyy
  const eMatch = text.match(/E\)\s*([\s\S]+?)(?:O\/P:|$)/i);
  const subject = eMatch ? eMatch[1] : text;
  const out = [];
  // global match for patterns AWY ... FLnnn-FLnnn
  const regex = /([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\s+([A-Z0-9'()\/\-\.\s]+?)\s+FL?(\d{1,3})\s*[-\u2013]\s*FL?(\d{1,3})/gmi;
  let m;
  while ((m = regex.exec(subject)) !== null) {
    // m[2] might contain multiple nodes separated by comma or ' ' or other - pick first pair with '-'
    const nodeText = m[2].trim();
    // try to pull from patterns like "NEDRA-GOMED" or "TUSLI - DUNHUANG VOR'DNH' OF ATS RTE W187 CLSD AT 10,400M..." so be flexible:
    const nodePairMatch = nodeText.match(/([A-Z0-9'()\/]+(?:-[A-Z0-9'()\/]+))/i);
    let fromNode = null, toNode = null;
    if (nodePairMatch) {
      const nodes = nodePairMatch[1].split(/\s*-\s*/);
      fromNode = nodes[0];
      toNode = nodes[1];
    } else {
      // fallback: take token sequence and try split by space and '-'
      const tokens = nodeText.split(/\s+/);
      if (tokens.length >= 3 && tokens[1].includes('-')) {
        const nodes = tokens[1].split('-');
        fromNode = nodes[0]; toNode = nodes[1];
      } else {
        // try splitting nodeText on '-' or '/'
        const sp = nodeText.split(/\s*-\s*/);
        if (sp.length >= 2) {
          fromNode = sp[0]; toNode = sp[1];
        } else {
          // last resort, set whole nodeText as single node
          fromNode = nodeText.trim();
        }
      }
    }
    const normalized = normalizeSegment(m[1], fromNode, toNode, m[3], m[4]);
    if (normalized) out.push(normalized);
  }

  // Additional heuristic: phrases like "FROM FL000 TO FL351" + "W112 TUSLI-VIKUP" might appear separately.
  // Attempt to capture blocks like "<AWY> <nodes> FROM FLx TO FLy" too.
  const regex2 = /([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\s+([A-Z0-9'()\/\-\s]+?)\s*[,:\.]*\s*FROM\s+FL?(\d{1,3})\s*(?:TO|-)\s*FL?(\d{1,3})/gmi;
  while ((m = regex2.exec(subject)) !== null) {
    const nodes = m[2].trim();
    const parts = nodes.split(/\s*-\s*/);
    const normalized = normalizeSegment(m[1], parts[0], parts[1] || '', m[3], m[4]);
    if (normalized) out.push(normalized);
  }

  return Array.from(new Set(out.filter(Boolean)));
}

function extractSegmentsGeneric(text) {
  // Generic fallback: find patterns like "<AWYcode> <SOMETHING> FLnn-FLnn" across the text
  const out = [];
  const regex = /([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\b[^\n]{0,80}?FL?(\d{1,3})\s*[-\u2013]\s*FL?(\d{1,3})/gmi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    // attempt to extract nodes between awy and FL
    const snippet = m[0];
    const awy = m[1];
    // attempt to find "X-Y" between awy and FL
    const mid = snippet.replace(awy, '').replace(m[2], '').replace(m[3], '');
    const nodePair = mid.match(/([A-Z0-9'()\/]+)\s*-\s*([A-Z0-9'()\/]+)/i);
    let fromNode = nodePair ? nodePair[1] : '';
    let toNode = nodePair ? nodePair[2] : '';
    const normalized = normalizeSegment(awy, fromNode, toNode, m[2], m[3]);
    if (normalized) out.push(normalized);
  }
  return Array.from(new Set(out.filter(Boolean)));
}

/* ===========================
   Orchestrator
   =========================== */

function parseNotam(rawText) {
  const text = (rawText || '').toString().replace(/\r\n/g, '\n');
  if (!text.trim()) return { success: false, error: 'empty input' };

  // 1) Try O/P:
  let segments = extractFromOPBlock(text);
  // 2) If none, try E) block extraction
  if (segments.length === 0) segments = extractSegmentsFromE(text);
  // 3) Generic fallback scanning
  if (segments.length === 0) segments = extractSegmentsGeneric(text);

  // If still nothing, try to interpret lines like "FLW ATS RTE SEGMENTS CLSD: L321 KUNKI-OBRAN FL000-FL500, L604 BRN-DANAD FL000-FL500 ..."
  if (segments.length === 0) {
    const colonListMatch = text.match(/(?:FLW\s+ATS\s+RTE\s+SEGMENTS\s+CLSD|ATS RTE SEGMENTS CLSD|SEGMENT OF ATS RTE CLSD)[\s\S]*?:\s*([\s\S]+)/i);
    if (colonListMatch) {
      const tail = colonListMatch[1].split(/O\/P:|E\)|$|\. \s*/)[0];
      // split by comma or semicolon or newline
      const bits = tail.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
      for (let b of bits) {
        const m = b.match(/([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\s+([A-Z0-9'()\/\-\s]+?)\s+FL?(\d{1,3})\s*[-\u2013]\s*FL?(\d{1,3})/i);
        if (m) segments.push(normalizeSegment(m[1], ...m[2].split(/\s*-\s*/), m[3], m[4]));
      }
    }
  }

  segments = Array.from(new Set(segments.filter(Boolean)));

  if (segments.length > 0) {
    return { success: true, segments };
  }

  // Nothing found -> save to memory to learn later
  const entry = {
    input: rawText,
    expected_output: null,
    created_at: new Date().toISOString()
  };
  addMemoryEntry(entry);
  return { success: false, saved_to_memory: true, memory_entry: entry };
}

/* ===========================
   CLI + demo runner
   =========================== */

function printUsage() {
  console.log('Usage:');
  console.log('  node offline_notam_parser.js parse "<NOTAM TEXT>"');
  console.log('  node offline_notam_parser.js parse-file path/to/textfile.txt');
  console.log('  node offline_notam_parser.js add-memory "<NOTAM TEXT>" \'<JSON_ARRAY_OF_EXPECTED_OUTPUTS>\'');
  console.log('  node offline_notam_parser.js show-memory');
  console.log('');
  console.log('Example:');
  console.log('  node offline_notam_parser.js parse "Q0381/25 NOTAM... O/P: L736 NEDRA-GOMED FL045-FL130"');
}

function cli() {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    // run demo on several NOTAM examples (provided by user)
    demo();
    return;
  }

  const cmd = argv[0];
  if (cmd === 'parse') {
    const input = argv[1] || '';
    const res = parseNotam(input);
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  if (cmd === 'parse-file') {
    const p = argv[1];
    if (!p || !fs.existsSync(p)) {
      console.error('file missing');
      return;
    }
    const txt = fs.readFileSync(p, 'utf8');
    console.log(JSON.stringify(parseNotam(txt), null, 2));
    return;
  }
  if (cmd === 'add-memory') {
    const raw = argv[1] || '';
    const json = argv[2] || '[]';
    let expected;
    try { expected = JSON.parse(json); } catch(e) { console.error('expected JSON array invalid'); return; }
    const entry = {
      input: raw,
      expected_output: expected,
      created_at: new Date().toISOString()
    };
    addMemoryEntry(entry);
    console.log('added to memory:', JSON.stringify(entry, null, 2));
    return;
  }
  if (cmd === 'show-memory') {
    console.log(JSON.stringify(readMemory(), null, 2));
    return;
  }
  printUsage();
}

/* ===========================
   Demo - run on user's sample NOTAMs
   =========================== */

function demo() {
  console.log('Running demo on sample NOTAMs (your examples) ...\n');

  const samples = [
`Q0381/25 NOTAMNQ)UMKK/QARLC/IV/NBO/E/045/130/5435N02024E028
A)UMKK B)2508120600 C)2508152200
D)12-15 0600-2200
E)FLW ATS RTE SEGMENTS CLSD:L736 NEDRA-GOMED FL045-FL130N5 KALININGRAD/KHRABROVO VORDME(KRD)-GITOV FL045-FL130.
O/P: L736 NEDRA-GOMED FL045-FL130N5 KRD-GITOV FL045-FL130.`,

`A2625/25 NOTAMNQ)ZLHW/QARLT/IV/NBO/E/000/341/3938N09334E069
A)ZLHW B)2508120100 C)2508120600
E)SEGMENT TUSLI - DUNHUANG VOR'DNH' OF ATS RTE W187 CLSD AT 10,400M AND BELOW.FROM GND TO FL341
O/P: W187 TUSLI-DNH FL000-FL341`,

`A0310/25 NOTAMNQ)HECC/QARLC/IV/NBO/E/000/500/3028N02837E122
A)HECC B)2508180800 C)2508181030
E)THE FLW ATS RTE CLSD DUE TO MIL EXERAWY L321 KUNKI/OBRAN,AWY L604 BRN/DANAD,AWY L613 IMREK/MMA...
O/P: L321 KUNKI-OBRAN FL000-FL500L604 BRN-DANAD FL000-FL500L613 IMREK-MMA FL000-FL500`,

// a tricky one lacking O/P block
`A2709/25 NOTAMNQ)ZLHW/QARLT/IV/NBO/E/000/157/3920N09412E091
A)ZLHW B)2508180130 C)2508180830
E)FLW SEGMENT OF ATS RTE CLSD AT 4,800M AND BELOW:
1.W187:TUSLI - KARVI
2.W112:TUSLI - VIKUP
FROM FL000 TO FL157`,

// one that should probably be saved to memory due to odd formatting
`THIS IS A WEIRD ONE: NO FL INFO, JUST "CHECK ROUTES"`,

  ];

  samples.forEach((s, idx) => {
    console.log('--- Sample', idx+1);
    const out = parseNotam(s);
    console.log(JSON.stringify(out, null, 2), '\n');
  });

  console.log('Demo finished. If parser could not extract segments, that NOTAM was saved to memory.json for later teaching.');
}

/* ===========================
   Run CLI
   =========================== */
if (require.main === module) {
  cli();
}

/* ===========================
   Exports for programmatic use
   =========================== */
module.exports = {
  parseNotam,
  addMemoryEntry, // internal helper for advanced uses
  readMemory,
  writeMemory,
};
