
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.8,
    topP: 0.9,
    responseMimeType: 'application/json'
  }
});

const SYSTEM_SPEC = `
You are an assistant that outputs STRICT JSON only, matching this TS type:
{
  "text": string, // clear, stepwise explanation (with a short TL;DR at end)
  "visualization": {
    "id": string,
    "duration": number, // ms
    "fps": number,
    "layers": Array<
      { "id": string, "type": "circle"|"rect"|"arrow"|"line"|"text",
        "props": object,
        "animations": Array<object>
      }
    >
  }
}
Rules:
- Use simple shapes (circle, rect, line, arrow, text) with friendly colors for dark backgrounds.
- Keep canvas 800x500 reference space; place shapes within that.
- Animations: use linear timing. "orbit" places an item around (centerX,centerY) with given radius over its duration.
- Keep duration 4 to 8 seconds; fps ~30.
- Ensure valid JSON (no comments, no markdown fences).
`;

async function parseModelJson(rawText, question) {
  let text = rawText ?? '';
  if (text.startsWith('```')) {
    text = text.replace(/^```json\n?|```/g, '');
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed?.text || !parsed?.visualization) throw new Error('Invalid shape');
    return parsed;
  } catch (e) {
    // fallback minimal payload kept same as previous version
    return {
      text: `Here is an overview of ${question}. (Model returned non-JSON; fallback used.)\n\nTL;DR: ${question} explained simply.`,
      visualization: {
        id: 'vis_fallback',
        duration: 5000,
        fps: 30,
        layers: [
          { id: 'title', type: 'text', props: { x: 50, y: 80, text: question, color: '#ffffff', size: 20 }, animations: [] },
          {
            id: 'pulse',
            type: 'circle',
            props: { x: 120, y: 220, r: 18, fill: '#4f46e5' },
            animations: [
              { property: 'r', from: 12, to: 24, start: 0, end: 2500 },
              { property: 'r', from: 24, to: 12, start: 2500, end: 5000 }
            ]
          }
        ]
      }
    };
  }
}

export async function llmGenerate(question) {
  const user = `Create an explanation + visualization for: "${question}"`;
  const res = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: SYSTEM_SPEC + '\n' + user }] }
    ]
  });

  const raw = res.response?.text?.() ?? '';
  const parsed = await parseModelJson(raw, question);
  return parsed;
}

export async function llmStream(question, handlers = {}, streamOptions = {}) {
  const { onToken, onComplete, onError } = handlers || {};
  const opts = { chunkSize: streamOptions.chunkSize ?? 64, emulateSlowFallback: !!streamOptions.emulateSlowFallback };

  try {
    if (typeof model.stream === 'function' || typeof model.generateStream === 'function' || typeof genAI.stream === 'function') {
      const streamFn = model.stream || model.generateStream || genAI.stream;

      let accumulated = '';

      let called = false;

      if (streamFn && streamFn.constructor.name === 'AsyncFunction') {
        try {
          const asyncIter = await streamFn({
            contents: [{ role: 'user', parts: [{ text: SYSTEM_SPEC + '\n' + `Create an explanation + visualization for: "${question}"` }] }],
            responseMimeType: 'application/json'
          });

          if (asyncIter && typeof asyncIter[Symbol.asyncIterator] === 'function') {
            for await (const part of asyncIter) {
              const frag = (part?.delta?.content ?? part?.text ?? part?.content ?? '') + '';
              if (frag) {
                accumulated += frag;
                onToken && onToken(frag);
              }
            }
            const parsed = await parseModelJson(accumulated, question);
            onComplete && onComplete(parsed);
            called = true;
            return parsed;
          }
        } catch (e) {
        }
      }

      try {
        await streamFn({
          contents: [{ role: 'user', parts: [{ text: SYSTEM_SPEC + '\n' + `Create an explanation + visualization for: "${question}"` }] }],
          responseMimeType: 'application/json'
        }, {
          onMessage: (m) => {
            try {
              const frag = (m?.delta?.content ?? m?.text ?? '') + '';
              if (frag) {
                accumulated += frag;
                onToken && onToken(frag);
              }
            } catch (e) {}
          },
          onError: (e) => {
            onError && onError(e);
          },
          onComplete: async () => {
            const parsed = await parseModelJson(accumulated, question);
            onComplete && onComplete(parsed);
          }
        });
        called = true;
      } catch (e) {
      }

      if (called) {
        return;
      }
    }

    const full = await llmGenerate(question);
    const text = full.text || '';
    if (typeof onToken === 'function') {
      const chunkSize = Math.max(32, parseInt(streamOptions.chunkSize || opts.chunkSize));
      let pos = 0;
      while (pos < text.length) {
        pos = Math.min(text.length, pos + chunkSize);
        const chunk = text.slice(0, pos); // cumulative
        onToken(chunk);
        if (opts.emulateSlowFallback) {
          await new Promise((r) => setTimeout(r, 80));
        }
      }
    }

    onComplete && onComplete(full);
    return full;
  } catch (err) {
    onError && onError(err);
    throw err;
  }
}
