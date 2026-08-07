export default function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-xs uppercase tracking-[0.2em] text-faint ${className ?? ''}`}
    >
      {children}
    </span>
  );
}
