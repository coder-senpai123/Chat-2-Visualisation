import React, { useEffect, useRef } from "react";

function drawStaticPreview(canvas, viz) {
  if (!canvas || !viz) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#071420";
  ctx.fillRect(0, 0, w, h);

  const layers = viz.layers || [];
  const refW = viz.width || 800;
  const refH = viz.height || 500;
  const dpr = window.devicePixelRatio || 1;
  const sx = (w / dpr) / refW;
  const sy = (h / dpr) / refH;
  const s = Math.min(sx, sy);

  ctx.save();
  ctx.scale(s, s);
  ctx.translate((w / dpr - refW) / 2, (h / dpr - refH) / 2);

  layers.forEach((layer) => {
    const p = layer.props || {};
    switch (layer.type) {
      case "circle":
        ctx.beginPath();
        ctx.fillStyle = p.fill || "#fff";
        ctx.arc(p.x || 0, p.y || 0, p.r || 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "rect":
        ctx.fillStyle = p.fill || "#fff";
        ctx.fillRect(p.x || 0, p.y || 0, p.w || p.width || 40, p.h || p.height || 24);
        break;
      case "line":
      case "arrow":
        ctx.strokeStyle = p.color || p.stroke || "#fff";
        ctx.lineWidth = p.lineWidth || 2;
        ctx.beginPath();
        ctx.moveTo(p.x1 ?? p.x ?? 0, p.y1 ?? p.y ?? 0);
        ctx.lineTo(p.x2 ?? (p.x ?? 0) + (p.dx || 40), p.y2 ?? (p.y ?? 0) + (p.dy || 0));
        ctx.stroke();
        break;
      case "text":
        ctx.font = `${p.size || 12}px sans-serif`;
        ctx.fillStyle = p.color || "#fff";
        ctx.fillText(p.text || "", p.x || 0, p.y || 0);
        break;
      default:
        break;
    }
  });

  ctx.restore();
}

export default function VizThumbnail({ viz, width = 220, height = 120, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStaticPreview(canvas, viz);
  }, [viz, width, height]);

  return (
    <div onClick={onClick} style={{ width, height, borderRadius: 8, overflow: "hidden", cursor: "pointer", border: "1px solid rgba(255,255,255,0.04)" }}>
      <canvas ref={ref} />
    </div>
  );
}
