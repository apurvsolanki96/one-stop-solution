// docs/offline-parser.js
(function () {
  "use strict";

  // normalize text
  function normalize(text) {
    return (text || "").replace(/\u2013|\u2014/g, "-").replace(/\s+/g, " ").trim();
  }

  // very small heuristic parser: finds route codes and FL ranges in nearby lines
  function parseNotam(text) {
    text = normalize(text).toUpperCase();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const routeRx = /\b([A-Z]{1,2}\d{1,4})\b/;
    const flRangeRx = /\bFL\s*(\d{1,3})\s*[-–]\s*FL\s*(\d{1,3})\b/i;
    const flFromToRx = /\bFROM\s+FL\s*(\d{1,3})\s+TO\s+FL\s*(\d{1,3})\b/i;
    const meterRx = /(\d{3,6})\s*M\b/i;

    const results = [];

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const m = ln.match(routeRx);
      if (!m) continue;
      const route = m[1];
      // look ahead up to 3 lines for FL info
      const windowText = lines.slice(i, i + 4).join(" ");
      let low = null, high = null;
      let fm = windowText.match(flRangeRx);
      if (fm) { low = fm[1].padStart(3, "0"); high = fm[2].padStart(3, "0"); }
      else {
        fm = windowText.match(flFromToRx);
        if (fm) { low = fm[1].padStart(3, "0"); high = fm[2].padStart(3, "0"); }
        else {
          fm = windowText.match(meterRx);
          if (fm) {
            const meters = parseInt(fm[1].replace(/,/g, ""), 10);
            const feet = Math.floor(meters * 3.28084);
            const fl = Math.floor(feet / 100);
            low = String(fl).padStart(3, "0");
            high = low;
          }
        }
      }
      results.push({ route, desc: ln, low, high });
    }

    return results;
  }

  // public API: returns object matching backend-style output { output: "..." }
  window.offlineProcess = function (text) {
    try {
      const parsed = parseNotam(text);
      if (!parsed || parsed.length === 0) {
        return { output: "No routes detected (offline parser)." };
      }
      const output = parsed.map(p => {
        if (p.low && p.high) return `${p.route} ${p.desc} FL${p.low}-FL${p.high}`;
        return `${p.route} ${p.desc}`;
      }).join("\n");
      return { output };
    } catch (err) {
      return { output: "Offline parser error: " + (err && err.toString ? err.toString() : String(err)) };
    }
  };

  // Export parseNotam too for dev console
  window.parseNotam = parseNotam;
})();
