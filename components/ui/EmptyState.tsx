import { ReactNode } from 'react';

export default function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-600">
      <div className="text-base font-medium text-gray-800">{title}</div>
      {description && <div className="mt-1 max-w-md">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

