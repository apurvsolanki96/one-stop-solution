// File: docs/offline-parser.js
// Purpose: offline NOTAM extractor (browser-safe). Exposes window.OfflineNotamParser.parse(text)
(function (global) {
  'use strict';
  function padFL(n) {
    if (!n) return null;
    n = String(n).toUpperCase().replace(/^FL/, '').replace(/\D/g, '');
    if (!n) return null;
    return 'FL' + n.padStart(3, '0');
  }
  function normalizeSegment(awy, left, right, flFrom, flTo) {
    if (!awy && !left && !right) return null;
    const awyNorm = awy ? awy.trim().toUpperCase().replace(/\s+/g, '') : '';
    left = (left || '').trim();
    right = (right || '').trim();
    const nodes = left && right ? `${left}-${right}` : (left || right || '').trim();
    const f = padFL(flFrom);
    const t = padFL(flTo);
    const flPart = (f && t) ? ` ${f}-${t}` : (f ? ` ${f}` : '');
    const out = `${awyNorm}${awyNorm && nodes ? ' ' : ''}${nodes}${flPart}`.trim();
    return out || null;
  }
  function extractFromOP(text) {
    const out = [];
    const opMatch = text.match(/O\/P:\s*([\s\S]+)/i);
    if (!opMatch) return out;
    const opText = opMatch[1].split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    for (const ln of opText) {
      const parts = ln.split(/(?:\s{2,}|\u00A0|\s(?=[A-Z]\d{1,4}\s))/).map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        const m = p.match(/([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\s+([A-Z0-9'()\/\s\-]+?)\s+FL?(\d{1,3})\s*[-\u2013]\s*FL?(\d{1,3})/i);
        if (m) out.push(normalizeSegment(m[1], ...m[2].split(/\s*-\s*/), m[3], m[4]));
      }
    }
    return out.filter(Boolean);
  }
  function extractFromE(text) {
    const out = [];
    const eMatch = text.match(/E\)\s*([\s\S]+?)(?:O\/P:|$)/i);
    const subject = eMatch ? eMatch[1] : text;
    const regex = /([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\s+([A-Z0-9'()\/\-\s]+?)\s+FL?(\d{1,3})\s*[-\u2013]\s*FL?(\d{1,3})/gmi;
    let m;
    while ((m = regex.exec(subject)) !== null) {
      const nodes = m[2].trim();
      let left = '', right = '';
      const pair = nodes.match(/([A-Z0-9'()\/]+)\s*-\s*([A-Z0-9'()\/]+)/i);
      if (pair) { left = pair[1]; right = pair[2]; }
      else {
        const sp = nodes.split(/\s*-\s*/);
        if (sp.length >= 2) { left = sp[0]; right = sp[1]; } else { left = nodes; }
      }
      const norm = normalizeSegment(m[1], left, right, m[3], m[4]);
      if (norm) out.push(norm);
    }
    const awyLineRegex = /([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\s+([A-Z0-9'()\/\-\s]+)/gi;
    const flRangeRegex = /FROM\s+FL?(\d{1,3})\s*(?:TO|-)\s*FL?(\d{1,3})/i;
    const flRangeMatch = subject.match(flRangeRegex);
    if (flRangeMatch) {
      const flFrom = flRangeMatch[1], flTo = flRangeMatch[2];
      let lm;
      while ((lm = awyLineRegex.exec(subject)) !== null) {
        const awy = lm[1];
        const nodes = lm[2].trim();
        const pair = nodes.match(/([A-Z0-9'()\/]+)\s*-\s*([A-Z0-9'()\/]+)/i);
        if (pair) {
          out.push(normalizeSegment(awy, pair[1], pair[2], flFrom, flTo));
        } else {
          const smallPair = nodes.match(/([A-Z0-9'()]+)\s*-\s*([A-Z0-9'()]+)/i);
          if (smallPair) out.push(normalizeSegment(awy, smallPair[1], smallPair[2], flFrom, flTo));
        }
      }
    }
    return Array.from(new Set(out.filter(Boolean)));
  }
  function extractGeneric(text) {
    const out = [];
    const regex = /([A-Z]\d{1,4}|[A-Z]{1,3}\d{1,3})\b[^\n]{0,90}?FL?(\d{1,3})\s*[-\u2013]\s*FL?(\d{1,3})/gmi;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const snippet = m[0];
      const awy = m[1];
      const flFrom = m[2], flTo = m[3];
      const mid = snippet.replace(m[1], '').replace(m[2], '').replace(m[3], '');
      const nodes = mid.match(/([A-Z0-9'()\/]+)\s*-\s*([A-Z0-9'()\/]+)/i);
      if (nodes) out.push(normalizeSegment(awy, nodes[1], nodes[2], flFrom, flTo));
    }
    return Array.from(new Set(out.filter(Boolean)));
  }
  function parse(text) {
    if (!text || !text.trim()) return { success: false, error: 'empty input' };
    const t = String(text).replace(/\r\n/g, '\n');
    let segments = extractFromOP(t);
    if (!segments.length) segments = extractFromE(t);
    if (!segments.length) segments = extractGeneric(t);
    segments = Array.from(new Set(segments.filter(Boolean)));
    return { success: segments.length > 0, segments };
  }
  global.OfflineNotamParser = { parse };
})(window);
