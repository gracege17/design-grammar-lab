// Neo-industrial strategies (8 columns × 10 rows). Telemetry-style compositions:
// dossier = archive card / spec sheet, console = screen readout, signage = hazard placard.
import { area } from './grid';
import type { Composer } from './composer';
import type { Variant } from './layouts';
import type { PosterContent, ShapeName } from './types';

const slashes = (c: Composer) => c.grammar.motifs.slashes ?? '///////';
const shapes = (c: Composer) => c.grammar.motifs.shapes as ShapeName[];
const frameStyle = (c: Composer) => c.rng.pick((c.grammar.motifs.frames ?? ['corners']) as ('corners' | 'brackets')[]);

/** A dark "screen" image: radar/scope in the signal colour. */
function screen(c: Composer, a: ReturnType<typeof area>, bleed: false | { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean } = false) {
  c.image(a, { style: 'scope', foreground: c.colors.signal, background: c.colors.panel, bleed });
}

/** A duotone line-screen "photograph". Paper ground when the poster itself is the signal colour. */
function photo(c: Composer, a: ReturnType<typeof area>) {
  const onSignal = c.colors.background === c.colors.signal;
  c.image(a, { style: 'linescreen', foreground: c.colors.ink, background: onSignal ? c.colors.paper : c.colors.signal });
}

const unit = (k: PosterContent) => `Unit / ${k.code}`;

// ─── Dossier: archive card & spec sheet ─────────────────────────────────────

const dossier: Variant[] = [
  {
    name: 'card',
    mirrorable: true,
    build(c, k) {
      c.frame(area(0, 0, 8, 10), frameStyle(c), c.colors.text, 14);
      c.text('meta', unit(k), area(0, 0, 2, 1), { box: { stroke: c.colors.text, pad: 5 } });
      c.text('meta', `${k.seriesLabel}\n${k.serial}`, area(2, 0, 3, 1));
      c.text('meta', `Status: ${k.status}`, area(5, 0, 3, 1), { align: 'right', color: c.colors.background, box: { fill: c.colors.accent, pad: 5 } });
      c.ruleAbove(1, 0, 8);
      c.text('display', k.name, area(0, 1, 8, 3), { vAlign: 'top', maxLines: 2, effect: c.pickEffect() });
      c.text('deck', k.headline, area(0, 4, 4, 1), { vAlign: 'top', maxLines: 2 });
      c.rng.bool() ? screen(c, area(5, 4, 3, 4)) : photo(c, area(5, 4, 3, 4));
      c.frame(area(5, 4, 3, 4), 'brackets', c.colors.accent, 6);
      c.table(k.specs, area(0, 5, 4, 3), { valueColor: c.colors.text });
      c.text('body', k.body, area(0, 8, 5, 1), { vAlign: 'top' });
      c.text('meta', slashes(c), area(0, 9, 2, 1), { vAlign: 'bottom', color: c.colors.accent });
      c.text('meta', `${k.coords}\n${k.location}`, area(2, 9, 3, 1), { vAlign: 'bottom' });
      c.shape('barcode', area(5, 9, 3, 1), c.colors.text);
    },
  },
  {
    name: 'specsheet',
    mirrorable: true,
    build(c, k) {
      c.gridfield(area(0, 0, 8, 10), c.colors.text, 8, 0.07, true);
      c.text('display', k.name, area(0, 0, 8, 2), { vAlign: 'top', maxLines: 1, effect: 'dotmatrix' });
      c.text('data', `[ ${k.status} ]`, area(0, 2, 4, 1), { vAlign: 'bottom', color: c.colors.accent, maxLines: 1 });
      c.hatch(area(4, 2, 4, 1), c.colors.text, 9);
      photo(c, area(0, 3, 5, 5));
      c.frame(area(0, 3, 5, 5), 'corners', c.colors.text, 6);
      c.table(k.specs, area(5, 3, 3, 4));
      c.shape(c.rng.pick(['reticle', 'chevrons'] as ShapeName[]), area(5, 7, 1, 1), c.colors.accent, 0);
      c.text('deck', k.headline, area(0, 8, 5, 1), { vAlign: 'top', maxLines: 2 });
      c.text('body', k.body, area(5, 8, 3, 2), { vAlign: 'top' });
      c.text('meta', `${unit(k)}\n${k.serial}`, area(0, 9, 2, 1), { vAlign: 'bottom' });
      c.text('meta', `${k.coords}\n${k.location}`, area(2, 9, 3, 1), { vAlign: 'bottom' });
    },
  },
];

// ─── Console: screen readouts ───────────────────────────────────────────────

