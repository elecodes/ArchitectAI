import type { CSSProperties, ReactNode } from 'react';

function Corner({ style }: { style: CSSProperties }) {
  return (
    <span aria-hidden style={style} className="pointer-events-none absolute z-10 h-3 w-3">
      <svg viewBox="0 0 12 12" className="h-full w-full text-hairline-strong" fill="none">
        <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1" />
        <circle cx="6" cy="6" r="1.4" stroke="currentColor" />
      </svg>
    </span>
  );
}

const corners: CSSProperties[] = [
  { top: -6, left: -6 },
  { top: -6, right: -6 },
  { bottom: -6, left: -6 },
  { bottom: -6, right: -6 },
];

export default function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative border border-hairline bg-white ${className ?? ''}`}>
      {corners.map((style, i) => (
        <Corner key={i} style={style} />
      ))}
      {children}
    </div>
  );
}
