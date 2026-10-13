// p5 renderer: draws a PosterLayout. It makes no design decisions of its own —
// every position, size and colour comes from the layout model.
import type p5 from 'p5';
import type { Grid } from '../engine/grid';
import { hashSeed, Rng } from '../engine/random';
import type {
  FrameElement,
  GridFieldElement,
  HatchElement,
  ImageElement,
  PosterLayout,
  Rect,
  ShapeElement,
  TextElement,
} from '../engine/types';

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
      case 'frame':
        drawFrame(p, el);
        break;
      case 'hatch':
        drawHatch(p, el);
        break;
      case 'gridfield':
        drawGridField(p, el);
        break;
      case 'text':
        drawText(p, el);
        break;
    }
  }
  p.pop();
  applySurface(p, layout);
  if (opts.showGrid && opts.grid) drawGridOverlay(p, layout, opts.grid);
}

const withAlpha = (p: p5, hex: string, a: number) => {
  const c = p.color(hex);
  c.setAlpha(Math.round(a * 255));
  return c;
};

// ─── Text ─────────────────────────────────────────────────────────────────────

function setType(g: p5 | p5.Graphics, el: TextElement) {
  g.textFont(el.family);
  g.textWeight(el.weight);
  g.textSize(el.size);
  g.textProperty('letterSpacing', `${Math.round(el.tracking * 100) / 100}px`);
}

/** Draw the text lines onto any p5 surface, offset by (ox, oy). */
function setLines(g: p5 | p5.Graphics, el: TextElement, ox = 0, oy = 0) {
  setType(g, el);
  g.textAlign(el.align === 'right' ? g.RIGHT : g.LEFT, g.BASELINE);
  // Canvas letter-spacing also trails the last glyph; shift right-aligned text so its ink meets the edge.
  const x = el.align === 'right' ? el.rect.x + el.rect.w + el.tracking : el.rect.x;
  el.lines.forEach((line, i) => g.text(line, x - ox, el.firstBaseline + i * el.lineHeight - oy));
}

function drawText(p: p5, el: TextElement) {
  p.push();
  if (el.box) {
    const b = el.box.rect;
    if (el.box.fill) {
      p.noStroke();
      p.fill(el.box.fill);
    } else {
      p.noFill();
      p.stroke(el.box.stroke ?? el.color);
      p.strokeWeight(1);
    }
    p.rect(b.x, b.y, b.w, b.h);
  }
  p.noStroke();
  p.fill(el.color);

  switch (el.effect) {
    case 'dotmatrix':
      drawDotMatrix(p, el);
      break;
    case 'scanline':
      drawScanlineText(p, el);
      break;
    case 'glow': {
      const ctx = p.drawingContext as CanvasRenderingContext2D;
      ctx.shadowColor = el.color;
      ctx.shadowBlur = el.size * 0.35;
      setLines(p, el);
      ctx.shadowBlur = el.size * 0.12;
      setLines(p, el);
      ctx.shadowBlur = 0;
      break;
    }
    default:
      setLines(p, el);
  }
  p.pop();
}

/** Render the text to an offscreen buffer the size of its ink bounds (plus a margin). */
function offscreen(p: p5, el: TextElement, density: number) {
  const m = Math.ceil(el.size * 0.2);
  const b = el.bounds;
  const g = p.createGraphics(Math.ceil(b.w + m * 2), Math.ceil(b.h + m * 2));
  g.pixelDensity(density);
  g.clear();
  g.noStroke();
  return { g, ox: b.x - m, oy: b.y - m };
}

/** Lettering made of lit cells, sampled from the real glyphs. */
function drawDotMatrix(p: p5, el: TextElement) {
  const { g, ox, oy } = offscreen(p, el, 1);
  g.fill(255);
  setLines(g, el, ox, oy);
  g.loadPixels();
  const cell = Math.max(3, el.size / 14);
  const w = g.width;
  p.noStroke();
  p.fill(el.color);
  p.rectMode(p.CENTER);
  for (let y = cell / 2; y < g.height; y += cell)
    for (let x = cell / 2; x < w; x += cell) {
      const i = (Math.floor(y) * w + Math.floor(x)) * 4 + 3;
      if (g.pixels[i] > 110) p.rect(ox + x, oy + y, cell * 0.78, cell * 0.78, cell * 0.25);
    }
  p.rectMode(p.CORNER);
  g.remove();
}

