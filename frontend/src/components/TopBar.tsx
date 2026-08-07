import type { ReactNode } from 'react';

export default function TopBar({
  left,
  right,
}: {
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="border-b border-hairline bg-paper">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-4">{left}</div>
        {right}
      </div>
    </header>
  );
}
