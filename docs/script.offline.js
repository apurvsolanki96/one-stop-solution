/* script.offline.js
// e.g. 'AWY L321 KUNKI/OBRAN, AWY L604 BRN/DANAD,' -> we removed AWY earlier, but split by commas to parse each
const commaParts = line.split(/,\s*/).filter(Boolean);
for (const part of commaParts) {
const route = parseRouteLine(part);
if (!route) continue;


// Find nearest range: prefer currentRange, else search globalRanges for nearest after i, else nearest before i
let useRange = currentRange;
if (!useRange) {
// find first global range whose idx > i
const after = globalRanges.find(g=>g.idx > i);
if (after) useRange = after.range;
else if (globalRanges.length) {
// fallback: nearest preceding
const before = [...globalRanges].reverse().find(g=>g.idx < i);
if (before) useRange = before.range;
}
}


// If still null, look for inline FL numbers inside the same part
if (!useRange) {
const inline = part.match(/FL\s*(\d{1,3})\s*[\-\/]\s*FL\s*(\d{1,3})/i);
if (inline) useRange = { low: 'FL' + String(inline[1]).padStart(3,'0'), high: 'FL' + String(inline[2]).padStart(3,'0') };
}


// If still no range, default to FL000-FL999 to avoid losing data
if (!useRange) useRange = { low: 'FL000', high: 'FL999' };


// Normalize segment text
let seg = normalizeSegment(route.segText);


// When segment contains a VOR name like "VOR'JIG'" we try to shorten it to the identifier inside quotes or the token
seg = seg.replace(/VOR'([^']+)'/g, '$1');
// Replace repeated spaces and remove trailing punctuation
seg = seg.replace(/[\.,]$/,'').trim();


// If names are like 'KUNKI-OBRAN' or 'KUNKI/OBRAN' we keep single '-'
const outputLine = `${route.routeId} ${seg} ${useRange.low}-${useRange.high}`;
out.push(outputLine);
}
}


return out;
}


// Wire the button and display
function wireOfflineButton() {
const btn = document.getElementById('offlineParseBtn');
if (!btn) return;
btn.addEventListener('click', ()=>{
const ta = document.getElementById('notamBox');
const outDiv = document.getElementById('output');
if (!ta || !outDiv) return alert('Missing textarea or output div');


const txt = ta.value;
if (!txt || !txt.trim()) {
outDiv.innerText = 'No NOTAM input provided.';
return;
}


const results = parseNotamOffline(txt);
if (!results.length) {
outDiv.innerText = 'No route segments detected.';
return;
}


// Render results nicely (preserve line breaks)
outDiv.innerHTML = '<pre style="white-space:pre-wrap;">' + results.join('\n') + '</pre>';
});
}


// Auto-run wire on DOMContentLoaded (if script appended after body, calling once is safe)
document.addEventListener('DOMContentLoaded', ()=>{
wireOfflineButton();
});


// Expose parser for debugging / unit tests
window.offlineNotam = {
  parseNotamOffline,
  metersToFL
};

})(); // end of IIFE
