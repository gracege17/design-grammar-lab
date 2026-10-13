// Composer: the only way layouts place things. It snaps every element to the grid,
// fits text, applies mirroring and colour roles, and enforces type hierarchy.
import { Grid } from './grid';
import { Rng } from './random';
import { fitText, lineMeasurer, resolveRole } from './text';
import type {
  FrameElement,
  GridArea,
  ImageStyle,
  MeasureFn,
  PosterElement,
  Rect,
  ResolvedColors,
  ShapeName,
  StyleGrammar,
  TextEffect,
  TextRoleName,
} from './types';

type Sides = { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };
const ALL: Sides = { top: true, right: true, bottom: true, left: true };

export interface TextOpts {
  vAlign?: 'top' | 'bottom';
  align?: 'left' | 'right';
  maxLines?: number;
  color?: string;
  /** Inset the text box from its grid area (used inside panels). */
  inset?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  minSize?: number;
  maxSize?: number;
  effect?: TextEffect;
  /** Draw a box behind the text: a status tag. `fill` makes it solid, otherwise it is outlined. */
  box?: { fill?: string; stroke?: string; pad?: number };
}

export class Composer {
  readonly elements: PosterElement[] = [];
  /** Sizes chosen so far per role — used to keep hierarchy ratios intact. */
  readonly sizes: Partial<Record<TextRoleName, number>> = {};
  private counter = 0;

  readonly grammar: StyleGrammar;
  readonly grid: Grid;
  readonly colors: ResolvedColors;
  readonly rng: Rng;
  readonly measure: MeasureFn;
  readonly mirrored: boolean;

  constructor(grammar: StyleGrammar, grid: Grid, colors: ResolvedColors, rng: Rng, measure: MeasureFn, mirrored: boolean) {
    this.grammar = grammar;
    this.grid = grid;
    this.colors = colors;
    this.rng = rng;
    this.measure = measure;
    this.mirrored = mirrored;
  }

  private id(prefix: string) {
    return `${prefix}-${this.counter++}`;
  }

  /** Apply mirroring to a logical area. */
  place(a: GridArea): GridArea {
    return this.mirrored ? this.grid.mirror(a) : a;
  }

  private sides(s: Sides): Sides {
    return this.mirrored ? { ...s, left: s.right, right: s.left } : s;
  }

  /** Pixel rect of a logical area, after mirroring. */
  rectOf(logical: GridArea): Rect {
    return this.grid.rect(this.place(logical));
  }

  /** A text effect drawn from the grammar's allowed list (or 'solid'). */
  pickEffect(): TextEffect {
    const list = (this.grammar.motifs.textEffects ?? ['solid']) as TextEffect[];
    return this.rng.pick(list);
  }

  text(role: TextRoleName, content: string, logical: GridArea, opts: TextOpts = {}) {
    const a = this.place(logical);
    // Mirrored layouts flip alignment so text keeps hugging the same side of its module.
    const align = this.mirrored && opts.align === 'right' ? 'left' : this.mirrored && opts.align === 'left' ? 'right' : opts.align;
    return this.textInRect(role, content, a, this.grid.rect(a), { ...opts, align });
  }

