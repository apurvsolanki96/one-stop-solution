/**
 * backend/process-notam.js
 *
 * Express router that supports BOTH classic OpenAI keys (sk-...) and
 * project keys (sk-proj-...) by selecting the appropriate client call.
 *
 * Usage:
 * 1. Place this file in your repo (e.g. backend/process-notam.js)
 * 2. In your main server (e.g. server.js) do:
 *      const express = require('express');
 *      const app = express();
 *      app.use(express.json());
 *      const processRouter = require('./backend/process-notam');
 *      app.use(processRouter); // mounts /process-notam
 * 3. Set env vars on Render:
 *      OPENAI_API_KEY = <your sk-proj-... or classic sk-...>
 *      (optional) OPENAI_PROJECT_ID = proj_xxx  // helpful for project keys
 *      (optional) OPENAI_MODEL = gpt-4.1         // or model you prefer
 * 4. Redeploy.
 */

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY || '';
const projectId = process.env.OPENAI_PROJECT_ID || ''; // optional
const modelName = process.env.OPENAI_MODEL || (process.env.OPENAI_MODEL === undefined ? 'gpt-4.1' : process.env.OPENAI_MODEL);

if (!apiKey) {
  console.error('Missing OPENAI_API_KEY environment variable.');
  // We still export the router so your server won't crash on require; requests will return error.
}

let client;
try {
  if (apiKey && (apiKey.startsWith('sk-proj-') || projectId)) {
    // Project-style key: initialize with project (new OpenAI client accepts `project` option)
    client = new OpenAI({ apiKey, project: projectId || undefined });
    console.info('OpenAI client initialized in PROJECT mode (sk-proj or OPENAI_PROJECT_ID).');
  } else if (apiKey) {
    // Classic key
    client = new OpenAI({ apiKey });
    console.info('OpenAI client initialized in CLASSIC mode (sk-...).');
  }
} catch (err) {
  console.error('Failed to initialize OpenAI client:', err && err.message);
}

/**
 * Minimal helper to try parse JSON or return raw text as fallback.
 */
function tryParseSegmentsFromText(text) {
  if (!text) return [];
  // Try JSON first
  try {
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed.segments)) return parsed.segments;
    // If parsed object has 'segments' nested
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.segments)) return parsed.segments;
  } catch (_) {
    // ignore JSON parse error
  }
  // Try to heuristically extract lines like "W187 TUSLI-DNH FL000-FL341"
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) return lines;
  // fallback single text
  return [ String(text).trim() ];
}

/**
 * POST /process-notam
 * Body: { notam: "<full-notam-text>" }
 * Response: { segments: ["AWY ...", ...] }
 */
router.post('/process-notam', async (req, res) => {
  try {
    if (!client) {
      return res.status(500).json({ error: 'OpenAI client not configured on server. Missing OPENAI_API_KEY.' });
    }
    const notam = (req.body && req.body.notam) ? String(req.body.notam) : '';
    if (!notam) return res.status(400).json({ error: 'missing notam in request body' });

    // Prompt instructing model to return JSON parseable output
    const systemInstruction = `You are a strict extractor. Given a NOTAM text, return a JSON object exactly in this format:
{"segments":["<AWY CODE> <FROM>-<TO> FLnnn-FLnnn", "..."]}
Only output valid JSON and nothing else. If you can't extract, return {"segments":[]} .`;

    const userPrompt = `NOTAM:\n${notam}\n\nExtract ATS airway segments and FL ranges as an array "segments". Example output:
{"segments":["W187 TUSLI-DNH FL000-FL341"]}`;

    // If using Project-style key (Responses API)
    if (apiKey.startsWith('sk-proj-') || projectId) {
      // Use Responses API
      const model = modelName;
      const response = await client.responses.create({
        model,
        input: `${systemInstruction}\n\n${userPrompt}`,
        // limit tokens/timeout etc if you want
      });

      // The responses API returns structured outputs. Try to get text:
      let outText = '';
      if (response.output && Array.isArray(response.output) && response.output.length) {
        // New SDK often places text at response.output[0].content[0].text or uses output_text
        try {
          // prefer output_text if available
          if (response.output_text) outText = response.output_text;
          else {
            // try find text chunk
            for (const o of response.output) {
              if (o.type === 'output_text' && typeof o.text === 'string') { outText += o.text + '\n'; }
              if (o.type === 'message' && o.content) {
                // message content may include text pieces
                for (const c of (o.content || [])) {
                  if (c.type === 'output_text' && c.text) outText += c.text + '\n';
                }
              }
            }
            outText = outText.trim();
          }
        } catch (e) {
          outText = response.output_text || JSON.stringify(response.output).slice(0, 2000);
        }
      } else {
        //fallback
        outText = response.output_text || '';
      }

      const segments = tryParseSegmentsFromText(outText);
      return res.json({ segments });
    }

    // Else use classic Chat Completions (Chat API)
    // Use chat.completions.create for older SDK interface
    const chatResponse = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800
    });

    const chatText = chatResponse.choices && chatResponse.choices[0] && chatResponse.choices[0].message && chatResponse.choices[0].message.content
      ? chatResponse.choices[0].message.content
      : (chatResponse.choices && chatResponse.choices[0] && chatResponse.choices[0].text ? chatResponse.choices[0].text : '');

    const segments = tryParseSegmentsFromText(chatText);
    return res.json({ segments });
  } catch (err) {
    console.error('Error in /process-notam:', err);
    // Provide safe error message
    return res.status(500).json({ error: (err && err.message) || 'server error' });
  }
});

module.exports = router;
