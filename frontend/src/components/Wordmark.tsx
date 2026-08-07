type WordmarkProps = {
  size?: 'sm' | 'lg';
  className?: string;
};

export default function Wordmark({ size = 'sm', className }: WordmarkProps) {
  const text = size === 'lg' ? 'text-3xl' : 'text-xl';
  const mark = size === 'lg' ? 'h-7 w-7' : 'h-6 w-6';
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <svg viewBox="0 0 24 24" className={`${mark} text-accent`} fill="none" aria-hidden>
        <path
          d="M12 2.75 21.5 19.25h-19L12 2.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8.25 12h7.5M12 8.25v7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className={`font-sans font-semibold tracking-tight text-ink ${text}`}>
        architect<span className="font-mono font-medium text-accent">ai</span>
      </span>
    </span>
  );
}
