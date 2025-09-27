import React, { useState } from "react";
import VisualizationCanvas from "./VisualizationCanvas";

/**
 * VisualizationsBoard shows the panels passed in props.panels.
 * Panels are ordered to match assistant messages order (App provides them).
 *
 * Props:
 *  - panels: array of panel objects (uid, key, messageId, questionText, answerText, visualization, createdAt)
 *  - onClose(uid) -> function to request closing a panel (App will handle updating conversation)
 */

function VizCard({ panel, onClose }) {
  const [playing, setPlaying] = useState(true);

  return (
    <div className="viz-card">
      <div className="viz-card-header">
        <div>
          <div className="viz-title">Visualization</div>
          <div className="viz-timestamp">{new Date(panel.createdAt).toLocaleTimeString()}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="button small-btn" onClick={() => setPlaying((p) => !p)}>
            {playing ? "⏸" : "▶"}
          </button>
          <button className="button small-btn" onClick={() => onClose(panel.uid)}>✕</button>
        </div>
      </div>

      <div className="viz-card-canvas viz-panel" style={{ width: "100%" }}>
        {panel.visualization ? (
          <VisualizationCanvas viz={panel.visualization} playing={playing} />
        ) : (
          <div style={{ color: "var(--muted)" }}>No visualization</div>
        )}
      </div>

      <div className="viz-card-body">
        {panel.questionText && <div className="viz-q"><strong>Q:</strong> {panel.questionText}</div>}
        {panel.answerText && <div className="viz-a">{panel.answerText}</div>}
      </div>
    </div>
  );
}

export default function VisualizationsBoard({ panels = [], onClose = () => {} }) {
  return (
    <div className="viz-board-wrap">
      {(!panels || panels.length === 0) && <div className="viz-empty">No visualizations yet. Ask a question to generate one.</div>}

      <div className="viz-row">
        {panels.map((p) => (
          <VizCard key={p.uid} panel={p} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}
