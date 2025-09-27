
import React, { useEffect, useRef, useState } from "react";

function applyAnimations(base = {}, anims = [], t = 0) {
  const out = { ...base };
  for (const a of anims || []) {
    try {
      if (a.property === "orbit") {
        const progress = Math.max(0, Math.min(1, (t % (a.duration || 1000)) / (a.duration || 1000)));
        const theta = progress * Math.PI * 2;
        out.x = (a.centerX ?? out.x ?? 0) + Math.cos(theta) * (a.radius ?? 0);
        out.y = (a.centerY ?? out.y ?? 0) + Math.sin(theta) * (a.radius ?? 0);
        continue;
      }
      const start = a.start ?? 0;
      const end = a.end ?? (a.duration ?? 0);
      const dur = Math.max(1, end - start);
      const localT = Math.max(0, Math.min(1, (t - start) / dur));
      if (typeof a.from === "number" && typeof a.to === "number") {
        out[a.property] = a.from + (a.to - a.from) * localT;
      } else if (typeof a.value !== "undefined") {
        if (t >= start) out[a.property] = a.value;
      }
    } catch (err) {
      console.warn("animation error", a, err);
    }
  }
  return out;
}

function drawLayerSafe(ctx, layer, t, scale) {
  try {
    const base = layer.props || {};
    const props = applyAnimations(base, layer.animations || [], t);

    ctx.save();
    if (scale && scale !== 1) ctx.scale(scale, scale);

    switch (layer.type) {
      case "circle": {
        const x = props.x ?? 0; const y = props.y ?? 0; const r = Math.max(0, props.r ?? 10);
        if (props.fill) {
          ctx.fillStyle = props.fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        if (props.stroke) {
          ctx.strokeStyle = props.stroke; ctx.lineWidth = props.lineWidth ?? 1; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        }
        break;
      }
      case "rect": {
        const x = props.x ?? 0; const y = props.y ?? 0; const w = props.w ?? props.width ?? 40; const h = props.h ?? props.height ?? 24;
        if (props.fill) { ctx.fillStyle = props.fill; ctx.fillRect(x, y, w, h); }
        if (props.stroke) { ctx.strokeStyle = props.stroke; ctx.lineWidth = props.lineWidth ?? 1; ctx.strokeRect(x, y, w, h); }
        break;
      }
      case "line": {
        ctx.strokeStyle = props.color ?? props.stroke ?? "#fff"; ctx.lineWidth = props.lineWidth ?? 2;
        ctx.beginPath();
        ctx.moveTo(props.x1 ?? props.x ?? 0, props.y1 ?? props.y ?? 0);
        ctx.lineTo(props.x2 ?? (props.x ?? 0) + (props.dx ?? 100), props.y2 ?? props.y ?? 0);
        ctx.stroke();
        break;
      }
      case "arrow": {
        const x = props.x ?? 0; const y = props.y ?? 0; const dx = props.dx ?? 40; const dy = props.dy ?? 0;
        const ex = x + dx; const ey = y + dy; ctx.strokeStyle = props.color ?? "#fff"; ctx.lineWidth = props.lineWidth ?? 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        const angle = Math.atan2(dy, dx); const headLen = props.headLen ?? 8;
        ctx.beginPath(); ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle - 0.3), ey - headLen * Math.sin(angle - 0.3));
        ctx.lineTo(ex - headLen * Math.cos(angle + 0.3), ey - headLen * Math.sin(angle + 0.3)); ctx.closePath();
        if (props.fill) { ctx.fillStyle = props.fill; ctx.fill(); } else { ctx.fillStyle = ctx.strokeStyle; ctx.fill(); }
        break;
      }
      case "text": {
        const size = props.size ?? 14;
        ctx.font = `${size}px sans-serif`;
        ctx.fillStyle = props.color ?? "#fff";
        ctx.textBaseline = (props.align === "center" ? "middle" : props.baseline ?? "top");
        ctx.fillText(props.text ?? "", props.x ?? 0, props.y ?? 0);
        break;
      }
      default:
        break;
    }

    ctx.restore();
  } catch (err) {
    console.error("drawLayer failed", layer, err);
  }
}