  /** Lower-level placement inside an explicit rect (used for table rows that subdivide a module). */
  textInRect(role: TextRoleName, content: string, a: GridArea, r: Rect, opts: TextOpts = {}) {
    const inset = opts.inset ?? {};
    const pad = opts.box ? (opts.box.pad ?? 5) : 0;
    const box: Rect = {
      x: r.x + (inset.left ?? 0) + pad,
      y: r.y + (inset.top ?? 0) + pad,
      w: r.w - (inset.left ?? 0) - (inset.right ?? 0) - pad * 2,
      h: r.h - (inset.top ?? 0) - (inset.bottom ?? 0) - pad * 2,
    };
    const spec = resolveRole(this.grammar, role);

    // Hierarchy: deck must be clearly smaller than display.
    const h = this.grammar.typography.hierarchy;
    let maxSize = opts.maxSize;
    if (role === 'deck' && this.sizes.display) maxSize = Math.min(maxSize ?? Infinity, this.sizes.display / h.displayToDeck);

    const fitted = fitText(content, box, spec, this.measure, { vAlign: opts.vAlign, maxLines: opts.maxLines, maxSize, minSize: opts.minSize });
    this.sizes[role] = Math.max(this.sizes[role] ?? 0, fitted.size);

    const m = lineMeasurer(spec, fitted.size, this.measure);
    const widest = Math.max(...fitted.lines.map(m));
    const align = opts.align ?? 'left';
    const top = fitted.firstBaseline - spec.capHeight * fitted.size;
    const bx = align === 'right' ? box.x + box.w - widest : box.x;
    const bounds = { x: bx, y: top, w: widest, h: fitted.height };
    this.elements.push({
      kind: 'text',
      id: this.id(role),
      role,
      area: a,
      rect: box,
      lines: fitted.lines,
      family: spec.family,
      weight: spec.weight,
      size: fitted.size,
      lineHeight: fitted.lineHeight,
      tracking: spec.tracking * fitted.size,
      firstBaseline: fitted.firstBaseline,
      color: opts.color ?? this.colors.text,
      align,
      effect: opts.effect ?? 'solid',
      box: opts.box ? { rect: { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w + pad * 2, h: bounds.h + pad * 2 }, fill: opts.box.fill, stroke: opts.box.stroke } : undefined,
      truncated: fitted.truncated,
      bounds,
    });
    return fitted;
  }

  /**
   * Key / value table ("Mass|412 KG" per line). Rows are spaced evenly down the area,
   * labels flush left, values flush right, a hairline under every row.
   */
  table(spec: string, logical: GridArea, opts: { labelColor?: string; valueColor?: string; ruleColor?: string } = {}) {
    const a = this.place(logical);
    const r = this.grid.rect(a);
    const rows = spec.split('\n').map((l) => l.split('|'));
    const pitch = r.h / rows.length;
    rows.forEach(([k, v], i) => {
      const row: Rect = { x: r.x, y: r.y + i * pitch, w: r.w, h: pitch - 6 };
      this.textInRect('meta', k, a, { ...row, w: row.w * 0.45 }, { vAlign: 'bottom', color: opts.labelColor });
      const label = this.elements[this.elements.length - 1];
      this.textInRect('data', v ?? '', a, row, { vAlign: 'bottom', align: 'right', color: opts.valueColor, maxLines: 1, maxSize: 22 });
      const value = this.elements[this.elements.length - 1];
      // Share one baseline: the value's (larger size) baseline wins, the label moves up to meet it.
      if (label.kind === 'text' && value.kind === 'text' && label.lines.length === 1) {
        const dy = value.firstBaseline - label.firstBaseline;
        label.firstBaseline += dy;
        label.bounds = { ...label.bounds, y: label.bounds.y + dy };
      }
      this.elements.push({ kind: 'rule', id: this.id('rule'), area: a, orientation: 'h', rect: { x: r.x, y: row.y + pitch - 2, w: r.w, h: 0 }, weight: 1, color: opts.ruleColor ?? this.colors.text });
    });
  }

  shape(shape: ShapeName, logical: GridArea, color = this.colors.accent, orientation?: number) {
    const a = this.place(logical);
    let o = orientation ?? this.rng.int(0, 3);
    // Mirror the orientation too, so mirrored layouts stay coherent.
    // Only corner-anchored shapes change under a left↔right mirror.
    if (this.mirrored && orientation !== undefined && (shape === 'quarter' || shape === 'arcs')) o = [1, 0, 3, 2][o];
    this.elements.push({ kind: 'shape', id: this.id('shape'), shape, area: a, rect: this.grid.rect(a), orientation: o, color });
  }

