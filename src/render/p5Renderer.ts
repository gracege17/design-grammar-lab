// p5 renderer: draws a PosterLayout. It makes no design decisions of its own —
// every position, size and colour comes from the layout model.
import type p5 from 'p5';
import type { Grid } from '../engine/grid';
import { Rng } from '../engine/random';
import type { ImageElement, PosterLayout, Rect, ShapeElement, TextElement } from '../engine/types';

export interface RenderOptions {
  showGrid?: boolean;
  grid?: Grid;
}

export function drawPoster(p: p5, layout: PosterLayout, opts: RenderOptions = {}) {
  p.push();
  p.background(layout.colors.background);
  for (const el of layout.elements) {
    switch (el.kind) {
      case 'panel':
        p.noStroke();
        p.fill(el.color);
        p.rect(el.rect.x, el.rect.y, el.rect.w, el.rect.h);
        break;
      case 'image':
        drawImage(p, el);
        break;
      case 'shape':
        drawShape(p, el);
        break;
      case 'rule':
        p.stroke(el.color);
        p.strokeWeight(el.weight);
        p.strokeCap(p.SQUARE);
        p.line(el.rect.x, el.rect.y, el.rect.x + el.rect.w, el.rect.y + el.rect.h);
        break;
      case 'text':
        drawText(p, el);
        break;
    }
  }
  if (opts.showGrid && opts.grid) drawGridOverlay(p, layout, opts.grid);
  p.pop();
}

function drawText(p: p5, el: TextElement) {
  p.noStroke();
  p.fill(el.color);
  p.textFont(el.family);
  p.textWeight(el.weight);
  p.textSize(el.size);
  p.textAlign(p.LEFT, p.BASELINE);
  el.lines.forEach((line, i) => p.text(line, el.rect.x, el.firstBaseline + i * el.lineHeight));
}

// ─── Shapes: always inscribed in a square snapped to the element's grid area ──

function square(r: Rect): Rect {
  const s = Math.min(r.w, r.h);
  return { x: r.x, y: r.y + (r.h - s), w: s, h: s }; // sit on the area's bottom edge
}

function drawShape(p: p5, el: ShapeElement) {
  const sq = square(el.rect);
  const s = sq.w;
  p.push();
  p.translate(sq.x + s / 2, sq.y + s / 2);
  p.rotate((el.orientation * Math.PI) / 2);
  p.translate(-s / 2, -s / 2);
  p.noStroke();
  p.fill(el.color);
  switch (el.shape) {
    case 'circle':
      p.circle(s / 2, s / 2, s);
      break;
    case 'half': // an arch: half disc on a half square
      p.arc(s / 2, s / 2, s, s, Math.PI, Math.PI * 2, p.PIE);
      p.rect(0, s / 2, s, s / 2);
      break;
    case 'quarter':
      p.arc(0, s, s * 2, s * 2, -Math.PI / 2, 0, p.PIE);
      break;
    case 'bars': {
      const n = 5;
      const t = s / (n * 2 - 1);
      for (let i = 0; i < n; i++) p.rect(0, i * 2 * t, s, t);
      break;
    }
    case 'dots': {
      const n = 4;
      const step = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) p.circle(step / 2 + i * step, step / 2 + j * step, step * 0.62);
      break;
    }
    case 'arcs': {
      p.noFill();
      p.stroke(el.color);
      const rings = 5;
      const w = s / (rings * 2);
      p.strokeWeight(w);
      p.strokeCap(p.SQUARE);
      for (let i = 0; i < rings; i++) {
        const r = s - w / 2 - i * 2 * w;
        p.arc(0, s, r * 2, r * 2, -Math.PI / 2, 0);
      }
      break;
    }
  }
  p.pop();
}

// ─── Procedural "photograph": a seeded tonal field printed as halftone / line screen ──

function makeField(p: p5, el: ImageElement) {
  const rng = new Rng(el.seed);
  p.noiseSeed(el.seed);
  p.noiseDetail(4, 0.5);
  const blobs = Array.from({ length: 3 }, () => ({ x: rng.next(), y: rng.next(), r: 0.18 + rng.next() * 0.3, w: 0.5 + rng.next() * 0.6 }));
  const angle = rng.next() * Math.PI * 2;
  const gx = Math.cos(angle);
  const gy = Math.sin(angle);
  const scale = 2 + rng.next() * 2;
  return (u: number, v: number) => {
    let f = 0.25 + 0.25 * (gx * (u - 0.5) + gy * (v - 0.5)); // soft light gradient
    f += (p.noise(u * scale, v * scale) - 0.5) * 0.7;
    for (const b of blobs) {
      const d = Math.hypot(u - b.x, (v - b.y) * 0.8) / b.r;
      f += b.w * Math.exp(-d * d * 1.6);
    }
    return Math.min(1, Math.max(0, f));
  };
}

function drawImage(p: p5, el: ImageElement) {
  const { x, y, w, h } = el.rect;
  // Use p5's own push/clip/pop: raw ctx.save()/restore() desyncs p5's cached fill state.
  p.push();
  p.clip(() => {
    if (el.mask === 'circle') {
      const d = Math.min(w, h);
      p.circle(x + w - d / 2, y + h - d / 2, d);
    } else p.rect(x, y, w, h);
  });

  p.noStroke();
  p.fill(el.background);
  p.rect(x, y, w, h);
  p.fill(el.foreground);

  // Field is sampled in a square space so the "subject" isn't stretched by the frame's ratio.
  const field = makeField(p, el);
  const span = Math.max(w, h);
  const c = el.cell;
  if (el.style === 'halftone') {
    for (let row = 0, py = y; py < y + h + c; row++, py += c * 0.866) {
      const off = row % 2 ? c / 2 : 0;
      for (let px = x - off; px < x + w + c; px += c) {
        const f = field((px - x) / span, (py - y) / span);
        const d = c * 1.18 * Math.sqrt(f);
        if (d > 0.4) p.circle(px, py, d);
      }
    }
  } else {
    for (let py = y + c / 2; py < y + h + c; py += c) {
      p.beginShape();
      const pts: [number, number][] = [];
      for (let px = x; px <= x + w + 3; px += 3) {
        const t = c * 0.92 * field((px - x) / span, (py - y) / span);
        pts.push([px, t]);
      }
      for (const [px, t] of pts) p.vertex(px, py - t / 2);
      for (let i = pts.length - 1; i >= 0; i--) p.vertex(pts[i][0], py + pts[i][1] / 2);
      p.endShape(p.CLOSE);
    }
  }
  p.pop();
}

// ─── Debug overlay ──

function drawGridOverlay(p: p5, layout: PosterLayout, grid: Grid) {
  p.push();
  p.noStroke();
  p.fill(255, 0, 140, 28);
  for (let c = 0; c < grid.columns; c++)
    for (let r = 0; r < grid.rows; r++) {
      const m = grid.rect({ col: c, row: r, colSpan: 1, rowSpan: 1 });
      p.rect(m.x, m.y, m.w, m.h);
    }
  p.noFill();
  p.strokeWeight(1);
  for (const el of layout.elements) {
    if (el.kind !== 'text') continue;
    const bad = el.truncated || layout.diagnostics.textOutOfBounds.includes(el.id);
    p.stroke(bad ? '#ff0000' : '#00a0ff');
    p.rect(el.bounds.x, el.bounds.y, el.bounds.w, el.bounds.h);
  }
  p.pop();
}
