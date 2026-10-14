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
  vAlign?: 'top' | 'bottom' | 'center';
  align?: 'left' | 'right';
  maxLines?: number;
  color?: string;
  /** Inset the text box from its grid area (used inside panels). */
  inset?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  minSize?: number;
  maxSize?: number;
  effect?: TextEffect;
  /** Draw a box behind the text: a status tag. `fill` makes it solid, otherwise it is outlined. */
  box?: { fill?: string; stroke?: string };
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

  /** Spacing tokens with defaults derived from the grid. */
  get space() {
    const g = this.grid.spec;
    return this.grammar.spacing ?? { tagPad: g.baseline + 2, tableRow: g.baseline * 7, posterFrameOutset: g.margin.left / 2 };
  }

  /** Opacity for hairline rules. */
  get ruleAlpha() {
    return this.grammar.motifs.ruleAlpha ?? 1;
  }

  /**
   * A tag's box: its height is the cap block plus equal padding, rounded up to whole baselines,
   * and it hugs the module's top, bottom or centre. Returns the box and the baseline that centres
   * the caps inside it — equal space above and below.
   */
  private tagBox(capBlock: number, capH: number, widest: number, textX: number, module: Rect, pad: number, vAlign: 'top' | 'bottom' | 'center') {
    const b = this.grid.spec.baseline;
    const h = Math.ceil((capBlock + pad * 2) / b - 1e-6) * b;
    const y = vAlign === 'top' ? module.y : vAlign === 'bottom' ? module.y + module.h - h : this.grid.snapBaseline(module.y + (module.h - h) / 2);
    const rect = { x: textX - pad, y, w: widest + pad * 2, h };
    return { rect, firstBaseline: y + (h - capBlock) / 2 + capH };
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

  /** Dry run: would this text fit the area at an allowed size, without breaking words or cutting? */
  fits(role: TextRoleName, content: string, logical: GridArea, opts: Pick<TextOpts, 'maxLines' | 'maxSize' | 'minSize'> = {}): boolean {
    const r = this.grid.rect(this.place(logical));
    const snap = { unit: this.grid.spec.baseline, origin: this.grid.baselineOrigin };
    return !fitText(content, r, resolveRole(this.grammar, role), this.measure, { ...opts, snap }).truncated;
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
    const pad = opts.box ? this.space.tagPad : 0;
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

    const snap = { unit: this.grid.spec.baseline, origin: this.grid.baselineOrigin };
    const fitted = fitText(content, box, spec, this.measure, { vAlign: opts.vAlign, maxLines: opts.maxLines, maxSize, minSize: opts.minSize, snap });
    this.sizes[role] = Math.max(this.sizes[role] ?? 0, fitted.size);

    const m = lineMeasurer(spec, fitted.size, this.measure);
    const widest = Math.max(...fitted.lines.map(m));
    const align = opts.align ?? 'left';
    const bx = align === 'right' ? box.x + box.w - widest : box.x;
    const capH = spec.capHeight * fitted.size;
    let tag: { rect: Rect; firstBaseline: number } | undefined;
    if (opts.box) {
      const capBlock = capH + (fitted.lines.length - 1) * fitted.lineHeight;
      tag = this.tagBox(capBlock, capH, widest, bx, r, pad, opts.vAlign ?? 'top');
      fitted.firstBaseline = tag.firstBaseline;
    }
    const top = fitted.firstBaseline - capH;
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
      box: tag && opts.box ? { rect: tag.rect, fill: opts.box.fill, stroke: opts.box.stroke } : undefined,
      centeredInBox: !!tag,
      truncated: fitted.truncated,
      bounds,
    });
    return fitted;
  }

  /**
   * Key / value table ("Mass|412 KG" per line). Rows run on a fixed pitch (a lattice multiple) from
   * the module top; label and value share one baseline, centred between the dividers.
   */
  table(spec: string, logical: GridArea, opts: { labelColor?: string; valueColor?: string; ruleColor?: string } = {}) {
    const a = this.place(logical);
    const r = this.grid.rect(a);
    const rows = spec.split('\n').map((l) => l.split('|'));
    // Fixed rhythm from the grammar; only tightened (in whole baselines) if the rows can't fit.
    const b = this.grid.spec.baseline;
    let pitch = this.space.tableRow;
    if (pitch * rows.length > r.h) pitch = Math.floor(r.h / rows.length / b) * b;
    rows.forEach(([k, v], i) => {
      const row: Rect = { x: r.x, y: r.y + i * pitch, w: r.w, h: pitch };
      this.textInRect('meta', k, a, { ...row, w: row.w * 0.45 }, { vAlign: 'center', color: opts.labelColor, maxLines: 1 });
      const label = this.elements[this.elements.length - 1];
      // Value caps take at most ~half the row, leaving equal clear space above and below.
      this.textInRect('data', v ?? '', a, row, { vAlign: 'center', align: 'right', color: opts.valueColor, maxLines: 1, maxSize: pitch * 0.55 });
      const value = this.elements[this.elements.length - 1];
      // Share one baseline: the value's (larger size) baseline wins, the label moves up to meet it.
      if (label.kind === 'text' && value.kind === 'text' && label.lines.length === 1) {
        const dy = value.firstBaseline - label.firstBaseline;
        label.firstBaseline += dy;
        label.bounds = { ...label.bounds, y: label.bounds.y + dy };
      }
      this.elements.push({ kind: 'rule', id: this.id('rule'), area: a, orientation: 'h', rect: { x: r.x, y: r.y + (i + 1) * pitch, w: r.w, h: 0 }, weight: this.grammar.motifs.ruleWeight, color: opts.ruleColor ?? this.colors.text, alpha: this.ruleAlpha });
    });
  }

  shape(shape: ShapeName, logical: GridArea, color = this.colors.accent, orientation?: number, anchor: 'bottom' | 'center' = 'bottom') {
    const a = this.place(logical);
    let o = orientation ?? this.rng.int(0, 3);
    // Mirror the orientation too, so mirrored layouts stay coherent.
    // Only corner-anchored shapes change under a left↔right mirror.
    if (this.mirrored && orientation !== undefined && (shape === 'quarter' || shape === 'arcs')) o = [1, 0, 3, 2][o];
    this.elements.push({ kind: 'shape', id: this.id('shape'), shape, area: a, rect: this.grid.rect(a), orientation: o, color, anchor });
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

  /**
   * Frame an area. 'module' puts the frame line in the middle of the surrounding gutter;
   * 'poster' puts it in the margin at the grammar's posterFrameOutset.
   */
  frame(logical: GridArea, style: FrameElement['style'], color = this.colors.text, at: 'module' | 'poster' = 'module') {
    const a = this.place(logical);
    const r = this.grid.rect(a);
    const outset = at === 'poster' ? this.space.posterFrameOutset : Math.min(this.grid.spec.columnGutter, this.grid.spec.rowGutter) / 2;
    const rect = { x: r.x - outset, y: r.y - outset, w: r.w + outset * 2, h: r.h + outset * 2 };
    this.elements.push({ kind: 'frame', id: this.id('frame'), area: a, rect, style, color });
  }

  hatch(logical: GridArea, color = this.colors.text, stripe = 10) {
    const a = this.place(logical);
    this.elements.push({ kind: 'hatch', id: this.id('hatch'), area: a, rect: this.grid.rect(a), color, stripe });
  }

  /**
   * Graph-paper texture on the grid's own lattice: cell = grid.cell, origin = the grid's inner corner,
   * so texture lines coincide with module edges, gutter centres and table dividers.
   */
  gridfield(logical: GridArea, color = this.colors.text, alpha = 0.14, bleed = false) {
    const a = this.place(logical);
    const rect = bleed ? this.grid.bleed(a) : this.grid.rect(a);
    const g = this.grid;
    const cell = g.spec.cell ?? g.spec.baseline * 3;
    const majorX = Array.from({ length: g.columns }, (_, c) => [g.colX(c), g.colX(c) + g.colWidth]).flat();
    const majorY = Array.from({ length: g.rows }, (_, r) => [g.rowY(r), g.rowY(r) + g.rowHeight]).flat();
    this.elements.push({ kind: 'gridfield', id: this.id('gridfield'), area: a, rect, color, cell, alpha, origin: { x: g.inner.x, y: g.inner.y }, majorX, majorY });
  }

  /** Horizontal hairline in the gutter above `row`, spanning the given columns. */
  ruleAbove(row: number, col: number, colSpan: number, color = this.colors.text) {
    const a = this.place({ col, row, colSpan, rowSpan: 1 });
    const r = this.grid.rect(a);
    const y = row === 0 ? r.y : r.y - this.grid.spec.rowGutter / 2;
    this.elements.push({ kind: 'rule', id: this.id('rule'), area: a, orientation: 'h', rect: { x: r.x, y, w: r.w, h: 0 }, weight: this.grammar.motifs.ruleWeight, color, alpha: this.ruleAlpha });
  }

  /** Vertical hairline in the gutter left of `col`, spanning the given rows. */
  ruleLeftOf(col: number, row: number, rowSpan: number, color = this.colors.text) {
    // When mirrored, "left of col" becomes "right of the mirrored col".
    const logical = { col, row, colSpan: 1, rowSpan };
    const a = this.place(logical);
    const r = this.grid.rect(a);
    const g = this.grid.spec.columnGutter / 2;
    const x = this.mirrored ? r.x + r.w + g : r.x - g;
    this.elements.push({ kind: 'rule', id: this.id('rule'), area: a, orientation: 'v', rect: { x, y: r.y, w: 0, h: r.h }, weight: this.grammar.motifs.ruleWeight, color, alpha: this.ruleAlpha });
  }
}
