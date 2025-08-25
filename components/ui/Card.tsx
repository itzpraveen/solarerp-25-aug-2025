import clsx from 'clsx';

export default function Card({ className, children, title, actions }: { className?: string; children: React.ReactNode; title?: string; actions?: React.ReactNode }) {
  return (
    <div className={clsx('rounded-lg border bg-white shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

