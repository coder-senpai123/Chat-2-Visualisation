import React, { useState } from 'react'
import VisualizationCanvas from './VisualizationCanvas'

export default function VisualizationPanel({ viz, answerMeta, onClose }) {
  const [playing, setPlaying] = useState(true)

  return (
    <div style={{
      background: '#071226',
      borderRadius: 12,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Visualization</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {answerMeta?.fallback && <span style={{ padding: '4px 8px', background: '#22343a', borderRadius: 8, fontSize: 12 }}>Fallback</span>}
          <button className="button" onClick={onClose}>✕</button>
        </div>
      </div>

      <div style={{
        background: '#061019',
        borderRadius: 10,
        padding: 8,
        flex: '0 0 auto',
        height: 360,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.01)'
      }}>
        <div className="viz-panel" style={{ width: '100%', height: '100%' }}>
          <VisualizationCanvas viz={viz} playing={playing} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button" onClick={() => setPlaying(p => !p)}>{playing ? '⏸ Pause' : '▶ Play'}</button>
          <button className="button" onClick={() => {
            const panel = document.querySelector('.viz-panel');
            const canvas = panel ? panel.querySelector('canvas') : document.querySelector('canvas');
            if (!canvas) return;
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(viz?.id || 'viz')}.png`;
            a.click();
          }}>Download PNG</button>
        </div>

        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          {viz?.duration ? `${Math.round((viz.duration ?? 4000) / 1000)}s` : ''}
        </div>
      </div>
    </div>
  )
}
