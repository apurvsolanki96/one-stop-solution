// offline-parser.js
// Simple offline NOTAM parser to extract route segments and FL ranges.
// Designed to be lightweight and run entirely in the browser.
// Keeps the same UI structure, reads from #notamBox and writes to #output.

(function(){
  function meterToFL(m) {
    // meters -> feet -> FL (hundreds of feet). Use floor to be conservative.
    const feet = m * 3.28084;
    const fl = Math.floor(feet / 100);
    return fl;
  }

  function extractFLRange(text) {
    text = text.toUpperCase();
    // FL045-FL130 or FL045 - FL130
    let m = text.match(/FL\s*(\d{1,3})\s*[-–]\s*FL\s*(\d{1,3})/i);
    if (m) return {low: m[1].padStart(3,'0'), high: m[2].padStart(3,'0')};

    // FROM FL000 TO FL157
    m = text.match(/FROM\s+FL\s*(\d{1,3})\s+TO\s+FL\s*(\d{1,3})/i);
    if (m) return {low: m[1].padStart(3,'0'), high: m[2].padStart(3,'0')};

    // single FL number e.g. FL045 -> treat as low==high
    m = text.match(/\bFL\s*(\d{1,3})\b/i);
    if (m) return {low: m[1].padStart(3,'0'), high: m[1].padStart(3,'0')};

    // meters pattern e.g. 4,800M or 4800M
    m = text.match(/(\d{3,6})\s*M\b/i);
    if (m) {
      const meters = parseInt(m[1].replace(/,/g,''),10);
      const fl = meterToFL(meters);
      return {low: String(fl).padStart(3,'0'), high: String(fl).padStart(3,'0')};
    }

    // meters phrase "AT 4,800M AND BELOW" -> treat as high = converted value
    m = text.match(/(\d{3,6})\s*M\b/i);
    if (m) {
      const meters = parseInt(m[1].replace(/,/g,''),10);
      const fl = meterToFL(meters);
      return {low: '000', high: String(fl).padStart(3,'0')};
    }

    return null;
  }

  function shortenDesc(desc) {
    if (!desc) return '';
    let s = desc.replace(/VORDME|VOR|NDB|DME|AERODROME|RWY|RUNWAY|TAXIWAY|TWY/ig, '').trim();
    // prefer parenthetical code like (KRD)
    const par = s.match(/\(([^)A-Z0-9]{0,}?([A-Z0-9]{2,4})[^)]*)\)/);
    if (par && par[1]) {
      const code = par[1].match(/[A-Z0-9]{2,4}/);
      if (code) return code[0];
    }
    // if contains slash-separated names, take last token parts and join initials
    if (s.indexOf('/') !== -1) {
      const parts = s.split('/').map(p=>p.trim()).filter(Boolean);
      if (parts.length>1) {
        // try to extract short uppercase sequence from last part
        const last = parts[parts.length-1];
        const m = last.match(/([A-Z]{2,4})/);
        if (m) return m[1];
        return parts[parts.length-1].split(' ').slice(0,2).map(x=>x.substr(0,3)).join('-');
      }
    }
    // if hyphenated pair, try to compress to CODE1-CODE2 by taking up to 6 chars each
    if (s.indexOf('-') !== -1) {
      const parts = s.split('-').map(p=>p.trim()).filter(Boolean);
      if (parts.length>=2) {
        const a = parts[0].split(' ').pop().replace(/[^A-Z0-9]/ig,'').substr(0,6);
        const b = parts[parts.length-1].split(' ').pop().replace(/[^A-Z0-9]/ig,'').substr(0,6);
        return (a + '-' + b).toUpperCase();
      }
    }
    // fallback: take last two words
    const toks = s.split(' ').filter(Boolean);
    return toks.slice(-2).join('-').toUpperCase().replace(/[^A-Z0-9\-]/g,'');
  }

  function extractRoutes(lines) {
    const routes = [];
    // Look for lines that start with a route code (letter(s)+digits) like L736, W187, N5, etc.
    const routeRx = /^\s*([A-Z]{1,2}\d{1,4}|[A-Z]{1}[0-9]{1,2}\b)\b[:\.]?\s*(.*)$/i;
    for (let i=0;i<lines.length;i++) {
      const line = lines[i].trim();
      const m = line.match(routeRx);
      if (m) {
        const code = m[1].toUpperCase();
        let rest = m[2] || '';
        // sometimes route and description on following lines
        if (!rest && i+1 < lines.length) rest = lines[i+1].trim();
        routes.push({code, desc: rest, idx:i});
      } else {
        // also check for patterns like "W187:TUSLI - KARVI" inline anywhere
        const inline = line.match(/\b([A-Z]{1,2}\d{1,4})[:\)]?\s*([A-Z\-\s\/]+)\b/i);
        if (inline) {
          routes.push({code: inline[1].toUpperCase(), desc: inline[2].trim(), idx:i});
        }
      }
    }
    return routes;
  }

  

  function normalize(text){ return text.replace(/\u2013|\u2014/g,'-').replace(/\s+/g,' ').trim(); }

  function meterToFL(m) {
    // meters -> feet -> FL (hundreds of feet). Use floor to be conservative.
    const feet = m * 3.28084;
    const fl = Math.floor(feet / 100);
    return fl;
  }

  function extractFLRange(text) {
    text = (text||'').toUpperCase();
    text = normalize(text);
    // FL045-FL130 or FL045 - FL130
    let m = text.match(/\bFL\s*(\d{1,3})\s*[-–]\s*FL\s*(\d{1,3})\b/);
    if (m) return {low: m[1].padStart(3,'0'), high: m[2].padStart(3,'0')};

    // FROM FL000 TO FL157
    m = text.match(/\bFROM\s+FL\s*(\d{1,3})\s+TO\s+FL\s*(\d{1,3})\b/);
    if (m) return {low: m[1].padStart(3,'0'), high: m[2].padStart(3,'0')};

    // AT X,XXXM AND BELOW / AT X,XXXM AND ABOVE / AT X,XXXM
    m = text.match(/(\d{3,6})\s*M\b/);
    if (m) {
      const meters = parseInt(m[1].replace(/,/g,''),10);
      const fl = meterToFL(meters);
      // common phrasing "AT 4800M AND BELOW" -> treat as high=fl
      if (/AND\s*BELOW/.test(text)) return {low:'000', high:String(fl).padStart(3,'0')};
      if (/AND\s*ABOVE/.test(text)) return {low:String(fl).padStart(3,'0'), high:'999'};
      return {low:String(fl).padStart(3,'0'), high:String(fl).padStart(3,'0')};
    }

    // single FL number e.g. FL045 -> treat as low==high
    m = text.match(/\bFL\s*(\d{1,3})\b/);
    if (m) return {low: m[1].padStart(3,'0'), high: m[1].padStart(3,'0')};

    // Range in meters phrase like "FROM 0M TO 157M" unlikely but handle
    m = text.match(/\bFROM\s+(\d{1,6})\s*M\s+TO\s+(\d{1,6})\s*M\b/);
    if (m) {
      const low = meterToFL(parseInt(m[1],10));
      const high = meterToFL(parseInt(m[2],10));
      return {low:String(low).padStart(3,'0'), high:String(high).padStart(3,'0')};
    }

    return null;
  }

  function shortenDesc(desc) {
    if (!desc) return '';
    let s = desc.replace(/VORDME|VOR|NDB|DME|AERODROME|RWY|RUNWAY|TAXIWAY|TWY/ig, '').trim();
    // prefer parenthetical code like (KRD)
    const par = s.match(/\(([^)A-Z0-9]{0,}?([A-Z0-9]{2,4})[^)]*)\)/);
    if (par && par[1]) {
      const code = par[1].match(/[A-Z0-9]{2,4}/);
      if (code) return code[0];
    }
    // if contains slash-separated names, take last token parts and join initials
    if (s.indexOf('/') !== -1) {
      const parts = s.split('/').map(p=>p.trim()).filter(Boolean);
      if (parts.length>1) {
        // try to extract short uppercase sequence from last part
        const last = parts[parts.length-1];
        const m = last.match(/([A-Z]{2,4})/);
        if (m) return m[1];
        return parts[parts.length-1].split(' ').slice(0,2).map(x=>x.substr(0,3)).join('-');
      }
    }
    // if hyphenated pair, try to compress to CODE1-CODE2 by taking up to 6 chars each
    if (s.indexOf('-') !== -1) {
      const parts = s.split('-').map(p=>p.trim()).filter(Boolean);
      if (parts.length>=2) {
        const a = parts[0].split(' ').pop().replace(/[^A-Z0-9]/ig,'').substr(0,6);
        const b = parts[parts.length-1].split(' ').pop().replace(/[^A-Z0-9]/ig,'').substr(0,6);
        return (a + '-' + b).toUpperCase();
      }
    }
    // fallback: take last two words
    const toks = s.split(' ').filter(Boolean);
    return toks.slice(-2).join('-').toUpperCase().replace(/[^A-Z0-9\-]/g,'');
  }

  function extractRoutes(lines) {
    const routes = [];
    const routeRx = /^\s*([A-Z]{1,2}\d{1,4}|[A-Z]\d{1,3})\b[:\.\)]?\s*(.*)$/i;
    for (let i=0;i<lines.length;i++) {
      const line = lines[i].trim();
      // common "1.W187:TUSLI - KARVI" pattern -> remove leading numbered list
      const cleaned = line.replace(/^\d+\.\s*/, '');
      const m = cleaned.match(routeRx);
      if (m && /[A-Z]{1,2}\d{1,4}/i.test(m[1])) {
        const code = m[1].toUpperCase();
        let rest = m[2] || '';
        if (!rest && i+1 < lines.length) rest = lines[i+1].trim();
        rest = rest.replace(/:+/g,':').replace(/\s*-\s*/g,'-').trim();
        routes.push({code, desc: rest, idx:i});
        continue;
      }
      // lines like "L736 NEDRA-GOMED FL045-FL130"
      const inline = line.match(/\b([A-Z]{1,2}\d{1,4})\b[\s\:]*([A-Z0-9\-\s\/\(\)]+)(FL|FROM|WITH|$)/i);
      if (inline) {
        const code = inline[1].toUpperCase();
        const desc = inline[2].trim().replace(/\s{2,}/g,' ');
        routes.push({code, desc, idx:i});
      }
    }
    return routes;
  }

