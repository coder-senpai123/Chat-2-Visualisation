import React, { useState } from "react";

export default function Composer({ onSubmitted, sending }) {
  const [text, setText] = useState("");

  function submit(e) {
    e && e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSubmitted && onSubmitted(t);
    setText("");
  }

  return (
    <form className="composer-hero" onSubmit={submit}>
      <div className="composer-inner">
        <button type="button" className="composer-left">+</button>
        {}
        <input
          aria-label="Ask anything"
          className="composer-input"
          placeholder=""
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="mic-btn" title="Voice input">🎤</button>
          <button type="submit" className="composer-send" disabled={sending}>{sending ? "Sending..." : "Send"}</button>
        </div>
      </div>
    </form>
  );
}
