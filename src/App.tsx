import { useEffect, useMemo, useRef, useState } from 'react';
import { generatePoster, Grid, planBatch, type PosterRequest } from './engine/generate';
import { GRAMMARS, grammarById } from './grammar';
import { loadGrammarFonts, measureText } from './render/measure';
import { PosterCard, type PosterHandle } from './ui/PosterCard';
import './App.css';

const COUNT = 10;

const randomSeed = () => Math.random().toString(36).slice(2, 8);
const params = new URLSearchParams(location.search);

export default function App() {
  const [fontsReady, setFontsReady] = useState(false);
  const [styleId, setStyleId] = useState(() => grammarById(params.get('style')).id);
  const [seed, setSeed] = useState(() => params.get('seed') || 'grammar01');
  const [showGrid, setShowGrid] = useState(false);
  // Per-slot overrides when a single poster is regenerated.
  const [overrides, setOverrides] = useState<Record<number, PosterRequest>>({});
  const cards = useRef<(PosterHandle | null)[]>([]);

  const grammar = useMemo(() => grammarById(styleId), [styleId]);

  useEffect(() => {
    Promise.all(GRAMMARS.map(loadGrammarFonts)).then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('style', styleId);
    url.searchParams.set('seed', seed);
    history.replaceState(null, '', url);
  }, [seed, styleId]);

  const grid = useMemo(() => Grid.fromGrammar(grammar), [grammar]);
  const layouts = useMemo(() => {
    if (!fontsReady) return [];
    const plan = planBatch(seed, COUNT, grammar);
    return plan.map((req, i) => generatePoster(overrides[i] ?? req, grammar, measureText));
  }, [fontsReady, seed, overrides, grammar]);

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
            {grammar.name} · {grid.columns}×{grid.rows} grid · {grammar.strategies.join(' / ')}
          </p>
        </div>
        <div className="controls">
          <label>
            Style
            <select
              value={styleId}
              onChange={(e) => {
                setOverrides({});
                setStyleId(e.target.value);
              }}
            >
              {GRAMMARS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
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
              key={`${grammar.id}-${layout.seed}-${i}`}
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
