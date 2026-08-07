import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const inputBase = 'sheet-input';

export function TextField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">
          {label}
        </span>
        {hint && <span className="font-mono text-[11px] text-faint">{hint}</span>}
      </span>
      <input {...props} className={inputBase} />
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">
          {label}
        </span>
        {hint && <span className="font-mono text-[11px] text-faint">{hint}</span>}
      </span>
      <textarea {...props} className={`${inputBase} resize-none`} />
    </label>
  );
}
