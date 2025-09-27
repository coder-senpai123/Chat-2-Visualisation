import React, { useEffect, useRef, useState } from "react";
import { API_BASE, fetchAnswer, postQuestion } from "./api";
import ChatPanel from "./components/ChatPanel";
import Composer from "./components/Composer";
import ChatBox from "./components/ChatBox";
import VisualizationPanel from "./components/VisualizationPanel";
import ReactMarkdown from "react-markdown";
import "./styles.css";

const STORAGE_KEY = "viz_conversations_v3";

const TYPING_INTERVAL_MS = 25;
const CHARS_PER_TICK = 2;

export default function App() {
  const [conversations, setConversations] = useState([]);
  const conversationsRef = useRef(conversations);
  const [currentConvId, setCurrentConvId] = useState(null);
  const currentConvRef = useRef(currentConvId);

  const [answers, setAnswers] = useState({});
  const answersRef = useRef(answers);

  const [posting, setPosting] = useState(false);

  const [displayTexts, setDisplayTexts] = useState({});
  const displayTextsRef = useRef(displayTexts);
  const revealBuffersRef = useRef({}); 

  const clientTempMapRef = useRef({});
  const [sessionId] = useState(() => `session_${Date.now()}`);

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { currentConvRef.current = currentConvId; }, [currentConvId]);
  useEffect(() => { displayTextsRef.current = displayTexts; }, [displayTexts]);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (parsed && parsed.length > 0) {
        setConversations(parsed);
        setCurrentConvId(parsed[0].id);
      } else {
        const c = { id: sessionId, title: "New Chat", createdAt: Date.now(), messages: [], panels: [] };
        setConversations([c]);
        setCurrentConvId(c.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([c]));
      }
    } catch {
      const c = { id: sessionId, title: "New Chat", createdAt: Date.now(), messages: [], panels: [] };
      setConversations([c]);
      setCurrentConvId(c.id);
    }
  }, []);

  function persistConversations(next) {
    try {
      const sanitized = (next || []).map(conv => ({
        ...conv,
        messages: (conv.messages || []).map(m => { const { animate, ...rest } = m; return rest; }),
        panels: conv.panels || [],
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch {}
  }

  const typingIntervalRef = useRef(null);
  useEffect(() => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    typingIntervalRef.current = setInterval(() => {
      const buffers = revealBuffersRef.current;
      let didChange = false;
      const nextDisplay = { ...displayTextsRef.current };

      for (const aid of Object.keys(buffers)) {
        const buffer = buffers[aid] || "";
        if (!buffer) { delete buffers[aid]; continue; }
        const take = buffer.slice(0, CHARS_PER_TICK);
        const remain = buffer.slice(CHARS_PER_TICK);
        nextDisplay[aid] = (nextDisplay[aid] || "") + take;
        buffers[aid] = remain;
        didChange = true;
        if (!buffers[aid]) delete buffers[aid];
      }

      if (didChange) setDisplayTexts(nextDisplay);
    }, TYPING_INTERVAL_MS);

    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/stream`);

    es.addEventListener("question_created", (ev) => {
      try {
        const { question } = JSON.parse(ev.data);
        if (!question || !question.id) return;

        setConversations(prev => {
          const copy = prev.slice();

          if (copy.some(c => c.id === question.id)) return copy;

          const mappingEntries = Object.entries(clientTempMapRef.current);
          const qTrim = (question.question || "").trim();
          for (const [tempMsgId, meta] of mappingEntries) {
            if (!meta) continue;
            if ((meta.text || "").trim() === qTrim && copy.some(c => c.id === meta.tempConvId)) {
              const convIdx = copy.findIndex(c => c.id === meta.tempConvId);
              if (convIdx !== -1) {
                const conv = { ...copy[convIdx] };
                conv.messages = conv.messages.map(m => (m.id === tempMsgId ? { ...m, id: question.id, pending: true } : m));
                conv.id = question.id;
                conv.title = (question.question || "").slice(0, 120);
                copy.splice(convIdx, 1);
                copy.unshift(conv);
                delete clientTempMapRef.current[tempMsgId];
                persistConversations(copy);
                setCurrentConvId(question.id);
                return copy;
              }
            }
          }

          if (question.conversationId) {
            const idx = copy.findIndex(c => c.id === question.conversationId);
            if (idx !== -1) {
              const conv = { ...copy[idx] };
              if (!conv.messages.some(m => m.text === question.question && m.role === "user")) {
                conv.messages.push({ id: question.id, role: "user", text: question.question, pending: false });
              }
              copy[idx] = conv;
              persistConversations(copy);
              return copy;
            }
          }

          const idxByMsg = copy.findIndex(c => c.messages.some(m => m.role === "user" && (m.text || "").trim() === qTrim));
          if (idxByMsg !== -1) {
            const conv = { ...copy[idxByMsg] };
            conv.messages = conv.messages.map(m =>
              (m.role === "user" && (m.text || "").trim() === qTrim) ? { ...m, id: question.id, pending: true } : m
            );
            conv.id = question.id;
            conv.title = (question.question || "").slice(0, 120);
            for (const [k, meta] of Object.entries(clientTempMapRef.current)) {
              if (meta && (meta.text || "").trim() === qTrim) delete clientTempMapRef.current[k];
            }
            copy.splice(idxByMsg, 1);
            copy.unshift(conv);
            persistConversations(copy);
            setCurrentConvId(question.id);
            return copy;
          }

          const newConv = {
            id: question.id,
            title: (question.question || "").slice(0, 120),
            createdAt: Date.now(),
            messages: [{ id: question.id, role: "user", text: question.question, pending: false }],
            panels: []
          };
          const next = [newConv, ...copy];
          persistConversations(next);
          setCurrentConvId(newConv.id);
          return next;
        });
      } catch (e) { console.error("Failed to parse question_created", e); }
    });

    es.addEventListener("answer_stream", (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        const { answerId, questionId, chunk, done, visualization } = payload;
        if (!answerId || !questionId) return;

        setAnswers(prev => {
          const prevAns = prev[answerId] || { id: answerId, questionId, text: "", streaming: true, visualization: null };
          const prevText = prevAns.text || "";
          const ch = chunk || "";

          const nextText = ch.startsWith(prevText) ? ch : (prevText + ch);

          const nextAns = {
            ...prevAns,
            text: nextText,
            streaming: !done,
            visualization: visualization || prevAns.visualization || null
          };

          const curDisplay = displayTextsRef.current[answerId] || "";
          const unseen = nextText.slice(curDisplay.length);
          if (unseen) {
            revealBuffersRef.current[answerId] = (revealBuffersRef.current[answerId] || "") + unseen;
          }

          return { ...prev, [answerId]: nextAns };
        });

        setConversations(prev => {
          const copy = prev.slice();

          let convIndex = copy.findIndex(c => c.messages.some(m => m.id === questionId));
          if (convIndex === -1) convIndex = copy.findIndex(c => c.id === questionId);

          if (convIndex === -1) {
            const newConv = {
              id: questionId,
              title: `Question ${String(questionId).slice(0, 120)}`,
              createdAt: Date.now(),
              messages: [
                { id: questionId, role: "user", text: "(question)", pending: false },
                { id: answerId, role: "assistant", text: chunk || "", pending: !done, answerId, animate: false }
              ],
              panels: []
            };
            if (visualization) {
              newConv.panels.push({
                uid: `p_${answerId}`,
                key: `m_${answerId}`,
                messageId: answerId,
                questionId,
                questionText: "",
                answerText: chunk || "",
                visualization,
                createdAt: Date.now()
              });
            }
            copy.unshift(newConv);
            persistConversations(copy);
            return copy;
          }

          const conv = { ...copy[convIndex] };
          const idx = conv.messages.findIndex(m => (m.answerId === answerId) || m.id === answerId);

          if (idx !== -1) {
            const msg = { ...conv.messages[idx] };
            const prevMsgText = msg.text || "";
            const ch = chunk || "";
            msg.text = ch.startsWith(prevMsgText) ? ch : (prevMsgText + ch);
            msg.pending = !done;
            msg.answerId = answerId;
            if (done) msg.animate = true;
            conv.messages[idx] = msg;
          } else {
            if (!conv.messages.some(m => m.id === answerId || m.answerId === answerId)) {
              conv.messages.push({ id: answerId, role: "assistant", text: chunk || "", pending: !done, answerId, animate: false });
            }
          }

          conv.panels = conv.panels || [];
          const panelKey = `m_${answerId}`;
          const existingPanel = conv.panels.findIndex(p => p.key === panelKey);
          const panelObj = {
            uid: existingPanel !== -1 ? conv.panels[existingPanel].uid : `p_${answerId}`,
            key: panelKey,
            messageId: answerId,
            questionId,
            questionText: conv.messages.find(m => m.id === questionId)?.text || "",
            answerText: conv.messages.find(m => (m.answerId === answerId) || m.id === answerId)?.text || "",
            visualization: visualization || (conv.panels[existingPanel] && conv.panels[existingPanel].visualization) || null,
            createdAt: Date.now()
          };
          if (existingPanel !== -1) conv.panels[existingPanel] = panelObj;
          else conv.panels.unshift(panelObj);

          copy.splice(convIndex, 1);
          copy.unshift(conv);
          persistConversations(copy);
          return copy;
        });

        if (done) {
          setConversations(prev => {
            const copy = prev.slice();
            const convIdx = copy.findIndex(c => c.messages.some(m => m.id === answerId) || c.id === questionId);
            if (convIdx === -1) return prev;
            const conv = { ...copy[convIdx] };
            conv.messages = conv.messages.map(m => (m.id === answerId ? { ...m, pending: false, animate: true } : m));
            conv.panels = (conv.panels || []).map(p => p.key === `m_${answerId}`
              ? { ...p, answerText: conv.messages.find(m => m.id === answerId)?.text || p.answerText, visualization: visualization || p.visualization || null }
              : p);
            copy[convIdx] = conv;
            persistConversations(copy);
            return copy;
          });

          if (revealBuffersRef.current && revealBuffersRef.current[answerId]) {
            const cur = displayTextsRef.current[answerId] || "";
            setDisplayTexts(prev => ({ ...prev, [answerId]: (answersRef.current[answerId]?.text || cur) }));
            delete revealBuffersRef.current[answerId];
          }
        }
      } catch (e) { console.error("Failed to parse answer_stream", e); }
    });

    // ANSWER CREATED (fallback only)
    es.addEventListener("answer_created", (ev) => {
      try {
        const { answer } = JSON.parse(ev.data);
        if (!answer || !answer.id) return;

        if (answersRef.current[answer.id]) return;

        setAnswers(prev => ({ ...prev, [answer.id]: { ...answer, streaming: false } }));

        setDisplayTexts(prev => {
          const cur = prev[answer.id] || "";
          const unseen = (answer.text || "").slice(cur.length);
          if (unseen) {
            revealBuffersRef.current[answer.id] = (revealBuffersRef.current[answer.id] || "") + unseen;
          }
          return prev;
        });

        setConversations(prev => {
          const copy = prev.slice();

          const convIndex = copy.findIndex(c => c.messages.some(m => m.id === answer.questionId));
          if (convIndex !== -1) {
            const conv = { ...copy[convIndex] };
            conv.messages = conv.messages.map(m => (m.id === answer.questionId && m.pending ? { ...m, pending: false } : m));

            const msgIdx = conv.messages.findIndex(m => m.answerId === answer.id || m.id === answer.id);
            if (msgIdx !== -1) {
              conv.messages[msgIdx] = {
                ...conv.messages[msgIdx],
                text: answer.text,
                pending: false,
                animate: true,
                answerId: answer.id,
                viz: answer.visualization ?? conv.messages[msgIdx].viz
              };
            } else {
              conv.messages.push({ id: answer.id, role: "assistant", text: answer.text, viz: answer.visualization, answerId: answer.id, animate: true });
            }

            conv.panels = conv.panels || [];
            const key = `m_${answer.id}`;
            const existing = conv.panels.findIndex(p => p.key === key);
            const newPanel = {
              uid: `p_${answer.id}`,
              key,
              messageId: answer.id,
              questionId: answer.questionId,
              questionText: conv.messages.find(m => m.id === answer.questionId)?.text || "",
              answerText: answer.text,
              visualization: answer.visualization,
              createdAt: Date.now()
            };
            if (existing !== -1) conv.panels[existing] = newPanel;
            else conv.panels.push(newPanel);

            const order = conv.messages.filter(m => m.role === 'assistant').map(m => `m_${m.id}`);
            conv.panels.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

            copy[convIndex] = conv;
            persistConversations(copy);
            return copy;
          } else {
            const newConv = {
              id: answer.questionId ?? `conv_${Date.now()}`,
              title: answer.questionId ? `Question ${answer.questionId}` : `Answer ${answer.id}`,
              createdAt: Date.now(),
              messages: [
                { id: answer.questionId ?? `q_${Date.now()}`, role: "user", text: "(question)", pending: false },
                { id: answer.id, role: "assistant", text: answer.text, viz: answer.visualization, answerId: answer.id, animate: true }
              ],
              panels: [{
                uid: `p_${answer.id}`,
                key: `m_${answer.id}`,
                messageId: answer.id,
                questionId: answer.questionId ?? null,
                questionText: "",
                answerText: answer.text,
                visualization: answer.visualization,
                createdAt: Date.now()
              }]
            };
            const next = [newConv, ...copy];
            persistConversations(next);
            return next;
          }
        });
      } catch (e) { console.error("Failed to parse answer_created", e); }
    });

    es.onerror = (err) => {
      console.warn("SSE error", err);
    };

    return () => es.close();
  }, []); 

  async function onSubmitted(questionText) {
    if (!questionText) return;

    let reuseConvId = null;
    if (currentConvRef.current) {
      const existingConv = conversationsRef.current.find(c => c.id === currentConvRef.current);
      if (existingConv && (!existingConv.messages || existingConv.messages.length === 0)) {
        reuseConvId = existingConv.id;
      }
    }

    const tempConvId = reuseConvId || `localconv_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const tempMsgId = `local_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    if (reuseConvId) {
      setConversations(prev => {
        const copy = prev.slice();
        const idx = copy.findIndex(c => c.id === reuseConvId);
        if (idx !== -1) {
          const conv = { ...copy[idx] };
          conv.title = questionText.slice(0, 120) || conv.title || "New Chat";
          conv.messages = [{ id: tempMsgId, role: "user", text: questionText, pending: true }];
          copy.splice(idx, 1);
          copy.unshift(conv);
          persistConversations(copy);
          setCurrentConvId(conv.id);
        }
        return copy;
      });
    } else {
      const newConv = {
        id: tempConvId,
        title: questionText.slice(0, 120) || "New Chat",
        createdAt: Date.now(),
        messages: [{ id: tempMsgId, role: "user", text: questionText, pending: true }],
        panels: []
      };
      const next = [newConv, ...conversationsRef.current];
      setConversations(next);
      persistConversations(next);
      setCurrentConvId(tempConvId);
    }

    clientTempMapRef.current[tempMsgId] = { tempConvId, tempMsgId, text: questionText };

    setPosting(true);
    try {
      const res = await postQuestion({ userId: "u1", question: questionText, conversationId: tempConvId });
      const questionId = res?.questionId;
      const answerId = res?.answerId;

      if (questionId) {
        setConversations(prev => {
          const copy = prev.slice();
          const idx = copy.findIndex(c => c.id === tempConvId);
          if (idx !== -1) {
            const conv = { ...copy[idx] };
            conv.messages = conv.messages.map(m => (m.id === tempMsgId ? { ...m, id: questionId, pending: true } : m));
            conv.id = questionId;
            conv.title = questionText.slice(0, 120);
            copy.splice(idx, 1);
            copy.unshift(conv);
            persistConversations(copy);
            setCurrentConvId(questionId);
          }
          delete clientTempMapRef.current[tempMsgId];
          return copy;
        });
      }

      if (answerId) {
        try {
          const a = await fetchAnswer(answerId);
          setAnswers(p => ({ ...p, [a.id]: a }));
          setConversations(prev => {
            const copy = prev.slice();
            let idx = -1;
            if (questionId) idx = copy.findIndex(c => c.id === questionId);
            if (idx === -1) idx = copy.findIndex(c => c.messages.some(m => m.id === a.questionId));
            if (idx === -1) idx = copy.findIndex(c => c.id === tempConvId);
            if (idx === -1) return prev;

            const conv = { ...copy[idx] };
            if (!conv.messages.some(m => m.answerId === a.id || m.id === a.id)) {
              conv.messages.push({ id: a.id, role: "assistant", text: a.text, viz: a.visualization, answerId: a.id, animate: true });
            }

            conv.panels = conv.panels || [];
            const key = `m_${a.id}`;
            const existing = conv.panels.findIndex(p => p.key === key);
            const newPanel = {
              uid: `p_${a.id}`,
              key,
              messageId: a.id,
              questionId: a.questionId,
              questionText: conv.messages.find(m => m.id === a.questionId)?.text || "",
              answerText: a.text,
              visualization: a.visualization,
              createdAt: Date.now()
            };
            if (existing !== -1) conv.panels[existing] = newPanel;
            else conv.panels.unshift(newPanel);

            const order = conv.messages.filter(m => m.role === 'assistant').map(m => `m_${m.id}`);
            conv.panels.sort((x, y) => order.indexOf(x.key) - order.indexOf(y.key));

            copy[idx] = conv;
            persistConversations(copy);
            return copy;
          });
        } catch (e) {
          console.warn("fetchAnswer immediate failed", e);
        }
      }
    } catch (err) {
      console.warn("postQuestion failed", err);
    } finally {
      setPosting(false);
    }
  }

  function handleSelectConversation(id) { setCurrentConvId(id); }

  function handleNewChat() {
    const id = `conv_${Date.now()}`;
    const conv = { id, title: "New Chat", createdAt: Date.now(), messages: [], panels: [] };
    const next = [conv, ...conversationsRef.current];
    setConversations(next);
    persistConversations(next);
    setCurrentConvId(id);
  }

  function handleClearHistory() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    const id = `session_${Date.now()}`;
    const newConv = { id, title: "New Chat", createdAt: Date.now(), messages: [], panels: [] };
    const next = [newConv];
    setConversations(next);
    persistConversations(next);
    setCurrentConvId(newConv.id);
    clientTempMapRef.current = {};
    setAnswers({});
    setDisplayTexts({});
    revealBuffersRef.current = {};
  }

  function handleRenameConversation(convId, newTitle) {
    setConversations(prev => {
      const copy = prev.map(c => c.id === convId ? { ...c, title: newTitle } : c);
      persistConversations(copy);
      return copy;
    });
  }

  function handleClosePanel(uid) {
    setConversations(prev => {
      const copy = prev.slice();
      const idx = copy.findIndex(c => c.id === currentConvId);
      if (idx === -1) return prev;
      const conv = { ...copy[idx] };
      conv.panels = (conv.panels || []).filter(p => p.uid !== uid);
      copy[idx] = conv;
      persistConversations(copy);
      return copy;
    });
  }

  const currentConv = conversations.find(c => c.id === currentConvId) ?? null;
  const currentMessages = currentConv?.messages ?? [];
  const currentPanels = currentConv?.panels ?? [];
  const activePanel = currentPanels && currentPanels.length > 0 ? currentPanels[0] : null;
  const assistantAnswer = currentMessages.find(m => m.role === "assistant") ?? null;
  const userQuestion = currentMessages.find(m => m.role === "user") ?? null;

  const assistantId = assistantAnswer?.id;

  const displayTextForAssistant = assistantId
    ? (answers[assistantId]?.streaming
        ? (displayTexts[assistantId] ?? answers[assistantId]?.text ?? assistantAnswer?.text ?? "")
        : (answers[assistantId]?.text ?? assistantAnswer?.text ?? ""))
    : "";

  const isStreaming = assistantId
    ? (answers[assistantId]?.streaming ?? assistantAnswer?.pending ?? false)
    : false;

  return (
    <div className="app">
      <ChatBox title="Chat → Visualization" />

      <div className="layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, padding: 16 }}>
        <div style={{ display: 'flex', gap: 18 }}>
          <div style={{ flex: '0 0 66%', minHeight: 540 }}>
            {activePanel ? (
              <VisualizationPanel
                viz={activePanel.visualization}
                answerMeta={activePanel}
                onClose={() => handleClosePanel(activePanel.uid)}
                large
              />
            ) : (
              <div style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005))",
                borderRadius: 12,
                padding: 24,
                minHeight: 540,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted)"
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>No visualization yet</div>
                  <div>Ask a question to generate a visualization. A new thread will be created for every question.</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: '0 0 34%', minHeight: 540 }}>
            <div style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005))",
              borderRadius: 12,
              padding: 18,
              minHeight: 540,
              overflowY: "auto"
            }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Question</div>
                <div style={{ color: "var(--muted)" }}>{userQuestion?.text ?? "—"}</div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Answer</div>

                <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                  {displayTextForAssistant ? (
                    <ReactMarkdown>{displayTextForAssistant}</ReactMarkdown>
                  ) : (
                    <div style={{ color: "var(--muted)" }}>{isStreaming ? "Waiting for an answer..." : "Waiting for an answer..."}</div>
                  )}
                </div>

                {isStreaming && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>Streaming…</div>
                )}
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                {(assistantAnswer && (assistantAnswer.viz || answers[assistantAnswer.id]?.visualization)) && (
                  <button className="button" onClick={() => {
                    setConversations(prev => {
                      const copy = prev.slice();
                      const idx = copy.findIndex(c => c.id === currentConvId);
                      if (idx === -1) return prev;
                      const conv = { ...copy[idx] };
                      conv.panels = conv.panels || [];
                      const key = `m_${assistantAnswer.id}`;
                      if (!conv.panels.some(p => p.key === key)) {
                        conv.panels.unshift({
                          uid: `p_${assistantAnswer.id}`,
                          key,
                          messageId: assistantAnswer.id,
                          questionId: assistantAnswer.questionId,
                          questionText: userQuestion?.text || "",
                          answerText: assistantAnswer.text,
                          visualization: assistantAnswer.viz || answers[assistantAnswer.id]?.visualization,
                          createdAt: Date.now()
                        });
                      }
                      copy[idx] = conv;
                      persistConversations(copy);
                      return copy;
                    });
                  }}>Open visualization</button>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="conversations-aside">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Conversations</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="button" onClick={handleNewChat}>+ New</button>
              <button className="button" onClick={handleClearHistory}>Clear history</button>
            </div>
          </div>

          <ChatPanel
            conversations={conversations}
            onSelectViz={(answerMeta, convId) => {
              setConversations(prev => {
                const copy = prev.slice();
                const idx = copy.findIndex(c => c.id === convId);
                if (idx === -1) return prev;
                const conv = { ...copy[idx] };
                conv.panels = conv.panels || [];
                const key = answerMeta.messageId
                  ? `m_${answerMeta.messageId}`
                  : (answerMeta.questionId ? `q_${answerMeta.questionId}` : `t_${String(answerMeta.question || answerMeta.questionText || '').slice(0,120)}`);
                const existing = conv.panels.findIndex(p => p.key === key);
                const newPanel = {
                  uid: existing !== -1 ? conv.panels[existing].uid : `p_${Date.now()}`,
                  key,
                  messageId: answerMeta.messageId || null,
                  questionId: answerMeta.questionId || null,
                  questionText: answerMeta.questionText || answerMeta.question || '',
                  answerText: answerMeta.answerText || answerMeta.text || '',
                  visualization: answerMeta.visualization,
                  createdAt: Date.now()
                };
                if (existing !== -1) conv.panels[existing] = newPanel;
                else conv.panels.unshift(newPanel);

                copy[idx] = conv;
                persistConversations(copy);
                return copy;
              });

              setCurrentConvId(convId);
            }}
            onConversationSelect={(id) => handleSelectConversation(id)}
            onRenameConversation={handleRenameConversation}
            currentConvId={currentConvId}
          />
        </aside>
      </div>

      <Composer onSubmitted={(q) => onSubmitted(q)} sending={posting} />
    </div>
  );
}
