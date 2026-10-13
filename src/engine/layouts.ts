// Layout strategies. Each variant is a deliberate composition expressed in grid modules
// (6 columns × 8 rows in the default grammar). Randomness only chooses between
// pre-designed structural options — spans, motif, mirroring — never free positions.
import { area } from './grid';
import type { Composer } from './composer';
import { INDUSTRIAL } from './layouts-industrial';
import type { PosterContent, ShapeName } from './types';

export interface Variant {
  name: string;
  /** Whether mirroring this composition left↔right is allowed. */
  mirrorable: boolean;
  /** Force a colour mode from the grammar (e.g. signage always wants the signal ground). */
  colorMode?: string;
  build: (c: Composer, content: PosterContent) => void;
}

const shapes = (c: Composer) => c.grammar.motifs.shapes as ShapeName[];
const metaLine = (content: PosterContent) => `${content.date}\n${content.venue}`;
const seriesLine = (content: PosterContent) => `${content.seriesLabel}\n${content.issue}`;

// ─── Typography-dominant ────────────────────────────────────────────────────

const typographic: Variant[] = [
  {
    // Headline set huge from the top edge, information band below a rule.
    name: 'stack',
    mirrorable: false,
    build(c, k) {
      const rows = c.rng.pick([5, 6]);
      c.text('display', k.headline, area(0, 0, 6, rows), { vAlign: 'top', maxLines: 5, minSize: 70 });
      c.ruleAbove(rows, 0, 6);
      c.text('deck', k.deck, area(0, rows, 4, 7 - rows), { vAlign: 'top' });
      c.shape(c.rng.pick(['circle', 'quarter', 'half'] as ShapeName[]), area(5, 6, 1, 1));
      c.text('meta', seriesLine(k), area(0, 7, 2, 1), { vAlign: 'bottom' });
      c.text('meta', metaLine(k), area(2, 7, 3, 1), { vAlign: 'bottom' });
    },
  },
  {
    // Information at the top, a field of space, headline anchored to the bottom margin.
    name: 'anchor',
    mirrorable: true,
    build(c, k) {
      c.text('meta', seriesLine(k), area(0, 0, 2, 1));
      c.text('meta', metaLine(k), area(2, 0, 2, 1));
      c.shape(c.rng.pick(shapes(c)), area(4, 0, 2, 2));
      c.text('deck', k.deck, area(0, 1, 3, 2), { vAlign: 'top' });
      c.text('display', k.headline, area(0, 3, 6, 5), { vAlign: 'bottom', maxLines: 5, minSize: 62 });
    },
  },
  {
    // Headline in a wide column, a narrow reading column separated by a vertical rule.
    name: 'split',
    mirrorable: true,
    build(c, k) {
      c.text('display', k.headline, area(0, 0, 4, 6), { vAlign: 'top', maxLines: 6, minSize: 56 });
      c.ruleLeftOf(4, 0, 8);
      c.text('meta', seriesLine(k), area(4, 0, 2, 1));
      c.text('deck', k.deck, area(4, 1, 2, 2), { vAlign: 'top' });
      c.text('body', k.body, area(4, 3, 2, 3), { vAlign: 'top' });
      c.text('meta', metaLine(k), area(4, 7, 2, 1), { vAlign: 'bottom' });
      c.shape(c.rng.pick(['dots', 'bars', 'arcs'] as ShapeName[]), area(0, 7, 1, 1));
    },
  },
  {
    // A giant issue numeral is the image; the headline sits beneath it.
    name: 'numeral',
    mirrorable: false,
    build(c, k) {
      c.text('numeral', k.issue.replace(/\D/g, ''), area(0, 0, 6, 4), { vAlign: 'top', color: c.colors.accent });
      c.text('display', k.headline, area(0, 4, 5, 3), { vAlign: 'bottom', maxLines: 4, maxSize: 110 });
      c.ruleAbove(7, 0, 6);
      c.text('meta', seriesLine(k), area(0, 7, 2, 1));
      c.text('meta', metaLine(k), area(2, 7, 2, 1));
      c.text('meta', k.deck, area(4, 7, 2, 1));
    },
  },
];

// ─── Image-dominant ─────────────────────────────────────────────────────────

