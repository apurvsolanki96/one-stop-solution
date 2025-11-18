// docs/script.js (append or integrate these functions)

async function saveToMemory(notamText, aviation = {}) {
  // UI element where status is shown (create #memoryStatus in index.html)
  const statusEl = document.getElementById('memoryStatus');
  if (statusEl) statusEl.textContent = 'Saving...';

  // Build payload
  const payload = { notam: notamText || '', aviation: aviation || {} };

  // Try backend first
  try {
    const resp = await fetch(window.location.origin + '/memory/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Server ${resp.status}: ${txt}`);
    }

    const data = await resp.json();
    if (statusEl) statusEl.textContent = 'Memory: Saved (server)';
    return data;
  } catch (err) {
    // fallback to client-side localStorage
    try {
      const key = 'offline_memory_entries';
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      const entry = {
        id: arr.length ? arr[arr.length-1].id + 1 : 1,
        timestamp: new Date().toISOString(),
        notam: payload.notam,
        aviation: payload.aviation,
      };
      arr.push(entry);
      localStorage.setItem(key, JSON.stringify(arr));
      if (statusEl) statusEl.textContent = 'Memory: Saved (local fallback)';
      return { status: 'saved_offline', entry };
    } catch (le) {
      if (statusEl) statusEl.textContent = 'Memory: Failed';
      console.error('Memory save failed:', err, le);
      throw err;
    }
  }
}

// Hook the Save button (call this on DOMContentLoaded if not already bound)
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('saveMemoryBtn'); // ensure your button has this id
  if (!saveBtn) return;
  saveBtn.addEventListener('click', async () => {
    const notamText = (document.getElementById('notamBox') || { value: '' }).value;
    try {
      const res = await saveToMemory(notamText, {});
      console.log('saveToMemory result', res);
    } catch (e) {
      console.error(e);
      alert('Save to memory failed. See console for details.');
    }
  });
});
