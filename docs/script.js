// docs/script.js

/**
 * Universal API Helper
 * Calls backend. If fails, calls Offline Parser.
 */
async function callAPI(endpoint, payload) {
    const statusEl = document.getElementById('output');
    statusEl.innerHTML = "Processing... ⏳";

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        
        const data = await response.json();
        return data.output || data.text || JSON.stringify(data);

    } catch (error) {
        console.warn("Backend failed, switching to Offline Mode:", error);
        
        // --- OFFLINE FALLBACK ---
        if (typeof window.offlineProcess === 'function') {
            const offlineResult = window.offlineProcess(payload.notam);
            return `[OFFLINE MODE] ${offlineResult.output}\n\n(Server Unreachable)`;
        } else {
            return "Fatal Error: Backend down and Offline Parser not loaded.";
        }
    }
}

// ----------------------
// BUTTON FUNCTIONS
// ----------------------

async function processNOTAM() {
    const text = document.getElementById('notamBox').value;
    if (!text) return alert("Please enter a NOTAM!");
    
    // Call the generic process endpoint (adjust route to match your backend)
    const result = await callAPI('/process', { notam: text }); 
    document.getElementById('output').textContent = result;
}

async function aiExplain() {
    const text = document.getElementById('notamBox').value;
    if (!text) return alert("Please enter a NOTAM!");

    const result = await callAPI('/explain', { notam: text });
    document.getElementById('output').textContent = result;
}

async function aiSimplify() {
    const text = document.getElementById('notamBox').value;
    if (!text) return alert("Please enter a NOTAM!");

    const result = await callAPI('/simplify', { notam: text });
    document.getElementById('output').textContent = result;
}

async function aiRisk() {
    const text = document.getElementById('notamBox').value;
    if (!text) return alert("Please enter a NOTAM!");

    const result = await callAPI('/risk', { notam: text });
    document.getElementById('output').textContent = result;
}

// ----------------------
// UTILITY FUNCTIONS
// ----------------------

function toggleMode() {
    document.body.classList.toggle('dark-mode');
}

// Memory Save Function (Preserved from your original code)
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveMemoryBtn');
    const memoryStatus = document.getElementById('memoryStatus');
    const notamBox = document.getElementById('notamBox');

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            memoryStatus.textContent = 'Saving...';
            const text = notamBox.value;
            
            // Simulating save logic
            setTimeout(() => {
                // Try LocalStorage first for speed
                const key = 'offline_memory_entries';
                const current = JSON.parse(localStorage.getItem(key) || "[]");
                current.push({ date: new Date(), notam: text });
                localStorage.setItem(key, JSON.stringify(current));
                
                memoryStatus.textContent = 'Memory: Saved (Local)';
            }, 500);
        });
    }
    
    // Offline Button Wiring
    const offlineBtn = document.getElementById('offlineParseBtn');
    if (offlineBtn) {
        offlineBtn.addEventListener('click', () => {
             const text = notamBox.value;
             if (window.offlineProcess) {
                 const res = window.offlineProcess(text);
                 document.getElementById('output').textContent = res.output;
             }
        });
    }
});
