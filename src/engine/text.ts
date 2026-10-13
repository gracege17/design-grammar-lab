// Text fitting: choose the largest size from a role's scale that fits a box without overflow.
import type { MeasureFn, Rect, StyleGrammar, TextRoleName } from './types';

export interface RoleSpec {
  family: string;
  weight: number;
  lineHeight: number;
  sizes: number[];
  uppercase: boolean;
  capHeight: number;
  descent: number;
  /** letter-spacing in em */
  tracking: number;
}

export function resolveRole(g: StyleGrammar, role: TextRoleName): RoleSpec {
  const r = g.typography.roles[role];
  if (!r) throw new Error(`Grammar "${g.id}" has no type role "${role}"`);
  const family = g.typography.families[r.family] ?? r.family;
  return { ...r, family, tracking: r.tracking ?? 0 };
}

/** Visible width of a line at a size, including letter-spacing between glyphs. */
export function lineMeasurer(spec: RoleSpec, size: number, measureFn: MeasureFn) {
  const ls = spec.tracking * size;
  return (s: string) => measureFn(s, spec.family, spec.weight, size) + ls * Math.max(0, [...s].length - 1);
}

export interface FitOptions {
  maxLines?: number;
  vAlign?: 'top' | 'bottom';
  /** Only consider sizes ≤ this (used to enforce hierarchy against a larger sibling). */
  maxSize?: number;
  /** Only consider sizes ≥ this (used to force the headline to dominate). */
  minSize?: number;
}

export interface FittedText {
  lines: string[];
  size: number;
  lineHeight: number;
  firstBaseline: number;
  height: number;
  truncated: boolean;
}

/** Greedy word wrap. Explicit "\n" forces a break. Returns null if any word is wider than the box. */
export function wrap(text: string, maxWidth: number, measure: (s: string) => number): string[] | null {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const lines = wrapParagraph(para, maxWidth, measure);
    if (!lines) return null;
    out.push(...lines);
  }
  return out;
}

function wrapParagraph(text: string, maxWidth: number, measure: (s: string) => number): string[] | null {
  const words = text.split(/[ \t]+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (measure(word) > maxWidth) return null; // a single word can't fit — this size is invalid
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function blockHeight(n: number, size: number, spec: RoleSpec): number {
  return spec.capHeight * size + (n - 1) * size * spec.lineHeight + spec.descent * size;
}

export function fitText(rawText: string, box: Rect, spec: RoleSpec, measureFn: MeasureFn, opts: FitOptions = {}): FittedText {
  const text = spec.uppercase ? rawText.toUpperCase() : rawText;
  const maxLines = opts.maxLines ?? Infinity;
  const sizes = spec.sizes.filter((s) => (opts.maxSize === undefined || s <= opts.maxSize) && (opts.minSize === undefined || s >= opts.minSize));
  const candidates = sizes.length ? sizes : [spec.sizes[spec.sizes.length - 1]];

  for (const size of candidates) {
    const measure = lineMeasurer(spec, size, measureFn);
    const lines = wrap(text, box.w, measure);
    if (!lines || lines.length > maxLines) continue;
    const h = blockHeight(lines.length, size, spec);
    if (h <= box.h) return place(lines, size, spec, box, opts.vAlign ?? 'top', false);
  }

  // Fallback: smallest size, truncate with an ellipsis so nothing ever leaves the box.
  const size = candidates[candidates.length - 1];
  const measure = lineMeasurer(spec, size, measureFn);
  const lh = size * spec.lineHeight;
  const fitCount = Math.max(1, Math.min(maxLines, Math.floor((box.h - spec.capHeight * size - spec.descent * size) / lh) + 1));
  const lines = text.split('\n').flatMap((p) => hardWrap(p, box.w, measure)).slice(0, fitCount + 1);
  let truncated = false;
  if (lines.length > fitCount) {
    lines.length = fitCount;
    truncated = true;
  }
  if (truncated) {
    let last = lines[lines.length - 1];
    while (last.length > 0 && measure(`${last}…`) > box.w) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return place(lines, size, spec, box, opts.vAlign ?? 'top', truncated);
}

/** Wrap that breaks overlong words by character, used only in the fallback path. */
function hardWrap(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) out.push(line);
    line = '';
    let chunk = '';
    for (const ch of word) {
      if (measure(chunk + ch) > maxWidth && chunk) {
        out.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    line = chunk;
  }
  if (line) out.push(line);
  return out;
}

function place(lines: string[], size: number, spec: RoleSpec, box: Rect, vAlign: 'top' | 'bottom', truncated: boolean): FittedText {
  const lineHeight = size * spec.lineHeight;
  const height = blockHeight(lines.length, size, spec);
  const firstBaseline = vAlign === 'top' ? box.y + spec.capHeight * size : box.y + box.h - spec.descent * size - (lines.length - 1) * lineHeight;
  return { lines, size, lineHeight, firstBaseline, height, truncated };
}
