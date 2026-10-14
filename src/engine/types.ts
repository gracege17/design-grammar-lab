// Core types for the poster engine. Nothing here depends on React or p5.

// ─── Style Grammar schema ─────────────────────────────────────────────────────
// Every grammar JSON in src/grammar/ follows this shape. Phase 2 will produce these automatically.

export interface RoleDef {
  family: string; // key into typography.families
  weight: number;
  lineHeight: number;
  sizes: number[]; // allowed sizes, largest first
  uppercase: boolean;
  capHeight: number; // em
  descent: number; // em
  tracking?: number; // letter-spacing in em
}

export interface ColorModeDef {
  id: string;
  weight: number;
  background: string; // 'paper' | 'ink' | 'accent' | 'on' | 'panel'
  text: string;
  accent: string;
}

export interface StyleGrammar {
  id: string;
  name: string;
  version: number;
  source?: { reference?: string; observations?: string[] };
  canvas: { width: number; height: number };
  grid: {
    columns: number;
    rows: number;
    margin: { top: number; right: number; bottom: number; left: number };
    columnGutter: number;
    rowGutter: number;
    baseline: number;
    /** Force module height + gutter to baseline multiples (row edges fall on the baseline grid). */
    lockToBaseline?: boolean;
    /**
     * Lattice cell (px). When set, module width/height, gutters, table rows and the grid-paper texture
     * are all whole multiples of it, so every line in the poster can land on the same lattice.
     */
    cell?: number;
  };
  /** Spacing tokens. Layouts never use raw pixel numbers; they use these. */
  spacing?: {
    /** inner padding of status tags */
    tagPad: number;
    /** pitch of key/value table rows (should be a baseline multiple) */
    tableRow: number;
    /** how far a whole-poster frame sits outside the grid, into the margin */
    posterFrameOutset: number;
  };
  palette: { paper: string; ink: string; panel?: string; accents: { color: string; on: string }[] };
  colorModes: ColorModeDef[];
  surface?: { grain?: number; scanlines?: number };
  typography: {
    families: Record<string, string>;
    roles: Record<string, RoleDef>;
    hierarchy: { displayToDeck: number; deckToBody: number };
  };
  motifs: {
    shapes: string[];
    image: { styles: string[]; cell: number };
    ruleWeight: number;
    /** Opacity of hairline dividers (0–1). Lower values keep rules from competing with type. */
    ruleAlpha?: number;
    textEffects?: string[];
    frames?: string[];
    slashes?: string;
  };
  rules: { minNegativeSpace: number; maxElementsPerPoster: number; headlineMaxLines: number; allowMirroring: boolean };
  strategies: string[];
  series: { label: string; subLabel: string };
  content: Record<string, string>[];
}

// ─── Layout model ─────────────────────────────────────────────────────────────

export type TextRoleName = string;
export type StrategyName = string;
export type ShapeName =
  | 'circle' | 'half' | 'quarter' | 'bars' | 'dots' | 'arcs' // swiss
  | 'reticle' | 'chevrons' | 'barcode' | 'stripeddisc'; // industrial
export type ImageStyle = 'halftone' | 'linescreen' | 'scope';
export type TextEffect = 'solid' | 'dotmatrix' | 'scanline' | 'glow';

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

/** Measure the advance width of `text` set in the given font (no tracking). Injected by the host. */
export type MeasureFn = (text: string, family: string, weight: number, size: number) => number;

export interface ResolvedColors {
  modeId: string;
  background: string;
  text: string;
  accent: string;
  ink: string;
  paper: string;
  panel: string;
  /** The raw accent hue, whatever role it plays in this mode. */
  signal: string;
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
  /** Letter spacing in px. */
  tracking: number;
  /** y of the first baseline, absolute canvas coordinates */
  firstBaseline: number;
  color: string;
  align: 'left' | 'right';
  effect: TextEffect;
  /** Centred inside a tag box rather than sitting on the baseline grid (the box itself is on the grid). */
  centeredInBox?: boolean;
  /** Optional box drawn behind the text (status tags). */
  box?: { rect: Rect; fill?: string; stroke?: string };
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
  /** Where the square sits inside a non-square area. */
  anchor: 'bottom' | 'center';
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
  alpha: number;
}

/** Corner registration marks, brackets or a plain hairline box around an area. */
export interface FrameElement extends BaseElement {
  kind: 'frame';
  style: 'corners' | 'brackets' | 'box';
  color: string;
}

/** Diagonal hazard stripes. */
export interface HatchElement extends BaseElement {
  kind: 'hatch';
  color: string;
  stripe: number;
}

/** Fine square grid texture (graph paper / screen raster). */
export interface GridFieldElement extends BaseElement {
  kind: 'gridfield';
  color: string;
  cell: number;
  alpha: number;
  /** Lattice origin — the grid's inner top-left — so texture lines coincide with module edges. */
  origin: { x: number; y: number };
  /** Module and gutter edges, drawn slightly stronger than the plain lattice. */
  majorX: number[];
  majorY: number[];
}

export type PosterElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | PanelElement
  | RuleElement
  | FrameElement
  | HatchElement
  | GridFieldElement;

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
  grammarId: string;
  strategy: StrategyName;
  variant: string;
  mirrored: boolean;
  width: number;
  height: number;
  colors: ResolvedColors;
  surface: { grain: number; scanlines: number };
  elements: PosterElement[];
  diagnostics: Diagnostics;
}

/** Content fields come straight from the grammar's content entries, plus a few derived ones. */
export type PosterContent = Record<string, string> & {
  issue: string;
  seriesLabel: string;
  seriesSubLabel: string;
};
