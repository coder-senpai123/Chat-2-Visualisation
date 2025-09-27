
import React, { useEffect, useState } from "react";
import VizThumbnail from "./VizThumbnail";

export default function MessageItem({ role = "user", text = "", viz = null, answerId = null, animate = false, onOpenViz }) {
  const isUser = role === "user";
  const [visible, setVisible] = useState(text);
  const [isAnimating, setIsAnimating] = useState(Boolean(animate));

  useEffect(() => {
    if (!animate) {
      setVisible(text);
      setIsAnimating(false);
      return;
    }

    let i = 0;
    setVisible("");
    setIsAnimating(true);

    const total = text.length;
    const perChar = Math.max(12, Math.floor(800 / Math.min(Math.max(total, 40), 600)));

    const timer = setInterval(() => {
      i++;
      setVisible(text.slice(0, i));
      if (i >= total) {
        clearInterval(timer);
        setIsAnimating(false);
      }
    }, perChar);

    return () => clearInterval(timer);
  }, [text, animate]);

  return (
    <div className={`message ${isUser ? "message-user" : "message-assistant"}`} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div className="avatar" style={{ minWidth: 34, height: 34, borderRadius: 8, background: isUser ? "#17212b" : "#0f2430", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isUser ? "U" : "AI"}
        </div>

        <div style={{ flex: 1 }}>
          <div className="bubble">
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
              {visible}
              {isAnimating && <span className="caret">|</span>}
            </div>

            {!isUser && viz && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <VizThumbnail viz={viz} width={220} height={120} onClick={() => onOpenViz?.({ visualization: viz, id: answerId, questionId: answerId })} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="button" onClick={() => onOpenViz?.({ visualization: viz, id: answerId, questionId: answerId })}>Open visualization</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