/** Solid lettering cut by horizontal scan gaps, CRT-style. */
function drawScanlineText(p: p5, el: TextElement) {
  const { g, ox, oy } = offscreen(p, el, 2);
  g.fill(el.color);
  setLines(g, el, ox, oy);
  const pitch = Math.max(3, el.size / 18);
  g.erase();
  g.noStroke();
  for (let y = 0; y < g.height; y += pitch) g.rect(0, y + pitch * 0.62, g.width, pitch * 0.38);
  g.noErase();
  p.image(g, ox, oy);
  g.remove();
}

// ─── Frames, hatch, grid texture ──────────────────────────────────────────────

function drawFrame(p: p5, el: FrameElement) {
  const { x, y, w, h } = el.rect;
  p.push();
  if (el.style === 'box') {
    p.noFill();
    p.stroke(el.color);
    p.strokeWeight(1);
    p.rect(x, y, w, h);
  } else if (el.style === 'corners') {
    const s = 5;
    p.noStroke();
    p.fill(el.color);
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) p.rect(cx - s / 2, cy - s / 2, s, s);
    p.stroke(withAlpha(p, el.color, 0.35));
    p.strokeWeight(1);
    (p.drawingContext as CanvasRenderingContext2D).setLineDash([2, 4]);
    p.noFill();
    p.rect(x, y, w, h);
    (p.drawingContext as CanvasRenderingContext2D).setLineDash([]);
  } else {
    const L = Math.min(18, w / 5, h / 5);
    p.noFill();
    p.stroke(el.color);
    p.strokeWeight(1.5);
    p.strokeCap(p.SQUARE);
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      p.line(cx, cy, cx + L * dx, cy);
      p.line(cx, cy, cx, cy + L * dy);
    }
  }
  p.pop();
}

function drawHatch(p: p5, el: HatchElement) {
  const { x, y, w, h } = el.rect;
  p.push();
  p.clip(() => p.rect(x, y, w, h));
  p.noStroke();
  p.fill(el.color);
  const s = el.stripe;
  for (let t = -h; t < w + h; t += s * 2) p.quad(x + t, y + h, x + t + s, y + h, x + t + s + h, y, x + t + h, y);
  p.pop();
}

function drawGridField(p: p5, el: GridFieldElement) {
  const { x, y, w, h } = el.rect;
  p.push();
  p.strokeWeight(1);
  for (let i = 0, gx = x; gx <= x + w + 0.5; gx += el.cell, i++) {
    p.stroke(withAlpha(p, el.color, i % 5 === 0 ? el.alpha * 1.8 : el.alpha));
    p.line(gx, y, gx, y + h);
  }
  for (let i = 0, gy = y; gy <= y + h + 0.5; gy += el.cell, i++) {
    p.stroke(withAlpha(p, el.color, i % 5 === 0 ? el.alpha * 1.8 : el.alpha));
    p.line(x, gy, x + w, gy);
  }
  p.pop();
}

// ─── Shapes: inscribed in a square snapped to the element's grid area ─────────

function square(r: Rect): Rect {
  const s = Math.min(r.w, r.h);
  return { x: r.x, y: r.y + (r.h - s), w: s, h: s }; // sit on the area's bottom edge
}

function drawShape(p: p5, el: ShapeElement) {
  if (el.shape === 'barcode') return drawBarcode(p, el);
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
    case 'reticle': {
      p.noFill();
      p.stroke(el.color);
      const sw = Math.max(1, s / 45);
      p.strokeWeight(sw);
      p.circle(s / 2, s / 2, s * 0.84);
      p.circle(s / 2, s / 2, s * 0.4);
      p.line(s / 2, 0, s / 2, s * 0.36);
      p.line(s / 2, s * 0.64, s / 2, s);
      p.line(0, s / 2, s * 0.36, s / 2);
      p.line(s * 0.64, s / 2, s, s / 2);
      p.noStroke();
      p.fill(el.color);
      p.circle(s / 2, s / 2, Math.max(3, s / 18));
      break;
    }
    case 'chevrons': {
      const n = 3;
      const cw = s / n;
      for (let i = 0; i < n; i++) {
        const x0 = i * cw;
        p.quad(x0, s * 0.2, x0 + cw * 0.45, s * 0.2, x0 + cw * 0.95, s / 2, x0 + cw * 0.5, s / 2);
        p.quad(x0 + cw * 0.5, s / 2, x0 + cw * 0.95, s / 2, x0 + cw * 0.45, s * 0.8, x0, s * 0.8);
      }
      break;
    }
    case 'stripeddisc': {
      p.clip(() => p.circle(s / 2, s / 2, s));
      const pitch = s / 11;
      for (let y = 0; y < s; y += pitch) p.rect(0, y, s, pitch * 0.72);
      break;
    }
  }
  p.pop();
}

