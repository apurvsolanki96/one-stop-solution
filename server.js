// server.js
// Single-file Express server that supports OpenAI project keys (sk-proj-...) and classic keys.
// Serves docs/ static UI and exposes POST /process-notam -> { segments: [ ... ] }

const express = require('express');
const path = require('path');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(express.json({ limit: '64kb' })); // small request bodies
app.use(cors()); // allow all origins; lock down if needed

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';
if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is missing. Set it in Render or your environment.');
  // Do not exit — server still serves static UI to allow offline testing. But endpoint will fail.
}

let openaiClient;
try {
  // Initialize client with apiKey and optional project (handles sk-proj keys)
  openaiClient = new OpenAI({
    apiKey: OPENAI_API_KEY,
    project: OPENAI_PROJECT_ID || undefined
  });
  console.info('OpenAI client initialized. Project mode:', !!(OPENAI_API_KEY && (OPENAI_API_KEY.startsWith('sk-proj-') || OPENAI_PROJECT_ID)));
} catch (err) {
  console.error('OpenAI client initialization failed:', err && err.message);
}

// Serve static UI from docs/
const docsPath = path.join(__dirname, 'docs');
app.use(express.static(docsPath));

// Basic health check
app.get('/healthz', (req, res) => res.json({ ok: true }));

/**
 * Helper: try parse JSON -> { segments: [...] } or extract lines heuristically.
 */
function extractSegmentsFromText(text) {
  if (!text) return [];
  text = String(text).trim();
  // Try JSON
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.segments)) return parsed.segments;
    // If parsed has output_text, maybe model returned { output_text: "..." }
    if (parsed && typeof parsed.output_text === 'string') {
      // fallthrough to split
      text = parsed.output_text;
    } else {
      // no segments
    }
  } catch (e) {
    // not JSON
  }
  // Split lines and return non-empty
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Heuristic: sometimes model includes "O/P:" or "OUTPUT:" header; remove those lines
  const cleaned = lines.filter(l => !/^(\[?output\]?:?|\(?o\/p\)?:?)/i.test(l));
  return cleaned;
}

/**
 * POST /process-notam
 * Body: { notam: "<text>" }
 * Response: { segments: [ ... ] }
 */
app.post('/process-notam', async (req, res) => {
  try {
    const notam = (req.body && req.body.notam) ? String(req.body.notam) : '';
    if (!notam || !notam.trim()) {
      return res.status(400).json({ error: 'missing notam in request body' });
    }

    if (!openaiClient) {
      return res.status(500).json({ error: 'OpenAI client not configured on server (missing OPENAI_API_KEY).' });
    }

    // Instruction: ask model to return strict JSON: {"segments":["..."]}
    const systemInstruction = `You are a strict extractor. Given NOTAM text, return ONLY valid JSON exactly in this format:
{"segments":["AWY ... FLnnn-FLnnn", "..."]}
If nothing found, return {"segments":[]} and nothing else.`;

    const userPrompt = `NOTAM:\n${notam}\n\nReturn only JSON as described.`;

    // If project key or explicit project id -> use Responses API (new Projects API)
    const isProjectKey = Boolean(OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-proj-')) || !!OPENAI_PROJECT_ID;

    if (isProjectKey) {
      // Responses API
      try {
        const resp = await openaiClient.responses.create({
          model: MODEL,
          input: `${systemInstruction}\n\n${userPrompt}`,
          // optionally adjust response settings: max_output_tokens, temperature
        });

        // Try to obtain text: prefer resp.output_text; fallback to scanning output array
        let outText = '';
        if (resp.output_text) outText = String(resp.output_text);
        else if (Array.isArray(resp.output)) {
          // Try to extract output_text chunks
          for (const o of resp.output) {
            if (o.type === 'output_text' && typeof o.text === 'string') outText += o.text + '\n';
            else if (o.type === 'message' && o.content) {
              for (const c of (o.content || [])) {
                if (c.type === 'output_text' && c.text) outText += c.text + '\n';
              }
            }
          }
        } else {
          // Fallback: try JSON.stringify resp
          outText = resp.output_text || JSON.stringify(resp).slice(0, 4000);
        }

        const segments = extractSegmentsFromText(outText);
        return res.json({ segments });
      } catch (err) {
        console.error('OpenAI Responses API error:', err && err.message);
        // include trimmed error in response for debugging (don't leak secrets)
        return res.status(500).json({ error: 'OpenAI Responses API error: ' + (err && err.message) });
      }
    }

    // Else classic (chat) key path — use Chat Completions (older path)
    try {
      // Many versions of the SDK use different method names; the OpenAI official Node SDK exposes:
      // client.chat.completions.create({ ... })
      // We attempt to call chat.completions.create and fallback to other shapes if necessary.
      let chatResult;
      if (openaiClient.chat && openaiClient.chat.completions && typeof openaiClient.chat.completions.create === 'function') {
        chatResult = await openaiClient.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 800,
        });
        // get text
        const choice = (chatResult.choices && chatResult.choices[0]) || null;
        const chatText = choice && choice.message && choice.message.content
          ? choice.message.content
          : (choice && choice.text ? choice.text : '');
        const segments = extractSegmentsFromText(chatText);
        return res.json({ segments });
      } else {
        // If SDK doesn't have chat.completions, try legacy completions (as last fallback)
        console.warn('chat.completions.create not found on openai client; attempting fallback.');
        // Try to call `client.responses.create` as fallback (some SDK versions still support)
        const fallback = await openaiClient.responses.create({
          model: MODEL,
          input: `${systemInstruction}\n\n${userPrompt}`
        });
        const text = fallback.output_text || JSON.stringify(fallback).slice(0, 2000);
        const segments = extractSegmentsFromText(text);
        return res.json({ segments });
      }
    } catch (err) {
      console.error('OpenAI Chat API error:', err && err.message);
      return res.status(500).json({ error: 'OpenAI Chat API error: ' + (err && err.message) });
    }

  } catch (err) {
    console.error('Unexpected /process-notam error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'server error' });
  }
});

// Fallback route: serve index if path not found (for SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(docsPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}. Serving docs from ${docsPath}`);
});
