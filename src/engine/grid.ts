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
}

export class Grid {
  readonly spec: GridSpec;
  readonly colWidth: number;
  readonly rowHeight: number;
  readonly inner: Rect;

  constructor(spec: GridSpec) {
    this.spec = spec;
    const { width, height, columns, rows, margin, columnGutter, rowGutter } = spec;
    this.inner = {
      x: margin.left,
      y: margin.top,
      w: width - margin.left - margin.right,
      h: height - margin.top - margin.bottom,
    };
    this.colWidth = (this.inner.w - columnGutter * (columns - 1)) / columns;
    this.rowHeight = (this.inner.h - rowGutter * (rows - 1)) / rows;
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

  /** Snap a y value down to the baseline grid. */
  snapBaseline(y: number): number {
    const b = this.spec.baseline;
    return Math.round(y / b) * b;
  }

  private assertInside(a: GridArea) {
    if (a.col < 0 || a.row < 0 || a.colSpan < 1 || a.rowSpan < 1 || a.col + a.colSpan > this.columns || a.row + a.rowSpan > this.rows) {
      throw new Error(`Grid area out of bounds: ${JSON.stringify(a)}`);
    }
  }
}

export const area = (col: number, row: number, colSpan: number, rowSpan: number): GridArea => ({ col, row, colSpan, rowSpan });
