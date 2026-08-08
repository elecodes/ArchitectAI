import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  fontFamily: 'ui-monospace, monospace',
});

interface Props {
  source: string;
  title?: string;
}

export default function MermaidDiagram({ source, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSource, setShowSource] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !source) return;

    const id = `mermaid-${Math.random().toString(36).slice(2)}`;

    mermaid
      .render(id, source)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to render diagram');
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      });
  }, [source]);

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
          <span className="text-xs font-medium text-slate-600">{title}</span>
          <button
            onClick={() => setShowSource(!showSource)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {showSource ? 'Diagram' : 'Source'}
          </button>
        </div>
      )}
      {error ? (
        <div className="p-3 text-xs text-red-600">{error}</div>
      ) : showSource ? (
        <pre className="p-3 text-xs font-mono text-slate-600 bg-slate-50 overflow-auto max-h-64">
          {source}
        </pre>
      ) : (
        <div ref={containerRef} className="p-4 flex justify-center overflow-auto" />
      )}
    </div>
  );
}
