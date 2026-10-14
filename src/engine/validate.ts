// Checks a finished layout against the grammar's rules. Results show in the UI's debug overlay.
import type { Grid } from './grid';
import type { Diagnostics, PosterElement, Rect, StrategyName, StyleGrammar, TextElement } from './types';

const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, b: Rect, tol = 0.5) => a.x >= b.x - tol && a.y >= b.y - tol && a.x + a.w <= b.x + b.w + tol && a.y + a.h <= b.y + b.h + tol;

export function validate(elements: PosterElement[], width: number, height: number, strategy: StrategyName, g: StyleGrammar, grid: Grid): Diagnostics {
  const texts = elements.filter((e): e is TextElement => e.kind === 'text');
  const warnings: string[] = [];

  const truncatedText = texts.filter((t) => t.truncated).map((t) => t.id);
  const textOutOfBounds = texts.filter((t) => !inside(t.bounds, t.rect)).map((t) => t.id);

  const overlappingText: [string, string][] = [];
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) if (intersects(texts[i].bounds, texts[j].bounds)) overlappingText.push([texts[i].id, texts[j].id]);

  // Negative space: fraction of the canvas not covered by type, shapes or images (sampled on a 4px raster).
  const covers: Rect[] = elements.flatMap((e) => (e.kind === 'text' ? [e.bounds] : e.kind === 'shape' || e.kind === 'image' ? [e.rect] : []));
  const step = 4;
  let empty = 0;
  let total = 0;
  for (let y = step / 2; y < height; y += step)
    for (let x = step / 2; x < width; x += step) {
      total++;
      if (!covers.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) empty++;
    }
  const negativeSpace = empty / total;

  const size = (role: string) => Math.max(0, ...texts.filter((t) => t.role === role).map((t) => t.size));
  const h = g.typography.hierarchy;
  const display = size('display');
  const deck = size('deck');
  const body = size('body');
  const hierarchyOk = (!deck || display / deck >= h.displayToDeck - 0.01) && (!deck || !body || deck / body >= h.deckToBody - 0.01);

  // Baseline grid: every line of every text block must sit on it.
  const offBaseline = texts.filter((t) => t.lines.some((_, i) => !grid.onBaseline(t.firstBaseline + i * t.lineHeight))).map((t) => t.id);
  if (offBaseline.length) warnings.push(`Off baseline: ${offBaseline.join(', ')}`);

  if (truncatedText.length) warnings.push(`Truncated: ${truncatedText.join(', ')}`);
  if (textOutOfBounds.length) warnings.push(`Out of bounds: ${textOutOfBounds.join(', ')}`);
  if (overlappingText.length) warnings.push(`Text overlap: ${overlappingText.map((p) => p.join('×')).join(', ')}`);
  if (!hierarchyOk) warnings.push(`Weak hierarchy (display ${display} / deck ${deck} / body ${body})`);
  if (strategy !== 'image' && negativeSpace < g.rules.minNegativeSpace) warnings.push(`Low negative space ${(negativeSpace * 100).toFixed(0)}%`);
  if (elements.length > g.rules.maxElementsPerPoster + 2) warnings.push(`Busy: ${elements.length} elements`);

  return { truncatedText, overlappingText, textOutOfBounds, negativeSpace, hierarchyOk, warnings };
}
