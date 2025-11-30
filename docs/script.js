// File: one-stop-solution/docs/script.js
// Purpose: frontend glue: theme toggle, online->offline parse fallback, memory (localStorage), modal-based Save/Admin
(function () {
  'use strict';

  /* -------------------------
     Utilities & DOM helpers
  ------------------------- */
  const byId = id => document.getElementById(id);
  const $ = sel => document.querySelector(sel);
  const now = () => new Date().toISOString();
  const MEM_KEY = 'oss_learned_notams_v1';
  const THEME_KEY = 'oss_theme_v1';

  function canonicalInput(s) { return (s || '').trim().replace(/\s+/g, ' ').toUpperCase(); }
  function dedupeLines(arr) {
    const seen = new Set(); const out = [];
    for (const l of (arr || [])) {
      const t = String(l || '').trim();
      if (!t) continue;
      if (!seen.has(t)) { seen.add(t); out.push(t); }
    }
    return out;
  }

  /* -------------------------
     Memory (localStorage) helpers
  ------------------------- */
  function loadMemory() { try { return JSON.parse(localStorage.getItem(MEM_KEY) || '[]'); } catch (e) { return []; } }
  function saveMemory(arr) { localStorage.setItem(MEM_KEY, JSON.stringify(arr || [])); updateMemoryBadge(); }
  function updateMemoryBadge() { const el = byId('memoryBadge'); if (!el) return; const n = loadMemory().length; el.textContent = `Memory: ${n} item${n === 1 ? '' : 's'}`; }
  function addMemoryEntry(inputText, outputArray) {
    const mem = loadMemory();
    const entry = { id: Math.random().toString(36).slice(2, 9), input: canonicalInput(inputText), expected_output: dedupeLines(outputArray || []), created_at: now() };
    const idx = mem.findIndex(m => m.input === entry.input);
    if (idx >= 0) mem[idx] = entry; else mem.push(entry);
    saveMemory(mem);
    return entry;
  }
  function removeMemoryById(id) { const mem = loadMemory().filter(m => m.id !== id); saveMemory(mem); }
  function updateMemoryById(id, patch) {
    const mem = loadMemory(); const i = mem.findIndex(m => m.id === id);
    if (i === -1) return null;
    mem[i] = { ...mem[i], ...patch }; saveMemory(mem); return mem[i];
  }
  function findMemoryExact(inputText) { const key = canonicalInput(inputText); return loadMemory().find(m => m.input === key) || null; }
  function findMemoryFuzzy(inputText) {
    const key = canonicalInput(inputText);
    const mem = loadMemory();
    return mem.filter(m => m.input.includes(key) || key.includes(m.input)).slice(0, 6);
  }

  /* -------------------------
     Theme handling
  ------------------------- */
  const themeBtn = byId('btnThemeToggle');
  function applyTheme() {
    const theme = localStorage.getItem(THEME_KEY) || 'dark';
    document.body.classList.toggle('light', theme === 'light');
    if (themeBtn) themeBtn.textContent = (theme === 'light') ? 'Dark' : 'Light';
  }
  function toggleTheme() {
    const cur = localStorage.getItem(THEME_KEY) || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme();
  }

  /* -------------------------
     Network / Parser
  ------------------------- */
  const ONLINE_ENDPOINT = '/process-notam';
  const ONLINE_TIMEOUT = 2500;
  async function callOnline(notamText) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ONLINE_TIMEOUT);
      const res = await fetch(ONLINE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notam: notamText }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('bad response ' + res.status);
      return await res.json();
    } catch (e) {
      return null;
    }
  }
  function parseOffline(notamText) {
    if (window.OfflineNotamParser && typeof window.OfflineNotamParser.parse === 'function') {
      try { return window.OfflineNotamParser.parse(notamText); } catch (e) { return { success: false }; }
    }
    return { success: false };
  }

  function extractSegmentsFromModelText(text) {
    if (!text) return [];
    text = String(text).trim();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.segments)) return dedupeLines(parsed.segments);
    } catch (e) {}
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return dedupeLines(lines);
  }

  /* -------------------------
     UI elements
  ------------------------- */
  const inputArea = byId('notamInput');
  const outputArea = byId('notamOutput');
  const parseOfflineBtn = byId('btnParseOffline');
  const saveMemBtn = byId('btnSaveMemory');

  function setOutput(linesOrText, suffix = '') {
    if (!outputArea) return;
    let text = '';
    if (Array.isArray(linesOrText)) text = linesOrText.join('\n');
    else text = String(linesOrText || '');
    // dedupe final output lines
    const outLines = dedupeLines(text.split(/\r?\n/));
    outputArea.textContent = outLines.join('\n') + (suffix ? '\n\n' + suffix : '');
  }

  /* -------------------------
     Modal: Save to Memory (editable input)
  ------------------------- */
  function ensureModalStyles() {
    if (document.getElementById('oss-modal-styles')) return;
    const css = `
      .oss-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100050;display:flex;align-items:center;justify-content:center;}
      .oss-modal{width:780px;max-width:94%;background:var(--panel-night);color:var(--text-night);padding:14px;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,0.6);font-family:inherit;}
      .oss-modal textarea{width:100%;height:120px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);resize:vertical;background:var(--textarea-night);color:var(--text-night);}
      .oss-modal .row{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;}
      .oss-modal .btn{margin:0;}
      .oss-modal .muted{opacity:.75;font-size:13px;margin-bottom:8px;}
      @media(max-width:540px){ .oss-modal{width:94%;padding:12px;} .oss-modal textarea{height:100px;} }
    `;
    const s = document.createElement('style'); s.id = 'oss-modal-styles'; s.textContent = css; document.head.appendChild(s);
  }

  function openSaveModal(rawNotam, suggestedArr = []) {
    ensureModalStyles();
    // if modal exists reuse
    let backdrop = byId('oss-save-modal-backdrop');
    if (backdrop) backdrop.remove();
    backdrop = document.createElement('div'); backdrop.id = 'oss-save-modal-backdrop'; backdrop.className = 'oss-modal-backdrop';
    const modal = document.createElement('div'); modal.className = 'oss-modal';
    modal.innerHTML = `
      <div class="muted"><strong>Save to Memory — Confirm or edit expected outputs</strong></div>
      <div style="font-size:13px;color:var(--muted-text);margin-bottom:8px">Input (readonly)</div>
      <div style="font-family:monospace;background:rgba(0,0,0,0.04);padding:8px;border-radius:6px;margin-bottom:10px;white-space:pre-wrap">${canonicalInput(rawNotam)}</div>
      <div style="font-size:13px;color:var(--muted-text);margin-bottom:6px">Expected outputs (one per line or comma separated)</div>
      <textarea id="oss-save-textarea" placeholder="W187 TUSLI-DNH FL000-FL341">${(suggestedArr || []).join('\\n')}</textarea>
      <div class="row">
        <button id="oss-save-cancel" class="btn secondary-btn">Cancel</button>
        <button id="oss-save-confirm" class="btn primary-btn">Save</button>
      </div>
    `;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    byId('oss-save-cancel').addEventListener('click', () => backdrop.remove());
    byId('oss-save-confirm').addEventListener('click', () => {
      const raw = byId('oss-save-textarea').value || '';
      let arr = [];
      if (raw.includes(',')) arr = raw.split(',').map(s => s.trim()).filter(Boolean);
      else arr = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (!arr.length) { if (!confirm('You are about to save an empty output. Continue?')) return; }
      addMemoryEntry(rawNotam, arr);
      updateMemoryBadge();
      backdrop.remove();
      alert('Saved to memory: ' + arr.length + ' item(s).');
    });
  }

  /* -------------------------
     Admin modal (list/edit/delete/export/import)
  ------------------------- */
  function openMemoryAdmin() {
    ensureModalStyles();
    // remove existing
    const old = byId('oss-admin-backdrop'); if (old) old.remove();
    const backdrop = document.createElement('div'); backdrop.id = 'oss-admin-backdrop'; backdrop.className = 'oss-modal-backdrop';
    const modal = document.createElement('div'); modal.className = 'oss-modal';
    modal.style.maxHeight = '80vh'; modal.style.overflow = 'auto';
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">Memory Admin</h3>
        <div>
          <button id="oss-admin-close" class="btn secondary-btn">Close</button>
          <button id="oss-admin-export" class="btn primary-btn">Export</button>
        </div>
      </div>
      <div id="oss-admin-list"></div>
      <div style="margin-top:12px;text-align:right;"><button id="oss-admin-import" class="btn secondary-btn">Import (replace)</button></div>
    `;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    byId('oss-admin-close').addEventListener('click', () => backdrop.remove());
    byId('oss-admin-export').addEventListener('click', () => {
      const data = JSON.stringify(loadMemory(), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'oss_memory.json'; a.click(); URL.revokeObjectURL(url);
    });
    byId('oss-admin-import').addEventListener('click', () => {
      const txt = prompt('Paste memory JSON to import (will replace existing memory).');
      if (!txt) return;
      try {
        const parsed = JSON.parse(txt);
        if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
        saveMemory(parsed);
        renderAdminList();
        alert('Imported ' + parsed.length + ' entries');
      } catch (e) { alert('Import failed: ' + (e.message || e)); }
    });

    function renderAdminList() {
      const box = byId('oss-admin-list');
      const mem = loadMemory();
      if (!mem.length) { box.innerHTML = '<div style="opacity:.7">No memory entries saved.</div>'; return; }
      box.innerHTML = '';
      mem.forEach(entry => {
        const el = document.createElement('div');
        el.style.border = '1px solid rgba(255,255,255,0.04)';
        el.style.padding = '10px'; el.style.marginBottom = '10px'; el.style.borderRadius = '8px';
        el.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:12px;color:var(--muted-text)">${entry.created_at}</div>
            <div>
              <button class="oss-admin-edit btn secondary-btn" data-id="${entry.id}">Edit</button>
              <button class="oss-admin-delete btn secondary-btn" data-id="${entry.id}">Delete</button>
            </div>
          </div>
          <div style="margin-top:8px"><strong>Input:</strong><div style="font-family:monospace;background:rgba(0,0,0,0.04);padding:8px;border-radius:6px;margin-top:6px">${entry.input}</div></div>
          <div style="margin-top:8px"><strong>Output:</strong><div style="font-family:monospace;background:rgba(0,0,0,0.04);padding:8px;border-radius:6px;margin-top:6px">${(entry.expected_output||[]).join('<br/>')}</div></div>
        `;
        box.appendChild(el);
      });

      box.querySelectorAll('.oss-admin-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          if (!confirm('Delete this memory entry?')) return;
          removeMemoryById(id);
          renderAdminList();
          updateMemoryBadge();
        });
      });

      box.querySelectorAll('.oss-admin-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          const memEntry = loadMemory().find(m => m.id === id);
          if (!memEntry) return alert('Entry not found');
          const newOut = prompt('Edit expected output (comma-separated):', (memEntry.expected_output || []).join(', '));
          if (newOut === null) return;
          const arr = newOut.split(',').map(s => s.trim()).filter(Boolean);
          updateMemoryById(id, { expected_output: arr });
          renderAdminList();
        });
      });
    }

    renderAdminList();
  }

  /* -------------------------
     Parsing flow
  ------------------------- */
  async function parseNotamFlow(forceOffline = false) {
    const raw = inputArea ? inputArea.value : '';
    if (!raw || !raw.trim()) { setOutput('[ERROR] empty input'); return; }

    // 1) exact memory recall
    const memExact = findMemoryExact(raw);
    if (memExact && Array.isArray(memExact.expected_output) && memExact.expected_output.length) {
      setOutput(memExact.expected_output, '(Recalled from memory)');
      return;
    }

    // 2) try online
    if (!forceOffline) {
      const online = await callOnline(raw);
      if (online && Array.isArray(online.segments) && online.segments.length) {
        setOutput(dedupeLines(online.segments), '(Online parser)');
        if (confirm('Save online result to memory?')) addMemoryEntry(raw, online.segments);
        return;
      }
    }

    // 3) offline
    const offline = parseOffline(raw);
    if (offline && offline.success && Array.isArray(offline.segments) && offline.segments.length) {
      setOutput(dedupeLines(offline.segments), '(Offline parser)');
      // show dialog to save if user wants to correct output
      if (confirm('Save offline result to memory? (OK = open editor, Cancel = skip)')) {
        openSaveModal(raw, dedupeLines(offline.segments));
      }
      return;
    }

    // 4) fuzzy memory suggestions
    const fuzzy = findMemoryFuzzy(raw);
    if (fuzzy && fuzzy.length) {
      // show only the top candidate
      const candidate = fuzzy[0];
      if (candidate && candidate.expected_output && candidate.expected_output.length) {
        setOutput(candidate.expected_output, '(Matched memory candidate)');
        return;
      }
    }

    // 5) no results — ask user to provide expected outputs
    setOutput('[No parse result] Provide expected output via Save to Memory.', '');
    openSaveModal(raw, []);
  }

  /* -------------------------
     Save button handler (opens modal)
  ------------------------- */
  function onSaveToMemoryClicked() {
    const raw = inputArea ? inputArea.value : '';
    if (!raw || !raw.trim()) { alert('No NOTAM input to save.'); return; }
    // pick suggestion from output area if present
    const outText = outputArea ? outputArea.textContent : '';
    const suggested = outText ? outText.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
    openSaveModal(raw, suggested);
  }

  /* -------------------------
     Wiring & init
  ------------------------- */
  // expose old names for existing inline HTML
  window.toggleMode = toggleTheme;
  window.processNOTAM = () => parseNotamFlow(false);
  window.aiExplain = () => parseNotamFlow(false);
  window.aiSimplify = () => parseNotamFlow(false);
  window.aiRisk = () => parseNotamFlow(false);

  function makeMemoryButtonClickable() {
    const memBtn = byId('memoryAdminBtn');
    if (!memBtn) return;
    // ensure pointer events and high z-index so it is clickable
    memBtn.style.pointerEvents = 'auto';
    memBtn.style.zIndex = 1200;
    memBtn.addEventListener('click', openMemoryAdmin);
  }

  function init() {
    applyTheme();
    updateMemoryBadge();

    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    if (parseOfflineBtn) parseOfflineBtn.addEventListener('click', () => parseNotamFlow(true));
    if (saveMemBtn) saveMemBtn.addEventListener('click', onSaveToMemoryClicked);

    // keyboard shortcut
    if (inputArea) inputArea.addEventListener('keydown', (ev) => { if (ev.ctrlKey && ev.key === 'Enter') { ev.preventDefault(); parseNotamFlow(false); } });

    // make floating admin button clickable
    makeMemoryButtonClickable();

    // expose limited api for debugging
    window.oss = { parseNow: parseNotamFlow, memoryList: loadMemory, addMemory: addMemoryEntry };

    // keep theme button text correct (for pages where script loads after the UI)
    if (themeBtn && !themeBtn.textContent) applyTheme();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
