import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
      <div className="mb-2 text-gray-400 dark:text-gray-500">
        {icon || <Inbox size={28} />}
      </div>
      <div className="text-base font-medium text-gray-800 dark:text-gray-100">
        {title}
      </div>
      {description && <div className="mt-1 max-w-md">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
