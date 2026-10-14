// Modular grid: columns × rows of equal modules separated by gutters, inside margins.
import type { GridArea, Rect, StyleGrammar } from './types';

export interface GridSpec {
  width: number;
  height: number;
  columns: number;
  rows: number;
  margin: { top: number; right: number; bottom: number; left: number };
  columnGutter: number;
  rowGutter: number;
  baseline: number;
  /**
   * When true the module height and gutter are forced to whole multiples of the baseline,
   * and the leftover height is shared between top and bottom margins (treated as minimums).
   * Every row edge then falls on the baseline grid.
   */
  lockToBaseline?: boolean;
}

export class Grid {
  readonly spec: GridSpec;
  readonly colWidth: number;
  readonly rowHeight: number;
  readonly inner: Rect;

  constructor(input: GridSpec) {
    const b = input.baseline;
    const spec: GridSpec = { ...input, margin: { ...input.margin } };
    if (spec.lockToBaseline) spec.rowGutter = Math.max(b, Math.round(spec.rowGutter / b) * b);
    const { width, height, columns, rows, margin, columnGutter, rowGutter } = spec;
    const availH = height - margin.top - margin.bottom;
    let rowHeight = (availH - rowGutter * (rows - 1)) / rows;
    if (spec.lockToBaseline) {
      rowHeight = Math.floor(rowHeight / b) * b;
      const extra = availH - rows * rowHeight - rowGutter * (rows - 1);
      const top = Math.floor(extra / 2);
      margin.top += top;
      margin.bottom += extra - top;
    }
    this.spec = spec;
    this.rowHeight = rowHeight;
    this.inner = {
      x: margin.left,
      y: margin.top,
      w: width - margin.left - margin.right,
      h: height - margin.top - margin.bottom,
    };
    this.colWidth = (this.inner.w - columnGutter * (columns - 1)) / columns;
  }

  /** The baseline grid starts at the top margin, so it coincides with every row edge. */
  get baselineOrigin() {
    return this.inner.y;
  }

  /** True if y lies on the baseline grid (within half a pixel). */
  onBaseline(y: number): boolean {
    const b = this.spec.baseline;
    const r = (y - this.baselineOrigin) / b;
    return Math.abs(r - Math.round(r)) * b < 0.5;
  }

  static fromGrammar(g: StyleGrammar): Grid {
    return new Grid({ width: g.canvas.width, height: g.canvas.height, ...g.grid });
  }

  get columns() {
    return this.spec.columns;
  }
  get rows() {
    return this.spec.rows;
  }

  colX(col: number): number {
    return this.inner.x + col * (this.colWidth + this.spec.columnGutter);
  }
  rowY(row: number): number {
    return this.inner.y + row * (this.rowHeight + this.spec.rowGutter);
  }

  /** Pixel rectangle covered by a grid area (module edges, gutters between them included). */
  rect(a: GridArea): Rect {
    this.assertInside(a);
    const x = this.colX(a.col);
    const y = this.rowY(a.row);
    const w = a.colSpan * this.colWidth + (a.colSpan - 1) * this.spec.columnGutter;
    const h = a.rowSpan * this.rowHeight + (a.rowSpan - 1) * this.spec.rowGutter;
    return { x, y, w, h };
  }

  /** Extend a rect to the canvas edge on every side where its area touches the grid boundary. */
  bleed(a: GridArea, sides: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean } = { top: true, right: true, bottom: true, left: true }): Rect {
    const r = this.rect(a);
    let { x, y, w, h } = r;
    if (sides.left && a.col === 0) {
      w += x;
      x = 0;
    }
    if (sides.top && a.row === 0) {
      h += y;
      y = 0;
    }
    if (sides.right && a.col + a.colSpan === this.columns) w = this.spec.width - x;
    if (sides.bottom && a.row + a.rowSpan === this.rows) h = this.spec.height - y;
    return { x, y, w, h };
  }

  mirror(a: GridArea): GridArea {
    return { ...a, col: this.columns - a.col - a.colSpan };
  }

  /** Snap a y value to the baseline grid ('up' = towards larger y). */
  snapBaseline(y: number, dir: 'up' | 'down' | 'nearest' = 'nearest'): number {
    const b = this.spec.baseline;
    const r = (y - this.baselineOrigin) / b;
    const k = dir === 'up' ? Math.ceil(r - 1e-6) : dir === 'down' ? Math.floor(r + 1e-6) : Math.round(r);
    return this.baselineOrigin + k * b;
  }

  private assertInside(a: GridArea) {
    if (a.col < 0 || a.row < 0 || a.colSpan < 1 || a.rowSpan < 1 || a.col + a.colSpan > this.columns || a.row + a.rowSpan > this.rows) {
      throw new Error(`Grid area out of bounds: ${JSON.stringify(a)}`);
    }
  }
}

export const area = (col: number, row: number, colSpan: number, rowSpan: number): GridArea => ({ col, row, colSpan, rowSpan });
