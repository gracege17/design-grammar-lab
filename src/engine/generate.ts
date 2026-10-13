// Public entry point of the engine: seeds in, layout models out. No React, no p5.
import { Composer } from './composer';
import { Grid } from './grid';
import { STRATEGIES, STRATEGY_NAMES } from './layouts';
import { Rng } from './random';
import type { MeasureFn, PosterContent, PosterLayout, ResolvedColors, StrategyName, StyleGrammar } from './types';
import { validate } from './validate';

export interface PosterRequest {
  seed: string;
  strategy?: StrategyName;
  variant?: string;
  contentIndex?: number;
}

function resolveColors(g: StyleGrammar, rng: Rng): ResolvedColors {
  const mode = rng.weighted(g.colorModes);
  const accent = rng.pick(g.palette.accents);
  // "on" = the text colour the grammar declares legible on this accent.
  const lookup = (role: string): string =>
    role === 'accent' ? accent.color : role === 'on' ? lookup(accent.on) : role === 'paper' ? g.palette.paper : g.palette.ink;
  return {
    modeId: mode.id,
    background: lookup(mode.background),
    text: lookup(mode.text),
    accent: lookup(mode.accent),
    ink: g.palette.ink,
    paper: g.palette.paper,
  };
}

export function generatePoster(req: PosterRequest, g: StyleGrammar, measure: MeasureFn): PosterLayout {
  const rng = new Rng(req.seed);
  const strategy = req.strategy ?? rng.pick(STRATEGY_NAMES);
  const variants = STRATEGIES[strategy];
  const variant = variants.find((v) => v.name === req.variant) ?? rng.fork('variant').pick(variants);
  const mirrored = g.rules.allowMirroring && variant.mirrorable && rng.fork('mirror').bool(0.5);
  const colors = resolveColors(g, rng.fork('colors'));

  const idx = req.contentIndex ?? rng.fork('content').int(0, g.content.length - 1);
  const entry = g.content[idx % g.content.length];
  const content: PosterContent = {
    ...entry,
    issue: `No. ${String((idx % g.content.length) + 1).padStart(2, '0')}`,
    seriesLabel: g.series.label,
    seriesSubLabel: g.series.subLabel,
  };

  const grid = Grid.fromGrammar(g);
  const composer = new Composer(g, grid, colors, rng.fork('compose'), measure, mirrored);
  variant.build(composer, content);

  const { width, height } = g.canvas;
  return {
    seed: req.seed,
    strategy,
    variant: variant.name,
    mirrored,
    width,
    height,
    colors,
    elements: composer.elements,
    diagnostics: validate(composer.elements, width, height, strategy, g),
  };
}

/**
 * Plan a gallery: strategies are interleaved and variants rotated so a batch shows
 * as many distinct compositions as possible; content entries are never repeated.
 */
export function planBatch(baseSeed: string, count: number, g: StyleGrammar): PosterRequest[] {
  const rng = new Rng(`batch:${baseSeed}`);
  const strategies = rng.shuffle(STRATEGY_NAMES);
  const queues = Object.fromEntries(STRATEGY_NAMES.map((s) => [s, rng.shuffle(STRATEGIES[s].map((v) => v.name))])) as Record<StrategyName, string[]>;
  const cursor: Record<StrategyName, number> = { typographic: 0, image: 0, editorial: 0 };
  const contentOrder = rng.shuffle(g.content.map((_, i) => i));

  return Array.from({ length: count }, (_, i) => {
    const strategy = strategies[i % strategies.length];
    const q = queues[strategy];
    const variant = q[cursor[strategy]++ % q.length];
    return { seed: `${baseSeed}-${i}`, strategy, variant, contentIndex: contentOrder[i % contentOrder.length] };
  });
}

export { Grid } from './grid';
export type { PosterLayout, MeasureFn, StyleGrammar } from './types';
