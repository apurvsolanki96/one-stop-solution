// offline-parser.js
// Drop-in offline parser for NOTAM airway extraction
// Exposes window.OfflineNotamParser.parse(notamText) -> { success: bool, segments: [ ... ] }

(function () {
  'use strict';

  // Helper: normalize whitespace and uppercase
  function normalizeText(s) {
    if (!s) return '';
    return s.replace(/\u00A0/g, ' ')
            .replace(/[\u200B\uFEFF]/g, '')
            .replace(/\r\n?/g, '\n')
            .split('\n').map(line => line.trim()).join('\n')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
  }

  // Extract short waypoint/identifier from a phrase
  function extractShort(pt) {
    if (!pt) return '';
    // prefer quoted like 'DNH' or (DNH)
    let m = pt.match(/'([A-Z0-9]{2,6})'/i) || pt.match(/\(([A-Z0-9]{2,6})\)/i);
    if (m) return m[1].toUpperCase();
    // remove known words
    pt = pt.replace(/\b(VOR\/DME|VOR|NDB|FIX|WAYPOINT|VORDME|VORDME|RADIOBEACON)\b/gi, '').trim();
    const arr = pt.split(/\s+/);
    for (let i = arr.length - 1; i >= 0; i--) {
      if (/^[A-Z0-9]{2,6}$/.test(arr[i])) return arr[i].toUpperCase();
    }
    // fallback to last token
    return (arr[arr.length - 1] || '').toUpperCase();
  }

  // Parse FL range from various parts of the text
  function parseFLRange(text) {
    // 1) Q) ... /E/<min>/<max>/ pattern (example: /E/095/110/)
    let m = text.match(/\/E\/(\d{1,3})\/(\d{1,3})\//i);
    if (m) {
      const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (!isNaN(a) && !isNaN(b)) return { min: a, max: b };
    }

    // 2) "FROM GND TO FL341" or "FROM FL000 TO FL351" etc.
    m = text.match(/FROM\s+(GND|FL?\s*\d{1,3})\s+TO\s+(FL?\s*\d{1,3})/i);
    if (m) {
      const aRaw = m[1].replace(/\s+/g, '');
      const bRaw = m[2].replace(/\s+/g, '');
      const a = (/GND/i.test(aRaw)) ? 0 : parseInt(aRaw.replace(/FL/i, ''), 10);
      const b = parseInt(bRaw.replace(/FL/i, ''), 10);
      if (!isNaN(a) && !isNaN(b)) return { min: a, max: b };
    }

    // 3) standalone "FL095/FL110" or "FL000-FL500" or "FL095-FL110"
    m = text.match(/FL\s*?(\d{1,3})\s*[\/\-]\s*FL\s*?(\d{1,3})/i);
    if (m) {
      return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
    }
    // 4) "BTN 6,300M(INCLUSIVE) AND 9,200M(INCLUSIVE)" - distances, ignore
    // fallback: none
    return null;
  }

  // Clean route token (remove trailing punctuation)
  function cleanToken(s) {
    if (!s) return '';
    return s.replace(/^[\s\.\-:,]+|[\s\.\-:,]+$/g, '').trim();
  }

  // Try to split a segment phrase into list of waypoint strings
  // Accepts chains like "NEDRA-GOMED" or "KESUM-RINMU" or "RAZDOLYE NDB (BD) - OKLUR"
  function splitChainToPoints(phrase) {
    if (!phrase) return [];
    // Replace common separators with '|'
    let p = phrase.replace(/\s*-\s*/g, '|')      // hyphen separators
                  .replace(/\s*TO\s*/gi, '|')    // "TO"
                  .replace(/\s*,\s*/g, '|');     // commas inside phrase
    const parts = p.split('|').map(s => cleanToken(s)).filter(Boolean);
    // For each part, try to extract short form
    return parts.map(extractShort).filter(Boolean);
  }

  // Given list of points [A,B,C], and route code, and FL range string, produce consecutive pairs
  function buildPairs(routeCode, pts, flStr) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (!a || !b || a === b) continue;
      out.push(`${routeCode} ${a}-${b}${flStr ? ' ' + flStr : ''}`);
    }
    return out;
  }

  // Find candidate texts to parse segments from:
  // prefer E) line, O/P:, or anywhere "ATS RTE" or "SEGMENT ... CLSD" blocks
  function gatherCandidateBlocks(text) {
    const candidates = [];
    // 1. Grab E) ... markers — often followed by segment description til next capital letter-letter) like A),B)
    const eMatches = [...text.matchAll(/E\)\s*([^A-Z]\S.*?)(?=\s*[A-Z]\)|\n[A-Z]\)|\n[A-Z]{1,2}\)|$)/gis)];
    if (eMatches.length) {
      for (const mm of eMatches) {
        const val = mm[1].trim();
        if (val) candidates.push(val);
      }
    }
    // 2. O/P: block may contain cleaned output - include if exists
    const opMatch = text.match(/O\/P[:\s]+(.+)$/i);
    if (opMatch) candidates.push(opMatch[1].trim());
    // 3. Phrases with "ATS RTE" or "SEGMENT" or "FLW SEGMENT" or "AWY"
    const segHdr = [...text.matchAll(/(ATS RTE|SEGMENT|FLW SEGMENT|AWY|AWY|ATS ROUTE|ATS RTE SEGMENT)[\s\S]{0,200}/gi)];
    // Instead of relying on these short matches, split entire text into sentences and pick sentences containing route tokens
    const sentences = text.split(/[\.\n\r;]+/).map(s => s.trim()).filter(Boolean);
    for (const s of sentences) {
      // contains airway code pattern (letter(s) then digits) and a hyphen or " - " or "TO"
      if (/[A-Z]{1,3}\d{1,4}/.test(s) && (/-| TO | - |'/i.test(s) || /VOR|NDB|VORDME|NDB/i.test(s))) {
        candidates.push(s);
      }
    }
    // 4. As fallback, include any sentence that mentions "FL" and a route code
    for (const s of sentences) {
      if (/[A-Z]{1,3}\d{1,4}/.test(s) && /FL\s*\d{1,3}/i.test(s)) candidates.push(s);
    }
    return candidates.map(c => c.replace(/\s+/g, ' ').trim());
  }

  // Extract route code and following route description from a piece of text
  // returns array of { code, desc } matched
  function extractRouteEntriesFromPiece(piece) {
    const out = [];
    // common pattern: <ROUTE_CODE> <rest...>
    // match sequences like L321, W187, A822, M997, P733, etc.
    const regex = /([A-Z]{1,3}\d{1,4})\b\s*[:\-]?\s*(.+)/i;
    // But sometimes the route code is embedded like "... AWY L321 KUNKI/OBRAN ..."
    // So we'll search for all route codes and then take the text that follows up to next route code or sentence end.
    const routeCodePattern = /([A-Z]{1,3}\d{1,4})/g;
    let match;
    const codes = [];
    while ((match = routeCodePattern.exec(piece)) !== null) {
      codes.push({ idx: match.index, code: match[1] });
    }
    if (codes.length === 0) {
      // try simpler pattern: first token looks like code
      const m = piece.match(regex);
      if (m) out.push({ code: m[1].toUpperCase(), desc: m[2] });
      return out;
    }
    // For each code, capture following substring until next code occurrence
    for (let i = 0; i < codes.length; i++) {
      const rc = codes[i].code.toUpperCase();
      const start = codes[i].idx + codes[i].code.length;
      const end = (i + 1 < codes.length) ? codes[i + 1].idx : piece.length;
      let desc = piece.slice(start, end).replace(/^[\s\:\-\,\.]+|[\s\:\-\,\.]+$/g, '');
      if (!desc) {
        // maybe the route is immediately followed by point pairs in the same word, attempt to find next tokens
        desc = piece.slice(start, Math.min(start + 120, piece.length));
      }
      out.push({ code: rc, desc: desc });
    }
    return out;
  }

  // Main parse function
  function parseNotam(notamRaw) {
    if (!notamRaw || !String(notamRaw).trim()) return { success: false };

    const text = normalizeText(notamRaw);
    const flRange = parseFLRange(text);
    const flStr = flRange ? `FL${String(flRange.min).padStart(3, '0')}-FL${String(flRange.max).padStart(3, '0')}` : '';

    const candidates = gatherCandidateBlocks(text);
    const segments = [];

    for (const cand of candidates) {
      // split candidate into small pieces by comma and "AND" when appropriate
      const pieces = cand.split(/(?:;|\/O\/P:|,|\band\b|\bor\b|\.)/i).map(s => s.trim()).filter(Boolean);
      for (const piece of pieces) {
        // if piece contains phrase like "FROM FL000 TO FL500" remove it for parsing the chain
        const cleanedPiece = piece.replace(/FROM\s+FL?\s*\d{1,3}\s+TO\s+FL?\s*\d{1,3}/ig, '').trim();
        const entries = extractRouteEntriesFromPiece(cleanedPiece);
        if (!entries || !entries.length) continue;
        for (const e of entries) {
          // sometimes desc contains multiple chains separated by commas or "AND"
          const subChains = e.desc.split(/\b(?:AND|,|;)\b/i).map(s => s.trim()).filter(Boolean);
          for (const sc of subChains) {
            // sc might be like "NEDRA-GOMED FL045-FL130N5 KALININGRAD/KHRABROVO VORDME(KRD)-GITOV FL045-FL130"
            // we remove trailing FL ranges or qualifiers, keep only chain part
            let scClean = sc.replace(/FL\s*\d{1,3}(?:[\-\/]\s*FL?\d{1,3})?/ig, '').trim();
            scClean = scClean.replace(/\b(NM|M)\b/ig, '').trim();
            // split chain into points
            const pts = splitChainToPoints(scClean);
            if (pts.length < 2) {
              // a fallback: sometimes chain is "KESUM-RINMU FL275-FL540" etc but hyphen removed by cleaning
              const hyMatch = sc.match(/([A-Z0-9]{2,6})\s*-\s*([A-Z0-9]{2,6})/i);
              if (hyMatch) {
                const a = hyMatch[1].toUpperCase(), b = hyMatch[2].toUpperCase();
                if (a !== b) segments.push(`${e.code} ${a}-${b}${flStr ? ' ' + flStr : ''}`);
                continue;
              }
              continue;
            }
            const pairs = buildPairs(e.code, pts, flStr);
            for (const p of pairs) segments.push(p);
          }
        }
      }
    }

    // Additional heuristic: some NOTAMs list routes like "L321 KUNKI/OBRAN, AWY L604 BRN/DANAD, ..." in a single line
    // Try to find patterns of "<code> <POINT>-<POINT>" anywhere
    const extraMatches = text.matchAll(/([A-Z]{1,3}\d{1,4})\s+([A-Z0-9\(\)\'\s\/\-]+?)(?=(?:\s+[A-Z]{1,3}\d{1,4}\s+)|$|\.)/g);
    for (const em of extraMatches) {
      try {
        const rc = (em[1] || '').toUpperCase();
        const desc = (em[2] || '').trim();
        if (!rc || !desc) continue;
        // desc may contain multiple chains split by comma or semicolon
        const parts = desc.split(/,|;/).map(s => s.trim()).filter(Boolean);
        for (const p of parts) {
          const pts = splitChainToPoints(p);
          if (pts.length < 2) {
            // fallback hyphen detection
            const mm = p.match(/([A-Z0-9]{2,6})\s*-\s*([A-Z0-9]{2,6})/i);
            if (mm) {
              const a = mm[1].toUpperCase(), b = mm[2].toUpperCase();
              if (a !== b) segments.push(`${rc} ${a}-${b}${flStr ? ' ' + flStr : ''}`);
            }
            continue;
          }
          const pairs = buildPairs(rc, pts, flStr);
          for (const pr of pairs) segments.push(pr);
        }
      } catch (e) {
        // ignore
      }
    }

    // dedupe and preserve order
    const out = [];
    const seen = new Set();
    for (const s of segments) {
      const v = s.replace(/\s+/g, ' ').trim();
      if (!v) continue;
      if (!seen.has(v)) { seen.add(v); out.push(v); }
    }

    if (!out.length) return { success: false, segments: [] };
    return { success: true, segments: out };
  }

  // Expose parser on window
  window.OfflineNotamParser = {
    parse: parseNotam,
    // optional helper for debugging
    _debug: {
      normalizeText, parseFLRange, gatherCandidateBlocks, extractRouteEntriesFromPiece
    }
  };
})();
