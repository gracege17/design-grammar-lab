// Core types for the poster engine. Nothing here depends on React or p5.

export type StyleGrammar = typeof import('../grammar/style-grammar.json');

export type TextRoleName = 'display' | 'deck' | 'body' | 'meta' | 'numeral';
export type StrategyName = 'typographic' | 'image' | 'editorial';
export type ShapeName = 'circle' | 'half' | 'quarter' | 'bars' | 'dots' | 'arcs';
export type ImageStyle = 'halftone' | 'linescreen';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A rectangle expressed in grid modules. Every element is placed through one of these. */
export interface GridArea {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

/** Measure the advance width of `text` set in the given font. Injected by the host. */
export type MeasureFn = (text: string, family: string, weight: number, size: number) => number;

export interface ResolvedColors {
  modeId: string;
  background: string;
  text: string;
  accent: string;
  /** Second ink used inside image duotones and panels. */
  ink: string;
  paper: string;
}

interface BaseElement {
  id: string;
  /** Grid-snapped rectangle the element occupies (after bleed is applied). */
  rect: Rect;
  area: GridArea;
}

export interface TextElement extends BaseElement {
  kind: 'text';
  role: TextRoleName;
  lines: string[];
  family: string;
  weight: number;
  size: number;
  lineHeight: number;
  /** y of the first baseline, absolute canvas coordinates */
  firstBaseline: number;
  color: string;
  align: 'left' | 'right';
  /** True if the text could not fit even at the smallest allowed size and was truncated. */
  truncated: boolean;
  /** Actual ink bounds of the set text (widest line × block height). */
  bounds: Rect;
}

export interface ShapeElement extends BaseElement {
  kind: 'shape';
  shape: ShapeName;
  /** 0..3 quarter-turn orientation */
  orientation: number;
  color: string;
}

export interface ImageElement extends BaseElement {
  kind: 'image';
  style: ImageStyle;
  seed: number;
  foreground: string;
  background: string;
  cell: number;
  mask: 'rect' | 'circle';
}

export interface PanelElement extends BaseElement {
  kind: 'panel';
  color: string;
}

export interface RuleElement extends BaseElement {
  kind: 'rule';
  orientation: 'h' | 'v';
  weight: number;
  color: string;
}

export type PosterElement = TextElement | ShapeElement | ImageElement | PanelElement | RuleElement;

export interface Diagnostics {
  truncatedText: string[];
  overlappingText: [string, string][];
  textOutOfBounds: string[];
  negativeSpace: number;
  hierarchyOk: boolean;
  warnings: string[];
}

export interface PosterLayout {
  seed: string;
  strategy: StrategyName;
  variant: string;
  mirrored: boolean;
  width: number;
  height: number;
  colors: ResolvedColors;
  elements: PosterElement[];
  diagnostics: Diagnostics;
}

export interface PosterContent {
  headline: string;
  deck: string;
  body: string;
  date: string;
  venue: string;
  issue: string;
  seriesLabel: string;
  seriesSubLabel: string;
}
