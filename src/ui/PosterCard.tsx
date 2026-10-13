import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import p5 from 'p5';
import type { Grid } from '../engine/grid';
import type { PosterLayout } from '../engine/types';
import { drawPoster } from '../render/p5Renderer';

export interface PosterHandle {
  exportPng: (filename?: string) => void;
}

interface Props {
  index: number;
  layout: PosterLayout;
  grid: Grid;
  showGrid: boolean;
  onRegenerate: () => void;
}

export const PosterCard = forwardRef<PosterHandle, Props>(function PosterCard({ index, layout, grid, showGrid, onRegenerate }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<p5 | null>(null);

  useEffect(() => {
    // Each p5 instance gets its own container. p5 2.x runs setup asynchronously, so a canvas
    // can appear after remove() under StrictMode; detaching the container makes that harmless.
    const host = document.createElement('div');
    hostRef.current!.appendChild(host);
    const instance = new p5((p: p5) => {
      p.setup = () => {
        p.createCanvas(layout.width, layout.height);
        p.pixelDensity(2); // export at 2× (1200 × 1696 for the default grammar)
        p.noLoop();
      };
      p.draw = () => drawPoster(p, layout, { showGrid, grid });
    }, host);
    sketchRef.current = instance;
    return () => {
      instance.remove();
      host.remove();
      sketchRef.current = null;
    };
  }, [layout, grid, showGrid]);

  const fileName = `${layout.grammarId}-${String(index + 1).padStart(2, '0')}-${layout.strategy}-${layout.variant}-${layout.seed}`;
  useImperativeHandle(ref, () => ({ exportPng: (name = fileName) => sketchRef.current?.saveCanvas(name, 'png') }), [fileName]);

  const d = layout.diagnostics;
  return (
    <figure className="card">
      <div className="poster" ref={hostRef} />
      <figcaption>
        <div className="caption-main">
          <span className="idx">{String(index + 1).padStart(2, '0')}</span>
          <span>
            {layout.strategy} / {layout.variant}
            {layout.mirrored ? ' ⇋' : ''}
          </span>
        </div>
        <div className="caption-meta">
          seed {layout.seed} · {layout.colors.modeId} · space {(d.negativeSpace * 100).toFixed(0)}%
        </div>
        {d.warnings.length > 0 && <div className="warn">{d.warnings.join(' · ')}</div>}
        <div className="actions">
          <button onClick={onRegenerate}>Regenerate</button>
          <button onClick={() => sketchRef.current?.saveCanvas(fileName, 'png')}>PNG</button>
        </div>
      </figcaption>
    </figure>
  );
});
