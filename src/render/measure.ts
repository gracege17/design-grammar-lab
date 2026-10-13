// Browser text measurement injected into the engine. Uses the same font string the
// canvas uses when p5 draws text, so wrapping decisions match what is rendered.
import type { MeasureFn, StyleGrammar } from '../engine/types';

const ctx = document.createElement('canvas').getContext('2d')!;
const cache = new Map<string, number>();

export const measureText: MeasureFn = (text, family, weight, size) => {
  const key = `${weight}|${family}|${text}`;
  let unit = cache.get(key);
  if (unit === undefined) {
    ctx.font = `${weight} 100px "${family}"`;
    unit = ctx.measureText(text).width / 100;
    cache.set(key, unit);
  }
  return unit * size;
};

/** Wait until every family/weight the grammar uses is loaded, so measurement is correct. */
export async function loadGrammarFonts(g: StyleGrammar): Promise<void> {
  const fams = g.typography.families as Record<string, string>;
  const loads = Object.values(g.typography.roles).map((r) => document.fonts.load(`${r.weight} 32px "${fams[r.family]}"`));
  await Promise.all(loads);
  await document.fonts.ready;
  cache.clear();
}
