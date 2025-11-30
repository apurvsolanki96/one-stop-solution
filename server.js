// File: server.js
// Drop-in Express server for one-stop-solution
// Supports OpenAI project keys (sk-proj-...) and classic keys (sk-...)
// Serves docs/ static site and exposes POST /process-notam

const express = require('express');
const path = require('path');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(express.json({ limit: '128kb' }));
app.use(cors());

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''; // must be set in Render
// If env var not set, use the project id you provided here as default project id.
// (This value is safe to include because it's not a secret token.)
const DEFAULT_PROJECT_ID = 'proj_tA0t9qXJIq2KYNl5vPrjKrpF';
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID || DEFAULT_PROJECT_ID;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';

// Initialize OpenAI client
let openaiClient = null;
try {
  if (!OPENAI_API_KEY) {
    console.warn('WARN: OPENAI_API_KEY is not set. /process-notam will return 500 until you set a valid key.');
  }
  openaiClient = new OpenAI({
    apiKey: OPENAI_API_KEY || undefined,
    project: OPENAI_PROJECT_ID || undefined
  });
  console.info('OpenAI client initialized. Project-id present:', !!OPENAI_PROJECT_ID);
} catch (err) {
  console.error('Failed to initialize OpenAI client:', err && err.message);
  openaiClient = null;
}

// Serve static frontend from docs/
const docsPath = path.join(__dirname, 'docs');
app.use(express.static(docsPath));

// Basic healthcheck
app.get('/healthz', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Utility: extract segments from model output
function extractSegmentsFromText(text) {
  if (!text) return [];
  text = String(text).trim();
  // Try JSON first
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.segments)) return parsed.segments.map(s => String(s).trim()).filter(Boolean);
    // Some models return object with output_text
    if (parsed && typeof parsed.output_text === 'string') text = parsed.output_text;
  } catch (e) {
    // ignore JSON error
  }
  // Fallback: split into non-empty lines, filter out obvious labels
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const filtered = lines.filter(l => !/^(\[?output\]?:?|\(?o\/p\)?:?)/i.test(l));
  // dedupe preserving order
  const seen = new Set();
  const out = [];
  for (const l of filtered) {
    if (!seen.has(l)) { seen.add(l); out.push(l); }
  }
  return out;
}

// POST /process-notam
// Request: { notam: "..." }
// Response: { segments: ["W187 TUSLI-DNH FL000-FL341", ...] }
app.post('/process-notam', async (req, res) => {
  try {
    const notam = req.body && req.body.notam ? String(req.body.notam).trim() : '';
    if (!notam) return res.status(400).json({ error: 'missing notam in request body' });

    if (!openaiClient) {
      return res.status(500).json({ error: 'OpenAI client not configured on server (missing OPENAI_API_KEY).' });
    }

    // Instruction to model: output strict JSON when possible
    const systemInstruction = `You are an extractor. Given NOTAM text, output ONLY valid JSON in exactly this shape:
{"segments":["<AWY> <FROM>-<TO> FLnnn-FLnnn", "..."]}
If nothing found, return {"segments":[]} and nothing else.`;

    const userPrompt = `NOTAM:\n${notam}\n\nReturn only JSON as described.`;

    // Determine if we should use Responses API (project keys) or Chat (classic)
    const isProjectKey = Boolean(OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-proj-')) || Boolean(OPENAI_PROJECT_ID);
    if (isProjectKey) {
      try {
        const response = await openaiClient.responses.create({
          model: MODEL,
          input: `${systemInstruction}\n\n${userPrompt}`,
          // optionally: max_output_tokens, temperature: 0
        });

        // Try to get text from response.output_text or response.output
        let outText = '';
        if (response.output_text) {
          outText = String(response.output_text);
        } else if (Array.isArray(response.output) && response.output.length) {
          // assemble text fragments
          for (const chunk of response.output) {
            if (chunk.type === 'output_text' && typeof chunk.text === 'string') outText += chunk.text + '\n';
            if (chunk.type === 'message' && Array.isArray(chunk.content)) {
              for (const c of chunk.content) {
                if (c.type === 'output_text' && c.text) outText += c.text + '\n';
              }
            }
          }
          outText = outText.trim();
        } else {
          // fallback stringification
          outText = response.output_text || JSON.stringify(response).slice(0, 3000);
        }

        const segments = extractSegmentsFromText(outText);
        return res.json({ segments });
      } catch (err) {
        console.error('OpenAI Responses API error:', err && (err.message || err.toString()));
        return res.status(500).json({ error: 'OpenAI Responses API error: ' + (err && err.message || 'unknown') });
      }
    }

    // Classic key path: try chat completions (older SDK shape)
    try {
      // Some SDK versions expose chat.completions.create
      if (openaiClient.chat && openaiClient.chat.completions && typeof openaiClient.chat.completions.create === 'function') {
        const chat = await openaiClient.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 800,
          temperature: 0.0
        });
        const choice = (chat.choices && chat.choices[0]) || null;
        const text = choice && choice.message && choice.message.content ? String(choice.message.content) : (choice && choice.text ? String(choice.text) : '');
        const segments = extractSegmentsFromText(text);
        return res.json({ segments });
      } else {
        // Fallback: try responses.create as last resort
        const fallback = await openaiClient.responses.create({
          model: MODEL,
          input: `${systemInstruction}\n\n${userPrompt}`
        });
        const text = fallback.output_text || JSON.stringify(fallback).slice(0, 2000);
        const segments = extractSegmentsFromText(text);
        return res.json({ segments });
      }
    } catch (err) {
      console.error('OpenAI Chat API error:', err && (err.message || err.toString()));
      return res.status(500).json({ error: 'OpenAI Chat API error: ' + (err && err.message || 'unknown') });
    }

  } catch (err) {
    console.error('Unexpected error in /process-notam:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'server error' });
  }
});

// SPA fallback: serve index.html for any other route (keeps front-end routing safe)
app.get('*', (req, res) => {
  res.sendFile(path.join(docsPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}. Serving docs from ${docsPath}`);
});
