import React from "react";
import ReactMarkdown from "react-markdown";

/**
 * ChatList — renders messages (user + assistant). The assistant message includes a small "Open visualization"
 * button that calls onOpenViz(meta) where meta contains messageId/questionId/visualization.
 *
 * Props:
 *  - messages: array
 *  - convId: string
 *  - onOpenViz(meta) -> function
 */
export default function ChatList({ messages = [], convId, onOpenViz }) {
  
  function findQuestionTextForIndex(idx) {
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].text;
    }
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {messages.map((m, idx) => {
        const isUser = m.role === "user";
        const questionText = findQuestionTextForIndex(idx);

        return (
          <div key={m.id} style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                minWidth: 34,
                height: 34,
                borderRadius: 8,
                background: isUser ? "#151a1d" : "#1b2629",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 600,
              }}
            >
              {isUser ? "U" : "AI"}
            </div>

            <div style={{ flex: 1 }}>
              <div className="bubble">
                {isUser ? (
                  <div>{m.text}</div>
                ) : (
                  <ReactMarkdown className="message-markdown">
                    {m.text || ""}
                  </ReactMarkdown>
                )}

                {!isUser && m.viz && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 140,
                        height: 80,
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.01)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--muted)",
                      }}
                    >
                      Preview
                    </div>
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 8 }}
                    >
                      <button
                        className="button"
                        onClick={() =>
                          onOpenViz &&
                          onOpenViz({
                            messageId: m.id,
                            questionId: m.questionId || null,
                            questionText,
                            answerText: m.text,
                            visualization: m.viz,
                          })
                        }
                      >
                        Open visualization
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