export default function VisualizationCanvas({ viz, playing = true }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimestampRef = useRef(0);
  const elapsedRef = useRef(0);
  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 0, h: 0 });
  const resizeObsRef = useRef(null);

  const [error, setError] = useState(null);
  const [validViz, setValidViz] = useState(null);

  useEffect(() => {
    setError(null);
    if (!viz || typeof viz !== "object" || !Array.isArray(viz.layers)) {
      setValidViz(null);
      return;
    }
    const duration = Math.max(1000, Number(viz.duration || 5000));
    const fps = Math.min(60, Math.max(10, Number(viz.fps || 30)));
    const cleaned = { ...viz, duration, fps, layers: viz.layers.slice(0, 200) }; // cap layers
    setValidViz(cleaned);
  }, [viz]);

  const duration = validViz ? Math.max(1, validViz.duration) : 4000;
  const fps = validViz ? Math.max(1, validViz.fps) : 30;
  const frameMs = 1000 / Math.max(1, fps);
  const referenceWidth = validViz?.referenceWidth || 800;
  const referenceHeight = validViz?.referenceHeight || 500;

  function setCanvasSizeNow() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return false;
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (w === 0 || h === 0) return false;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    dprRef.current = dpr;
    if (sizeRef.current.w === w && sizeRef.current.h === h && canvas.width === Math.floor(w * dpr)) return true;
    sizeRef.current = { w, h };
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function renderFrame(now) {
    const ctxCanvas = canvasRef.current;
    if (!ctxCanvas || !validViz) {
      if (ctxCanvas) {
        const ctx = ctxCanvas.getContext("2d");
        ctx.clearRect(0, 0, ctxCanvas.width / (dprRef.current || 1), ctxCanvas.height / (dprRef.current || 1));
        ctx.fillStyle = "#071226";
        ctx.fillRect(0, 0, ctxCanvas.width / dprRef.current, ctxCanvas.height / dprRef.current);
      }
      return;
    }
    const ctx = ctxCanvas.getContext("2d");
    const { w, h } = sizeRef.current;
    if (!w || !h) return;

    ctx.clearRect(0, 0, ctxCanvas.width / dprRef.current, ctxCanvas.height / dprRef.current);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0f1b2b");
    g.addColorStop(1, "#090e14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const t = Math.max(0, Math.min(duration, elapsedRef.current));
    const pad = 30;
    const availW = Math.max(1, w - pad * 2);
    const availH = Math.max(1, h - pad * 2);
    const sx = availW / referenceWidth;
    const sy = availH / referenceHeight;
    const scale = Math.min(sx, sy);
    const offsetX = (w - (referenceWidth * scale)) / 2;
    const offsetY = (h - (referenceHeight * scale)) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    try {
      (validViz.layers || []).forEach((layer) => {
        drawLayerSafe(ctx, layer, t, scale);
      });
    } catch (err) {
      console.error("renderFrame fatal", err);
      setError(err?.message || "Render error");
    }

    ctx.restore();
  }

  useEffect(() => {
    let rafStarted = false;
    function tick(now) {
      if (!lastTimestampRef.current) lastTimestampRef.current = now;
      const delta = now - lastTimestampRef.current;
      if (delta >= frameMs) {
        elapsedRef.current += delta;
        lastTimestampRef.current = now;
        if (elapsedRef.current > duration) {
          elapsedRef.current = elapsedRef.current % duration;
        }
        renderFrame(now);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    const ok = setCanvasSizeNow();
    if (!ok) {
      let attempts = 0;
      const retry = setInterval(() => {
        attempts += 1;
        const r = setCanvasSizeNow();
        if (r || attempts > 6) {
          clearInterval(retry);
          if (!r) {
            setError("Unable to size canvas");
            renderFrame(performance.now());
          } else if (playing) {
            lastTimestampRef.current = 0;
            rafRef.current = requestAnimationFrame(tick);
            rafStarted = true;
          }
        }
      }, 120);
    } else {
      if (playing) {
        lastTimestampRef.current = 0;
        rafRef.current = requestAnimationFrame(tick);
        rafStarted = true;
      } else {
        renderFrame(performance.now());
      }
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, validViz, frameMs, duration]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return undefined;
    resizeObsRef.current = new ResizeObserver(() => {
      setCanvasSizeNow();
      renderFrame(performance.now());
    });
    resizeObsRef.current.observe(container);
    return () => {
      if (resizeObsRef.current && container) resizeObsRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    elapsedRef.current = 0;
    lastTimestampRef.current = 0;
    setError(null);
    setTimeout(() => {
      setCanvasSizeNow();
      renderFrame(performance.now());
    }, 40);
  }, [validViz]);

  return (
    <div ref={containerRef} className="canvasWrap" style={{ width: "100%", height: "100%", minHeight: 240, display: "block", boxSizing: "border-box" }}>
      <canvas ref={canvasRef} />
      {!validViz && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: "#93a6b8" }}>
          No visualization
        </div>
      )}
      {error && (
        <div style={{ position: "absolute", right: 8, top: 8, padding: 8, background: "rgba(0,0,0,0.45)", color: "#ffc9c9", fontSize: 12, borderRadius: 8 }}>
          Viz error
        </div>
      )}
    </div>
  );
}