const image: Variant[] = [
  {
    // Full-bleed image with the type set on a solid panel bleeding off the corner.
    name: 'fullbleed',
    mirrorable: true,
    build(c, k) {
      const pad = c.grid.spec.rowGutter * 2;
      c.image(area(0, 0, 6, 8), { bleed: { top: true, right: true, bottom: true, left: true } });
      c.panel(area(0, 4, 4, 4), c.colors.background, { left: true, bottom: true }, pad);
      c.text('meta', seriesLine(k), area(0, 4, 4, 1));
      c.text('display', k.headline, area(0, 4, 4, 3), { vAlign: 'bottom', maxLines: 4, inset: { top: 36 } });
      c.text('meta', metaLine(k), area(0, 7, 2, 1), { vAlign: 'bottom' });
      c.text('meta', k.deck, area(2, 7, 2, 1), { vAlign: 'bottom' });
    },
  },
  {
    // Framed image inside the margins; type set in the lower third.
    name: 'framed',
    mirrorable: false,
    build(c, k) {
      c.text('meta', seriesLine(k), area(0, 0, 2, 1));
      c.text('meta', metaLine(k), area(2, 0, 2, 1));
      c.image(area(0, 1, 6, 4));
      c.text('display', k.headline, area(0, 5, 6, 2), { vAlign: 'top', maxLines: 3 });
      c.text('deck', k.deck, area(0, 7, 4, 1), { vAlign: 'bottom' });
      c.shape(c.rng.pick(['circle', 'quarter', 'half'] as ShapeName[]), area(5, 7, 1, 1));
    },
  },
  {
    // Image bleeds off one half; text column on the other.
    name: 'halfbleed',
    mirrorable: true,
    build(c, k) {
      const span = c.rng.pick([3, 4]);
      c.image(area(6 - span, 0, span, 8), { bleed: { top: true, right: true, bottom: true } });
      const tw = 6 - span;
      c.text('meta', seriesLine(k), area(0, 0, tw, 1));
      c.text('display', k.headline, area(0, 1, tw, 4), { vAlign: 'top', maxLines: 6 });
      c.text('body', k.body, area(0, 5, tw, 2), { vAlign: 'bottom' });
      c.ruleAbove(7, 0, tw);
      c.text('meta', metaLine(k), area(0, 7, tw, 1), { vAlign: 'bottom' });
    },
  },
  {
    // Image cropped to a circle — image and geometric motif in one.
    name: 'orb',
    mirrorable: true,
    build(c, k) {
      c.text('meta', seriesLine(k), area(0, 0, 1, 2));
      c.image(area(1, 0, 5, 5), { mask: 'circle' });
      c.text('display', k.headline, area(0, 5, 6, 2), { vAlign: 'bottom', maxLines: 3 });
      c.ruleAbove(7, 0, 6);
      c.text('meta', metaLine(k), area(0, 7, 3, 1));
      c.text('meta', k.deck, area(3, 7, 3, 1));
    },
  },
];

// ─── Asymmetric editorial ───────────────────────────────────────────────────

const editorial: Variant[] = [
  {
    // Narrow margin column for metadata; headline and an offset image hang from it.
    name: 'column',
    mirrorable: true,
    build(c, k) {
      c.text('meta', seriesLine(k), area(0, 0, 1, 2));
      c.text('meta', metaLine(k), area(0, 6, 1, 2), { vAlign: 'bottom' });
      c.ruleLeftOf(1, 0, 8);
      c.text('display', k.headline, area(1, 0, 5, 3), { vAlign: 'top', maxLines: 4, maxSize: 124 });
      c.image(area(2, 3, 4, 3));
      c.text('deck', k.deck, area(1, 6, 2, 2), { vAlign: 'top' });
      c.text('body', k.body, area(3, 6, 3, 2), { vAlign: 'top' });
    },
  },
  {
    // Magazine opener: headline mid-height, a rule, then deck / body / image in three columns.
    name: 'article',
    mirrorable: true,
    build(c, k) {
      c.text('meta', seriesLine(k), area(0, 0, 4, 1));
      c.shape(c.rng.pick(shapes(c)), area(4, 0, 2, 2));
      c.text('display', k.headline, area(0, 1, 4, 3), { vAlign: 'bottom', maxLines: 4, maxSize: 110 });
      c.ruleAbove(4, 0, 6);
      c.text('deck', k.deck, area(0, 4, 2, 3), { vAlign: 'top' });
      c.text('body', k.body, area(2, 4, 2, 3), { vAlign: 'top' });
      c.image(area(4, 4, 2, 3));
      c.text('meta', metaLine(k), area(0, 7, 2, 1), { vAlign: 'bottom' });
    },
  },
  {
    // Small image pushed into the upper corner, big headline below, text split along a rule.
    name: 'offset',
    mirrorable: true,
    build(c, k) {
      c.text('meta', seriesLine(k), area(0, 0, 3, 1));
      c.text('meta', metaLine(k), area(0, 1, 3, 1));
      c.image(area(3, 0, 3, 3), { bleed: { top: true, right: true } });
      c.text('display', k.headline, area(0, 3, 6, 4), { vAlign: 'bottom', maxLines: 4 });
      c.ruleAbove(7, 0, 6);
      c.text('deck', k.deck, area(0, 7, 3, 1), { vAlign: 'top' });
      c.text('body', k.body, area(3, 7, 3, 1), { vAlign: 'top' });
    },
  },
];

/** Every strategy the engine knows. A grammar's `strategies` list picks which ones it uses. */
export const STRATEGIES: Record<string, Variant[]> = { typographic, image, editorial, ...INDUSTRIAL };
