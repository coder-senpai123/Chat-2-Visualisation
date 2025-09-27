import React from "react";

/**
 * ChatPanel (right column) — displays conversation list and supports hover highlight + selection.
 *
 * Props:
 * - conversations: array
 * - onSelectViz(answerMeta, convId) -> add visualization to a conversation
 * - onConversationSelect(id) -> select conversation
 * - onRenameConversation(convId, newTitle)
 * - currentConvId
 */
export default function ChatPanel({ conversations = [], onSelectViz, onConversationSelect, onRenameConversation, currentConvId }) {
  return (
    <div>
      <div className="conversations-list">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conv-item ${c.id === currentConvId ? "active" : ""}`}
            onMouseEnter={() => {}}
            onClick={() => onConversationSelect && onConversationSelect(c.id)}
            title={c.title}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="conv-title">{c.title}</div>
              <div className="conv-sub">{(c.messages && c.messages.length > 0) ? c.messages[c.messages.length - 1].text.slice(0, 64) : "No messages yet"}</div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="button" onClick={(e) => { e.stopPropagation(); onRenameConversation && onRenameConversation(c.id, prompt("Rename conversation", c.title) || c.title); }}>Rename</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
