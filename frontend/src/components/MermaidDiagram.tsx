import { useEffect, useRef, useState } from 'react';
import {
  renderMermaidToSvg,
  svgToSvgBlob,
  svgToPngBlob,
  downloadBlob,
} from '../lib/mermaid';

interface Props {
  source: string;
  title?: string;
  slug: string;
}

export default function MermaidDiagram({ source, title, slug }: Props) {
  const svgRef = useRef<HTMLDivElement>(null);
  const [svgString, setSvgString] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setShowSource(false);
    setZoom(1);
    setSvgString(null);
    setSize(null);
    if (!source) return;

    renderMermaidToSvg(source)
      .then((svg) => {
        if (!cancelled) setSvgString(svg);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to render diagram');
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    const svg = svgRef.current?.querySelector('svg');
    if (svg) {
      const rect = svg.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    }
  }, [svgString]);

  async function handleExport(kind: 'svg' | 'png') {
    if (busy) return;
    setBusy(true);
    try {
      const svg = svgString || (await renderMermaidToSvg(source));
      if (kind === 'svg') downloadBlob(svgToSvgBlob(svg), `${slug}.svg`);
      else downloadBlob(await svgToPngBlob(svg), `${slug}.png`);
    } catch (err) {
      setError((err as Error).message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-hairline bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-paper/50 px-3 py-2">
        {title && (
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
            {title}
          </span>
        )}
        <div className="flex items-center gap-1 font-mono text-xs text-faint">
          {!error && !showSource && svgString && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="px-1.5 py-0.5 hover:text-ink"
                title="Zoom out"
              >
                −
              </button>
              <span className="w-8 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="px-1.5 py-0.5 hover:text-ink"
                title="Zoom in"
              >
                +
              </button>
              <button
                onClick={() => setZoom(1)}
                className="px-1.5 py-0.5 hover:text-ink"
                title="Reset zoom"
              >
                reset
              </button>
            </>
          )}
          <span className="mx-1 text-hairline-strong">/</span>
          <button
            onClick={() => setShowSource(!showSource)}
            className="px-1.5 py-0.5 hover:text-ink"
          >
            {showSource ? 'diagram' : 'source'}
          </button>
          {!error && (
            <>
              <span className="mx-1 text-hairline-strong">/</span>
              <button
                onClick={() => handleExport('svg')}
                disabled={busy}
                className="px-1.5 py-0.5 hover:text-ink disabled:opacity-40"
              >
                svg
              </button>
              <button
                onClick={() => handleExport('png')}
                disabled={busy}
                className="px-1.5 py-0.5 hover:text-ink disabled:opacity-40"
              >
                png
              </button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="p-4 text-xs text-red-700">{error}</div>
      ) : showSource ? (
        <pre className="max-h-72 overflow-auto whitespace-pre bg-paper p-4 font-mono text-xs text-ink-soft">
          {source}
        </pre>
      ) : !svgString ? (
        <div className="p-4 text-center font-mono text-xs text-faint">rendering…</div>
      ) : (
        <div className="overflow-auto p-4" style={{ maxHeight: 520 }}>
          <div
            style={{
              width: size ? size.w * zoom : '100%',
              height: size ? size.h * zoom : undefined,
            }}
          >
            <div
              ref={svgRef}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              dangerouslySetInnerHTML={{ __html: svgString }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
