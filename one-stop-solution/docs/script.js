/* ============================================================
   ONE STOP SOLUTION — FRONTEND SCRIPT
   Handles API calls, auto-copy, memory learning, UI updates
   Batch F (Final)
============================================================ */

const API = "http://127.0.0.1:8000";     // Backend URL
const MOCK = false;                      // Set true for offline UI testing


/* ------------------------------------------------------------
   Utility: Copy text to clipboard with success notice
------------------------------------------------------------ */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        const cn = document.getElementById("copyNotice");
        cn.textContent = "Copied to clipboard!";
        cn.classList.add("visible");
        setTimeout(() => cn.classList.remove("visible"), 1800);
    } catch (err) {
        console.warn("Clipboard error:", err);
    }
}


/* ------------------------------------------------------------
   Generic API request handler
------------------------------------------------------------ */
async function callAPI(endpoint, payload) {
    if (MOCK) return "MOCK RESPONSE\n" + payload.notam;

    try {
        const res = await fetch(`${API}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Server error");

        return await res.json();
    } catch (err) {
        return { error: "Backend connection failed", detail: err.toString() };
    }
}


/* ------------------------------------------------------------
   MAIN PROCESSOR: /process-notam (AI + Parser + Merge)
------------------------------------------------------------ */
async function processNOTAM() {
    const raw = document.getElementById("notamBox").value.trim();
    const out = document.getElementById("output");

    if (!raw) {
        out.textContent = "⚠ Please paste a NOTAM.";
        return;
    }

    out.textContent = "Processing…";

    const data = await callAPI("/process-notam", { notam: raw });

    if (data.error) {
        out.textContent = "⚠ " + data.error;
        return;
    }

    const result = data.output || "(No result)";
    out.textContent = result;

    if (result.trim().length > 0) {
        copyToClipboard(result);
    }
}


/* ------------------------------------------------------------
   INDIVIDUAL AI FEATURES
------------------------------------------------------------ */
async function aiExplain() {
    const raw = document.getElementById("notamBox").value.trim();
    if (!raw) return;

    const out = document.getElementById("output");
    out.textContent = "AI explaining…";

    const res = await callAPI("/ai/explain", { notam: raw });
    out.textContent = res.output || res.error || "No response";
}

async function aiSimplify() {
    const raw = document.getElementById("notamBox").value.trim();
    if (!raw) return;

    const out = document.getElementById("output");
    out.textContent = "AI simplifying…";

    const res = await callAPI("/ai/simplify", { notam: raw });
    out.textContent = res.output || res.error || "No response";
}

async function aiRisk() {
    const raw = document.getElementById("notamBox").value.trim();
    if (!raw) return;

    const out = document.getElementById("output");
    out.textContent = "AI performing risk analysis…";

    const res = await callAPI("/ai/risk", { notam: raw });
    out.textContent = res.output || res.error || "No response";
}


/* ------------------------------------------------------------
   MEMORY SAVE
------------------------------------------------------------ */
async function saveToMemory() {
    const raw = document.getElementById("notamBox").value.trim();
    const out = document.getElementById("output").textContent.trim();
    const status = document.getElementById("memoryStatus");

    if (!raw || !out) {
        status.textContent = "Memory: Nothing to save";
        return;
    }

    status.textContent = "Saving…";

    const res = await callAPI("/memory/save", {
        notam: raw,
        output: out
    });

    if (res.success) status.textContent = "Memory: Saved";
    else status.textContent = "Memory: Failed";
}


/* ------------------------------------------------------------
   DAY/NIGHT MODE
------------------------------------------------------------ */
function toggleMode() {
    document.body.classList.toggle("day");
    localStorage.setItem("dayMode", document.body.classList.contains("day"));
}

/* Restore last mode */
window.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("dayMode") === "true") {
        document.body.classList.add("day");
    }
});