const consoleV: Variant[] = [
  {
    name: 'screen',
    mirrorable: false,
    colorMode: 'ink',
    build(c, k) {
      const sig = c.colors.signal;
      c.text('meta', 'Waiting...', area(0, 0, 2, 1), { vAlign: 'bottom' });
      c.text('meta', `/   Scanning ${k.location}   /`, area(2, 0, 4, 1), { vAlign: 'bottom', color: sig, box: { stroke: sig, pad: 6 } });
      c.text('meta', '● Live', area(6, 0, 2, 1), { vAlign: 'bottom', align: 'right', color: c.colors.ink, box: { fill: sig, pad: 6 } });
      screen(c, area(0, 1, 8, 6));
      c.frame(area(0, 1, 8, 6), 'brackets', sig, 6);
      c.text('display', k.time, area(0, 7, 5, 2), { vAlign: 'bottom', maxLines: 1, color: sig, effect: 'glow' });
      c.text('data', `[ ${k.name} ]`, area(5, 7, 3, 1), { vAlign: 'bottom', align: 'right', color: sig, maxLines: 1 });
      c.text('meta', `${k.headline}\n${k.serial}`, area(5, 8, 3, 1), { vAlign: 'bottom', align: 'right', color: sig });
      c.ruleAbove(9, 0, 8, c.colors.text);
      c.text('meta', slashes(c), area(0, 9, 2, 1), { vAlign: 'bottom', color: sig });
      c.text('meta', k.coords, area(2, 9, 3, 1), { vAlign: 'bottom' });
      c.text('meta', unit(k), area(5, 9, 3, 1), { vAlign: 'bottom', align: 'right' });
    },
  },
  {
    // Text-only telemetry block floating in a large dark field.
    name: 'readout',
    mirrorable: false,
    colorMode: 'ink',
    build(c, k) {
      const sig = c.colors.signal;
      c.text('meta', `${k.seriesLabel}\n${k.seriesSubLabel}`, area(0, 0, 4, 1));
      c.text('meta', `T+ ${k.time}`, area(6, 0, 2, 1), { align: 'right' });
      c.frame(area(1, 2, 6, 6), frameStyle(c), c.colors.text, 18);
      c.text('data', `Unit ID: ${k.code}`, area(1, 2, 6, 1), { vAlign: 'bottom', maxLines: 1 });
      c.text('display', k.name, area(1, 3, 6, 2), { vAlign: 'top', maxLines: 1, color: sig, effect: c.rng.pick(['scanline', 'dotmatrix', 'glow']) });
      c.text('deck', k.headline, area(1, 5, 6, 1), { vAlign: 'top', maxLines: 2 });
      c.text('data', slashes(c), area(1, 6, 2, 1), { vAlign: 'top', color: sig, maxLines: 1 });
      c.text('data', k.location, area(3, 6, 4, 1), { vAlign: 'top', align: 'right', maxLines: 1 });
      c.shape('stripeddisc', area(1, 7, 2, 1), sig, 0);
      c.text('meta', `Status: ${k.status}`, area(3, 7, 2, 1), { vAlign: 'bottom', color: sig, box: { stroke: sig, pad: 6 } });
      c.text('meta', k.serial, area(5, 7, 2, 1), { vAlign: 'bottom', align: 'right', color: c.colors.ink, box: { fill: sig, pad: 6 } });
      c.text('body', k.body, area(0, 9, 5, 1), { vAlign: 'bottom' });
      c.text('meta', k.coords, area(5, 9, 3, 1), { vAlign: 'bottom', align: 'right' });
    },
  },
];

// ─── Signage: hazard placards ───────────────────────────────────────────────

const signage: Variant[] = [
  {
    // Orange placard: boxed modules on a graph-paper ground.
    name: 'placard',
    mirrorable: true,
    colorMode: 'accent',
    build(c, k) {
      const ink = c.colors.text;
      c.gridfield(area(0, 0, 8, 10), ink, 12, 0.16, true);
      c.frame(area(0, 0, 4, 2), 'box', ink);
      c.text('data', k.headline, area(0, 0, 4, 2), { vAlign: 'top', maxLines: 3, inset: { top: 10, left: 10, right: 10, bottom: 8 } });
      c.hatch(area(4, 0, 4, 1), ink, 10);
      c.text('numeral', k.code, area(4, 1, 4, 2), { vAlign: 'bottom', maxLines: 1, align: 'right' });
      c.shape(c.rng.pick(shapes(c)), area(0, 3, 1, 1), ink, 0);
      c.text('meta', `${unit(k)} — ${k.serial}`, area(1, 3, 7, 1), { vAlign: 'bottom' });
      c.text('display', k.name, area(0, 4, 8, 3), { vAlign: 'top', maxLines: 1, effect: 'dotmatrix' });
      c.table(k.specs, area(0, 7, 4, 2), { ruleColor: ink });
      c.text('body', k.body, area(5, 7, 3, 2), { vAlign: 'top' });
      c.text('meta', `${k.coords}\n${k.location}`, area(0, 9, 4, 1), { vAlign: 'bottom' });
      c.text('meta', `Status: ${k.status} >>>`, area(4, 9, 4, 1), { vAlign: 'bottom', align: 'right', color: c.colors.signal, box: { fill: ink, pad: 6 } });
    },
  },
  {
    // Dark ground, hazard bands top and bottom, a single loud name.
    name: 'warning',
    mirrorable: true,
    colorMode: 'ink',
    build(c, k) {
      const sig = c.colors.signal;
      c.hatch(area(0, 0, 8, 1), sig, 12);
      c.text('display', k.name, area(0, 1, 8, 3), { vAlign: 'top', maxLines: 2, color: sig, effect: c.rng.pick(['solid', 'scanline']) });
      c.text('deck', k.headline, area(0, 4, 5, 1), { vAlign: 'top', maxLines: 2 });
      c.shape(c.rng.pick(['stripeddisc', 'reticle'] as ShapeName[]), area(5, 4, 3, 3), sig, 0);
      c.frame(area(0, 5, 5, 3), 'corners', c.colors.text, 8);
      c.table(k.specs, area(0, 5, 5, 3));
      c.text('body', k.body, area(5, 7, 3, 1), { vAlign: 'top' });
      c.text('meta', `${unit(k)}\n${k.serial}`, area(0, 8, 2, 1), { vAlign: 'bottom' });
      c.text('meta', `${k.coords}\n${k.location}`, area(2, 8, 3, 1), { vAlign: 'bottom' });
      c.text('meta', `Status: ${k.status}`, area(5, 8, 3, 1), { vAlign: 'bottom', align: 'right', color: c.colors.ink, box: { fill: sig, pad: 6 } });
      c.hatch(area(0, 9, 8, 1), sig, 12);
    },
  },
];

export const INDUSTRIAL: Record<string, Variant[]> = { dossier, console: consoleV, signage };
