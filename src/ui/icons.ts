import { ITEMS, type ItemKey } from '../sim/constants';

const hex = (c: number) => '#' + (c >>> 0).toString(16).padStart(6, '0');

export function drawIcon(ctx: CanvasRenderingContext2D, type: ItemKey, x: number, y: number, r: number) {
  ctx.save(); ctx.translate(x, y); const it = ITEMS[type];
  if (type === 'tomato') {
    ctx.fillStyle = '#d23a2a'; ctx.beginPath(); ctx.ellipse(0, r * 0.12, r * 0.95, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.05, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3d8a35'; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.24, -r * 0.6 + Math.sin(a) * r * 0.12, r * 0.24, r * 0.08, a, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === 'corn') {
    ctx.fillStyle = '#5a9a44'; ctx.beginPath(); ctx.moveTo(0, r * 0.95); ctx.quadraticCurveTo(-r * 0.85, r * 0.2, -r * 0.35, -r * 0.55); ctx.quadraticCurveTo(-r * 0.3, r * 0.3, 0, r * 0.95); ctx.fill();
    ctx.fillStyle = '#efc540'; ctx.beginPath(); ctx.ellipse(r * 0.05, -r * 0.05, r * 0.4, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d6a52a'; for (let yy = -0.7; yy <= 0.75; yy += 0.22) for (let xx = -0.22; xx <= 0.32; xx += 0.18) { ctx.beginPath(); ctx.arc(r * xx, r * yy, r * 0.055, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#6ab152'; ctx.beginPath(); ctx.moveTo(0, r * 0.95); ctx.quadraticCurveTo(r * 0.9, r * 0.3, r * 0.45, -r * 0.45); ctx.quadraticCurveTo(r * 0.35, r * 0.35, 0, r * 0.95); ctx.fill();
  } else if (type === 'apple') {
    ctx.fillStyle = '#c22a2f'; ctx.beginPath(); ctx.arc(-r * 0.32, r * 0.08, r * 0.62, 0, Math.PI * 2); ctx.arc(r * 0.32, r * 0.08, r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 0.7, r * 0.48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-r * 0.45, -r * 0.05, r * 0.16, r * 0.24, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b4423'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -r * 0.4); ctx.quadraticCurveTo(r * 0.05, -r * 0.75, r * 0.15, -r * 0.9); ctx.stroke();
    ctx.fillStyle = '#4f9a3e'; ctx.beginPath(); ctx.ellipse(r * 0.38, -r * 0.72, r * 0.3, r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'rice') {
    ctx.fillStyle = '#d9c393'; ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.5); ctx.quadraticCurveTo(-r * 0.95, r * 0.2, -r * 0.7, r * 0.85); ctx.lineTo(r * 0.7, r * 0.85); ctx.quadraticCurveTo(r * 0.95, r * 0.2, r * 0.55, -r * 0.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.55); ctx.lineTo(-r * 0.5, -r * 0.95); ctx.lineTo(0, -r * 0.75); ctx.lineTo(r * 0.5, -r * 0.95); ctx.lineTo(r * 0.3, -r * 0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a5a2c'; ctx.fillRect(-r * 0.5, -r * 0.62, r, r * 0.16);
  } else if (type === 'eggs' || type === 'duckEggs') {
    // open carton with eggs
    ctx.fillStyle = '#b89a6c'; ctx.beginPath(); ctx.moveTo(-r * 0.95, r * 0.05); ctx.lineTo(r * 0.95, r * 0.05); ctx.lineTo(r * 0.82, r * 0.7); ctx.lineTo(-r * 0.82, r * 0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = type === 'eggs' ? '#f3e7d3' : '#cfe6de';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-r * 0.55 + i * r * 0.55, -r * 0.08, r * 0.24, r * 0.32, 0, 0, Math.PI * 2); ctx.fill(); }
    if (type === 'eggs') { ctx.fillStyle = '#d9a774'; ctx.beginPath(); ctx.ellipse(0, -r * 0.08, r * 0.24, r * 0.32, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.45)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-r * 0.62 + i * r * 0.55, -r * 0.2, r * 0.07, r * 0.11, -0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#9c7f55'; ctx.fillRect(-r * 0.95, r * 0.05, r * 1.9, r * 0.12);
  } else {
    ctx.rotate(-0.25); ctx.fillStyle = hex(it.color!);
    ctx.beginPath(); ctx.moveTo(r * 0.55, 0); ctx.lineTo(r * 0.98, -r * 0.45); ctx.lineTo(r * 0.98, r * 0.45); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.72, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.15, r * 0.12, r * 0.5, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    if (type === 'koi') { ctx.fillStyle = '#e2683c'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.1, r * 0.16, 0, Math.PI * 2); ctx.arc(r * 0.1, r * 0.08, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#1b1a18'; ctx.beginPath(); ctx.arc(-r * 0.52, -r * 0.08, r * 0.07, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const cache: Partial<Record<ItemKey, string>> = {};
export function iconUrl(t: ItemKey) {
  if (!cache[t]) { const c = document.createElement('canvas'); c.width = c.height = 64; drawIcon(c.getContext('2d')!, t, 32, 33, 26); cache[t] = c.toDataURL(); }
  return cache[t]!;
}
