import { useEffect, useMemo, useRef, useState } from 'react';
import grammarJson from './grammar/style-grammar.json';
import { generatePoster, Grid, planBatch, type PosterRequest, type StyleGrammar } from './engine/generate';
import { loadGrammarFonts, measureText } from './render/measure';
import { PosterCard, type PosterHandle } from './ui/PosterCard';
import './App.css';

const grammar = grammarJson as StyleGrammar;
const COUNT = 10;

const randomSeed = () => Math.random().toString(36).slice(2, 8);
const initialSeed = () => new URLSearchParams(location.search).get('seed') || 'grammar01';

export default function App() {
  const [fontsReady, setFontsReady] = useState(false);
  const [seed, setSeed] = useState(initialSeed);
  const [showGrid, setShowGrid] = useState(false);
  // Per-slot overrides when a single poster is regenerated.
  const [overrides, setOverrides] = useState<Record<number, PosterRequest>>({});
  const cards = useRef<(PosterHandle | null)[]>([]);

  useEffect(() => {
    loadGrammarFonts(grammar).then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('seed', seed);
    history.replaceState(null, '', url);
  }, [seed]);

  const grid = useMemo(() => Grid.fromGrammar(grammar), []);
  const layouts = useMemo(() => {
    if (!fontsReady) return [];
    const plan = planBatch(seed, COUNT, grammar);
    return plan.map((req, i) => generatePoster(overrides[i] ?? req, grammar, measureText));
  }, [fontsReady, seed, overrides]);

  const regenerateAll = () => {
    setOverrides({});
    setSeed(randomSeed());
  };
  const regenerateOne = (i: number) => {
    const current = layouts[i];
    // Keep the slot's strategy and content, draw a fresh composition.
    const contentIndex = planBatch(seed, COUNT, grammar)[i].contentIndex;
    setOverrides((o) => ({ ...o, [i]: { seed: `${seed}-${i}-${randomSeed()}`, strategy: current.strategy, contentIndex } }));
  };
  const exportAll = async () => {
    for (const c of cards.current) {
      c?.exportPng();
      await new Promise((r) => setTimeout(r, 350));
    }
  };

  const warnings = layouts.reduce((n, l) => n + l.diagnostics.warnings.length, 0);

  return (
    <main>
      <header>
        <div className="brand">
          <h1>Design Grammar Lab</h1>
          <p>
            Phase 1 · {grammar.name} · {grid.columns}×{grid.rows} grid
          </p>
        </div>
        <div className="controls">
          <label>
            Seed
            <input
              value={seed}
              onChange={(e) => {
                setOverrides({});
                setSeed(e.target.value.trim() || 'grammar01');
              }}
              spellCheck={false}
            />
          </label>
          <button className="primary" onClick={regenerateAll}>
            Regenerate all
          </button>
          <button onClick={exportAll}>Export all PNG</button>
          <label className="toggle">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            Grid overlay
          </label>
          <span className={warnings ? 'status warn' : 'status'}>{warnings ? `${warnings} warnings` : 'All rules pass'}</span>
        </div>
      </header>

      {!fontsReady ? (
        <p className="loading">Loading fonts…</p>
      ) : (
        <section className="gallery">
          {layouts.map((layout, i) => (
            <PosterCard
              key={`${layout.seed}-${i}`}
              ref={(h) => {
                cards.current[i] = h;
              }}
              index={i}
              layout={layout}
              grid={grid}
              showGrid={showGrid}
              onRegenerate={() => regenerateOne(i)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
