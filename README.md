# Design Grammar Lab — Phase 1

A generative poster engine. A **Style Grammar** (JSON) defines a visual language. A deterministic engine turns `seed + grammar` into a layout model, and p5.js draws it. Swapping the grammar swaps the whole style — same engine.

**Swiss Lecture Series** — hand-written grammar

![Swiss Lecture Series batch](docs/swiss-lecture-preview.png)

**Neo-Industrial** — grammar extracted by hand from a reference studio's work (rules only; all marks and content are original)

![Neo-Industrial batch](docs/neo-industrial-preview.png)

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (?style=neo-industrial&seed=anything)
npm run build      # type-check + production build
```

In the gallery:

- **Style** switches between grammars.
- **Regenerate all** creates a new batch seed. The seed field and the `?seed=` URL make any batch reproducible.
- **Regenerate** on a card draws a fresh composition for that slot. It keeps the slot's strategy and content.
- **PNG** exports one poster at 1200×1696. **Export all PNG** downloads all ten.
- **Grid overlay** shows the modules and each text block's ink bounds. Bounds are blue when they pass and red when the validator flags them.

## Where the design rules live

| File | Controls |
|---|---|
| `src/grammar/*.json` | **All design tokens, one file per style.** Canvas, grid, palette and colour modes, type roles (family, weight, size scale, leading, tracking), hierarchy ratios, surface (grain, scanlines), motifs, rule thresholds, which strategies to use, and content. `neo-industrial.json` also records the observations it was extracted from. |
| `src/grammar/index.ts` | The list of available grammars. |
| `src/engine/types.ts` | The grammar schema (`StyleGrammar`) — the target format for Phase 2's automatic extraction. |
| `src/engine/layouts.ts` | **Swiss compositions.** typographic, image, editorial (6×8 grid). |
| `src/engine/layouts-industrial.ts` | **Industrial compositions.** dossier, console, signage (8×10 grid). |
| `src/engine/composer.ts` | Placement rules. Grid snapping, mirroring, bleeds, gutter rules, type hierarchy, status tags, spec tables, frames, hazard stripes, grid texture. |
| `src/engine/text.ts` | Overflow prevention. Picks the largest size on the role's scale that fits the box, and truncates with an ellipsis only as a flagged last resort. |
| `src/engine/validate.ts` | Checks after layout. Truncation, out-of-bounds text, text overlap, hierarchy ratios, and negative space. |
| `src/engine/grid.ts`, `random.ts`, `generate.ts` | Modular grid maths, the seeded RNG, and batch planning (strategies interleaved, variants rotated, content never repeated). |
| `src/render/p5Renderer.ts` | The p5 drawing of the layout model: halftone / line-screen / radar-scope images, dot-matrix, scanline and glow lettering, film grain. |
| `src/ui/`, `src/App.tsx` | The React gallery only. |

`src/engine/` has no React or p5 imports. Text measurement is injected, so a future SVG renderer or a Node renderer can reuse the engine unchanged.

## Dependency notes (Oct 2026)

- **p5 2.3.x** (LGPL-2.1) runs in instance mode. Types are bundled with the package.
- **p5.js-svg** is not used. Its latest release (1.6.0, Apr 2025) supports only p5 1.11.x. Vector export is better added later as a second renderer of the layout model.
- Fonts come from **Inter Tight**, **IBM Plex Mono**, **Chakra Petch** and **Share Tech Mono** via Fontsource (OFL). They are self-hosted, so there are no network calls.
