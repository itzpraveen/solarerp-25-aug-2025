'use client';
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/70"
        onClick={onClose}
      />
      {/* Modal content */}
      <div
        className={[
          'relative w-full max-w-md rounded-xl',
          'border border-[var(--border-default)] bg-[var(--bg-surface)]',
          'shadow-[var(--shadow-lg)]',
          'animate-in fade-in-0 zoom-in-95 duration-200',
        ].join(' ')}
      >
        {title && (
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