function parseNotam(text) {
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const results = [];
    const routes = extractRoutes(lines);

    // For each route try to find a FL range within nearby lines
    for (const r of routes) {
      // search within a window of 3 lines after the route
      const window = lines.slice(r.idx, r.idx+4).join(' ');
      const fl = extractFLRange(window) || extractFLRange(lines.join(' '));
      if (fl) {
        results.push({route: r.code, desc: r.desc, low: fl.low, high: fl.high});
      } else {
        // fallback: look for numbers like FL045-FL130 anywhere
        const anyFL = extractFLRange(lines.join(' '));
        if (anyFL) results.push({route: r.code, desc: r.desc, low:anyFL.low, high:anyFL.high});
        else results.push({route: r.code, desc: r.desc, low:null, high:null});
      }
    }

    // If no explicit routes found, attempt to find route mentions like "L736 NEDRA-GOMED"
    if (results.length===0) {
      for (const line of lines) {
        const m = line.match(/\b([A-Z]{1,2}\d{1,4})\b[\s:\)]*([A-Z\-\s\/]+)\b.*(FL\s*\d{1,3}[-–]FL\s*\d{1,3}|FROM\s+FL\s*\d{1,3}\s+TO\s+FL\s*\d{1,3}|\d{3,6}M)/i);
        if (m) {
          const code=m[1].toUpperCase();
          const desc=m[2].trim();
          const fl = extractFLRange(line) || extractFLRange(lines.join(' '));
          results.push({route: code, desc, low: fl?fl.low:null, high: fl?fl.high:null});
        }
      }
    }

    return results;
  }

  function renderResults(arr) {
    const out = document.getElementById('output');
    if (!out) return;
    if (!arr || arr.length===0) {
      out.innerText = 'No route segments detected by offline parser.';
      return;
    }
    const lines = arr.map(r=>{
      if (r.low && r.high) return `${r.route} ${r.desc} FL${r.low}-FL${r.high}`;
      if (r.low && !r.high) return `${r.route} ${r.desc} FL${r.low}`;
      return `${r.route} ${r.desc}`;
    });
    out.innerText = lines.join('\n');
  }

  // bind to UI
  document.addEventListener('DOMContentLoaded', ()=> {
    const btn = document.getElementById('offlineParseBtn');
    if (!btn) return;
    btn.addEventListener('click', ()=>{
      const text = (document.getElementById('notamBox')||{value:''}).value;
      const res = parseNotam(text);
      renderResults(res);
    });
  });

}

  // Expose a simple interface for other scripts to call the offline parser
  window.offlineProcess = function(text) {
    const arr = parseNotam(text || '');
    if (!arr || arr.length===0) return { output: 'No route segments detected by offline parser.' };
    const lines = arr.map(r => {
      if (r.low && r.high) return `${r.route} ${r.desc} FL${r.low}-FL${r.high}`;
      if (r.low && !r.high) return `${r.route} ${r.desc} FL${r.low}`;
      return `${r.route} ${r.desc}`;
    });
    return { output: lines.join('\n') };
  };

  // Also expose a render helper if other scripts want to render directly
  window.offlineRender = function(text) {
    const arr = parseNotam(text || '');
    renderResults(arr);
  };

})();