function drawBarcode(p: p5, el: ShapeElement) {
  const { x, y, w, h } = el.rect;
  const rng = new Rng(hashSeed(el.id + w));
  p.push();
  p.noStroke();
  p.fill(el.color);
  const barH = Math.min(h, 34);
  let cx = x;
  while (cx < x + w) {
    const bw = rng.pick([1, 1, 2, 3]);
    if (cx + bw > x + w) break;
    p.rect(cx, y + h - barH, bw, barH);
    cx += bw + rng.pick([1, 2, 2, 3]);
  }
  p.pop();
}

// ─── Images: procedural "photograph" or telemetry scope ───────────────────────

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

  if (el.style === 'scope') {
    drawScope(p, el);
    p.pop();
    return;
  }

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

/** Radar / tracking scope: raster grid, range rings, crosshair, sweep and contacts. */
function drawScope(p: p5, el: ImageElement) {
  const { x, y, w, h } = el.rect;
  const rng = new Rng(el.seed);
  const fg = el.foreground;
  const ctx = p.drawingContext as CanvasRenderingContext2D;

  // raster
  const cell = Math.max(10, Math.round(Math.min(w, h) / 14));
  p.strokeWeight(1);
  p.stroke(withAlpha(p, fg, 0.13));
  for (let gx = x; gx <= x + w; gx += cell) p.line(gx, y, gx, y + h);
  for (let gy = y; gy <= y + h; gy += cell) p.line(x, gy, x + w, gy);

  const cx = x + w * (0.35 + rng.next() * 0.3);
  const cy = y + h * (0.4 + rng.next() * 0.2);
  const R = Math.max(w, h) * 0.75;

  // sweep wedge
  const a0 = rng.next() * Math.PI * 2;
  p.noStroke();
  for (let i = 0; i < 24; i++) {
    p.fill(withAlpha(p, fg, 0.012 + (i / 24) * 0.05));
    p.arc(cx, cy, R * 2, R * 2, a0 + (i / 24) * 0.9, a0 + 0.9, p.PIE);
  }

  // rings + crosshair, glowing
  ctx.shadowColor = fg;
  ctx.shadowBlur = 8;
  p.noFill();
  p.stroke(withAlpha(p, fg, 0.7));
  p.strokeWeight(1.2);
  for (let r = R / 5; r <= R; r += R / 5) p.circle(cx, cy, r * 2);
  p.stroke(withAlpha(p, fg, 0.9));
  p.line(cx, y, cx, y + h);
  p.line(x, cy, x + w, cy);
  // ticks on the crosshair
  for (let t = -R; t <= R; t += R / 20) {
    p.line(cx + t, cy - 3, cx + t, cy + 3);
    p.line(cx - 3, cy + t, cx + 3, cy + t);
  }
  // sweep edge
  p.strokeWeight(2);
  p.line(cx, cy, cx + Math.cos(a0 + 0.9) * R, cy + Math.sin(a0 + 0.9) * R);

  // contacts
  p.noStroke();
  p.fill(fg);
  const n = 4 + rng.int(0, 4);
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = (0.15 + rng.next() * 0.7) * Math.min(w, h) * 0.5;
    const bx = cx + Math.cos(a) * r;
    const by = cy + Math.sin(a) * r;
    p.rect(bx - 3, by - 3, 6, 6);
    if (i % 2 === 0) {
      p.noFill();
      p.stroke(fg);
      p.strokeWeight(1);
      p.rect(bx - 9, by - 9, 18, 18);
      p.noStroke();
      p.fill(fg);
    }
  }
  ctx.shadowBlur = 0;
}

// ─── Surface: scanlines + film grain over the whole poster ────────────────────

function applySurface(p: p5, layout: PosterLayout) {
  const { grain, scanlines } = layout.surface;
  if (scanlines > 0) {
    p.push();
    p.noStroke();
    p.fill(0, Math.round(scanlines * 255));
    for (let y = 0; y < layout.height; y += 3) p.rect(0, y, layout.width, 1);
    p.pop();
  }
  if (grain > 0) {
    p.loadPixels();
    const px = p.pixels;
    let s = hashSeed(layout.seed) || 1;
    const amp = grain * 255;
    for (let i = 0; i < px.length; i += 4) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0; // LCG — deterministic per seed
      const n = ((s >>> 8) / 16777216 - 0.5) * amp;
      px[i] += n;
      px[i + 1] += n;
      px[i + 2] += n;
    }
    p.updatePixels();
  }
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