  image(
    logical: GridArea,
    opts: { bleed?: Sides | false; style?: ImageStyle; mask?: 'rect' | 'circle'; foreground?: string; background?: string } = {},
  ) {
    const a = this.place(logical);
    const rect = opts.bleed === false || opts.bleed === undefined ? this.grid.rect(a) : this.grid.bleed(a, this.sides(opts.bleed));
    const styles = this.grammar.motifs.image.styles as ImageStyle[];
    this.elements.push({
      kind: 'image',
      id: this.id('image'),
      area: a,
      rect,
      style: opts.style ?? this.rng.pick(styles),
      seed: this.rng.int(0, 1_000_000),
      foreground: opts.foreground ?? this.colors.ink,
      background: opts.background ?? (this.colors.accent === this.colors.background ? this.colors.paper : this.colors.accent),
      cell: this.grammar.motifs.image.cell,
      mask: opts.mask ?? 'rect',
    });
  }

  /** A solid colour field. `pad` grows it outward on the non-bleeding sides so text inside gets breathing room. */
  panel(logical: GridArea, color: string, bleed: Sides = ALL, pad = 0) {
    const a = this.place(logical);
    const s = this.sides(bleed);
    const r = this.grid.bleed(a, s);
    const touches = {
      left: s.left && a.col === 0,
      top: s.top && a.row === 0,
      right: s.right && a.col + a.colSpan === this.grid.columns,
      bottom: s.bottom && a.row + a.rowSpan === this.grid.rows,
    };
    const rect = { ...r };
    if (!touches.left) {
      rect.x -= pad;
      rect.w += pad;
    }
    if (!touches.right) rect.w += pad;
    if (!touches.top) {
      rect.y -= pad;
      rect.h += pad;
    }
    if (!touches.bottom) rect.h += pad;
    this.elements.push({ kind: 'panel', id: this.id('panel'), area: a, rect, color });
  }

  /** Frame an area. `outset` pushes the frame into the surrounding gutter/margin. */
  frame(logical: GridArea, style: FrameElement['style'], color = this.colors.text, outset = 0) {
    const a = this.place(logical);
    const r = this.grid.rect(a);
    const rect = { x: r.x - outset, y: r.y - outset, w: r.w + outset * 2, h: r.h + outset * 2 };
    this.elements.push({ kind: 'frame', id: this.id('frame'), area: a, rect, style, color });
  }

  hatch(logical: GridArea, color = this.colors.text, stripe = 10) {
    const a = this.place(logical);
    this.elements.push({ kind: 'hatch', id: this.id('hatch'), area: a, rect: this.grid.rect(a), color, stripe });
  }

  /** Graph-paper texture. With bleed the field runs to the canvas edges. */
  gridfield(logical: GridArea, color = this.colors.text, cell = 12, alpha = 0.14, bleed = false) {
    const a = this.place(logical);
    const rect = bleed ? this.grid.bleed(a) : this.grid.rect(a);
    this.elements.push({ kind: 'gridfield', id: this.id('gridfield'), area: a, rect, color, cell, alpha });
  }

  /** Horizontal hairline in the gutter above `row`, spanning the given columns. */
  ruleAbove(row: number, col: number, colSpan: number, color = this.colors.text) {
    const a = this.place({ col, row, colSpan, rowSpan: 1 });
    const r = this.grid.rect(a);
    const y = row === 0 ? r.y : r.y - this.grid.spec.rowGutter / 2;
    this.elements.push({ kind: 'rule', id: this.id('rule'), area: a, orientation: 'h', rect: { x: r.x, y, w: r.w, h: 0 }, weight: this.grammar.motifs.ruleWeight, color });
  }

  /** Vertical hairline in the gutter left of `col`, spanning the given rows. */
  ruleLeftOf(col: number, row: number, rowSpan: number, color = this.colors.text) {
    // When mirrored, "left of col" becomes "right of the mirrored col".
    const logical = { col, row, colSpan: 1, rowSpan };
    const a = this.place(logical);
    const r = this.grid.rect(a);
    const g = this.grid.spec.columnGutter / 2;
    const x = this.mirrored ? r.x + r.w + g : r.x - g;
    this.elements.push({ kind: 'rule', id: this.id('rule'), area: a, orientation: 'v', rect: { x, y: r.y, w: 0, h: r.h }, weight: this.grammar.motifs.ruleWeight, color });
  }
}
