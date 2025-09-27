export const API_BASE = import.meta.env.VITE_API_BASE || '';


export async function fetchQuestions() {
const res = await fetch(`${API_BASE}/api/questions`);
return res.json();
}
export async function fetchAnswer(aid) {
const res = await fetch(`${API_BASE}/api/answers/${aid}`);
if (!res.ok) throw new Error('Answer fetch failed');
return res.json();
}
export async function postQuestion({ userId, question, conversationId }) {
  const res = await fetch(`${API_BASE}/api/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, question, conversationId })
  });

  const text = await res.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch (e) { /* not JSON */ }

  if (!res.ok) {
    const msg = payload?.error || payload?.message || text || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  try { return payload || JSON.parse(text); } catch (e) { return text; }
}
