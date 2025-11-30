// File: docs/script.js
// Purpose: frontend glue: theme toggle, online->offline parse fallback, memory (localStorage)
(function () {
  'use strict';
  const $ = sel => document.querySelector(sel);
  const byId = id => document.getElementById(id);
  function now() { return new Date().toISOString(); }
  function canonicalInput(s) { return (s || '').trim().replace(/\s+/g, ' ').toUpperCase(); }
  const MEM_KEY = 'oss_learned_notams_v1';
  function loadMemory() { try { return JSON.parse(localStorage.getItem(MEM_KEY) || '[]'); } catch (e) { return []; } }
  function saveMemory(arr) { localStorage.setItem(MEM_KEY, JSON.stringify(arr || [])); updateMemoryBadge(); }
  function addMemoryRecord(input, expectedArray) {
    const mem = loadMemory();
    const entry = { id: Math.random().toString(36).slice(2, 9), input: canonicalInput(input), expected_output: expectedArray, created_at: now() };
    const idx = mem.findIndex(m => m.input === entry.input);
    if (idx >= 0) mem[idx] = entry; else mem.push(entry);
    saveMemory(mem);
    return entry;
  }
  function findMemoryExact(input) { const mem = loadMemory(); const key = canonicalInput(input); return mem.find(m => m.input === key) || null; }
  function findMemoryFuzzy(input) { const mem = loadMemory(); const key = canonicalInput(input); const candidates = mem.filter(m => m.input.includes(key) || key.includes(m.input) || m.input.split(' ').some(tok => key.includes(tok) && tok.length > 3)); return candidates.slice(0, 5); }
  function updateMemoryBadge() { const el = byId('memoryBadge'); if (!el) return; const n = loadMemory().length; el.textContent = `Memory: ${n} item${n === 1 ? '' : 's'}`; }
  const inputArea = byId('notamInput') || $('textarea#notamInput') || $('textarea');
  const outputArea = byId('notamOutput') || $('#notamOutput') || $('pre#notamOutput') || $('#output');
  const parseBtn = byId('btnParseOffline');
  const processBtn = byId('btnProcess');
  const saveMemBtn = byId('btnSaveMemory');
  const themeToggle = byId('btnThemeToggle');
  function setOutput(text, extra = '') { if (!outputArea) { console.log('[OUTPUT]', text); return; } outputArea.textContent = text + (extra ? '\n\n' + extra : ''); }
  const THEME_KEY = 'oss_theme_v1';
  function applyTheme() { const theme = localStorage.getItem(THEME_KEY) || 'dark'; document.body.classList.toggle('dark', theme === 'dark'); document.body.classList.toggle('light', theme === 'light'); if (themeToggle) themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark'; }
  function toggleTheme() { const cur = localStorage.getItem(THEME_KEY) || 'dark'; const next = cur === 'dark' ? 'light' : 'dark'; localStorage.setItem(THEME_KEY, next); applyTheme(); }
  const ONLINE_ENDPOINT = '/process-notam';
  const ONLINE_TIMEOUT = 2500;
  async function callOnline(notamText) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ONLINE_TIMEOUT);
      const res = await fetch(ONLINE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notam: notamText }), signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('bad response ' + res.status);
      return await res.json();
    } catch (e) {
      return null;
    }
  }
  function showOfflineBanner(msg) {
    let b = byId('offlineBanner');
    if (!b) { b = document.createElement('div'); b.id = 'offlineBanner'; b.style.position = 'fixed'; b.style.right = '12px'; b.style.bottom = '12px'; b.style.padding = '8px 12px'; b.style.borderRadius = '8px'; b.style.fontSize = '13px'; b.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)'; document.body.appendChild(b); }
    b.style.background = '#f5c542'; b.style.color = '#1a1a1a'; b.textContent = msg || 'Offline mode: server unreachable — using offline parser.';
    setTimeout(() => { if (b) b.style.opacity = '0.9'; }, 60);
  }
  function clearOfflineBanner() { const b = byId('offlineBanner'); if (b) b.remove(); }
  async function parseNotamFlow(useOfflineOnly = false) {
    const raw = (inputArea && inputArea.value) ? inputArea.value : '';
    if (!raw.trim()) { setOutput('[ERROR] empty input'); return; }
    const memExact = findMemoryExact(raw);
    if (memExact && Array.isArray(memExact.expected_output) && memExact.expected_output.length) { setOutput(memExact.expected_output.join('\n'), '(Recalled from memory)'); return; }
    if (!useOfflineOnly) {
      const onlineRes = await callOnline(raw);
      if (onlineRes && onlineRes.segments && Array.isArray(onlineRes.segments) && onlineRes.segments.length) {
        clearOfflineBanner();
        setOutput(onlineRes.segments.join('\n'), '(Online parser)');
        addMemoryRecord(raw, onlineRes.segments);
        return;
      }
    }
    showOfflineBanner('Offline mode: using local parser.');
    try {
      if (window.OfflineNotamParser && typeof window.OfflineNotamParser.parse === 'function') {
        const r = window.OfflineNotamParser.parse(raw);
        if (r && r.success && r.segments && r.segments.length) {
          clearOfflineBanner();
          setOutput(r.segments.join('\n'), '(Offline parser)');
          addMemoryRecord(raw, r.segments);
          return;
        }
      }
      const fuzzy = findMemoryFuzzy(raw);
      if (fuzzy && fuzzy.length) {
        const candidate = fuzzy[0];
        clearOfflineBanner();
        setOutput((candidate.expected_output || []).join('\n'), '(Matched memory candidate)');
        return;
      }
      addMemoryRecord(raw, null);
      clearOfflineBanner();
      setOutput('[Saved to memory for learning] Provide expected output and click Save to Memory.', '');
    } catch (err) {
      setOutput('[ERROR] offline parser exception: ' + (err && err.message));
    }
  }
  function onSaveToMemory() {
    const raw = (inputArea && inputArea.value) ? inputArea.value : '';
    if (!raw.trim()) { alert('No NOTAM input to save.'); return; }
    const outText = (outputArea && outputArea.textContent) ? outputArea.textContent : '';
    const outLines = outText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!outLines.length) {
      const user = prompt('Enter expected output (comma-separated airway entries):');
      if (!user) { alert('Save cancelled'); return; }
      const arr = user.split(',').map(s => s.trim()).filter(Boolean);
      addMemoryRecord(raw, arr);
      alert('Saved to memory: ' + JSON.stringify(arr));
      return;
    }
    addMemoryRecord(raw, outLines);
    alert('Saved to memory: ' + outLines.length + ' lines');
  }
  function init() {
    applyTheme();
    updateMemoryBadge();
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (parseBtn) parseBtn.addEventListener('click', () => parseNotamFlow(true));
    if (processBtn) processBtn.addEventListener('click', () => parseNotamFlow(false));
    if (saveMemBtn) saveMemBtn.addEventListener('click', onSaveToMemory);
    if (inputArea) {
      inputArea.addEventListener('keydown', (ev) => {
        if (ev.ctrlKey && ev.key === 'Enter') { ev.preventDefault(); parseNotamFlow(); }
      });
    }
    window.oss = { parseNow: parseNotamFlow, memoryList: loadMemory, addMemory: addMemoryRecord };
    // --- Backwards-compatible global functions for existing HTML buttons ---
window.toggleMode = toggleTheme;                 // original toggle button: toggleMode()
window.processNOTAM = () => parseNotamFlow(false); // original Process button: processNOTAM()
window.aiExplain = () => parseNotamFlow(false);    // Explain -> use same pipeline (adjust later)
window.aiSimplify = () => parseNotamFlow(false);   // Simplify -> same pipeline
window.aiRisk = () => parseNotamFlow(false);       // Risk -> same pipeline
// --------------------------------------------------------------------

  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
