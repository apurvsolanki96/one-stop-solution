// notam-parser-tested.js
// Offline NOTAM parser with diagnostics/test runner.
// KEEP IN SEPARATE FOLDER. This file does not call any network services.

(function(){
  // UI
  const input = document.getElementById('input');
  const parseBtn = document.getElementById('parse');
  const clearBtn = document.getElementById('clear');
  const fileInput = document.getElementById('file');
  const resultDiv = document.getElementById('result');
  const summaryDiv = document.getElementById('summary');
  const exportBtn = document.getElementById('export');
  const runAllBtn = document.getElementById('runAll');
  const sampleBtn = document.getElementById('sample');

  // Helper utilities
  function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function csvSafe(s){ if (s===undefined||s===null) return ''; s = String(s).replace(/"/g,'""'); return `"${s}"`; }

  // Robust split: splits by double blank lines OR by NOTAM id lines or lines that begin with Q) or with 4-letter ICAO as headline
  function splitNotams(text){
    if (!text) return [];
    const normalized = text.replace(/\r/g,'').trim();
    // primary attempt: split on two or more newlines (common)
    let chunks = normalized.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
    if (chunks.length > 1) return chunks;

    // fallback: find positions where line begins with NOTAM id, 'NOTAM', 'Q)' or a 4-letter ICAO line or typical "Axxxx/yy" patterns
    const lines = normalized.split('\n');
    const indices = [];
    for (let i=0;i<lines.length;i++){
      const L = lines[i].trim();
      if (!L) continue;
      if (/^(NOTAM|NOTAMN|NOTAMR)\b/i.test(L)) indices.push(i);
      else if (/^[A-Z]\d{1,}\/\d{2,}\b/i.test(L)) indices.push(i);
      else if (/^Q\)/i.test(L)) indices.push(i);
      else if (/^[A-Z]{4}\b/.test(L) && /^\s*[A-Z]{4}\s*$/.test(L)) indices.push(i); // single ICAO line
    }
    if (indices.length>1){
      const out=[];
      for (let k=0;k<indices.length;k++){
        const start = indices[k];
        const end = (k+1<indices.length)? indices[k+1] : lines.length;
        out.push(lines.slice(start,end).join('\n').trim());
      }
      return out;
    }

    // last resort: split by lines that look like Q) or 'Axxxx/yy' within the block
    const alt = normalized.split(/\n(?=Q\)|[A-Z]\d{1,}\/\d{2,})/i).map(s=>s.trim()).filter(Boolean);
    return alt.length>0? alt : [normalized];
  }

  // Parse single NOTAM chunk heuristics
  function parseOne(raw){
    const original = raw.replace(/\r/g,'').trim();
    const s = original.replace(/\s+/g,' ').trim();

    // id — common A1234/25 or NOTAMN / NOTAMR tokens
    const idMatch = original.match(/\b([A-Z]\d{1,}\/\d{2,})\b/);
    const notamTag = original.match(/\b(NOTAMN?|NOTAMR)\b/i);
    const id = idMatch? idMatch[1] : (notamTag? notamTag[0] : '');

    // Q-line capture (full)
    const qFull = original.match(/Q\)\s*([A-Z0-9 \/\-\+\(\)\.\,]+)/i);
    const qline = qFull? qFull[1].trim() : '';

    // Attempt to decode Q-line fields (very helpful for ICAO, FIR, subject)
    let qDecoded = {};
    if (qline){
      const qparts = qline.split(/\s+/);
      // naive: first token often a site/fir or classification. We'll just store raw and split by '/'
      const slashParts = qline.split('/');
      qDecoded.raw = qline;
      qDecoded.fields = slashParts.map(p => p.trim());
    }

    // Extract 4-letter ICAOs (but filter common words)
    const stop = new Set(['FROM','TO','WITH','THIS','NOTAM','ESTD','UNL','AERO']);
    const icaoMatches = [...original.matchAll(/\b([A-Z]{4})\b/g)].map(m=>m[1]).filter(x=>!stop.has(x));
    const icaos = [...new Set(icaoMatches)].slice(0,6);

    // Times: try multiple patterns
    let timeRange = '';
    const t1 = original.match(/\b(\d{6}T\d{4}Z?)\s*\/\s*(\d{6}T\d{4}Z?)\b/i);
    if (t1) timeRange = `${t1[1]} / ${t1[2]}`;
    else {
      const t2 = original.match(/\bFROM\s+(\d{6}T\d{4}Z?)\s+TO\s+(\d{6}T\d{4}Z?)\b/i);
      if (t2) timeRange = `${t2[1]} / ${t2[2]}`;
      else {
        const t3 = original.match(/\bFROM\s+([0-9]{6})\s+TO\s+([0-9]{6})\b/);
        if (t3) timeRange = `${t3[1]} / ${t3[2]}`;
      }
    }

    // message: remove id and q-line and common tags
    let message = original;
    if (id) message = message.replace(id,'');
    if (qFull) message = message.replace(qFull[0],'');
    message = message.replace(/\b(NOTAMN?|NOTAMR)\b/ig,'').trim();

    // further structure extraction: look for "RWY", "TWY", "AD", "SVC", etc.
    const runwayMatch = message.match(/\b(RWY|RUNWAY)\s*([0-9LRC\/\-]{1,10})/i);
    const twyMatch = message.match(/\b(TWY|TAXIWAY)\s*([A-Z0-9\-\s]{1,20})/i);
    const adMatch = message.match(/\b(AD|AERODROME)\b/i);

    // confidence heuristics
    let confidence = 0;
    if (id) confidence += 1;
    if (qline) confidence += 1;
    if (icaos.length) confidence += 1;
    if (timeRange) confidence += 1;
    if (message && message.length>10) confidence += 1;

    return {
      raw: original,
      id: id || '',
      notamTag: notamTag? notamTag[0] : '',
      qline: qDecoded,
      icaos,
      timeRange,
      runway: runwayMatch? runwayMatch[2] : '',
      taxiway: twyMatch? twyMatch[2] : '',
      adFlag: !!adMatch,
      message: message.trim(),
      confidence // 0..5
    };
  }

  // Render table + diagnostics
  function renderResults(arr){
    if (!arr || arr.length===0) return '<p class="small">No NOTAMs parsed.</p>';
    let html = '<div class="ok"><strong>Parsed NOTAMs:</strong> ' + arr.length + ' entries. Click rows for raw NOTAM.</div>';
    html += '<table><thead><tr><th>#</th><th>ID</th><th>ICAO(s)</th><th>Time range</th><th>RWY/TWY</th><th>Confidence</th></tr></thead><tbody>';
    arr.forEach((it,i)=>{
      const confColor = it.confidence >=4 ? '#0b8f3b' : (it.confidence>=2 ? '#b38600' : '#d04b4b');
      html += `<tr data-idx="${i}" style="cursor:pointer">
        <td>${i+1}</td>
        <td>${escapeHtml(it.id || it.notamTag)}</td>
        <td>${escapeHtml(it.icaos.join(', '))}</td>
        <td>${escapeHtml(it.timeRange)}</td>
        <td>${escapeHtml((it.runway||'') + (it.taxiway? ' / ' + it.taxiway : ''))}</td>
        <td style="color:${confColor};font-weight:700">${it.confidence}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    html += '<div class="small" style="margin-top:8px">Click any row to view the full parsed fields and raw NOTAM.</div>';
    return html;
  }

  // Show details for a selected row
  function showDetails(item){
    let html = '<div style="margin-top:10px">';
    html += `<h3 style="margin:4px 0 6px 0">Details — ID: ${escapeHtml(item.id || item.notamTag)}</h3>`;
    html += `<div><strong>ICAO(s):</strong> ${escapeHtml(item.icaos.join(', '))}</div>`;
    html += `<div><strong>Time range:</strong> ${escapeHtml(item.timeRange)}</div>`;
    html += `<div><strong>Runway:</strong> ${escapeHtml(item.runway)} &nbsp; <strong>Taxiway:</strong> ${escapeHtml(item.taxiway)}</div>`;
    html += `<div><strong>Q-line raw:</strong> <code style="display:block;background:#f6f8fb;padding:6px;border-radius:6px">${escapeHtml(item.qline.raw || '')}</code></div>`;
    html += `<div style="margin-top:8px"><strong>Message (trimmed):</strong><pre style="white-space:pre-wrap;background:#fcfcff;border-radius:6px;padding:8px">${escapeHtml(item.message)}</pre></div>`;
    html += `<div style="margin-top:6px"><strong>Confidence score:</strong> ${item.confidence} / 5</div>`;
    html += `<div style="margin-top:8px"><strong>Raw NOTAM:</strong><pre style="white-space:pre-wrap;background:#fff7f7;border-radius:6px;padding:8px">${escapeHtml(item.raw)}</pre></div>`;
    html += '</div>';
    resultDiv.innerHTML = html;
  }

  // Parse a text (possibly containing multiple NOTAMs)
  function parseText(text){
    const blocks = splitNotams(text);
    const parsed = blocks.map(parseOne);
    return {blocks, parsed};
  }

  // Main parse button event
  parseBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) { summaryDiv.innerHTML = '<p style="color:#a00">Paste or load NOTAM text first.</p>'; return; }
    const {blocks, parsed} = parseText(text);
    window._lastNotams = parsed;
    summaryDiv.innerHTML = `<div class="ok">Parsed ${parsed.length} NOTAM(s) from the current input.</div>`;
    resultDiv.innerHTML = renderResults(parsed);
  });

  // Clear
  clearBtn.addEventListener('click', () => {
    input.value = '';
    resultDiv.innerHTML = '';
    summaryDiv.innerHTML = '';
    window._lastNotams = null;
  });

  // Load file via file input and run diagnostics
  let lastLoadedRaw = '';
  fileInput.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      lastLoadedRaw = r.result;
      input.value = ''; // keep textarea empty by default, user can paste if needed
      summaryDiv.innerHTML = `<div class="small">Loaded file: <strong>${escapeHtml(f.name)}</strong> (${f.size} bytes). Click "Parse & Run Diagnostics on Loaded File".</div>`;
    };
    r.readAsText(f);
  });

  // Run diagnostics over loaded file
  runAllBtn.addEventListener('click', () => {
    if (!lastLoadedRaw) { summaryDiv.innerHTML = '<p style="color:#a00">Load your .txt file first.</p>'; return; }
    const {blocks, parsed} = parseText(lastLoadedRaw);
    window._lastNotams = parsed;
    // compute summary metrics
    let high=0, mid=0, low=0;
    parsed.forEach(p => {
      if (p.confidence >=4) high++;
      else if (p.confidence >=2) mid++;
      else low++;
    });
    summaryDiv.innerHTML = `<div class="ok">Diagnostics: ${parsed.length} NOTAMs parsed — High:${high} | Medium:${mid} | Low:${low}</div>`;
    resultDiv.innerHTML = renderResults(parsed);
    // add clickable rows - attach events
    setTimeout(()=>{ // delegate after DOM insertion
      const rows = resultDiv.querySelectorAll('tr[data-idx]');
      rows.forEach(r => r.addEventListener('click', () => {
        const idx = parseInt(r.getAttribute('data-idx'),10);
        showDetails(parsed[idx]);
      }));
    },50);
  });

  // Export CSV
  exportBtn.addEventListener('click', () => {
    const arr = window._lastNotams || [];
    if (!arr.length) { alert('No parsed NOTAMs to export — parse first.'); return; }
    const header = ['id','icaos','qline_raw','timeRange','runway','taxiway','message','confidence'];
    const lines = [header.join(',')].concat(arr.map(it => {
      return [
        csvSafe(it.id || it.notamTag),
        csvSafe(it.icaos.join(';')),
        csvSafe(it.qline.raw || ''),
        csvSafe(it.timeRange),
        csvSafe(it.runway),
        csvSafe(it.taxiway),
        csvSafe(it.message),
        csvSafe(it.confidence)
      ].join(',');
    }));
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'notams_offline_tested.csv'; a.click();
    URL.revokeObjectURL(url);
  });

  // Demo sample loader
  sampleBtn.addEventListener('click', ()=> {
    const demo = [
`A1234/25 NOTAMN
Q) EGTT/QFALW/IV/NBO/A/000/999/5128N00028W005
EGLL AD
FROM 250101T0000Z TO 250131T2359Z
RWY 09/27 CLOSED DUE TO WORK`,

`NOTAMR A1234/25
Q) EGKK/QMRLC/IV/NBO/A/000/999/5130N00027W005
EGKK AD
FROM 250201T0600Z TO 250201T1800Z
TWY B CLSD`,

`Q) KJFK/QXXXX/IV/NBO/A/000/999/4050N07346W005
NOTAMN A9999/25
KJFK
FROM 250301T0000Z TO 250331T2359Z
SOME EXAMPLE MESSAGE FOR DEMO PURPOSES`
    ].join('\n\n');
    lastLoadedRaw = demo;
    summaryDiv.innerHTML = `<div class="small">Demo loaded — click "Parse & Run Diagnostics on Loaded File".</div>`;
  });

  // initial message
  resultDiv.innerHTML = '<p class="small">Load your THE AWY OUTPUT ONLY.TXT file using "Load .txt", then click "Parse & Run Diagnostics on Loaded File".</p>';

})();
