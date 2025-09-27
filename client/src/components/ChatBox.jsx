import React from "react";

export default function ChatBox({ title = "Chat → Visualization", subtitle = "" }) {
  return (
    <header className="app-hero">
      <div className="app-hero-inner">
        <h1 className="hero-title">{title}</h1>
        {subtitle ? <p className="hero-sub">{subtitle}</p> : null}
      </div>
    </header>
  );
}
